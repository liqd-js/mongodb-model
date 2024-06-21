import {ObjectId} from "mongodb";

export const REGISTER_MODEL = Symbol('REGISTER_MODEL');
export const GET_PARENT = Symbol('GET_PARENT');

const Flow = require('@liqd-js/flow');

export function flowStart( callback: Function, scope: object )
{
    Flow.start( callback, scope );
}

export function flowGet<T>( key: string, fallback?: T ): T
{
    return Flow.get( key, fallback );
}

export function flowSet( key: string, value: any )
{
    Flow.set( key, value );
}

export function map<T,E>(ids: T[], entries: E[], getID: (e: E ) => T ): Array<E | null>
{
    console.log({ entries });

    const index = new Map<T,E>( entries.map( e => [ getID( e ), e ] ));

    return ids.map( id => index.get( id ) ?? null );
}

const { inspect } = require('util');

export function LOG( ...args: unknown[] )
{
    console.log( ...args.map( a => typeof a === 'string' ? a : inspect( a, { colors: true, depth: Infinity })));
}

function stringify(value: any, indentation: string = ''): string
{
    if (typeof value === 'undefined') {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        const elements = value.map((element) => stringify(element, indentation));
        return '[' + elements.join(',') + ']';
    }
    if (typeof value === 'object') {
        if (value instanceof Date) { return 'ISODate("' + value.toISOString() + '")' }
        if (value instanceof RegExp) { return value.toString() }
        if (value instanceof ObjectId) { return 'ObjectId("' + value.toHexString() + '")' }

        const properties = Object.keys(value).map((key) => {
            const val = stringify(value[key], indentation + '  ');
            return indentation + '"' + key + '": ' + val;
        });
        return '{\n' + properties.join(',\n') + '\n' + indentation + '}';
    }
    return '';
}

export function hasPublicMethod( obj: any, method: string ): boolean
{
    return method in obj && typeof (obj as any)[method] === 'function';
}

export function DUMP( obj: object )
{
    console.log( stringify( obj ));
}