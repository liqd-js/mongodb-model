const Flow = require('@liqd-js/flow');

import { ObjectId } from 'mongodb'; 

export * from './mongo';

export function flowStart( callback: Function, scope: object )
{
    Flow.start( callback, scope );
}

export function flowGet<T>( key: string, fallback?: T ): T
{
    return Flow.get( key, fallback );
}

export function i18n( i18n: { [key: string]: string } | string ): string
{
    if( typeof i18n === 'string' ){ return i18n }

    const locales: Set<string> = Flow.get('locales') || [];

    for( let locale of locales )
    {
        if( i18n.hasOwnProperty( locale ))
        {
            return i18n[locale]!;
        }
    }

    if( i18n.en ){ return i18n.en }

    return i18n[Object.keys(i18n)[0]]!;
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

export function DUMP( obj: object )
{
    console.log( stringify( obj ));
}

const formatter = new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', fractionalSecondDigits: 3, hour12: false });

export class Benchmark
{
    public start = new Date();
    public last = Date.now();

    public elapsed()
    {
        return Date.now() - this.start.getTime();
    }

    public step()
    {
        const now = Date.now(), step = now - this.last;

        this.last = now;

        return step;
    }

    public get startTime()
    {
        return formatter.format( this.start );
    }

    public get time()
    {
        return formatter.format( new Date() );
    }
}

export function deleteNullProperties( obj: any ): void
{
    if( Array.isArray( obj ))
    {
        for( var i = obj.length - 1; i >= 0; --i )
        {
            if( obj[i] === null || obj[i] === undefined )
            {
                obj.splice( i, 1 );
            }
            else if( typeof obj[i] === 'object' )
            {
                deleteNullProperties( obj[i] );
            }
        }
    }
    else if( obj )
    {
        for( var [ key, value ] of Object.entries( obj ))
        {
            if( value === null || value === undefined )
            {
                delete obj[key];
            }
            else if( typeof obj[key] === 'object' )
            {
                deleteNullProperties( obj[key] );
            }
        }
    }
}