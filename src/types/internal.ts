import { Document, FindOptions, ObjectId } from 'mongodb';
import { AbstractModelConverter, AbstractModelSmartFilters } from './external';

export type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
export type PublicMethodNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

export type AsyncSmartFilterMethod = ( params: any ) => Promise<{ pipeline: Document[] | null, filter: Document | null }>
export type SyncSmartFilterMethod = ( params: any ) => { pipeline: Document[] | null, filter: Document | null }
export type SmartFilterMethod = AsyncSmartFilterMethod | SyncSmartFilterMethod;

export type AsyncComputedPropertyMethod = ( params: any ) => Promise<{ fields: Document | null, pipeline: Document[] | null }>;
export type SyncComputedPropertyMethod = ( params: any ) => { fields: Document | null, pipeline: Document[] | null };
export type ComputedPropertyMethod = AsyncComputedPropertyMethod | SyncComputedPropertyMethod;

export type AbstractModelFromConverter<DBE extends Document, T> = (data: T ) => ( Omit<DBE, '_id'> & { _id?: DBE['_id'] }) | (Promise<Omit<DBE, '_id'> & { _id?: DBE['_id'] }>);
export type AbstractConverterOptions<DBE extends Document, ComputedProperties = never> =
{
    converter           : AbstractModelConverter<DBE>,
    projection?         : FindOptions<DBE>['projection'],
    computedProperties? : string[] | ( (...args: any) => string[] ),
    cache?              : { retention?: string, cap?: string, frequency?: number, list?: boolean, precache?: boolean }, // precache prefetchne dalsiu stranu cez cursor
}

export type ComputedPropertiesParam = string[] | ( (...args: any) => string[] );

// TODO: dá sa poslať ako druhý parameter funkcia? - napr. AbstractModelSmartFilters
export type TypeMap<T extends any[]> = T extends [infer U, ...infer Rest]
    ? [AbstractModelSmartFilters<U>, ...TypeMap<Rest>]
    : [];

export type ExpandPaths<T, Prefix extends string = ''> = /*T extends (infer U)[]
    ? `${Prefix}${number}` | ExpandPaths<U, `${Prefix}${number}.`>
    :*/ T extends object
        ? {
            [K in keyof T]: 
            K extends string 
                ? T[K] extends object 
                ? `${Prefix}${K}` | ExpandPaths<T[K], `${Prefix}${K}.`>
                : `${Prefix}${K}`
                : never
        }[keyof T]
        : never;
  
export type PathValue<T, Path extends string> = Path extends `${infer P}.${infer Rest}`
    ? P extends keyof T
        ? PathValue<T[P], Rest>
        : never
    : Path extends keyof T
        ? T[Path]
        : never;