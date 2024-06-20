import {Document, Filter, FindOptions} from "mongodb";

export type CreateOptions = { duplicateIgnore?: boolean };
export type MongoRootDocument = Document & { _id: any };
export type MongoPropertyDocument = Document & ({ id: any } | { _id: any });
export type WithTotal<T> = T & { total?: number };

export type PropertyModelFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { _root?: Filter<RootDBE> };
export type ModelListOptions<DBE extends Document, Filters = never> = FindOptions<DBE> &
    {
        filter?         : Filter<DBE>,
        smartFilter?    : {[key in PublicMethodNames<Filters>]?: any},
        cursor?         : string,
        pipeline?       : Document[],
        count?          : boolean
    };

export type PropertyModelListOptions<RootDBE extends Document, DBE extends Document, Filters = never> = Omit<FindOptions<DBE>, 'projection'> &
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : {[key in PublicMethodNames<Filters>]?: any},
        cursor?         : string
        projection?     : FindOptions<DBE>['projection'] & { _root?: FindOptions<RootDBE>['projection'] },
        pipeline?       : Document[],
        count?          : boolean
    };

export type ModelAggregateOptions<DBE extends Document, Filters = never> =
    {
        filter?         : Filter<DBE>
        smartFilter?    : {[key in PublicMethodNames<Filters>]?: any},
        projection?     : FindOptions<DBE>['projection']
    };
export type PropertyModelAggregateOptions<RootDBE extends Document, DBE extends Document, Filters = never> =
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : {[key in PublicMethodNames<Filters>]?: any},
        projection?     : FindOptions<DBE & { _root: RootDBE }>['projection']
    };

export type AbstractConverter<DBE extends Document> = ( dbe: DBE ) => unknown | Promise<unknown>;
export type AbstractFromConverter<DBE extends Document, T> = ( data: T ) => ( Omit<DBE, '_id'> & { _id?: DBE['_id'] }) | (Promise<Omit<DBE, '_id'> & { _id?: DBE['_id'] }>);

export type AbstractConverterOptions<DBE extends Document> =
    {
        converter       : AbstractConverter<DBE>,
        projection?     : FindOptions<DBE>['projection'],
        cache?          : { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
    }

export type AbstractConverters<DBE extends Document> =
    {
        from?   : { [key: string]: AbstractFromConverter<DBE, any> },
        dto     : AbstractConverterOptions<DBE>,
    }
    &
    {
        [key: string]: AbstractConverterOptions<DBE>
    }

export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

export type FilterMethod = ( params: any ) => { pipeline: Document[] | null, filter: Document | null };
export type AbstractFilters<T> = { [K in keyof T]: T[K] extends Function ? FilterMethod : T[K] }

export type ModelParams<DBE extends MongoRootDocument | MongoPropertyDocument, Filters extends AbstractFilters<Filters> = never> = {
    converters  : AbstractConverters<DBE>,
    filters?    : Filters
}

export type UpdateResponse = { matchedCount: number, modifiedCount: number };