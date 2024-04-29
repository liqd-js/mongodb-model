import {Collection, Document, Filter, FindOptions, MongoClient, MongoClientOptions, ObjectId, UpdateFilter, UpdateOptions} from "mongodb";
import {addPrefixToFilter, addPrefixToUpdate, Arr, Benchmark, collectAddedFields, DUMP, flowGet, flowSet, flowStart, isUpdateOperator, LOG, projectionToProject, resolveBSONObject} from "./helpers";
import {ModelError} from "./helpers/errors";
import Cache from "./helpers/cache";
import {Aggregator, convert} from "./model"
import {AbstractConverters, MongoRootDocument, PropertyModelAggregateOptions, PropertyModelFilter, PropertyModelListOptions, WithTotal} from "./types";
import {isSet} from "node:util/types";

type MongoPropertyDocument = Document & { id: any };

export abstract class AbstractPropertyModel<RootDBE extends MongoRootDocument, DBE extends MongoPropertyDocument, DTO extends Document, Converters extends AbstractConverters<DBE>>
{
    private abstractFindAggregator;
    private paths;
    private prefix;

    protected constructor( public collection: Collection<RootDBE>, private path: string, public converters: Converters )
    {
        this.paths = [...path.matchAll(/[^\[\]]+(\[\])?/g)].map( m => ({ path: m[0].replace(/^\./,'').replace(/\[\]$/,''), array: m[0].endsWith('[]')}));
        this.prefix = this.paths.map( p => p.path ).join('.');

        this.abstractFindAggregator = new Aggregator( async( ids: Array<DTO['id']>, conversion: keyof Converters ) =>
        {
            try
            {
                let perf = new Benchmark();

                const { converter, projection } = this.converters[conversion];

                flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find aggregator (${ids.length})` );

                const entries = await this.collection.aggregate( await this.pipeline({ filter: { id: { $in: ids.map( id => this.dbeID( id ))}}, projection })).toArray();

                let find = perf.step();

                //const index = entries.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe.id ?? dbe._id ), convert( this, converter, dbe as DBE, conversion )), i ), new Map());
                const index = entries.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe.id ?? dbe._id ), dbe as DBE ), i ), new Map());

                const result = Promise.all( ids.map( id => index.get( id ) ?? null ));

                /*for( let i = 0; i < ids.length; ++i )
                {
                    this.models.set( ids[i], result[i] );
                }*/

                let convetor = perf.step();

                flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );

                return result;
            }
            catch( e )
            {
                if( e instanceof ModelError )
                {
                    throw e;
                }

                throw new ModelError( this, e!.toString() );
            }
        });
    }

    //private pipeline( rootFilter: Filter<RootDBE>, filter: Filter<DBE>, projection?: Document ): Document[]
    protected async pipeline( list: PropertyModelListOptions<RootDBE, DBE> = {} ): Promise<Document[]>
    {
        let { filter = {} as PropertyModelFilter<RootDBE, DBE>, ...options } = list;

        let pipeline:  Document[] = [], prefix = '$';

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: addPrefixToFilter( accessFilter, this.prefix ) });
        }

        let custom = list.customFilter ? await this.resolveCustomFilter( list.customFilter ) : undefined;

        if( custom?.filter )
        {
            filter = ( isSet( filter ) ? { $and: [ filter, custom.filter ]} : custom.filter ) as PropertyModelFilter<RootDBE, DBE>;
        }

        let $match = resolveBSONObject( addPrefixToFilter( filter, this.prefix ));

        //isSet( $match ) && pipeline.push({ $match });

        for( let path of this.paths )
        {
            if( path.array )
            {
                //pipeline.push({ $unwind: { path: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + path.path }});
                pipeline.push({ $unwind: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + path.path });
                //isSet( $match ) && pipeline.push({ $match });

                // matchovat veci co uz mam unwindnute postupne $root, $root.property, $root.property.property2
            }
        }

        isSet( $match ) && pipeline.push({ $match });

        //let $project: string | Filter<RootDBE> = '$' + this.prefix, $rootProject;
        let $project: string | Record<string, unknown> = '$' + this.prefix, $rootProject;

        const { $root: rootProjection, ...propertyProjection } = options.projection ?? {}; // TODO add support for '$root.property' projection

        if( isSet( propertyProjection )){ $project = addPrefixToFilter( projectionToProject({ id: 1, ...propertyProjection }), this.prefix, false )}
        if( isSet( rootProjection )){ $rootProject = typeof rootProjection === 'object' ? addPrefixToFilter( projectionToProject( rootProjection ), '$$ROOT', false ): '$$ROOT' }

        if( $rootProject )
        {
            pipeline.push
            (
                { $replaceWith: { $mergeObjects: [ $project, { _root: $rootProject }]}},
                { $replaceWith: { $setField: { field: { $literal: '$root' }, input: '$$ROOT', value: '$_root' }}},
                { $unset: '_root' }
            );
        }
        else
        {
            pipeline.push({ $replaceWith: $project });
        }

        //TODO add support for '$root.property' projection if present in pipeline

        if( custom?.pipeline )
        {
            pipeline.push( ...custom.pipeline );
        }

        if( options.pipeline )
        {
            pipeline.push( ...options.pipeline.map( resolveBSONObject ));

            if( isSet( collectAddedFields( options.pipeline )))
            {
                pipeline.push({ $unset: collectAddedFields( options.pipeline )});
            }
        }

        if( options.sort ){ pipeline.push({ $sort: options.sort }); }
        if( options.skip ){ pipeline.push({ $skip: options.skip }); }
        if( options.limit ){ pipeline.push({ $limit: options.limit }); }
        // TODO rest of operators

        if( accessFilter )
        {
            LOG( this.constructor.name, { pipeline });
        }

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): DBE['id']{ return dtoID as DBE['id']; }
    public dtoID( dbeID: DBE['id'] ): DTO['id']{ return dbeID as DTO['id']; }

    /*public async create(  parentID<> dbe: Omit<DBE, 'id'>, id?: DTO['id'] ): Promise<DTO['id']>
    {
        const _id: DTO['id'] = id ?? await this.id();



        //await this.collection.insertOne({ ...dbe, _id: this.dbeID( _id ) } as OptionalUnlessRequiredId<DBE> );

        return _id;
    }*/

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<{matchedCount: number, modifiedCount: number}>
    {
        let path = this.paths.map( p => p.path ).join('.') + '.id';
        let operations: Partial<RootDBE> | UpdateFilter<RootDBE> = {};
        let options: UpdateOptions = {};

        if( this.paths.length === 1 && !this.paths[0].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths[0].path );
        }
        if( this.paths[this.paths.length - 1].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.map( p => p.path ).join('.$[].') + '.$[entry]' );
            options = { arrayFilters: [{ 'entry.id': this.dbeID( id )}]};
        }
        else
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.slice( 0, this.paths.length - 1 ).map( p => p.path ).join('.$[].') + '.$[entry].' + this.paths[this.paths.length - 1].path );
            options = { arrayFilters: [{[ 'entry.' + this.paths[this.paths.length - 1].path + '.id' ]: this.dbeID( id )}]};
        }

        flowGet( 'log' ) && LOG({ match: {[ path ]: this.dbeID( id )}, operations, options });

        let res = await this.collection.updateOne({[ path ]: this.dbeID( id )} as Filter<RootDBE>, isUpdateOperator( operations ) ? operations : { $set: operations } as UpdateFilter<RootDBE>, options );

        flowGet('log') && LOG({res});

        return {matchedCount: res.matchedCount, modifiedCount: res.modifiedCount}
    }

    public async get( id: DTO['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: DTO['id'][] ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | Array<DTO['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        //let perf = new Benchmark();
        //let find = perf.step();
        //flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find in ${find} ms` );

        const documents = await this.abstractFindAggregator.call( Arr( id ), conversion ) as Array<DBE|null>;
        const entries = await Promise.all( documents.map( dbe => dbe ? convert( this, this.converters[conversion].converter, dbe, conversion ) : null )) as Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>;

        if( filtered ){ entries.filter( Boolean )}

        return Array.isArray( id ) ? entries : entries[0] ?? null as any;

        /*

        const { converter, projection } = this.converters[conversion];

        if( !Array.isArray( id ))
        {
            const entry = await this.abstractFindAggregator.call( id, conversion ) as DBE | null;

            return entry ? convert( this, converter, entry as DBE, conversion ) : null;
        }

        let entries: any = await this.abstractFindAggregator.call( id, conversion ) as Array<Awaited<DBE|null>>;

        entries = await Promise.all( entries.map(( entry: any ) => entry ? convert( this, converter, entry as DBE, conversion ) : null ));

        return filtered ? entries.filter( Boolean ) : entries;*/
    }

    public async find<K extends keyof Converters>(filter: PropertyModelFilter<RootDBE,DBE>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        let cursor = this.collection.aggregate( await this.pipeline({ filter, projection }));

        if( sort ){ cursor = cursor.sort( sort )}

        const dbe = ( await cursor.limit(1).toArray())[0];

        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>(list: PropertyModelListOptions<RootDBE, DBE>, conversion: K = 'dto' as K ): Promise<WithTotal<Array<Awaited<ReturnType<Converters[K]['converter']>>>>>
    {
        const { converter, projection } = this.converters[conversion];
        //let { filter: propertyFilter = {}, sort = { _id: 1 }, cursor, limit, ...options } = list;
        //let { $root, }

        const pipeline = this.pipeline({ ...resolveBSONObject( list ), projection });

        let perf = new Benchmark();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list` );

        let total = 0, entries = await this.collection.aggregate( await pipeline ).toArray();

        if( list.count )
        {
            const { cursor, ...rest } = list;
            let totalPipeline = await this.pipeline({ ...resolveBSONObject( rest ), projection });

            total = await this.collection.aggregate([ ...totalPipeline.filter( p => !['$skip','$limit'].includes(Object.keys(p)[0]) ), { $count: 'count' }]).toArray().then( r => r[0]?.count ?? 0 );
        }

        flowGet( 'log' ) && LOG( await pipeline );

        let find = perf.step();

        const result = Promise.all( entries.map( dbe => convert( this, converter, dbe as DBE, conversion ) as ReturnType<Converters[K]['converter']> ));

        let convetor = perf.step();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );

        if( list.count )
        {
            Object.defineProperty( result, 'total', { value: total ?? 0, writable: false });
        }

        return result;

        // TODO property options

        /*
        //let { filter = {}, sort = { _id: 1 }, cursor, limit, ...options } = list;
        let prev = cursor?.startsWith('prev:'), last = true;

        cursor && ( filter = { $and: [ filter, generateCursorCondition( cursor, sort )]});

        flowGet( 'log' ) && LOG( filter );

        let entries = await this.collection.find( resolveBSONObject( filter ), { projection, limit: limit ? limit + 1 : limit, sort: prev ? reverseSort( sort ) : sort, ...options }).toArray();

        ( !( last = limit ? entries.length <= limit : true )) && entries.pop();
        prev && entries.reverse();

        return Promise.all( entries.map( async( dbe, i ) =>
        {
            const dto = await converter( dbe as DBE ) as ReturnType<Converters[K]['converter']> & { $cursor?: string };

            if(( limit && ( i > 0 || ( cursor && ( !prev || !last ))) && !( last && !prev && i === entries.length - 1 )))
            {
                dto.$cursor = getCursor( dbe, sort );
            }

            return dto;
        }));*/
    }

    public async aggregate<T>( pipeline: Document[], options?: PropertyModelAggregateOptions<RootDBE,DBE> ): Promise<T[]>
    {
        const aggregationPipeline = [ ...await this.pipeline( options! ), ...( resolveBSONObject( pipeline ) as Document[] ) ];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline ).toArray() as Promise<T[]>;

        /* WHY THE HELL WAS IT LIKE THAT

        flowGet( 'log' ) && DUMP( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline );

        return this.collection.aggregate( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline ).toArray() as Promise<T[]>;*/
    }

    public async count( pipeline: Document[], options?: PropertyModelAggregateOptions<RootDBE,DBE> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<PropertyModelFilter<RootDBE,DBE> | void>{}

    protected async resolveCustomFilter( customFilter: any ): Promise<{ filter?: Filter<DBE>, pipeline: Document[] }>
    {
        throw new Error('Method not implemented.');
    }

    public scope( scope: object )
    {
        Object.entries( scope ).forEach(([ key, value ]) => flowSet( key, value ) );

        return this;
    }
}

const Clients = new Map<string, MongoClient>();

export class AbstractModels
{
    protected client: MongoClient;
    public cache = new Cache();

    protected constructor( connectionString: string, options: MongoClientOptions = {} )
    {
        if( Clients.has( connectionString ))
        {
            this.client = Clients.get( connectionString )!;
        }
        else
        {
            this.client = new MongoClient( connectionString, { minPoolSize: 0, maxPoolSize: 100, maxIdleTimeMS: 15000, compressors: [ 'snappy' ], ...options });
            this.client.connect();

            Clients.set( connectionString, this.client );
        }
    }

    public scope( callback: Function, scope: object )
    {
        flowStart( callback, scope );
    }
}