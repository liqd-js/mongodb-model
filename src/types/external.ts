import {Document, Filter, FindOptions} from "mongodb";
import {AbstractConverterOptions, AbstractModelFromConverter, ComputedPropertyMethod, FirstParameter, PublicMethodNames, SmartFilterMethod} from "./internal";

export type ModelCreateOptions = { duplicateIgnore?: boolean };
export type ModelUpdateOptions = { documentBefore?: boolean, documentAfter?: boolean, /* TODO upsert a ine veci */ };
export type MongoRootDocument = Document & { _id: any };
export type MongoPropertyDocument = Document & ({ id: any } | { _id: any });
export type WithTotal<T> = T & { total?: number };

export type ModelSmartFilter<T> = { [K in PublicMethodNames<T>]?: FirstParameter<T[K]> }

export type PropertyModelFilter<RootDBE extends Document, DBE extends Document> = Filter<DBE> & { _root?: Filter<RootDBE> };

export type ModelListOptions<DBE extends Document, Filters = never> = FindOptions<DBE> &
    {
        filter?             : Filter<DBE>,
        smartFilter?        : ModelSmartFilter<Filters>,
        cursor?             : string,
        pipeline?           : Document[],
        count?              : boolean,
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

export type FirstType<T> = T extends [infer U, ...infer Rest] ? U : undefined;
export type SecondType<T> = T extends [infer U, infer V, ...infer Rest] ? V : undefined;

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

export type AbstractModelProperties<T> = T extends never ? undefined : { [K in keyof T]: T[K] extends Function ? ComputedPropertyMethod : T[K] }

export type ModelUpdateResponse<DBE extends Document> = { matchedCount: number, modifiedCount: number, documentBefore?: DBE, documentAfter?: DBE };

export type ConstructorExtensions<E extends PropertyModelExtensions<any, any, any>> = Omit<E, 'smartFilters'> & { smartFilters?: FirstType<E['smartFilters']> }

export type ModelExtensions<DBE extends MongoRootDocument | MongoPropertyDocument, SmartFilters extends AbstractModelSmartFilters<any> = never, ComputedProperties extends AbstractModelProperties<any> = never> =
    {
        converters      : AbstractModelConverters<DBE>,
        smartFilters?   : SmartFilters,
        computedProperties?: ComputedProperties,
    }
export type PropertyModelExtensions<DBE extends MongoRootDocument | MongoPropertyDocument, SmartFilters extends AbstractPropertyModelSmartFilters<any, any> = never, ComputedProperties extends AbstractModelProperties<any> = never> =
    {
        converters          : AbstractModelConverters<DBE>,
        smartFilters?       : SmartFilters,
        computedProperties? : ComputedProperties,
    }