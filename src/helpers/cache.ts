export default class Cache
{
    private static cache: Map<any, Map<string, Map<any, any>>> = new Map();

    constructor()
    {
        
    }

    public static set<T>( convertor: any, type: string, id: any, value: T ): T
    {
        let convertorCache = this.cache.get( convertor );

        if( !convertorCache )
        {
            this.cache.set( convertor, convertorCache = new Map());
        }

        let typeCache = convertorCache.get( type );

        if( !typeCache )
        {
            convertorCache.set( type, typeCache = new Map());
        }

        typeCache.set( id, value );

        return value;
    }

    public static get<T>( convertor: any, type: string, id: any ): T | undefined
    {
        return this.cache.get( convertor )?.get( type )?.get( id );
    }
}