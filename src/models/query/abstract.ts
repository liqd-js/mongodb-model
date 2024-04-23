import {Collection, Document, Filter} from "mongodb";
import {generateCursorCondition, getCursor, isSet} from "../../helpers";
import {AbstractConverter, ModelListOptions, MongoRootDocument} from "../../types";
import {convert} from "../../model";

export type QueryParams<DBE extends MongoRootDocument> =
    {
        accessFilter?: () => Promise<Filter<DBE> | void>,
        filter?: Filter<DBE>,
        customFilter?: { filter?: Filter<DBE>, pipeline?: Document[] },
        pipeline?: Document[],
        projection?: any,
        sort?: any,
        limit?: number,
        cursor?: string
    }

export default abstract class AbstractQuery<DBE extends MongoRootDocument, DTO extends Document>
{
    protected constructor( protected collection: Collection<DBE>, protected params: QueryParams<DBE>, protected converter?: AbstractConverter<DBE> )
    {
    }

    public abstract execute(): Promise<DTO>;
    public abstract count(): Promise<number>;

    protected async resolveFilter( cursor: boolean ): Promise<Filter<DBE>>
    {
        let filter = {};

        const accessFilter = this.params.accessFilter && await this.params.accessFilter()
        if ( accessFilter )
        {
            filter = isSet(this.params.filter) ? { $and: [ this.params.filter, accessFilter ] } : accessFilter;
        }

        if ( this.params.customFilter )
        {
            if ( this.params.customFilter.filter )
            {
                filter = isSet(filter) ? { $and: [ filter, this.params.customFilter.filter ] } : this.params.customFilter.filter;
            }
        }

        if ( cursor && this.params.cursor )
        {
            filter = { $and: [ filter, generateCursorCondition( this.params.cursor, this.params.sort )]}
        }

        return filter;
    }

    protected convertTo()
    {
        const result = await Promise.all( entries.map( async( dbe, i ) =>
        {
            const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Converters[K]['converter']> & { $cursor?: string };

            if(( limit && ( i > 0 || ( cursor && ( !prev || !last ))) && !( last && !prev && i === entries.length - 1 )))
            {
                dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
            }

            return dto;
        }));
    }
}