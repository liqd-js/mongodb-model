import {MongoRootDocument} from "../types";
import {Filter,Document} from "mongodb";
import {generateCursorCondition, isSet, optimizeMatch, reverseSort} from "./mongo";

export type ListParams<DBE extends MongoRootDocument> =
    {
        accessFilter?: () => Promise<Filter<DBE> | void>,
        filter?: Filter<DBE>,
        // customFilter?: { filter?: Filter<DBE>, pipeline?: Document[] },
        pipeline?: Document[],
        // projection?: any,
        sort?: any,
        // limit?: number,
        cursor?: string
    }

export default class QueryBuilder<DBE extends MongoRootDocument>
{
    async list( params: ListParams<DBE> )
    {
        let filter = params.filter || {};

        const accessFilter = params.accessFilter && await params.accessFilter()

        accessFilter && ( filter = isSet(filter) ? { $and: [ filter, accessFilter ] } : accessFilter );

        params.cursor && ( filter = { $and: [ filter, generateCursorCondition( params.cursor, params.sort )]});
        let prev = params.cursor?.startsWith('prev:')
        let last = true;

        return [
            { $match: optimizeMatch( filter ) },
            ...( params.pipeline || [] ),
            // ...( params.sort ? [{ $sort: prev ? reverseSort( params.sort ) : params.sort }] : []),
        ]
    }
}