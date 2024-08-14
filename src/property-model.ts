import {Collection, Document, Filter as MongoFilter, Filter, FindOptions, ObjectId, UpdateFilter, UpdateOptions, WithId} from 'mongodb';
import { addPrefixToFilter, addPrefixToPipeline, addPrefixToUpdate, Arr, collectAddedFields, convert, DUMP, flowGet, generateCursorCondition, GET_PARENT, getCursor, getUsedFields, hasPublicMethod, isExclusionProjection, isSet, LOG, map, mergeComputedProperties, optimizeMatch, projectionToReplace, propertyModelUpdateParams, REGISTER_MODEL, resolveBSONObject, reverseSort, splitFilterToStages, toUpdateOperations } from './helpers';
import { ModelError, QueryBuilder, Benchmark } from './helpers';
import { Aggregator } from './model'
import { SmartFilterMethod, MongoPropertyDocument, MongoRootDocument, PropertyModelAggregateOptions, PropertyModelFilter, PropertyModelListOptions, PublicMethodNames, ModelUpdateResponse, WithTotal, PropertyModelFindOptions, SecondType, AbstractPropertyModelSmartFilters, PropertyModelExtensions, ConstructorExtensions, FirstType, ComputedPropertyMethod, AbstractModelProperties, ComputedPropertiesParam, SyncComputedPropertyMethod, ModelUpdateOptions, PropertyModelUpdateResponse} from './types';
import { AbstractModels } from "./index";

/**
 * Abstract class for property models
 * @template RootDBE - Root Database entity
 * @template DBE - Database entity
 * @template DTO - Data transfer object
 * @template Extensions - Model parameters
 */
export abstract class AbstractPropertyModel<
    RootDBE extends MongoRootDocument,
    DBE extends MongoPropertyDocument,
    DTO extends Document,
    Extensions extends PropertyModelExtensions<DBE, AbstractPropertyModelSmartFilters<any, any>, AbstractModelProperties<Extensions['computedProperties']>>
>
{
    private abstractFindAggregator;
    private paths;
    private prefix;
    public converters: Extensions['converters'];
    public smartFilters?: FirstType<Extensions['smartFilters']>;
    private readonly computedProperties;
    readonly #models: AbstractModels;

    /**
     *
     * @param models \{AbstractModels\} - Models instance
     * @param collection
     * @param path
     * @param params
     */
    protected constructor( models: AbstractModels, public collection: Collection<RootDBE>, path: string, params: ConstructorExtensions<Extensions> )
    {
        this.#models = models;
        this.paths = [...path.matchAll(/[^\[\]]+(\[\])?/g)].map( m => ({ path: m[0].replace(/^\./,'').replace(/\[\]$/,''), array: m[0].endsWith('[]')}));
        this.prefix = this.paths.map( p => p.path ).join('.');
        this.converters = params.converters ?? { dbe: { converter: ( dbe: DBE ) => dbe } };
        this.smartFilters = params.smartFilters;
        this.computedProperties = params.computedProperties;

        this.abstractFindAggregator = new Aggregator( async( ids: Array<DTO['id'] | DBE['id']>, conversion: keyof Extensions['converters'], accessControl: Filter<DBE> | void ) =>
        {
            try
            {
                // TODO overit ci spravny access control vezme  v potaz
                let pipeline = await this.pipeline({ filter: { id: { $in: ids.map( id => this.dbeID( id ))}}, projection: this.converters[conversion].projection });

                flowGet('log') && ( console.log( this.constructor.name + '::get', ids ), DUMP( pipeline ));

                ids = ids.map( id => this.dtoID( id ));

                return map(
                    ids.map( id => this.dtoID( id ) ),
                    await this.collection.aggregate( pipeline, { collation: { locale: 'en' } } ).toArray() as DBE[],
                    ( dbe: DBE ) => this.dtoID( dbe._id ?? dbe.id )
                );
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

        models[REGISTER_MODEL]( this, collection.collectionName, this.prefix );
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }

    /**
     * Converts DTO['id'] to DBE['id']
     * @param id {DTO['id'] | DBE['id']} - DTO or DBE id
     * @returns {DBE['id']} - DBE id
     */
    public dbeID( id: DTO['id'] | DBE['id'] ): DBE['id']{ return id as DBE['id']; }

    /**
     * Converts DBE['id'] to DTO['id']
     * @param dbeID {DBE['id']} - DBE id
     * @returns {DTO['id']} - DTO id
     */
    public dtoID( dbeID: DBE['id'] | DTO['id'] ): DTO['id']{ return dbeID as DTO['id']; }

    //private pipeline( rootFilter: Filter<RootDBE>, filter: Filter<DBE>, projection?: Document ): Document[]
    protected async pipeline<K extends keyof Extensions['converters']>( options: PropertyModelListOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>> & { computedProperties?: ComputedPropertiesParam } = {}, conversion?: K ): Promise<Document[]>
    {
        const { computedProperties } = this.converters[conversion ?? 'dto'];

        let { filter = {} as PropertyModelFilter<RootDBE, DBE>, sort = { id: -1 }, ...rest } = resolveBSONObject(options);
        const queryBuilder = new QueryBuilder<RootDBE>();

        let pipeline:  Document[] = [], prefix = '$';

        const smartFilter = options.smartFilter ? await this.resolveSmartFilter( options.smartFilter as any ) : undefined;

        const converterProperties = await this.resolveComputedProperties( computedProperties );
        const optionsProperties = await this.resolveComputedProperties( options.computedProperties );
        const computed = mergeComputedProperties( converterProperties, optionsProperties );

        const gatheredFields = Object.values( computed || {fields: null, pipeline: null} )
            .reduce((acc, val) => {
                const fields = { ...acc?.fields, ...val?.fields };
                const pipeline = [...acc?.pipeline!, ...(val?.pipeline || [])];
                return { fields, pipeline };
            }, {fields: {}, pipeline: []});

        let computedAddedFields = Object.fromEntries(([
            ...collectAddedFields( [{$addFields: gatheredFields?.fields || {}}] ),
            ...collectAddedFields( gatheredFields?.pipeline || [] ),
        ]).map( f => [f.replace( new RegExp('^' + this.prefix + '.'), '' ), 1 ]));
        computedAddedFields = projectionToReplace( computedAddedFields ) as {[p: string]: any};

        const gatheredFilters = Object.values( smartFilter || {} )
            .reduce((acc, val) => {
                const filter = { ...acc?.filter, ...val?.filter } as Filter<DBE>;
                const pipeline = [ ...acc?.pipeline!, ...(val?.pipeline || []) ] as Document[];
                return { filter, pipeline };
            }, { filter: {} as Filter<DBE>, pipeline: [] as Document[] })
        const needRoot = getUsedFields( gatheredFilters?.pipeline ?? [] ).used.some(el => el.startsWith('_root.'));

        const stages = await this.filterStages( options );
        const subpaths = this.prefix.split('.');
        for ( let i = 0; i <= subpaths.length; i++ )
        {
            const last = i === subpaths.length;
            if ( i !== 0 )
            {
                pipeline.push({ $unwind: prefix = ( prefix === '$' ? prefix : prefix + '.' ) + this.paths[i - 1].path });
            }

            const tmpPrefix = prefix.replace(/^\$/,'');

            needRoot && last && pipeline.push({ $addFields: { _root: '$$ROOT' }});
            pipeline.push( ...await queryBuilder.pipeline(
                {
                    filter: stages[i],
                    smartFilter: smartFilter?.[tmpPrefix] ? smartFilter?.[tmpPrefix] as { filter?: Filter<RootDBE>, pipeline: Document[] } : undefined,
                    computedProperties: computed?.[tmpPrefix] ? computed[tmpPrefix] : undefined,
                }));
            needRoot && last && pipeline.push({ $unset: '_root' });
        }

        let $project: string | Record<string, unknown> = '$' + this.prefix, $rootProject;

        const { rootProjection, propertyProjection } = this.splitProjection(rest.projection ?? {});

        const unsetFieldsRoot = isExclusionProjection( rootProjection ) && getUsedFields( [{$match: rootProjection}] ).used.map(el => ('_root.' + el)) || [];
        const unsetFieldsProperty = isExclusionProjection( propertyProjection ) && getUsedFields( [{$match: propertyProjection}] ).used || [];

        if( isSet( propertyProjection ))
        {
            $project = projectionToReplace({ id: 1, ...propertyProjection }, this.prefix );
        }
        if( isSet( rootProjection ))
        {
            $rootProject = typeof rootProjection === 'object' && unsetFieldsRoot.length === 0 ? projectionToReplace( rootProjection ) : '$$ROOT'
        }

        if( $rootProject )
        {
            pipeline.push({ $replaceWith: { $mergeObjects: [ $project, { '_root': $rootProject, ...computedAddedFields }]}});
        }
        else
        {
            pipeline.push({ $replaceWith: { $mergeObjects: [ $project, computedAddedFields ] } });
        }

        const unsetFields = [...unsetFieldsProperty, ...unsetFieldsRoot];
        if ( unsetFields.length )
        {
            pipeline.push({ $unset: unsetFields });
        }

        const prev = options.cursor?.startsWith('prev:');
        pipeline.push( ...await queryBuilder.pipeline({
            sort: prev ? reverseSort( sort ) : sort,
            skip: rest.skip,
            limit: rest.limit,
            pipeline: rest.pipeline,
            //projection: options.projection,
        }) );

        return pipeline;
    }

    public async create( parentID: any, dbe: Omit<DBE, 'id'>, id?: DTO['id'] ): Promise<DTO['id']>
    {
        const _id: DTO['id'] = id ?? await this.id();

        const parentModel = this.#models[GET_PARENT]( this.collection.collectionName, this.prefix );

        const parent = parentModel ? await parentModel.get( parentID ) : null;
        if ( !parent || !parentModel )
        {
            throw new ModelError( this, `Parent document not found: ${parentID}` );
        }

        const { parentIDPath, updatePath, arrayFilters } = propertyModelUpdateParams( this.paths, parentModel.dbeID(parentID) );

        const operation = this.paths[this.paths.length - 1].array ? '$push' : '$set';

        await this.collection.updateOne({ [parentIDPath]: parentModel?.dbeID( parentID ) } as any, { [operation]: { [updatePath]: { id: _id, ...dbe } } }, { arrayFilters });

        return _id;
    }

    public async update( id: DTO['id'] | DBE['id'], update: Partial<DBE> | UpdateFilter<DBE>, options?: ModelUpdateOptions ): Promise<PropertyModelUpdateResponse<DBE>>
    {
        let path = this.paths.map( p => p.path ).join('.') + '.id';
        let operations: Partial<RootDBE> | UpdateFilter<RootDBE> = {};
        let updateOptions: UpdateOptions = {};

        if( this.paths.length === 1 && !this.paths[0].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths[0].path );
        }
        // TODO - over či vazne else if
        else if( this.paths[this.paths.length - 1].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.map( p => p.path ).join('.$[].') + '.$[entry]' );
            updateOptions = { ...updateOptions, arrayFilters: [{ 'entry.id': this.dbeID( id )}]};
        }
        else
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.slice( 0, this.paths.length - 1 ).map( p => p.path ).join('.$[].') + '.$[entry].' + this.paths[this.paths.length - 1].path );
            updateOptions = { ...updateOptions, arrayFilters: [{[ 'entry.' + this.paths[this.paths.length - 1].path + '.id' ]: this.dbeID( id )}]};
        }

        flowGet( 'log' ) && LOG({ match: {[ path ]: this.dbeID( id )}, operations, options: updateOptions });

        const documentBefore = options?.documentBefore ? (await this.get( id, 'dbe' ) as DBE) || undefined : undefined;
        //TODO remve let res = await this.collection.updateOne({[ path ]: this.dbeID( id )} as Filter<RootDBE>, isUpdateOperator( operations ) ? operations : { $set: operations } as UpdateFilter<RootDBE>, updateOptions );
        let res = await this.collection.updateOne({[ path ]: this.dbeID( id )} as Filter<RootDBE>, toUpdateOperations( operations ), updateOptions );
        const documentAfter = options?.documentAfter ? (await this.get( id, 'dbe' ) as DBE) || undefined : undefined;

        flowGet('log') && LOG({res});

        return { matchedRootCount: res.matchedCount, modifiedRootCount: res.modifiedCount, documentBefore, documentAfter }
    }

    async updateMany( ids: DBE['id'][] | DTO['id'][], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<PropertyModelUpdateResponse<DBE>>
    {
        let path = this.paths.map( p => p.path ).join('.') + '.id';
        let operations: Partial<RootDBE> | UpdateFilter<RootDBE> = {};
        let options: UpdateOptions = {};

        if( this.paths.length === 1 && !this.paths[0].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths[0].path );
        }
        else if( this.paths[this.paths.length - 1].array )
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.map( p => p.path ).join('.$[].') + '.$[entry]' );
            options = { ...options, arrayFilters: [{ 'entry.id': { $in: ids.map( id => this.dbeID( id )) }}]};
        }
        else
        {
            operations = addPrefixToUpdate<RootDBE,DBE>( update, this.paths.slice( 0, this.paths.length - 1 ).map( p => p.path ).join('.$[].') + '.$[entry].' + this.paths[this.paths.length - 1].path );
            options = { ...options, arrayFilters: [{[ 'entry.' + this.paths[this.paths.length - 1].path + '.id' ]: { $in: ids.map( id => this.dbeID( id )) }}]};
        }

        flowGet( 'log' ) && LOG({ match: {[ path ]: { $in: ids.map( id => this.dbeID( id )) }}, operations, options });

        //TODO remove let res = await this.collection.updateMany({[ path ]: { $in: ids.map( id => this.dbeID( id )) }} as Filter<RootDBE>, isUpdateOperator( operations ) ? operations : { $set: operations } as UpdateFilter<RootDBE>, options );
        let res = await this.collection.updateMany({[ path ]: { $in: ids.map( id => this.dbeID( id )) }} as Filter<RootDBE>, toUpdateOperations( operations ), options );

        flowGet('log') && LOG({res});

        return { matchedRootCount: res.matchedCount, modifiedRootCount: res.modifiedCount }
    }

    public async get( id: DTO['id'] | DBE['id'] ): Promise<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>;
    public async get<K extends keyof Extensions['converters']>( id: DTO['id'] | DBE['id'], conversion: K ): Promise<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>;
    public async get( id: Array<DTO['id'] | DBE['id']> ): Promise<Array<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['id']> , conversion: K ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['id']>, conversion: K, filtered: true ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>>>>;
    public async get<K extends keyof Extensions['converters']>( id: Array<DTO['id'] | DBE['id']>, conversion: K, filtered: false ): Promise<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>>;
    public async get<K extends keyof Extensions['converters']>( id: DTO['id'] | DBE['id'] | Array<DTO['id'] | DBE['id']>, conversion: K = 'dto' as K, filtered: boolean = false )
    {
        const documents = await this.abstractFindAggregator.call( Arr( id ), conversion, await this.accessFilter() ) as Array<DBE|null>;
        const entries = await Promise.all( documents.map( dbe => dbe ? convert( this, this.converters[conversion].converter, dbe, conversion ) : null )) as Array<Awaited<ReturnType<Extensions['converters']['dto']['converter']>> | null>;

        if( filtered ){ entries.filter( Boolean )}

        return Array.isArray( id ) ? entries : entries[0] ?? null as any;
    }

    public async find<K extends keyof Extensions['converters']>( options: PropertyModelFindOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>>, conversion: K = 'dto' as K, sort?: FindOptions<DBE>['sort'] ): Promise<Awaited<ReturnType<Extensions['converters'][K]['converter']>> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const pipeline = await this.pipeline({ filter: options.filter, smartFilter: options.smartFilter, projection, sort, limit: 1 });

        flowGet('log') && ( console.log( this.constructor.name + '::find', options.filter ), DUMP( pipeline ));

        const dbe = ( await this.collection.aggregate( pipeline ).toArray())[0];

        return dbe ? await convert( this, converter, dbe as DBE, conversion ) as Awaited<ReturnType<Extensions['converters'][K]['converter']>> : null;
    }

    public async list<K extends keyof Extensions['converters']>( options: PropertyModelListOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>>, conversion: K = 'dto' as K ): Promise<WithTotal<Array<Awaited<ReturnType<Extensions['converters'][K]['converter']>> & { $cursor?: string }>>>
    {
        const { converter, projection } = this.converters[conversion];
        const prev = options.cursor?.startsWith('prev:');
        const queryBuilder = new QueryBuilder();

        const resolvedList = resolveBSONObject( options );

        const pipeline = this.pipeline({ ...resolvedList, projection }, conversion);

        let perf = new Benchmark();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list` );

        const { cursor, sort = { id: 1 }, limit, skip, ...countOptions } = resolvedList;

        const [ entries, total ] = await Promise.all([
            this.collection.aggregate( await pipeline, { collation: { locale: 'en' } } ).toArray(),
            resolvedList.count ? this.collection.aggregate( queryBuilder.buildCountPipeline( await this.pipeline({ ...countOptions, projection }) ), { collation: { locale: 'en' } } ).toArray().then( r => r[0]?.count ?? 0 ) : 0
        ])

        flowGet( 'log' ) && LOG( {
            list: await pipeline,
            total: resolvedList.count ? queryBuilder.buildCountPipeline( await this.pipeline({ ...countOptions, projection }) ) : undefined
        } );

        let find = perf.step();

        const result = await Promise.all( entries.map( (async (dbe, i) => {
            const dto = await convert( this, converter, dbe as DBE, conversion ) as ReturnType<Extensions['converters'][K]['converter']> & { $cursor?: string };
            dto.$cursor = getCursor( dbe, sort );
            return dto;
        } )));

        let convetor = perf.step();

        flowGet( 'benchmark' ) && LOG( `${perf.start} ${this.constructor.name} list in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );

        if( resolvedList.count )
        {
            Object.defineProperty( result, 'total', { value: total ?? 0, writable: false });
        }

        return prev ? result.reverse() : result;
    }

    public async aggregate<T>( pipeline: Document[], options?: PropertyModelAggregateOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>> ): Promise<T[]>
    {
        const aggregationPipeline = [ ...await this.pipeline( options ), ...( resolveBSONObject( pipeline ) as Document[] ) ];

        flowGet( 'log' ) && DUMP( aggregationPipeline );

        return this.collection.aggregate( aggregationPipeline, { collation: { locale: 'en' } } ).toArray() as Promise<T[]>;

        /* WHY THE HELL WAS IT LIKE THAT

        flowGet( 'log' ) && DUMP( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline );

        return this.collection.aggregate( isSet( options ) ? [ ...await this.pipeline( options! ), ...pipeline ] : pipeline ).toArray() as Promise<T[]>;*/
    }

    public async count( pipeline: Document[], options?: PropertyModelAggregateOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>> ): Promise<number>
    {
        return this.aggregate<{ count: number }>([ ...pipeline, { $count: 'count' }], options ).then( r => r[0]?.count ?? 0 );
    }

    protected async accessFilter(): Promise<PropertyModelFilter<RootDBE,DBE> | void>{}

    public async resolveSmartFilter( smartFilter: {[key in PublicMethodNames<SecondType<Extensions['smartFilters']>>]: any} ): Promise<{ [prefix: string]: { filter?: Filter<DBE>, pipeline?: Document[] } }>
    {
        const result: { [path: string]: { filter?: Filter<DBE>, pipeline?: Document[] }} = {};
        const pipeline: Document[] = [];
        let filter: Filter<DBE> = {};
        const extraFilters: Document = {};

        for ( const [key, value] of Object.entries( smartFilter ) )
        {
            if ( hasPublicMethod( this.smartFilters, key ) )
            {
                const result = await (( this.smartFilters as any )[key] as SmartFilterMethod)( value );
                result.pipeline && pipeline.push( ...addPrefixToPipeline(result.pipeline, this.prefix) );
                result.filter && ( filter = { $and: [{ ...filter }, addPrefixToFilter( result.filter, this.prefix )].filter(f => Object.keys(f).length > 0) });
            }
            else
            {
                extraFilters[key] = value;
            }
        }
        if ( pipeline.length > 0 || Object.keys(filter).length > 0 )
        {
            result[this.prefix] = { filter, pipeline };
        }

        const parentModel = this.#models[GET_PARENT]( this.collection.collectionName, this.prefix );
        if ( parentModel )
        {
            const resolved = await parentModel.resolveSmartFilter( extraFilters )

            if ('filter' in resolved && 'pipeline' in resolved) {
                result[''] = resolved;
            }
            else if (Object.keys(resolved).length > 0)
            {
                for ( const prefix in resolved )
                {
                    result[prefix] = (resolved as any)[prefix];
                }
            }
        }
        else if ( Object.keys( extraFilters ).length > 0 )
        {
            throw new Error( `Custom filter contains unsupported filters - ${JSON.stringify(extraFilters, null, 2)}` );
        }

        return result;
    }

    public async resolveComputedProperties( properties: any ): Promise<{ [path: string]: Awaited<ReturnType<SyncComputedPropertyMethod>>}>
    {
        const result: { [path: string]: ReturnType<SyncComputedPropertyMethod>} = {};
        let pipeline: Document[] = [];
        let fields: Document = {};
        const extraProperties: any = {};

        if ( Array.isArray( properties ) )
        {
            properties = properties.reduce(
                (acc, val) => {acc[val] = null; return acc;},
                {}
            );
        }

        for ( const property in ( properties as { [key in PublicMethodNames<SecondType<Extensions["computedProperties"]>>]?: any } ) )
        {
            if ( hasPublicMethod( this.computedProperties, property ) )
            {
                const resolvedProperties: Awaited<ReturnType<SyncComputedPropertyMethod>> = await (( this.computedProperties as any )[property])( (properties as any)[property] );

                for ( const field in resolvedProperties.fields )
                {
                    fields[this.prefix + '.' + field] = addPrefixToFilter(resolvedProperties.fields![field], this.prefix);
                }

                if ( resolvedProperties.pipeline )
                {
                    pipeline.push( ...addPrefixToPipeline(resolvedProperties.pipeline, this.prefix) );
                }
            }
            else
            {
                extraProperties[property] = (properties as any)[property];
            }
        }

        if ( pipeline.length > 0 || Object.keys(fields).length > 0 )
        {
            result[this.prefix] = { fields, pipeline };
        }

        const parentModel = this.#models[GET_PARENT]( this.collection.collectionName, this.prefix );
        if ( parentModel )
        {
            let resolvedProperties = await parentModel.resolveComputedProperties( extraProperties )

            if ('fields' in resolvedProperties && 'pipeline' in resolvedProperties) {
                result[''] = resolvedProperties as { fields: Document, pipeline: Document[] };
            }
            else if (Object.keys(resolvedProperties).length > 0)
            {
                for ( const prefix in resolvedProperties )
                {
                    result[prefix] = resolvedProperties[prefix];
                }
            }
        }
        else if ( extraProperties.length > 0 )
        {
            throw new Error( `Custom computed properties contain unsupported properties - ${extraProperties.join(', ')}` );
        }

        return result;
    }

    private async filterStages( list: PropertyModelListOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>> )
    {
        const sort = list.sort ?? { id: -1 };

        const accessFilter = await this.accessFilter();
        const cursorFilter = list.cursor ? generateCursorCondition( list.cursor, sort ) : undefined;

        const stageFilter = optimizeMatch({ $and:  [ addPrefixToFilter( { $and: [ list.filter, accessFilter, cursorFilter ]}, this.prefix ) ]} as MongoFilter<DBE>);
        return splitFilterToStages( stageFilter as MongoFilter<DBE>, this.prefix ) as Filter<RootDBE>
    }

    private splitProjection( projection: PropertyModelListOptions<RootDBE, DBE, SecondType<Extensions['smartFilters']>>['projection'] ): {rootProjection?: any, propertyProjection?: any}
    {
        if ( !projection ) { return {}; }

        let { _root: rootProjection, ...propertyProjection } = projection;

        // add to _root all properties from propertyProjection starting with _root
        for ( let key in propertyProjection )
        {
            if( key.startsWith('_root.') )
            {
                if ( !rootProjection )
                {
                    rootProjection = {};
                }
                rootProjection[key.replace('_root.', '')] = propertyProjection[key];
                delete propertyProjection[key];
            }
        }

        return { rootProjection, propertyProjection };
    }
}