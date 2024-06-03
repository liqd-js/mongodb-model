import { MongoRootDocument } from '../types';
import { Document, Filter, Sort } from 'mongodb';
import { collectAddedFields, generateCursorCondition, isSet, mergeFilters, optimizeMatch, resolveBSONObject, reverseSort } from './mongo';

export type ListParams<DBE extends MongoRootDocument> =
{
    accessFilter?: Filter<DBE>
    filter?: Filter<DBE>
    customFilter?: {filter: Filter<DBE>, pipeline: Document[]}
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
        const accessFilter = params.accessFilter
        let filter = mergeFilters(
            params.filter,
            params.customFilter?.filter,
            accessFilter,
            params.cursor ? generateCursorCondition( params.cursor, params.sort || {} ) : undefined
        );

        let prev = params.cursor?.startsWith('prev:')

        const addedFields = collectAddedFields( [...(params.pipeline || []), ...(params.customFilter?.pipeline || []) ] )

        return resolveBSONObject([
            ...( isSet(filter) ? [{ $match: optimizeMatch( filter ) }] : []),
            ...( params.customFilter?.pipeline || [] ),
            ...( params.projection ? [{ $project: params.projection }] : []),
            ...( params.pipeline || [] ),
            ...( addedFields.length ? [{ $unset: addedFields }] : []),
            ...( params.sort ? [{ $sort: prev ? reverseSort( params.sort ) : params.sort }] : []),
            ...( params.skip ? [{ $skip: params.skip }] : []),
            ...( params.limit ? [{ $limit: params.limit }] : []),
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