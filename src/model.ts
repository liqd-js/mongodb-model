import { Collection, Document, FindOptions, Filter, WithId, ObjectId, OptionalUnlessRequiredId, UpdateFilter } from 'mongodb';
import { flowGet, DUMP, Arr, isSet, convert, REGISTER_MODEL, hasPublicMethod, collectAddedFields, mergeComputedProperties, toUpdateOperations } from './helpers';
import { projectionToProject, getCursor, resolveBSONObject, ModelError, QueryBuilder } from './helpers';
import { ModelAggregateOptions, ModelCreateOptions, ModelListOptions, MongoRootDocument, WithTotal, ModelUpdateResponse, AbstractModelSmartFilters, PublicMethodNames, SmartFilterMethod, ModelExtensions, ModelFindOptions, ModelUpdateOptions, AbstractModelProperties, ComputedPropertyMethod, AbstractConverterOptions, ComputedPropertiesParam, SyncComputedPropertyMethod} from './types';
import { AbstractModels } from "./index";
export const Aggregator = require('@liqd-js/aggregator');

/**
 * Abstract model class
 * @template DBE - Database entity
 * @template DTO - Data transfer object
 * @template Extensions - Model parameters
 * @class
 */
export abstract class AbstractModel<
    DBE extends MongoRootDocument,
    DTO extends Document,
    Extensions extends ModelExtensions<DBE, AbstractModelSmartFilters<Extensions['smartFilters']>, AbstractModelProperties<Extensions['computedProperties']>>
>
{
    private abstractFindAggregator;
    public converters: Extensions['converters'];
    public smartFilters?: Extensions['smartFilters'];
    private readonly computedProperties: Extensions['computedProperties'];
    readonly #models: AbstractModels;

    protected constructor( models: AbstractModels, public collection: Collection<DBE>, params: Extensions )
    {
        this.converters = params.converters ?? { dbe: { converter: ( dbe: DBE ) => dbe } };
        this.smartFilters = params.smartFilters;
        this.computedProperties = params.computedProperties;

        this.#models = models;

        models[REGISTER_MODEL]( this, collection.collectionName );
        this.abstractFindAggregator = new Aggregator( async( ids: Array<DTO['id']>, conversion: keyof Extensions['converters'], accessControl: Filter<WithId<DBE>> | void ) =>
        {
            try
            {
                //const filter = accessControl ? { $and: [ { _id: { $in: ids.map( id => this.dbeID( id ))}}, accessControl ]} : { _id: { $in: ids.map( id => this.dbeID( id ))}};
                //const documents = await this.collection.find( filter, { projection: this.converters[conversion].projection, collation: { locale: 'en' } }).toArray();
                // const documents = accessControl
                //     ? await this.collection.aggregate([{ $match: { $and: [ { _id: { $in: ids.map( id => this.dbeID( id ))}}, accessControl ]}}]).toArray()
                //     : await this.collection.find( { _id: { $in: ids.map( id => this.dbeID( id ))}}, { projection: this.converters[conversion].projection, collation: { locale: 'en' } }).toArray();

                const pipeline = await this.pipeline({
                    filter: {
                        $and: [
                            { _id: { $in: ids.map( id => this.dbeID( id ))} },
                            accessControl || {}
                        ]
                    },
                    projection: this.converters[conversion].projection
                }, conversion );

                const documents = await this.collection.aggregate( pipeline, { collation: { locale: 'en' } }).toArray();
                    
                const index = documents.reduce(( i, dbe ) => ( i.set( this.dtoID( dbe._id ?? dbe.id ), dbe ), i ), new Map());

                return ids.map( id => index.get( this.dtoID(id) ) ?? null );
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

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( id: DTO['id'] | DBE['_id'] ): DBE['_id']{ return id as DBE['_id']; }
    public dtoID( dbeID: DBE['_id'] | DTO['id'] ): DTO['id']{ return dbeID as DTO['id']; }

    protected async pipeline<K extends keyof Extensions['converters']>( options: ModelAggregateOptions<DBE, Extensions['smartFilters']>, conversion?: K ): Promise<Document[]>
    {
        const { computedProperties: converterComputedProperties } = this.converters[conversion ?? 'dto'];

        let { filter, projection, computedProperties, smartFilter } = resolveBSONObject( options ) as ModelAggregateOptions<DBE, Extensions['smartFilters']>;

        let pipeline: Document[] = [];

        let accessFilter = await this.accessFilter();

        if( accessFilter )
        {
            pipeline.push({ $match: accessFilter!});
        }

        let custom = smartFilter ? await this.resolveSmartFilter( smartFilter ) : undefined;
        const converterProperties = { '': await this.resolveComputedProperties( converterComputedProperties )};
        const optionsProperties = { '': await this.resolveComputedProperties( computedProperties )};
        const props = mergeComputedProperties( converterProperties, optionsProperties )[''];

        isSet( filter ) && pipeline.push({ $match: filter});
        isSet( custom?.filter ) && pipeline.push({ $match: custom?.filter});

        props?.pipeline && isSet( props?.pipeline ) && pipeline.push( ...props.pipeline );
        props?.fields && isSet( props?.fields ) && pipeline.push({ $addFields: props.fields });

        const addedFields = Object.fromEntries( collectAddedFields(pipeline).map( el => [el, 1]) );

        isSet( custom?.pipeline ) && pipeline.push( ...custom?.pipeline! );
        isSet( projection ) && pipeline.push({ $project: { ...projectionToProject( projection ), ...addedFields }});

        return pipeline;
    }

    public async create( dbe: Omit<DBE, '_id'>, id?: DTO['id'], options?: ModelCreateOptions ): Promise<DTO['id']>
    {
        /*if( options?.converter )
        {
            dbe = await options.converter( dbe as T );
        }*/

        const _id: DTO['id'] = id ?? await this.id();

        try
        {
            await this.collection.insertOne({ ...dbe, _id: this.dbeID( _id ) } as OptionalUnlessRequiredId<DBE>/*, { collation: { locale: 'en' } }*/ );
        }
        catch( e: any )
        {
            if( options?.duplicateIgnore === true && e.code === 11000 )
            {
                return this.dtoID( await this.collection.findOne( e.keyValue, { projection: { _id: 1 }, collation: { locale: 'en' } }).then( r => r?._id ));
            }

            throw e;
        }

        return _id;
    }

    public async createFrom( data: any, id?: DTO['id'], options?: ModelCreateOptions ): Promise<DTO['id']>
    {
        throw new Error('Method not implemented.');
    }

    public async update( id: DTO['id'] | DBE['_id'], update: Partial<DBE> | UpdateFilter<DBE>, options?: ModelUpdateOptions ): Promise<ModelUpdateResponse<DBE>>
    {
        let matchedCount: number | undefined = 0, modifiedCount: number | undefined = 0, documentBefore: DBE | undefined, documentAfter: DBE | undefined;

        if( options?.documentAfter )
        {
            await this.#models.transaction( async() =>
            {
                documentBefore = options?.documentBefore ? (await this.collection.findOne({ _id: this.dbeID( id ) as WithId<DBE>['_id'] }, {collation: { locale: 'en' }})) as DBE || undefined : undefined;
                // TODO remove documentAfter = (await this.collection.findOneAndUpdate({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, isUpdateOperator( update ) ? update : { $set: update } as UpdateFilter<DBE>/*, { collation: { locale: 'en' } }*/ )) as DBE || undefined;
                documentAfter = (await this.collection.findOneAndUpdate({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, toUpdateOperations( update ))) as DBE || undefined;

                matchedCount = documentAfter ? 1 : 0;
                modifiedCount = documentAfter ? 1 : 0;
            });
        }
        else
        {
            documentBefore = options?.documentBefore ? (await this.collection.findOne({ _id: this.dbeID( id ) as WithId<DBE>['_id'] }, {collation: { locale: 'en' }})) as DBE || undefined : undefined;
            // TODO remove const res = await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, isUpdateOperator( update ) ? update : { $set: update } as UpdateFilter<DBE>/*, { collation: { locale: 'en' } }*/ );
            const res = await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, toUpdateOperations( update ));

            matchedCount = res.matchedCount;
            modifiedCount = res.modifiedCount;
        }

        return { matchedCount, modifiedCount, documentBefore, documentAfter };
    }

    public async updateMany( id: DTO['id'][] | DBE['_id'][], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<ModelUpdateResponse<DBE>>
    {
        //const res = await this.collection.updateMany({ _id: { $in: id.map( id => this.dbeID( id ))}}, isUpdateOperator( update ) ? update : { $set: update } as UpdateFilter<DBE> );
        const res = await this.collection.updateMany({ _id: { $in: id.map( id => this.dbeID( id ))}}, toUpdateOperations( update ));

        return {
            matchedCount: res.matchedCount,
            modifiedCount: res.modifiedCount
        }
    }

    public async updateOne( match: ModelFindOptions<DBE, Extensions['smartFilters']>, update: Partial<DBE> | UpdateFilter<DBE>, options?: ModelUpdateOptions ): Promise<ModelUpdateResponse<DBE>>
    {
        throw new Error('Method not implemented.');

        return { matchedCount: 1, modifiedCount: 1 };
    }

    public async get( id: DTO['id'] | DBE['_id'] ): Promise<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>;
    public async get<K extends keyof Extensions['converters']>( id: DTO['id'] | DBE['_id'], conversion: K ): Promise<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>;
    public async get( id: Array<DTO['id'] | DBE['_id']> ): Promise<Array<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['_id']>, conversion: K ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['_id']>, conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>>>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['_id']>, conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: DTO['id'] | DBE['_id'] | Array<DTO['id'] | DBE['_id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        //let perf = new Benchmark();
        //let find = perf.step();
        //flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} find in ${find} ms` );

        const documents = await this.abstractFindAggregator.call( Arr( id ), conversion, await this.accessFilter() ) as Array<DBE|null>;
        const entries = await Promise.all( documents.map( dbe => dbe ? convert( this, this.converters[conversion].converter, dbe, conversion ) : null )) as Array<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>;

        if( filtered ){ entries.filter( Boolean )}

        return Array.isArray( id ) ? entries : entries[0] ?? null as any;
    }

    public async find<K extends keyof Extensions['converters']>( options: ModelFindOptions<DBE, Extensions['smartFilters']>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>
    {
        const { converter } = this.converters[conversion];

        const dbe = await this.aggregate<DBE>( [{$limit: 1}], options ).then( r => r[0]);

        return dbe ? await convert( this, converter, dbe, conversion ) as Awaited<ReturnType<Extensions['converters'][K]['converter']>> : null;
    }

    public async list<K extends keyof Extensions['converters']>( options: ModelListOptions<DBE, Extensions['smartFilters']>, conversion: K = 'dto' as K ): Promise<WithTotal<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> & { $cursor?: string }>>>
    {
        const { converter, computedProperties: compProps, cache } = this.converters[conversion];
        const { filter = {}, sort = { _id: 1 }, cursor, limit, smartFilter: sFilter, ...rest } = resolveBSONObject(options);
        const prev = cursor?.startsWith('prev:');

        const smartFilter = options.smartFilter && await this.resolveSmartFilter( options.smartFilter );
        const computedProperties = compProps && await this.resolveComputedProperties( Array.isArray( compProps ) ? compProps : compProps() ) || undefined;

        const params = {
            filter, sort, smartFilter, cursor, limit, ...rest,
            accessFilter: await this.accessFilter() || undefined,
            pipeline: options.pipeline,
            computedProperties
        };
        const queryBuilder = new QueryBuilder<DBE>();
        const [pipeline, countPipeline] = await Promise.all ([
            queryBuilder.pipeline( params ),
            options.count ? queryBuilder.count( params ) : undefined
        ]);

        flowGet( 'log' ) && DUMP( pipeline );
        flowGet( 'log' ) && countPipeline && DUMP( countPipeline );

        let [ entries, total ] = await Promise.all(
            [
                this.collection.aggregate( pipeline, { collation: { locale: 'en' } } ).toArray(),
                options.count ? this.collection.aggregate( countPipeline, { collation: { locale: 'en' } } ).toArray().then( r => r[0]?.count ?? 0 ) : undefined
            ]);

        const result = await Promise.all( entries.map( async( dbe, i ) =>
        {
            const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Extensions['converters'][K]['converter']> & { $cursor?: string };
            dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
            return dto;
        }));

        if ( options.count )
        {
            Object.defineProperty(result, 'total', { value: total ?? 0, writable: false });
        }

        return prev ? result.reverse() : result;
    }

    public async aggregate<T>( pipeline: Document[], options?: ModelAggregateOptions<DBE, Extensions['smartFilters']> ): Promise<T[]>
    {
        const aggregationPipeline = isSet( options ) ? [ ...await this.pipeline( options! ), ...( resolveBSONObject( pipeline ) as Document[] ) ] : resolveBSONObject( pipeline ) as Document[];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline, { collation: { locale: 'en' } } ).toArray() as Promise<T[]>;
    }

    public async count( pipeline: Document[], options?: ModelAggregateOptions<DBE, Extensions['smartFilters']> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<Filter<DBE> | void> {}

    public async resolveSmartFilter( smartFilter: {[key in PublicMethodNames<Extensions['smartFilters']>]?: any} ): Promise<{ filter?: Filter<DBE>, pipeline?: Document[] }>
    {
        if ( !this.smartFilters )
        {
            throw new Error( 'Custom filter is not supported' );
        }

        const pipeline: any[] = [];
        let filter: any = {};
        const extraFilters: any = {};

        for ( const [key, value] of Object.entries( smartFilter ) )
        {
            if ( hasPublicMethod( this.smartFilters, key ) )
            {
                const result = await (( this.smartFilters as any )[key] as SmartFilterMethod)( value );
                result.pipeline && pipeline.push( ...result.pipeline );
                result.filter && ( filter = { $and: [{ ...filter }, result.filter ].filter(f => Object.keys(f).length > 0) });
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

    public async resolveComputedProperties( properties: any ): Promise<Awaited<ReturnType<SyncComputedPropertyMethod>>>
    {
        const result: ReturnType<ComputedPropertyMethod> = { fields: {}, pipeline: [] };

        if ( Array.isArray( properties ) )
        {
            properties = properties.reduce(
                (acc, val) => {acc[val] = null; return acc;},
                {}
            );
        }

        for ( const property in (properties as object) )
        {
            if ( hasPublicMethod( this.computedProperties, property ) )
            {
                const resolvedProperties: Awaited<ReturnType<ComputedPropertyMethod>> = await ( this.computedProperties as any )[property]( properties[property] );
                result.fields = { ...result.fields, ...resolvedProperties.fields };
                result.pipeline?.push( ...(resolvedProperties.pipeline || []) );
            }
        }

        return {
            fields: result.fields && Object.keys( result.fields ).length ? result.fields : null,
            pipeline: result.pipeline?.length ? result.pipeline : null
        }
    }

    public async delete( id: DTO['id'] | DBE['_id'] ): Promise<Boolean>
    {
        return ( await this.collection.deleteOne({ _id: this.dbeID( id ) as WithId<DBE>['_id'] }/*, { collation: { locale: 'en' } }*/)).deletedCount === 1;
    }
}