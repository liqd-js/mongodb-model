import { ObjectId } from 'mongodb';
import { objectStringify } from '@liqd-js/fast-object-hash';
import { flowGet } from '../internal';
import crypto from 'crypto';

export function i18n( i18n: { [key: string]: string } | string ): string
{
    if( typeof i18n === 'string' ){ return i18n }

    const locales: Set<string> = flowGet('locales') || [];

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

export function multiI18n( i18n: { [key: string]: string } | string ): {[key: string]: string }
{
    const locales: Set<string> = flowGet('locales') || [];
    const result: {[key: string]: string } = {};

    for( let locale of locales )
    {
        if( typeof i18n === 'string' )
        {
            result[locale] = i18n;
        }
        else if( i18n.hasOwnProperty( locale ))
        {
            result[locale] = i18n[locale]!;
        }
        else
        {
            result[locale] = i18n.en ?? i18n[Object.keys(i18n)[0]]!;
        }
    }

    return result;
}

export function deleteNullishProperties(obj: any ): void
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
                deleteNullishProperties( obj[i] );
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
                deleteNullishProperties( obj[key] );
            }
        }
    }
}


/**
 * TODO
 * @param obj
 * @param options
 */
export function objectHash( obj: any, options: { sort?: boolean, alg?: 'plain' | 'sha1' | 'sha256' | 'cyrb64' } = {})
{
    const value = objectStringify( obj, { sortArrays: options.sort, ignoreUndefinedProperties: true, toString: ( obj: any ) => obj instanceof ObjectId ? `ObjectId("${obj.toString()}")` : undefined });

    return options.alg !== 'plain' ? crypto.createHash( options.alg ?? 'sha1' ).update( value ).digest('hex') : value;
}

export function objectHashID( obj: any, options: { sort?: boolean, alg?: 'sha1' | 'sha256'  } = {})
{
    return new ObjectId( objectHash( obj, options ).substring(0, 24) );
}


export function objectSet( obj: Record<string, unknown>, path: string[], value: unknown )
{
    if ( !path.length )
    {
        throw new Error('Path is empty');
    }

    if( path.length === 1 )
    {
        obj[ path[0] ] = value;
    }
    else
    {
        if( !obj[ path[0] ]){ obj[ path[0] ] = {}}

        objectSet( obj[ path[0] ] as Record<string, unknown>, path.slice(1), value );
    }

    return obj;
}

export function objectGet( obj: Record<string, unknown>, path: string[] ): any
{
    if ( !path.length )
    {
        throw new Error('Path is empty');
    }

    if( path.length === 1 )
    {
        return obj[ path[0] ];
    }
    else
    {
        if( !obj[ path[0] ]){ return undefined }

        return objectGet( obj[ path[0] ] as Record<string, unknown>, path.slice(1));
    }
}

function objectFlattenRecursive( value: any, result: Record<string, unknown>, prefix: string )
{
    if( typeof value !== 'object' ||
        (
            ( value instanceof ObjectId ) ||
            ( value instanceof Date )  ||
            ( value instanceof RegExp ) || // TODO is basic object alternative?
            ( value === null )
        ))
    {
        result[prefix] = value;
    }
    else if ( Array.isArray( value ) )
    {
        for ( let i = 0; i < value.length; i++ )
        {
            objectFlattenRecursive( value[i], result, prefix ? `${prefix}.${i}` : `${i}` );
        }
    }
    else
    {
        for( const [ key, val ] of Object.entries( value ))
        {
            objectFlattenRecursive( val, result, prefix ? `${prefix}.${key}` : key );
        }
    }
}

export function objectFlatten( obj: Record<string, unknown> ): Record<string, unknown>
{
    const result: Record<string, unknown> = {};

    for( const [ key, value ] of Object.entries( obj ))
    {
        objectFlattenRecursive( value, result, key );
    }

    return result;
}