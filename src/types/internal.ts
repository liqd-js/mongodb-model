import {Document, FindOptions} from "mongodb";
import {AbstractModelConverter, AbstractModelConverters, AbstractModelSmartFilters, MongoPropertyDocument, MongoRootDocument} from "./external";

/**
 * Utility types
 */
export type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

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