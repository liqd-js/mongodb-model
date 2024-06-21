
import { flowStart, flowGet, flowSet, map, LOG } from '../internal/utils';

export * from './mongo';

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
