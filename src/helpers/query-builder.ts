import { MongoRootDocument } from '../types';
import { Document, Filter, Sort } from 'mongodb';
import { collectAddedFields, generateCursorCondition, isSet, mergeFilters, optimizeMatch, resolveBSONObject, reverseSort } from './mongo';

export type ListParams<DBE extends MongoRootDocument> =
{
    accessFilter?: Filter<DBE>
    filter?: Filter<DBE>
    smartFilter?: {filter?: Filter<DBE>, pipeline?: Document[]}
    pipeline?: Document[]
    projection?: Document,
    skip?: number,
    sort?: Sort
    limit?: number
    cursor?: string
}

const COUNT_IGNORE_STAGES = [ '$limit', '$skip', '$sort', '$project', '$addFields', '$unset' ];

export default class QueryBuilder<DBE extends MongoRootDocument>
{
    async pipeline( params: ListParams<DBE> )
    {
        const options = resolveBSONObject( params );
        const accessFilter = options.accessFilter
        let filter = mergeFilters(
            options.filter,
            options.smartFilter?.filter,
            accessFilter,
            options.cursor ? generateCursorCondition( options.cursor, options.sort || {} ) : undefined
        );

        let prev = options.cursor?.startsWith('prev:')

        const addedFields = collectAddedFields( [...(options.pipeline || []), ...(options.smartFilter?.pipeline || []) ] )

        return resolveBSONObject([
            ...( isSet(filter) ? [{ $match: optimizeMatch( filter ) }] : []),
            ...( options.smartFilter?.pipeline || [] ),
            ...( options.projection ? [{ $project: options.projection }] : []),
            ...( options.pipeline || [] ),
            ...( addedFields.length ? [{ $unset: addedFields }] : []),
            ...( options.sort ? [{ $sort: prev ? reverseSort( options.sort ) : options.sort }] : []),
            ...( options.skip ? [{ $skip: options.skip }] : []),
            ...( options.limit ? [{ $limit: options.limit }] : []),
        ]) as Document[];
    }

    async count( params: ListParams<DBE> )
    {
        const { cursor, ...options } = params;
        return this.buildCountPipeline(await this.pipeline({ ...options }));
    }

    /**
     * Removes stages from the end of the pipeline that don't affect the count, adds $count stage
     */
    buildCountPipeline( pipeline: Document[] )
    {
        while ( pipeline.length > 0 && COUNT_IGNORE_STAGES.includes( Object.keys( pipeline[pipeline.length - 1] )[0] ))
        {
            pipeline = pipeline.slice( 0, -1 );
        }

        pipeline.push({ $count: 'count' })

        return pipeline;
    }
}