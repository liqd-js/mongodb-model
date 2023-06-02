const Flow = require('@liqd-js/flow');

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