import {Collection, Document, Filter, FindOptions, ObjectId, UpdateFilter, UpdateOptions} from "mongodb";
import {addPrefixToFilter, addPrefixToUpdate, Arr, Benchmark, convert, DUMP, flowGet, flowSet, generateCursorCondition, isUpdateOperator, LOG, mergeFilters, projectionToProject, resolveBSONObject, reverseSort, splitFilterToStages} from "./helpers";
import {ModelError} from "./helpers/errors";
import {Aggregator} from "./model"
import {AbstractConverters, MongoRootDocument, PropertyModelAggregateOptions, PropertyModelFilter, PropertyModelListOptions, WithTotal} from "./types";
import {isSet} from "node:util/types";
import QueryBuilder from "./helpers/query-builder";

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
    protected async pipeline( list: PropertyModelListOptions<RootDBE, DBE> = {}, count: boolean = false ): Promise<Document[]>
    {
        let { filter = {} as PropertyModelFilter<RootDBE, DBE>, ...options } = list;
        const queryBuilder = new QueryBuilder<RootDBE>();

        let pipeline:  Document[] = [], prefix = '$';

        const accessFilter = await this.accessFilter();
        const custom = list.customFilter ? await this.resolveCustomFilter(list.customFilter) : undefined;
        const cursorFilter = list.cursor ? generateCursorCondition( list.cursor, list.sort ?? {} ) : undefined;

        const stageFilter = addPrefixToFilter( mergeFilters( filter, custom?.filter, accessFilter, cursorFilter ), this.prefix );
        const stages = splitFilterToStages( stageFilter, this.prefix ) as Filter<RootDBE>

        const subpaths = this.prefix.split('.');

        for ( let i = 0; i <= subpaths.length; i++ )
        {
            if ( i !== 0 )
            {
                pipeline.push({$unwind: prefix = (prefix === '$' ? prefix : prefix + '.') + this.paths[i - 1].path});
            }

            if ( i < subpaths.length && stages[i] && Object.keys( stages[i] ).length )
            {
                pipeline.push( ...await queryBuilder.pipeline({ filter: stages[i], cursor: list.cursor, sort: list.sort }) );
            }
            else
            {
                pipeline.push( ...await queryBuilder.pipeline({
                    filter: stages[i],
                    customFilter: {
                        filter: {},
                        pipeline: custom?.pipeline ?? []
                    },
                }));
            }
        }

        let $project: string | Record<string, unknown> = '$' + this.prefix, $rootProject;

        const {$root: rootProjection, ...propertyProjection} = options.projection ?? {}; // TODO add support for '$root.property' projection

        if (isSet(propertyProjection))
        {
            $project = addPrefixToFilter(projectionToProject({id: 1, ...propertyProjection}), this.prefix, false)
        }
        if (isSet(rootProjection))
        {
            $rootProject = typeof rootProjection === 'object' ? addPrefixToFilter(projectionToProject(rootProjection), '$$ROOT', false) : '$$ROOT'
        }

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

        const prev = list.cursor?.startsWith('prev:');

        pipeline.push( ...await queryBuilder.pipeline({
            sort: options.sort && prev ? reverseSort( options.sort ) : options.sort,
            skip: options.skip,
            limit: options.limit,
            pipeline: options.pipeline,
            projection: options.projection,
        }) );

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( id: DTO['id'] | DBE['id'] ): DBE['id']{ return id as DBE['id']; }
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

    public async get( id: DTO['id'] | DBE['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'] | DBE['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: Array<DTO['id'] | DBE['id']> ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['id']> , conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['id']>, conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['id']>, conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | DBE['id'] | Array<DTO['id'] | DBE['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
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

        const pipeline = this.pipeline({ ...resolveBSONObject( list ), projection });

        let perf = new Benchmark();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list` );

        const { cursor, sort, limit, skip, ...countOptions } = list;

        const [ entries, total ] = await Promise.all([
            this.collection.aggregate( await pipeline ).toArray(),
            list.count ? this.collection.aggregate([
                ...( await this.pipeline({ ...resolveBSONObject( countOptions ), projection }) ).filter( p => ![ '$skip', '$limit' ].includes( Object.keys(p)[0] ) ),
                { $count: 'count' }]).toArray().then( r => r[0]?.count ?? 0 ) : 0
        ])

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