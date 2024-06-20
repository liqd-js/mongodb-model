import {Document, FindOptions} from "mongodb";
import {AbstractConverter, AbstractConverters, AbstractSmartFilters, MongoPropertyDocument, MongoRootDocument} from "./external";

/**
 * Utility types
 */
export type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

export type SmartFilterMethod = ( params: any ) => { pipeline: Document[] | null, filter: Document | null };

export type AbstractConverterOptions<DBE extends Document> =
    {
        converter       : AbstractConverter<DBE>,
        projection?     : FindOptions<DBE>['projection'],
        cache?          : { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
    }

export type ModelExtensions<DBE extends MongoRootDocument | MongoPropertyDocument, SmartFilters extends AbstractSmartFilters<any> = never> =
    {
        converters      : AbstractConverters<DBE>,
        smartFilters?   : SmartFilters
    }