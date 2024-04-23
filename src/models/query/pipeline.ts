import AbstractQuery, {QueryParams} from "./abstract";
import {Document, Filter, WithId} from "mongodb";
import {AbstractConverter, MongoRootDocument} from "../../types";
import {generateCursorCondition, isSet} from "../../helpers";

export default class PipelineQuery<DBE extends MongoRootDocument, DTO extends Document> extends AbstractQuery<DBE, DTO>
{
    constructor( params: QueryParams<DBE>, converter?: AbstractConverter<DBE> )
    {
        super( params );
    }

    public async execute(): Promise<DTO>
    {
        let filter = this.params.filter || {};
        const accessFilter = this.params.accessFilter && await this.params.accessFilter();
        if ( accessFilter )
        {
            filter = isSet( filter ) ? { $and: [ filter, accessFilter ] } : accessFilter;
        }
        if ( this.params.customFilter )
        {
            filter = isSet( filter ) ? { $and: [ filter, this.params.customFilter ] } : this.params.customFilter;
        }

        if ( this.params.cursor )
        {
            filter = { $and: [ filter, generateCursorCondition( this.params.cursor, this.params.sort )]}
        }

        // let entries: WithId<DBE>[] = [], total = undefined;
        //
        // if( !isSet( list.pipeline ))
        // {
        //     entries = await this.collection.find( resolveBSONObject( filter ), { projection: cache?.list ? sortProjection( sort, '_id' ) : projection, limit: limit ? limit + 1 : limit, sort: prev ? reverseSort( sort ) : sort, ...options }).toArray();
        //
        //     if( list.count )
        //     {
        //         total = await this.collection.countDocuments( resolveBSONObject( filter ));
        //     }
        // }
        //
        // ( !( last = limit ? entries.length <= limit : true )) && entries.pop();
        // prev && entries.reverse();
        //
        // if( cache?.list )
        // {
        //     flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} entries `, entries );
        // }
        //
        // // TODO vytiahnut cez projection len _idcka, sort stlpce a potom dotiahnut data cez get aby sa pouzila cache
        //
        // const result = await Promise.all( entries.map( async( dbe, i ) =>
        // {
        //     const dto = await ( cache?.list ? this.get( this.dtoID( dbe._id ), conversion ) : convert( this, converter, dbe as DBE, conversion )) as ReturnType<Converters[K]['converter']> & { $cursor?: string };
        //
        //     if(( limit && ( i > 0 || ( cursor && ( !prev || !last ))) && !( last && !prev && i === entries.length - 1 )))
        //     {
        //         dto.$cursor = getCursor( dbe, sort ); // TODO pozor valka klonu
        //     }
        //
        //     return dto;
        // }));
        //
        // let convetor = perf.step();
        //
        // flowGet( 'benchmark' ) && LOG( `${perf.time} ${this.constructor.name} list in ${find} ms, convert in ${convetor} ms = ${find+convetor} ms` );
        //
        // if( list.count )
        // {
        //     Object.defineProperty( result, 'total', { value: total ?? 0, writable: false });
        // }
        //
        // return result;
    }

    public async count(): Promise<number>
    {
        return 0;
    }
}