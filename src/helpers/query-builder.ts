import PipelineQuery from "../models/query/pipeline";
import FilterQuery from "../models/query/filter";

export default class QueryBuilder
{
    private params: any;

    constructor()
    {
    }

    private hasPipeline()
    {
        return false;
    }

    build()
    {
        return this.hasPipeline()
            ? new PipelineQuery(this.params, undefined)
            : new FilterQuery(this.params, undefined);
    }
}