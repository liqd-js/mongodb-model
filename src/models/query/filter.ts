import AbstractQuery, {QueryParams} from "./abstract";
import {Collection, Document, Filter} from "mongodb";
import {AbstractConverter, MongoRootDocument} from "../../types";
import {generateCursorCondition, isSet, resolveBSONObject, reverseSort, sortProjection} from "../../helpers";

export default class FilterQuery<DBE extends MongoRootDocument, DTO extends Document> extends AbstractQuery<DBE, DTO>
{
    constructor( collection: Collection<DBE>, params: QueryParams<DBE>, converter?: AbstractConverter<DBE> )
    {
        super( collection, params, converter );
    }

    public async execute(): Promise<DTO>
    {
        const data = await this.collection.find(
            resolveBSONObject( this.resolveFilter( true ) ),
            {
                projection: cache?.list ? sortProjection( sort, '_id' ) : projection,
                limit: limit ? limit + 1 : limit,
                sort: prev ? reverseSort( sort ) : sort,
                ...options
            }).toArray();

        // TODO: convert

    }

    public async count(): Promise<number>
    {
        return this.collection.countDocuments( resolveBSONObject( this.buildFilter( true )));
    }
}