import {Document, FindOptions} from "mongodb";
import {AbstractModelConverter, AbstractModelSmartFilters} from "./external";

export type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

export type AsyncSmartFilterMethod = ( params: any ) => Promise<{ pipeline: Document[] | null, filter: Document | null }>
export type SyncSmartFilterMethod = ( params: any ) => { pipeline: Document[] | null, filter: Document | null }
export type SmartFilterMethod = AsyncSmartFilterMethod | SyncSmartFilterMethod;
export type ComputedPropertyMethod = ( params: any ) => { fields: Document | null, pipeline: Document[] | null };

export type AbstractModelFromConverter<DBE extends Document, T> = (data: T ) => ( Omit<DBE, '_id'> & { _id?: DBE['_id'] }) | (Promise<Omit<DBE, '_id'> & { _id?: DBE['_id'] }>);
export type AbstractConverterOptions<DBE extends Document, ComputedProperties = never> =
    {
        converter           : AbstractModelConverter<DBE>,
        projection?         : FindOptions<DBE>['projection'],
        computedProperties? : string[] | ( (...args: any) => string[] ),
        cache?              : { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
    }

// TODO: dá sa poslať ako druhý parameter funkcia? - napr. AbstractModelSmartFilters
export type TypeMap<T extends any[]> = T extends [infer U, ...infer Rest]
    ? [AbstractModelSmartFilters<U>, ...TypeMap<Rest>]
    : [];