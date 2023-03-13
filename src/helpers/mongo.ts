import { Document, ObjectId, FindOptions } from 'mongodb';
type Filter = Record<string, any>;

function addPrefixToValue( filter: Filter | any, prefix: string, prefixKeys: boolean = true ): Filter | any
{
    if( typeof filter === 'string' && filter.match(/^\$[^\$]/) ){ return filter.replace(/^\$/, '$' + prefix + '.' ); }
    if( typeof filter !== 'object' || filter === null ){ return filter; }
    if( typeof filter === 'object' &&
    (
        ( filter instanceof ObjectId ) ||
        ( filter instanceof Date )
    ))
    {
        return filter;
    }
    
    return addPrefixToFilter( filter, prefix, prefixKeys );
}

export function addPrefixToFilter( filter: Filter, prefix: string, prefixKeys: boolean = true ): Filter
{
    if( Array.isArray( filter ))
    {
        return filter.map(( item ) => addPrefixToValue( item, prefix, prefixKeys ));
    }

    const newFilter: Filter = {};

    for( const key in filter )
    {
        if( filter.hasOwnProperty( key ))
        {
            if( !prefixKeys || key.startsWith('$') )
            {
                newFilter[key] = addPrefixToValue( filter[key], prefix, prefixKeys );
            }
            else
            {
                newFilter[`${prefix}.${key}`] = addPrefixToValue( filter[key], prefix, prefixKeys );
            }
        }
    }

    return newFilter;
}

function objectSet( obj: Record<string, unknown>, path: string[], value: unknown )
{
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

export function projectionToProject<DBE extends Document>( projection: FindOptions<DBE>['projection']): Record<string, unknown>
{
    const project: Record<string, unknown> = {};

    for( let path of Object.keys( projection! ))
    {
        objectSet( project, path.split('.'), '$' + path );
    }

    return project;
}

export function isUpdateOperator( update: object ): boolean
{
    return ( typeof update === 'object' && update !== null && Object.keys( update ).every( key => key.startsWith('$')));
}