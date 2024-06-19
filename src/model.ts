import {Collection, Document, FindOptions, Filter, WithId, ObjectId, OptionalUnlessRequiredId, UpdateFilter} from 'mongodb';
import {flowGet, DUMP, flowSet, Arr, isSet, convert, REGISTER_MODEL, hasPublicMethod} from './helpers';
import { projectionToProject, isUpdateOperator, getCursor, resolveBSONObject } from './helpers';
import { ModelError } from './helpers/errors';
import {AbstractConverters, ModelAggregateOptions, CreateOptions, ModelListOptions, MongoRootDocument, WithTotal, UpdateResponse, AbstractFilters, PublicMethodNames, FilterMethod} from './types';
import QueryBuilder from './helpers/query-builder';
import {AbstractModels} from "./index";
export const Aggregator = require('@liqd-js/aggregator');

export abstract class AbstractModel<DBE extends MongoRootDocument, DTO extends Document, Converters extends AbstractConverters<DBE>, Filters extends AbstractFilters<Filters> = never, Models extends AbstractModels = never>
{
    private abstractFindAggregator;

    protected constructor( protected models: Models, public collection: Collection<DBE>, public converters: Converters, public filters?: Filters )
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

        models[REGISTER_MODEL]( this, collection.collectionName );
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( id: DTO['id'] | DBE['_id'] ): DBE['_id']{ return id as DBE['_id']; }
    public dtoID( dbeID: DBE['_id'] ): DTO['id']{ return dbeID as DTO['id']; }

    protected async pipeline( options: ModelAggregateOptions<DBE> ): Promise<Document[]>
    {
        let { filter, projection, ...rest } = resolveBSONObject( options );

        let pipeline: Document[] = [];

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: accessFilter!});
        }

        let custom = rest.customFilter ? await this.resolveCustomFilter( rest.customFilter ) : undefined;

        isSet( filter ) && pipeline.push({ $match: filter});
        isSet( custom?.filter ) && pipeline.push({ $match: custom?.filter});
        isSet( custom?.pipeline ) && pipeline.push( ...custom?.pipeline! );
        isSet( projection ) && pipeline.push({ $project: projectionToProject( projection )});

        return pipeline;
    }

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

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<UpdateResponse>
    {
        const res = await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, isUpdateOperator( update ) ? update : { $set: update } as UpdateFilter<DBE> );
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount }
    }

    public async get( id: DTO['id'] | DBE['_id'] ): Promise<Awaited<ReturnType<Converters['dto']['converter']>> | null>;
    public async get<K extends keyof Converters>( id: DTO['id'] | DBE['_id'], conversion: K ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>;
    public async get( id: Array<DTO['id'] | DBE['_id']> ): Promise<Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['_id']>, conversion: K ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['_id']>, conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>>>>;
    public async get<K extends keyof Converters>( id: Array<DTO['id'] | DBE['_id']>, conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Converters[K]['converter']>> | null>>;
    public async get<K extends keyof Converters>( id: DTO['id'] | DBE['_id'] | Array<DTO['id'] | DBE['_id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        //let perf = new Benchmark();
        //let find = perf.step();
        //flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find in ${find} ms` );

        const documents = await this.abstractFindAggregator.call( Arr( id ), conversion ) as Array<DBE|null>;
        const entries = await Promise.all( documents.map( dbe => dbe ? convert( this, this.converters[conversion].converter, dbe, conversion ) : null )) as Array<Awaited<ReturnType<Converters['dto']['converter']>> | null>;

        if( filtered ){ entries.filter( Boolean )}

        return Array.isArray( id ) ? entries : entries[0] ?? null as any;
    }

    // TODO: customfilters tutaj
    public async find<K extends keyof Converters>( filter: Filter<DBE>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Converters[K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne( resolveBSONObject( filter ), { projection, sort });

        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Converters[K]['converter']>> : null;
    }

    public async list<K extends keyof Converters>(list: ModelListOptions<DBE>, conversion: K = 'dto' as K ): Promise<WithTotal<Array<Awaited<ReturnType<Converters[K]['converter']>> & { $cursor?: string }>>>
    {
        const { converter, projection, cache } = this.converters[conversion];
        const { filter = {}, sort = { _id: 1 }, cursor, limit, ...options } = resolveBSONObject(list);
        const prev = cursor?.startsWith('prev:');

        const customFilter = list.customFilter && await this.resolveCustomFilter( list.customFilter );
        const params = {
            filter, sort, customFilter, cursor, limit, ...options,
            accessFilter: await this.accessFilter() || undefined,
            pipeline: list.pipeline
        };
        const queryBuilder = new QueryBuilder<DBE>();

        let [ entries, total ] = await Promise.all(
            [
                this.collection.aggregate( await queryBuilder.pipeline( params )).toArray(),
                list.count ? this.collection.aggregate( await queryBuilder.count( params ) ).toArray().then( r => r[0]?.count ?? 0 ) : undefined
            ]);

        const result = await Promise.all( entries.map( async( dbe, i ) =>
        {
            const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Converters[K]['converter']> & { $cursor?: string };
            dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
            return dto;
        }));

        if ( list.count )
        {
            Object.defineProperty(result, 'total', { value: total ?? 0, writable: false });
        }

        return prev ? result.reverse() : result;
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

    public async resolveCustomFilter( customFilter: {[key in PublicMethodNames<Filters>]?: any} ): Promise<{ filter?: Filter<DBE>, pipeline?: Document[] }>
    {
        if ( !this.filters )
        {
            throw new Error( 'Custom filter is not supported' );
        }

        const pipeline: any[] = [];
        const filter: any = {};
        const extraFilters: any = {};

        for ( const [key, value] of Object.entries( customFilter ) )
        {
            if ( hasPublicMethod( this.filters, key ) )
            {
                const result = (( this.filters as any )[key] as FilterMethod)( value );
                result.pipeline && pipeline.push( ...result.pipeline );
                result.filter && (filter[ key ] = result.filter);
            }
            else
            {
                extraFilters[key] = value;
            }
        }

        if ( Object.keys( extraFilters ).length > 0 )
        {
            throw new Error( `Custom filter contains unsupported filters - ${JSON.stringify(extraFilters, null, 2)}` );
        }

        return { filter, pipeline };
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