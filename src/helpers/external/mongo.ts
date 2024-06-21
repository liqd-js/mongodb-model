import {Document, ObjectId} from 'mongodb';
import crypto from 'crypto';
import {AbstractConverter} from "../../types";
import {ModelConverterError} from "./errors";
import {objectStringify} from "@liqd-js/fast-object-hash";

export const toBase64 = ( str: string ) => Buffer.from( str, 'utf8' ).toString('base64url');
export const fromBase64 = ( str: string ) => Buffer.from( str, 'base64url' ).toString('utf8');

export async function convert<DBE extends Document>( model: object, converter: AbstractConverter<DBE>, dbe: DBE, conversion: string | number | symbol )
{
    try
    {
        return await converter( dbe );
    }
    catch( e )
    {
        if( e instanceof ModelConverterError )
        {
            throw e;
        }

        throw new ModelConverterError( model, conversion.toString(), dbe._id ?? dbe.id, e as Error );
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