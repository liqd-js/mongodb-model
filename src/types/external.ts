import {Document, Filter, FindOptions} from "mongodb";
import {AbstractConverterOptions, AbstractModelFromConverter, FirstParameter, PublicMethodNames, SmartFilterMethod} from "./internal";

export type CreateOptions = { duplicateIgnore?: boolean };
export type MongoRootDocument = Document & { _id: any };
export type MongoPropertyDocument = Document & ({ id: any } | { _id: any });
export type WithTotal<T> = T & { total?: number };

export type ModelSmartFilter<T> = { [K in PublicMethodNames<T>]?: FirstParameter<T[K]> }

export type PropertyModelFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { _root?: Filter<RootDBE> };

export type ModelListOptions<DBE extends Document, Filters = never> = FindOptions<DBE> &
    {
        filter?         : Filter<DBE>,
        smartFilter?    : ModelSmartFilter<Filters>,
        cursor?         : string,
        pipeline?       : Document[],
        count?          : boolean
    };
export type PropertyModelListOptions<RootDBE extends Document, DBE extends Document, Filters = never> = Omit<FindOptions<DBE>, 'projection'> &
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : ModelSmartFilter<Filters>,
        cursor?         : string
        projection?     : FindOptions<DBE>['projection'] & { _root?: FindOptions<RootDBE>['projection'] },
        pipeline?       : Document[],
        count?          : boolean
    };

export type ModelFindOptions<DBE extends Document, Filters = never> =
    {
        filter?         : Filter<DBE>
        smartFilter?    : ModelSmartFilter<Filters>,
    }
export type PropertyModelFindOptions<RootDBE extends Document, DBE extends Document, Filters = never> =
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : ModelSmartFilter<Filters>,
    }

export type ModelAggregateOptions<DBE extends Document, Filters = never> =
    {
        filter?         : Filter<DBE>
        smartFilter?    : ModelSmartFilter<Filters>,
        projection?     : FindOptions<DBE>['projection']
    };
export type PropertyModelAggregateOptions<RootDBE extends Document, DBE extends Document, Filters = never> =
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : ModelSmartFilter<Filters>,
        projection?     : FindOptions<DBE & { _root: RootDBE }>['projection']
    };

export type AbstractModelConverter<DBE extends Document> = (dbe: DBE ) => unknown | Promise<unknown>;

export type AbstractModelConverters<DBE extends Document> =
    {
        from?   : { [key: string]: AbstractModelFromConverter<DBE, any> },
        dto     : AbstractConverterOptions<DBE>,
    }
    &
    {
        [key: string]: AbstractConverterOptions<DBE>
    }

export type AbstractModelSmartFilters<T> = T extends never ? undefined : { [K in keyof T]: T[K] extends Function ? SmartFilterMethod : T[K] }

export type ModelUpdateResponse = { matchedCount: number, modifiedCount: number };