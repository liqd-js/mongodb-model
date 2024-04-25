import { Collection, Document, FindOptions, Filter, WithId, ObjectId, OptionalUnlessRequiredId, UpdateFilter, UpdateOptions, MongoClientOptions, Sort } from 'mongodb';
import {flowGet, LOG, DUMP, Benchmark, flowSet, Arr, isSet} from './helpers';
import { projectionToProject, isUpdateOperator, getCursor, resolveBSONObject, generateCursorCondition, reverseSort, sortProjection, collectAddedFields } from './helpers/mongo';
import { ModelError, ModelConverterError } from './helpers/errors';
import {AbstractConverter, AbstractConverters, ModelAggregateOptions, CreateOptions, ModelListOptions, MongoRootDocument, WithTotal} from "./types";
import QueryBuilder from "./helpers/query-builder";
export const Aggregator = require('@liqd-js/aggregator');

export async function convert<DBE extends Document>( model: object, converter: AbstractConverter<DBE>, dbe: DBE, conversion: string | number | symbol )
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
                const documents = await this.collection.find({ _id: { $in: ids.map( id => this.dbeID( id ))}}, { projection: this.converters[conversion].projection }).toArray();
                const index = documents.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe._id ?? dbe.id ), dbe ), i ), new Map());
                
                return ids.map( id => index.get( id ) ?? null );
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

    async newList( list: ModelListOptions<DBE>, count: boolean = false )
    {
        const queryBuilder = new QueryBuilder<DBE>();
        const pipeline = await queryBuilder.list( {
            filter: list.filter,
            pipeline: list.pipeline,
            accessFilter: this.accessFilter,
            sort: !count ? list.sort : undefined,
            cursor: list.cursor
        });

        return pipeline;
    }

    protected async pipeline( options: ModelAggregateOptions<DBE> ): Promise<Document[]>
    {
        let { filter, projection } = options;

        let pipeline: Document[] = [];

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: resolveBSONObject( accessFilter! )});
        }

        let custom = options.customFilter ? await this.resolveCustomFilter( options.customFilter ) : undefined;

        isSet( filter ) && pipeline.push({ $match: resolveBSONObject( filter! )});
        isSet( custom?.filter ) && pipeline.push({ $match: resolveBSONObject( custom?.filter! )});
        isSet( custom?.pipeline ) && pipeline.push( ...custom?.pipeline! );
        isSet( projection ) && pipeline.push({ $project: projectionToProject( projection )});

        return pipeline;
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): DBE['_id']{ return dtoID as DBE['_id']; }
    public dtoID( dbeID: DBE['_id'] ): DTO['id']{ return dbeID as DTO['id']; }

    public async create( dbe: Omit<DBE, '_id'>, id?: DTO['id'], options?: CreateOptions ): Promise<DTO['id']>
    {
        /*if( options?.converter )
        {
            dbe = await options.converter( dbe as T );
        }*/

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

    public async createFrom( data: any, id?: DTO['id'], options?: CreateOptions ): Promise<DTO['id']>
    {
        throw new Error('Method not implemented.');
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
        //let perf = new Benchmark();
        //let find = perf.step();
        //flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find in ${find} ms` );

        const documents = await this.abstractFindAggregator.call( Arr( id ), conversion ) as Array<DBE|null>;
        const entries = await Promise.all( documents.map( dbe => dbe ? convert( this, this.converters[conversion].converter, dbe, conversion ) : null )) as Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>;

        if( filtered ){ entries.filter( Boolean )}

        return Array.isArray( id ) ? entries : entries[0] ?? null as any;
    }

    public async find<K extends keyof Converters>( filter: Filter<DBE>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne( resolveBSONObject( filter ), { projection, sort });

        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>(list: ModelListOptions<DBE>, conversion: K = 'dto' as K ): Promise<WithTotal<Array<Awaited<ReturnType<Converters[K]['converter']>> & { $cursor?: string }>>>
    {
        const { converter, projection, cache } = this.converters[conversion];
        let { filter = {}, sort = { _id: 1 }, cursor, limit, ...options } = list;
        let prev = cursor?.startsWith('prev:'), last = true;

        if( list.customFilter )
        {
            const custom = await this.resolveCustomFilter( list.customFilter );

            if( custom.filter )
            {
                filter = isSet( filter ) ? { $and: [ filter, custom.filter ]} : custom.filter;
            }

            if( custom.pipeline )
            {
                list.pipeline = list.pipeline ? [ ...list.pipeline, ...custom.pipeline ] : custom.pipeline;
            }
        }

        const params = { filter, sort, accessFilter: this.accessFilter, cursor, pipeline: list.pipeline };
        const queryBuilder = new QueryBuilder<DBE>();
        const pipe = await queryBuilder.list( params );
        let promises = [ this.collection.aggregate( pipe ).toArray() ];

        if ( list.count )
        {
            promises.push( this.collection.aggregate( await queryBuilder.count( params ) ).toArray().then( r => r[0]?.count ?? 0 ));
        }

        let [ entries, total ] = await Promise.all( promises );

        const result = await Promise.all( entries.map( async( dbe, i ) =>
        {
            const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Converters[K]['converter']> & { $cursor?: string };

            if(( limit && ( i > 0 || ( cursor && ( !prev || !last ))) && !( last && !prev && i === entries.length - 1 )))
            {
                dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
            }

            return dto;
        }));

        if ( list.count )
        {
            Object.defineProperty(result, 'total', { value: total ?? 0, writable: false });
        }

        return result;
    }

    public async aggregate<T>( pipeline: Document[], options?: ModelAggregateOptions<DBE> ): Promise<T[]>
    {
        const aggregationPipeline = isSet( options ) ? [ ...await this.pipeline( options! ), ...( resolveBSONObject( pipeline ) as Document[] ) ] : resolveBSONObject( pipeline ) as Document[];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline ).toArray() as Promise<T[]>;
    }

    public async count( pipeline: Document[], options?: ModelAggregateOptions<DBE> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<Filter<DBE> | void>{}

    protected async resolveCustomFilter( customFilter: any ): Promise<{ filter?: Filter<DBE>, pipeline: Document[] }>
    {
        throw new Error('Method not implemented.');
    }

    public async delete( id: DTO['id'] ): Promise<Boolean>
    {
        return ( await this.collection.deleteOne({ _id: this.dbeID( id ) as WithId<DBE>['_id'] })).deletedCount === 1;
    }

    public scope( scope: object )
    {
        Object.entries( scope ).forEach(([ key, value ]) => flowSet( key, value ) );

        return this;
    }
}