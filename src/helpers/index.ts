const Flow = require('@liqd-js/flow');

export function flowStart( callback: Function, scope: object )
{
    Flow.start( callback, scope );
}

export function flowGet<T>( key: string, fallback: T ): T
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