import { Collection, Document, FindOptions, Filter, WithId, ObjectId, MongoClient, OptionalUnlessRequiredId, UpdateFilter } from 'mongodb';
import { flowStart, flowGet, LOG } from './helpers';
import { addPrefixToFilter, projectionToProject } from './helpers/mongo';
const Aggregator = require('@liqd-js/aggregator');

const isSet = ( value: any ): boolean => value !== undefined && value !== null && ( Array.isArray( value ) ? value.length > 0 : ( typeof value === 'object' ? Object.keys( value ).length > 0 : true ));
const omitRoot = ( value: Record<string, unknown> ): Record<string, unknown> => 
{
    const { $root, ...rest } = value;

    return rest;
}

export * from 'mongodb';
export * from './helpers';
export { flowStart as _ };

type MongoRootDocument = Document & { _id: any };
type MongoPropertyDocument = Document & { id: any };

export type PropertyFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { $root?: Filter<RootDBE> };
export type ListOptions<DBE extends Document> = FindOptions<DBE> & { filter? : Filter<DBE> };
export type PropertyListOptions<RootDBE extends Document, DBE extends Document> = Omit<FindOptions<DBE>, 'projection'> & 
{
    filter? : PropertyFilter<RootDBE, DBE>
    projection? : FindOptions<DBE>['projection'] & { $root?: FindOptions<RootDBE>['projection'] }
};

export type AggregateOptions<DBE extends Document> =
{
    filter? : Filter<DBE>
    projection? : FindOptions<DBE>['projection']
};
export type PropertyAggregateOptions<RootDBE extends Document, DBE extends Document> =
{
    filter? : PropertyFilter<RootDBE, DBE>
    projection? : FindOptions<DBE>['projection'] & { $root?: FindOptions<RootDBE>['projection'] }
};

export type AbstractConverter<DBE extends Document> = ( dbe: DBE ) => unknown | Promise<unknown>;

export type AbstractConverters<DBE extends Document> = 
{
    dto:
    {
        converter: AbstractConverter<DBE>,
        projection?: FindOptions<DBE>['projection']
    }
    [key: string]: 
    {
        converter: AbstractConverter<DBE>,
        projection?: FindOptions<DBE>['projection']
    }
}

export abstract class AbstractModel<DBE extends MongoRootDocument, DTO extends Document, Converters extends AbstractConverters<DBE>>
{
    private abstractFindAggregator;

    protected constructor( public collection: Collection<DBE>, public converters: Converters )
    {
        this.abstractFindAggregator = new Aggregator( async( ids: Array<DTO['id']>, conversion: keyof Converters ) =>
        {
            const { converter, projection } = this.converters[conversion];

            const entries = await this.collection.find({ _id: { $in: ids.map( id => this.dbeID( id ))}}, { projection }).toArray();
            const index = entries.reduce(( i, e ) => ( i.set( this.dtoID( e._id ?? e.id ), converter( e as DBE )), i ), new Map());

            return Promise.all( ids.map( id => index.get( id ) ?? null ));
        });
    }

    private pipeline( options: AggregateOptions<DBE> ): Document[]
    {
        const { filter, projection } = options;

        let pipeline: Document[] = [];

        isSet( filter ) && pipeline.push({ $match: filter });
        isSet( filter ) && pipeline.push({ $project: projectionToProject( filter )});

        flowGet( 'log' ) && LOG( pipeline );

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): DBE['_id']{ return dtoID as DBE['_id']; }
    public dtoID( dbeID: DBE['_id'] ): DTO['id']{ return dbeID as DTO['id']; }

    public async create( dbe: Omit<DBE, '_id'>, id?: DTO['id'] ): Promise<DTO['id']>
    {
        const _id: DTO['id'] = id ?? await this.id();

        await this.collection.insertOne({ ...dbe, _id: this.dbeID( _id ) } as OptionalUnlessRequiredId<DBE> );

        return _id;
    }

    public async get( id: DTO['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: DTO['id'][] ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | Array<DTO['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        if( !Array.isArray( id ))
        {
            return await this.abstractFindAggregator.call( id, conversion ) as Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
        }

        let entries = await this.abstractFindAggregator.call( id, conversion ) as Array<Awaited<ReturnType<Converters[K]['converter']>> | null>;
        
        return filtered ? entries.filter( Boolean ) : entries;
    }

    public async find<K extends keyof Converters>( filter: Filter<DBE>, conversion: K = 'dto' as K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne( filter, { projection });

        return dbe ? await converter( dbe as DBE ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>( list: ListOptions<DBE>, conversion: K = 'dto' as K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>
    {
        const { converter, projection } = this.converters[conversion];
        const { filter = {}, ...options } = list;
        
        let entries = await this.collection.find( filter, { projection, ...options }).toArray();

        return Promise.all( entries.map( dbe => converter( dbe as DBE ) as ReturnType<Converters[K]['converter']> ));
    }

    public async aggregate<T>( pipeline: Document[], options?: AggregateOptions<DBE>  ): Promise<T[]>
    {
        return this.collection.aggregate( isSet( options ) ? [ ...this.pipeline( options! ), ...pipeline ] : pipeline ).toArray() as Promise<T[]>;
    }

    public async count( pipeline: Document[] ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }]).then( r => r[0]?.count ?? 0 );
    }

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<void>
    {
        await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, update );
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
            const { converter, projection } = this.converters[conversion];

            const entries = await this.collection.aggregate( this.pipeline({ filter: { id: { $in: ids }}, projection })).toArray();
            const index = entries.reduce(( i, e ) => ( i.set( this.dtoID( e._id ?? e.id ), converter( e as DBE )), i ), new Map());

            return Promise.all( ids.map( id => index.get( id ) ?? null ));
        });
    }

    //private pipeline( rootFilter: Filter<RootDBE>, filter: Filter<DBE>, projection?: Document ): Document[]
    private pipeline( list: PropertyListOptions<RootDBE, DBE> ): Document[]
    {
        const { filter = {} as PropertyFilter<RootDBE, DBE>, ...options } = list;
        const { $root: rootFilter, ...propertyFilter } = filter;

        let $match = {}, pipeline:  Document[] = [], prefix = '$';

        if( isSet( propertyFilter )){ $match = { ...$match, ...addPrefixToFilter( propertyFilter, this.prefix )}}
        if( isSet( rootFilter )){ $match = { ...$match, ...rootFilter }}

        isSet( $match ) && pipeline.push({ $match });

        for( let path of this.paths )
        {
            if( path.array )
            {
                pipeline.push({ $unwind: { path: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + path.path }});
                isSet( $match ) && pipeline.push({ $match });
            }
        }

        //let $project: string | Filter<RootDBE> = '$' + this.prefix, $rootProject;
        let $project: string | Record<string, unknown> = '$' + this.prefix, $rootProject;

        const { $root: rootProjection, ...propertyProjection } = options.projection ?? {};

        if( isSet( propertyProjection )){ $project = addPrefixToFilter( projectionToProject( propertyProjection ), this.prefix, false )}
        if( isSet( rootProjection )){ $rootProject = projectionToProject( rootProjection )}

        pipeline.push({ $replaceRoot: { newRoot: ( $rootProject ? { $mergeObjects: [ $project, { _root: $rootProject }]} : $project )}});

        if( options.sort ){ pipeline.push({ $sort: options.sort }); }
        if( options.skip ){ pipeline.push({ $skip: options.skip }); }
        if( options.limit ){ pipeline.push({ $limit: options.limit }); }
        // TODO rest of operators

        flowGet( 'log' ) && LOG( pipeline );

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): DBE['id']{ return dtoID as DBE['id']; }
    public dtoID( dbeID: DBE['id'] ): DTO['id']{ return dbeID as DTO['id']; }

    public async get( id: DTO['id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: DTO['id'][] ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: DTO['id'][], conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | Array<DTO['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        if( !Array.isArray( id ))
        {
            return await this.abstractFindAggregator.call( id, conversion ) as Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
        }

        let entries = await this.abstractFindAggregator.call( id, conversion ) as Array<Awaited<ReturnType<Converters[K]['converter']>> | null>;
        
        return filtered ? entries.filter( Boolean ) : entries;
    }

    public async find<K extends keyof Converters>( filter: PropertyFilter<RootDBE,DBE>, conversion: K = 'dto' as K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = ( await this.collection.aggregate( this.pipeline({ filter, projection })).limit(1).toArray())[0];
        
        return dbe ? await converter( dbe as DBE ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>( list: PropertyListOptions<RootDBE, DBE>, conversion: K = 'dto' as K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>
    {
        const { converter, projection } = this.converters[conversion];

        const pipeline = this.pipeline({ ...list, projection });

        let entries = await this.collection.aggregate( pipeline ).toArray();

        return Promise.all( entries.map( dbe => converter( dbe as DBE ) as ReturnType<Converters[K]['converter']> ));
    }

    public async aggregate<T>( pipeline: Document[], options?: PropertyAggregateOptions<RootDBE,DBE> ): Promise<T[]>
    {
        return this.collection.aggregate( isSet( options ) ? [ ...this.pipeline( options! ), ...pipeline ] : pipeline ).toArray() as Promise<T[]>;
    }

    public async count( pipeline: Document[], options?: PropertyAggregateOptions<RootDBE,DBE> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }
}

export class AbstractModels
{
    protected client: MongoClient;

    protected constructor( connectionString: string )
    {
        this.client = new MongoClient( connectionString ); 
        this.client.connect();
    }

    public scope( callback: Function, scope: object )
    {
        flowStart( callback, scope );
    }
}