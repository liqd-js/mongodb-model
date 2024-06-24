import {Document, Filter, FindOptions} from "mongodb";
import {AbstractConverterOptions, AbstractModelFromConverter, FirstType, ModelSmartFilter, SmartFilterMethod, TypeMap} from "./internal";
import {ApplicationFilters, EngagementFilters} from "../tmp/filters";

export type CreateOptions = { duplicateIgnore?: boolean };
export type MongoRootDocument = Document & { _id: any };
export type MongoPropertyDocument = Document & ({ id: any } | { _id: any });
export type WithTotal<T> = T & { total?: number };

export type PropertyModelFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { _root?: Filter<RootDBE> };

export type ModelListOptions<DBE extends Document, Filters = never> = FindOptions<DBE> &
    {
        filter?         : Filter<DBE>,
        smartFilter?    : ModelSmartFilter<Filters>,
        cursor?         : string,
        pipeline?       : Document[],
        count?          : boolean
    };
export type PropertyModelListOptions<RootDBE extends Document, DBE extends Document, Filters extends AbstractModelSmartFilters<any> = never> = Omit<FindOptions<DBE>, 'projection'> &
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
export type PropertyModelFindOptions<RootDBE extends Document, DBE extends Document, Filters extends AbstractModelSmartFilters<any> = never> =
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

export type TupleToUnion<T extends any[]> = T extends [infer U, ...infer Rest]
    ? U & TupleToUnion<Rest>
    : never;

export type PropertyModelAggregateOptions<RootDBE extends Document, DBE extends Document, Filters extends AbstractModelSmartFilters<any> = never> =
    {
        filter?         : PropertyModelFilter<RootDBE, DBE>
        smartFilter?    : ModelSmartFilter<Filters>
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
export type AbstractPropertyModelSmartFilters<T extends AbstractModelSmartFilters<any>, P extends AbstractModelSmartFilters<any>> = T extends never ? undefined : [T, P]

/*
 * len skuska
 */

export type ModelUpdateResponse = { matchedCount: number, modifiedCount: number };