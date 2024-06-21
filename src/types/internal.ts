import {Document, FindOptions} from "mongodb";
import {AbstractModelConverter, AbstractModelConverters, AbstractModelSmartFilters, AbstractPropertyModelSmartFilters, MongoPropertyDocument, MongoRootDocument} from "./external";

/**
 * Utility types
 */
export type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

export type ModelSmartFilter<T> = { [K in PublicMethodNames<T>]?: FirstParameter<T[K]> }

export type SmartFilterMethod = ( params: any ) => { pipeline: Document[] | null, filter: Document | null };

export type AbstractModelFromConverter<DBE extends Document, T> = (data: T ) => ( Omit<DBE, '_id'> & { _id?: DBE['_id'] }) | (Promise<Omit<DBE, '_id'> & { _id?: DBE['_id'] }>);
export type AbstractConverterOptions<DBE extends Document> =
    {
        converter       : AbstractModelConverter<DBE>,
        projection?     : FindOptions<DBE>['projection'],
        cache?          : { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
    }

export type ModelExtensions<DBE extends MongoRootDocument | MongoPropertyDocument, SmartFilters extends AbstractModelSmartFilters<any> = never> =
    {
        converters      : AbstractModelConverters<DBE>,
        smartFilters?   : SmartFilters
    }
export type PropertyModelExtensions<DBE extends MongoRootDocument | MongoPropertyDocument, SmartFilters extends AbstractPropertyModelSmartFilters<any> = never> =
    {
        converters      : AbstractModelConverters<DBE>,
        smartFilters?   : SmartFilters
    }

export type FirstType<T extends any[]> = T extends [infer U, ...infer Rest] ? U : never;

// TODO: dá sa poslať ako druhý parameter funkcia? - napr. AbstractModelSmartFilters
export type TypeMap<T extends any[]> = T extends [infer U, ...infer Rest]
    ? [AbstractModelSmartFilters<U>, ...TypeMap<Rest>]
    : [];