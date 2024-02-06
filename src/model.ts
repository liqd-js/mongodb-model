import { Collection, Document, FindOptions, Filter, WithId, ObjectId, MongoClient, OptionalUnlessRequiredId, UpdateFilter, UpdateOptions, MongoClientOptions, Sort } from 'mongodb';
import { flowStart, flowGet, LOG, DUMP, Benchmark } from './helpers';
import { addPrefixToFilter, addPrefixToUpdate, projectionToProject, isUpdateOperator, getCursor, resolveBSONObject, generateCursorCondition, reverseSort, sortProjection, collectAddedFields } from './helpers/mongo';
import Cache from './helpers/cache';
import { ModelError, ModelConverterError } from './helpers/errors';
const Aggregator = require('@liqd-js/aggregator');

const isSet = ( value: any ): boolean => value !== undefined && value !== null && ( Array.isArray( value ) ? value.length > 0 : ( typeof value === 'object' ? Object.keys( value ).length > 0 : true ));

export * from 'mongodb';
export * from './helpers';
export { flowStart as _ };

type CreateOptions = { duplicateIgnore?: boolean };

type MongoRootDocument = Document & { _id: any };
type MongoPropertyDocument = Document & { id: any };

export type PropertyFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { $root?: Filter<RootDBE> };
export type ListOptions<DBE extends Document> = FindOptions<DBE> & { filter? : Filter<DBE>, cursor?: string, pipeline?: Document[]};
export type PropertyListOptions<RootDBE extends Document, DBE extends Document> = Omit<FindOptions<DBE>, 'projection'> & 
{
    filter? : PropertyFilter<RootDBE, DBE>
    cursor?: string
    projection? : FindOptions<DBE>['projection'] & { $root?: FindOptions<RootDBE>['projection'] },
    pipeline?: Document[]
};

export type AggregateOptions<DBE extends Document> =
{
    filter? : Filter<DBE>
    projection? : FindOptions<DBE>['projection']
};
export type PropertyAggregateOptions<RootDBE extends Document, DBE extends Document> =
{
    filter? : PropertyFilter<RootDBE, DBE>
    projection? : FindOptions<DBE & { $root: RootDBE }>['projection']
};

export type AbstractConverter<DBE extends Document> = ( dbe: DBE ) => unknown | Promise<unknown>;

export type AbstractConverterOptions<DBE extends Document> =
{
    converter: AbstractConverter<DBE>,
    projection?: FindOptions<DBE>['projection'],
    cache?: { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
}

export type AbstractConverters<DBE extends Document> = 
{
    dto: AbstractConverterOptions<DBE>,
    [key: string]: AbstractConverterOptions<DBE>
}

async function convert<DBE extends Document>( model: object, converter: AbstractConverter<DBE>, dbe: DBE, conversion: string | number | symbol )
{
    try
    {
        return await converter( dbe );
    }
    catch( e )
    {
        if( e instanceof ModelConverterError )
        {
            throw e;
        }

        throw new ModelConverterError( model, conversion.toString(), dbe._id ?? dbe.id, e as Error );
    }
}

export abstract class AbstractModel<DBE extends MongoRootDocument, DTO extends Document, Converters extends AbstractConverters<DBE>>
{
    private abstractFindAggregator;

    protected constructor( public collection: Collection<DBE>, public converters: Converters )
    {
        this.abstractFindAggregator = new Aggregator( async( ids: Array<DTO['id']>, conversion: keyof Converters ) =>
        {
            try
            {
                let perf = new Benchmark();

                const { converter, projection } = this.converters[conversion];

                flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find aggregator (${ids.length})`);

                const entries = await this.collection.find({ _id: { $in: ids.map( id => this.dbeID( id ))}}, { projection }).toArray();

                let find = perf.step();

                // TODO bezpecnostna habadura
                //const index = entries.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe._id ?? dbe.id ), convert( this, converter, dbe as DBE, conversion )), i ), new Map());
                const index = entries.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe._id ?? dbe.id ), dbe ), i ), new Map());
                const result = await Promise.all( ids.map( id => index.get( id ) ?? null ));

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

    private async pipeline( options: AggregateOptions<DBE> ): Promise<Document[]>
    {
        const { filter, projection } = options;

        let pipeline: Document[] = [];

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: resolveBSONObject( accessFilter! )});
        }

        isSet( filter ) && pipeline.push({ $match: resolveBSONObject( filter! )});
        isSet( projection ) && pipeline.push({ $project: projectionToProject( projection )});

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): DBE['_id']{ return dtoID as DBE['_id']; }
    public dtoID( dbeID: DBE['_id'] ): DTO['id']{ return dbeID as DTO['id']; }

    public async create( dbe: Omit<DBE, '_id'>, id?: DTO['id'], options?: CreateOptions ): Promise<DTO['id']>
    {
        const _id: DTO['id'] = id ?? await this.id();

        try
        {
            await this.collection.insertOne({ ...dbe, _id: this.dbeID( _id ) } as OptionalUnlessRequiredId<DBE> );
        }
        catch( e: any )
        {
            if( options?.duplicateIgnore === true && e.code === 11000 )
            {
                return this.dtoID( await this.collection.findOne( e.keyValue, { projection: { _id: 1 }}).then( r => r?._id ));
            }

            throw e;
        }

        return _id;
    }

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<void>
    {
        await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, isUpdateOperator( update ) ? update : { $set: update } as UpdateFilter<DBE> );
    }

    public async get( id: DTO['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: DTO['id'][] ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | Array<DTO['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        const { converter, projection } = this.converters[conversion];

        if( !Array.isArray( id ))
        {
            const entry = await this.abstractFindAggregator.call( id, conversion ) as DBE | null;

            return entry ? convert( this, converter, entry as DBE, conversion ) : null;
        }

        let entries: any = await this.abstractFindAggregator.call( id, conversion ) as Array<Awaited<ReturnType<Converters[K]['converter']>> | null>;

        entries = await Promise.all( entries.map(( entry: any ) => entry ? convert( this, converter, entry as DBE, conversion ) : null ));
        
        return filtered ? entries.filter( Boolean ) : entries;
    }

    public async find<K extends keyof Converters>( filter: Filter<DBE>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne( resolveBSONObject( filter ), { projection, sort });

        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>( list: ListOptions<DBE>, conversion: K = 'dto' as K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> & { $cursor?: string }>>
    {
        const { converter, projection, cache } = this.converters[conversion];
        let { filter = {}, sort = { _id: 1 }, cursor, limit, ...options } = list;
        let prev = cursor?.startsWith('prev:'), last = true;

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            filter =  isSet( filter ) ? { $and: [ filter, accessFilter ]} : accessFilter;
        }

        cursor && ( filter = { $and: [ filter, generateCursorCondition( cursor, sort )]});

        flowGet( 'log' ) && LOG( filter );
        let perf = new Benchmark();

        flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} list`);

        if( accessFilter )
        {
            LOG( this.constructor.name, { filter });
        }

        //TODO options nepojdu pri aggregatione
 
        let entries: WithId<DBE>[] = [];
        
        if( !isSet( list.pipeline ))
        {
            entries = await this.collection.find( resolveBSONObject( filter ), { projection: cache?.list ? sortProjection( sort, '_id' ) : projection, limit: limit ? limit + 1 : limit, sort: prev ? reverseSort( sort ) : sort, ...options }).toArray();
        }
        else if( list.pipeline ) // toto je vzdy troubo
        {
            let pipka = [];

            if( isSet(filter) ){ pipka.push({ $match: resolveBSONObject( filter )})}
            if( cache?.list || projection ){ pipka.push({ $project: cache?.list ? sortProjection( sort, '_id' ) : projection })}

            pipka.push( ...list.pipeline.map( resolveBSONObject ));

            if( isSet( collectAddedFields( list.pipeline ))){ pipka.push({ $unset: collectAddedFields( list.pipeline )})}

            if( isSet( sort )){ pipka.push({ $sort: prev ? reverseSort( sort ) : sort }) }
            if( limit ){ pipka.push({ $limit: limit + 1 }) }

            entries = await this.collection.aggregate( pipka ).toArray() as WithId<DBE>[];
        }

        let find = perf.step();

        ( !( last = limit ? entries.length <= limit : true )) && entries.pop();
        prev && entries.reverse();

        if( cache?.list )
        {
            flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} entries `, entries );
        }

        // TODO vytiahnut cez projection len _idcka, sort stlpce a potom dotiahnut data cez get aby sa pouzila cache

        const result = await Promise.all( entries.map( async( dbe, i ) => 
        {
            const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Converters[K]['converter']> & { $cursor?: string };

            if(( limit && ( i > 0 || ( cursor && ( !prev || !last ))) && !( last && !prev && i === entries.length - 1 )))
            {
                dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
            }

            return dto;
        }));

        let convetor = perf.step();

        flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} list in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );

        return result;
    }

    public async aggregate<T>( pipeline: Document[], options?: AggregateOptions<DBE> ): Promise<T[]>
    {
        const aggregationPipeline = isSet( options ) ? [ ...await this.pipeline( options! ), ...( resolveBSONObject( pipeline ) as Document[] ) ] : resolveBSONObject( pipeline ) as Document[];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline ).toArray() as Promise<T[]>;
    }

    public async count( pipeline: Document[], options?: AggregateOptions<DBE> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<Filter<DBE> | void>{}

    public async delete( id: DTO['id'] ): Promise<Boolean>
    {
        return ( await this.collection.deleteOne({ _id: this.dbeID( id ) as WithId<DBE>['_id'] })).deletedCount === 1;
    }
}

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
    private async pipeline( list: PropertyListOptions<RootDBE, DBE> = {} ): Promise<Document[]>
    {
        const { filter = {} as PropertyFilter<RootDBE, DBE>, ...options } = list;

        let pipeline:  Document[] = [], prefix = '$';

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: addPrefixToFilter( accessFilter, this.prefix ) });
        }

        let $match = resolveBSONObject( addPrefixToFilter( filter, this.prefix ));

        isSet( $match ) && pipeline.push({ $match });

        for( let path of this.paths )
        {
            if( path.array )
            {
                //pipeline.push({ $unwind: { path: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + path.path }});
                pipeline.push({ $unwind: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + path.path });
                isSet( $match ) && pipeline.push({ $match });
            }
        }

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

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<void>
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

        let status = await this.collection.updateOne({[ path ]: this.dbeID( id )} as Filter<RootDBE>, isUpdateOperator( operations ) ? operations : { $set: operations } as UpdateFilter<RootDBE>, options );

        flowGet( 'log' ) && LOG({ status });
    }

    public async get( id: DTO['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: DTO['id'][] ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | Array<DTO['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        const { converter, projection } = this.converters[conversion];

        if( !Array.isArray( id ))
        {
            const entry = await this.abstractFindAggregator.call( id, conversion ) as DBE | null;

            return entry ? convert( this, converter, entry as DBE, conversion ) : null;
        }

        let entries: any = await this.abstractFindAggregator.call( id, conversion ) as Array<Awaited<DBE|null>>;

        entries = await Promise.all( entries.map(( entry: any ) => entry ? convert( this, converter, entry as DBE, conversion ) : null ));
        
        return filtered ? entries.filter( Boolean ) : entries;
    }

    public async find<K extends keyof Converters>( filter: PropertyFilter<RootDBE,DBE>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        let cursor = this.collection.aggregate( await this.pipeline({ filter, projection }));

        if( sort ){ cursor = cursor.sort( sort )}

        const dbe = ( await cursor.limit(1).toArray())[0];
        
        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>( list: PropertyListOptions<RootDBE, DBE>, conversion: K = 'dto' as K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>
    {
        const { converter, projection } = this.converters[conversion];
        //let { filter: propertyFilter = {}, sort = { _id: 1 }, cursor, limit, ...options } = list;
        //let { $root, }

        const pipeline = this.pipeline({ ...resolveBSONObject( list ), projection });

        let perf = new Benchmark();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list` );

        let entries = await this.collection.aggregate( await pipeline ).toArray();

        let find = perf.step();

        const result = Promise.all( entries.map( dbe => convert( this, converter, dbe as DBE, conversion ) as ReturnType<Converters[K]['converter']> ));

        let convetor = perf.step();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );

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

    public async aggregate<T>( pipeline: Document[], options?: PropertyAggregateOptions<RootDBE,DBE> ): Promise<T[]>
    {
        const aggregationPipeline = [ ...await this.pipeline( options! ), ...( resolveBSONObject( pipeline ) as Document[] ) ];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline ).toArray() as Promise<T[]>;

        /* WHY THE HELL WAS IT LIKE THAT
        
        flowGet( 'log' ) && DUMP( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline );

        return this.collection.aggregate( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline ).toArray() as Promise<T[]>;*/
    }

    public async count( pipeline: Document[], options?: PropertyAggregateOptions<RootDBE,DBE> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<PropertyFilter<RootDBE,DBE> | void>{}
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