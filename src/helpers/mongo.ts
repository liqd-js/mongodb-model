import {Document, FindOptions, ObjectId, Sort, UpdateFilter} from 'mongodb';
import crypto from 'crypto';

type Filter = Record<string, any>;

export const toBase64 = ( str: string ) => Buffer.from( str, 'utf8' ).toString('base64url');
export const fromBase64 = ( str: string ) => Buffer.from( str, 'base64url' ).toString('utf8');

const SORT_DESC = [ -1, '-1', 'desc', 'descending' ];

function stableStringify( obj: any, sort: boolean ): string
{
    if( obj instanceof ObjectId ){ return stableStringify( obj.toString(), sort )}
    if( obj instanceof Date ){ return stableStringify( obj.toISOString(), sort )}
    if( obj instanceof RegExp ){ return stableStringify( obj.toString(), sort )}
    if( obj instanceof Set ){ return stableStringify([...obj], sort )}
    if( obj instanceof Map ){ return stableStringify( Object.fromEntries([...obj.entries()]), sort )}
    if( typeof obj !== 'object' || obj === null ){ return JSON.stringify( obj ); }
    if( Array.isArray( obj ))
    {
        const arr = obj.map( v => stableStringify( v, sort )); sort && arr.sort();

        return `[${ arr.join(',') }]`;
    }

    const pairs = Object.keys( obj ).sort().map( key => `${ JSON.stringify( key ) }:${ stableStringify( obj[key], sort )}`);

    return `{${ pairs.join(',') }}`;
}

export function objectHash( obj: any, options: { sort?: boolean, alg?: 'plain' | 'sha1' | 'sha256' } = {})
{
    const value = stableStringify( obj, options.sort ?? true );

    return options.alg !== 'plain' ? crypto.createHash( options.alg ?? 'sha1' ).update( value ).digest('hex') : value;
}

export function objectHashID( obj: any, options: { sort?: boolean, alg?: 'sha1' | 'sha256'  } = {})
{
    return new ObjectId( crypto.createHash( options.alg ?? 'sha1' ).update( stableStringify( obj, options.sort ?? true )).digest('hex').substring(0, 24));
}

export function reverseSort( sort: Sort ): Sort
{
    return Object.fromEntries( Object.entries( sort ).map(([ key, value ]) => [ key, SORT_DESC.includes( value ) ? 1 : -1 ]));
}

export function sortProjection( sort: Sort, id: string ): Record<string, 1>
{
    return Object.fromEntries([ ...Object.keys( sort ).map(( key => [ key, 1 ]) ), [ id, 1 ]]);
}

function addPrefixToValue( filter: Filter | any, prefix: string, prefixKeys: boolean = true ): Filter | any
{
    if( typeof filter === 'string' && filter.match(/^\$$ROOT\./) ){ return filter; }
    if( typeof filter === 'string' && filter.match(/^\$root\./) ){ return '$' + filter.substring(6); }
    if( typeof filter === 'string' && filter.match(/^\$[^\$]/) ){ return filter.replace(/^\$/, '$' + prefix + '.' ); }
    if( typeof filter !== 'object' || filter === null ){ return filter; }
    if( typeof filter === 'object' &&
    (
        ( filter instanceof ObjectId ) ||
        ( filter instanceof Date )  ||
        ( filter instanceof RegExp ) // TODO is basic object alternative?
    ))
    {
        return filter;
    }
    
    return addPrefixToFilter( filter, prefix, prefixKeys );
}

//export function resolveFilterValue( filter: Filter | any ): Filter | any
export function resolveBSONValue( value: any ): any
{
    if( typeof value === 'string' ){ return value; }
    if( typeof value !== 'object' || value === null ){ return value; }
    if( typeof value === 'object' &&
    (
        ( value instanceof ObjectId ) ||
        ( value instanceof Date )  ||
        ( value instanceof RegExp ) // TODO is basic object alternative?
    ))
    {
        return value;
    }
    if( typeof value === 'object' && Object.keys( value ).length === 1 )
    {
        if( value.hasOwnProperty('$oid') ){ return new ObjectId( value.$oid )}
        if( value.hasOwnProperty('$date') ){ return new Date( value.$date )} // TODO verify it is not colliding
        if( value.hasOwnProperty('$function') )
        {
            if( typeof value.$function.body === 'function' )
            {
                return { $function: { ...value.$function, body: value.$function.body.toString() }};
            }

            return value;
        }
    }
    
    return resolveBSONObject( value );
}

//export function resolveFilterOIDs( filter: Filter ): Filter
export function resolveBSONObject( obj: Record<string, any> ): Record<string, any>
{
    if( Array.isArray( obj ))
    {
        return obj.map(( item ) => resolveBSONValue( item ));
    }

    const resolved: Record<string, any> = {};

    for( const key in obj )
    {
        if( obj.hasOwnProperty( key ))
        {
            resolved[key] = resolveBSONValue( obj[key] );
        }
    }

    return resolved;
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
            if( key === '$root' )
            {
                Object.assign( newFilter, addPrefixToValue( filter[key], prefix, false ));
            }
            else if(  key.startsWith('$root.') )
            {
                newFilter[key.substring(6)] = addPrefixToValue( filter[key], prefix, false );
            }
            else if( !prefixKeys || key.startsWith('$') )
            {
                newFilter[key] = addPrefixToValue( filter[key], prefix, prefixKeys );
            }
            else
            {
                newFilter[`${prefix}.${key}`] = addPrefixToValue( filter[key], prefix, false );
            }
        }
    }

    return newFilter;
}

export function addPrefixToUpdate<RootDBE,DBE>( update: Partial<DBE> | UpdateFilter<DBE>, prefix: string ): Partial<RootDBE> | UpdateFilter<RootDBE>
{
    const newUpdate: Record<string, any> = {};

    for( const[ key, value ] of Object.entries( update ))
    {
        if( key.startsWith('$') )
        {
            newUpdate[key] = addPrefixToUpdate( value, prefix );
        }
        else
        {
            newUpdate[`${prefix}.${key}`] = value; // TODO test when update is not a primitive
        }
    }

    return newUpdate;
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

export function projectionToProject<DBE extends Document>( projection: FindOptions<DBE>['projection']): Record<string, unknown>
{
    const project: Record<string, unknown> = {};

    for( let [ path, property ] of Object.entries( projection! ))
    {
        objectSet( project, path.split('.'), typeof property === 'string' ? ( property.startsWith('$root.') ? property.replace(/^\$root/, '$$$ROOT') : '$' + property ) : '$' + path );
    }

    return project;
}

export function bsonValue( value: any )
{
    if( value instanceof ObjectId ){ return { $oid: value.toString() }}
    if( value instanceof Date ){ return { $date: value.getTime() }}

    return value;
}

export function isUpdateOperator( update: object ): boolean
{
    return ( typeof update === 'object' && update !== null && Object.keys( update ).every( key => key.startsWith('$')));
}

export function getCursor( dbe: Document, sort: Sort ): string
{
    return toBase64( JSON.stringify( Object.keys( sort ).map( key => bsonValue( objectGet( dbe, key.split('.') )))));
}

export function generateCursorCondition( cursor: string, sort: Sort ): Filter
{
    const direction = cursor.startsWith('prev:') ? 'prev' : cursor.startsWith('next:') ? 'next' : undefined;
    const properties = Object.keys( sort );
    const directions = Object.values( sort ).map( value => ( direction === 'prev' ? -1 : 1 ) * ( SORT_DESC.includes( value ) ? -1 : 1 ));
    const values = JSON.parse( fromBase64( cursor.substring( direction ? direction.length + 1 : 0 )));

    if ( properties.length !== values.length )
    {
        throw new Error('Cursor does not match sort properties');
    }

    if( properties.length === 1 )
    {
        return {[ properties[0]]: {[( directions[0] === 1 ? '$gt' : '$lt' ) + ( !direction ? 'e' : '' )]: values[0] }};
    }

    const filter: Filter[] = [];
    
    for( let i = 0; i < properties.length; i++ )
    {
        const condition: Filter = {}; filter.push( condition );

        for( let j = 0; j <= i; j++ )
        {
            condition[properties[j]] = {[( j < i ? '$eq' : directions[j] === 1 ? '$gt' : '$lt' ) + ( j === properties.length - 1 && !direction ? 'e' : '' )]: values[j] }; 
        }
    }

    return { $or: filter };
}

export function collectAddedFields( pipeline: any[] ): string[]
{
    const fields = new Set<string>();

    for( const stage of pipeline )
    {
        if( stage.$addFields )
        {
            Object.keys(stage.$addFields).forEach(prop => fields.add(prop));
        }
        else if( stage.$lookup )
        {
            fields.add(stage.$lookup.as);
        }
        else if( stage.$unset )
        {
            stage.$unset.forEach((prop: string) => fields.delete(prop));
        }
        else if ( !stage.$match )
        {
            throw new Error(`Unsupported pipeline stage: "${Object.keys(stage)[0]}"`);
        }
    }

    return [...fields];
}

export function optimizeMatch( obj: any ): any {
    if ( !obj ) { return undefined }

    let result: any = {};

    for ( const [key, value] of Object.entries(obj) )
    {
        if ( key === '$and' || key === '$or' )
        {
            const filteredArray = (value as any[])
                .map( (item: any) => optimizeMatch(item) )
                .filter( (optimizedItem: any) => optimizedItem && Object.keys(optimizedItem).length );

            if ( filteredArray.length > 1 )
            {
                if ( key === '$and' )
                {
                    // merge elements that don't contain keys with $
                    if ( filteredArray.every( ( item: any ) => Object.keys(item).every( (itemKey: string) => !itemKey.startsWith('$') )) )
                    {
                        const merged = mergeProperties(...filteredArray);
                        result = { ...result, ...merged }
                    }
                    // merge elements that have only $and keys (current is $and) or $or keys (current is $or)
                    else if ( filteredArray.every( ( item: any ) => Object.keys(item).every( (itemKey: string) => itemKey === '$and' )) )
                    {
                        const merged = mergeProperties(...filteredArray);
                        result = { ...result, ...merged }
                    }
                    else
                    {
                        result[key] = filteredArray
                    }
                }
                else if ( key === '$or' )
                {
                    if ( filteredArray.every( ( item: any ) => (Object.keys(item).length === 1 && item.$or) || Object.keys(item).every( itemKey => !itemKey.startsWith('$'))) )
                    {
                        const merged = [];
                        for ( const item of filteredArray )
                        {
                            if ( item.$or )
                            {
                                merged.push(...item.$or);
                            }
                            else
                            {
                                merged.push(item);
                            }
                        }
                        result = { ...result, $or: merged }
                    }
                    else
                    {
                        const or = filteredArray.filter( el => Object.keys(el).length === 1 && el.$or );
                        const rest = filteredArray.filter( el => Object.keys(el).length > 1 || !el.$or );
                        result[key] = [ ...rest, ...or[0].$or ]
                    }
                }
                else
                {
                    result[key] = filteredArray
                }

            }
            else if ( filteredArray.length === 1 )
            {
                const isInRoot = Object.keys( filteredArray[0] ).some( key => result[key] );
                const properties = mergeProperties( filteredArray[0] );
                result = { ...result, ...( isInRoot ? { [key]: [ filteredArray[0] ] } : properties ) }
            }
        }
        else
        {
            result[key] = value;
        }
    }

    return result;
}

function mergeProperties( ...objects: object[] ): object
{
    const result: any = {};

    if ( !objects.every(el => typeof el === 'object' && !Array.isArray(el)) )
    {
        throw new Error('Invalid input - expected objects');
    }
    
    for ( const obj of objects as any[] )
    {
        for ( const key of Object.keys(obj) )
        {
            if ( !result[key] )
            {
                result[key] = {};
            }

            if ( typeof obj[key] === 'object' )
            {
                if ( typeof result[key] !== 'object' )
                {
                    result[key] = { $eq: result[key] };
                }
                result[key] = { ...result[key], ...obj[key] };
            }
            else
            {
                if ( Object.keys(result[key]).length === 0 )
                {
                    result[key] = obj[key];
                }
                else
                {
                    result[key] = { ...result[key], $eq: obj[key] };
                }
            }
        }
    }
    
    return result;
}

export function extractFields(pipeline: Document[] )//: Set<string>
{
    const usedFields: Set<string> = new Set();
    const ignoredFields: Set<string> = new Set();

    for ( const el of pipeline )
    {
        const stage = Object.keys(el)[0];

        switch ( stage )
        {
            case '$match':
                const extracted = extractRecursively( el.$match );
                for ( const field of extracted )
                {
                    // TODO: doesn't have to be full match - startsWith
                    if ( ignoredFields.has(field) ) { continue; }

                    usedFields.add(field);
                }
                break;
            case '$project':
            case '$addFields':
            case '$group':
                for ( const [key, value] of Object.entries(el[stage]) )
                {
                    ignoredFields.add( key );
                    if ( typeof value === 'object' || (typeof value === 'string' && value.startsWith('$')) )
                    {
                        extractRecursively( value ).forEach(key => usedFields.add(key));
                    }
                }
                break;
            case '$lookup':
                ignoredFields.add( el.$lookup.as );
                !ignoredFields.has( el.$lookup.localField ) && usedFields.add( el.$lookup.localField )
                break;
            case '$replaceWith':
                if ( typeof el.$replaceWith === 'object' )
                {
                    Object.entries(el.$replaceWith).forEach(
                        ([key, value]) =>
                            ignoredFields.add(key)
                            && extractRecursively( value ).forEach(key => usedFields.add(key))
                    );
                }
                break;
            case '$unwind': break;
            default:
                throw new Error(`Unsupported pipeline stage: "${stage}"`);
        }
    }

    return { used: Array.from(usedFields), ignored: Array.from(ignoredFields) };
}

const MATHEMATICAL_OPERATORS = ['$sum', '$subtract', '$multiply', '$divide', '$mod', '$abs', '$ceil', '$floor', '$ln', '$log', '$log10', '$pow', '$sqrt', '$trunc'];
function extractRecursively( obj: any /* TODO: ignoredFields? */ ): Set<string>
{
    const fields: Set<string> = new Set();

    if ( !obj ) { return fields; }

    if ( typeof obj !== 'object' )
    {
        if ( typeof obj === 'string' && obj.startsWith('$') )
        {
            fields.add(obj);
        }
    }
    else
    {
        for ( const [key, value] of Object.entries(obj) )
        {
            if ( key === '$and' || key === '$or' )
            {
                for ( const item of value as any[] )
                {
                    extractRecursively( item ).forEach(key => fields.add(key));
                }
            }
            else if ( key === '$expr' )
            {
                extractRecursively( value ).forEach(key => fields.add(key));
            }
            else if ( key === '$map' || key === '$filter' )
            {
                fields.add((value as any).input);
            }
            else if ( key === '$mergeObjects' )
            {
                for ( const item of value as any[] )
                {
                    if ( typeof item === 'string' && item.startsWith('$') )
                    {
                        extractRecursively( item ).forEach(key => fields.add(key));
                    }
                }
            }
            else if ( key === '$arrayElemAt' )
            {
                fields.add((value as any[])[0]);
            }
            else if ( key === '$function' )
            {
                (value as any).args
                    .filter( (arg: any) => typeof arg === 'string' && arg.startsWith('$'))
                    .forEach( (arg: string) => fields.add(arg));
            }
            else if ( MATHEMATICAL_OPERATORS.includes(key) )
            {
                extractRecursively( value ).forEach(key => fields.add(key));
            }
            else if ( Array.isArray( value ) )
            {
                value.forEach( (item: any) => typeof item === 'string' && item.startsWith('$') && fields.add(item) );
            }
            else if ( !key.startsWith('$') )
            {
                fields.add(key);
            }
            else
            {
                throw new Error(`Unsupported operator: "${key}"`);
            }
        }
    }

    const result: Set<string> = new Set();
    for ( const field of fields )
    {
        result.add(field.startsWith('$') ? field.replace(/^\$/, '') : field);
    }

    return result;
}

const COMPARISON_OPERATORS = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'];
const LOGICAL_OPERATORS = ['$and', '$or', '$nor', '$not'];
const ELEMENT_OPERATORS = ['$exists', '$type'];
const EVALUATION_OPERATORS = ['$regex', '$expr', '$jsonSchema', '$mod', '$text', '$where'];
const ARRAY_OPERATORS = ['$all', '$elemMatch', '$size'];

export function filterUnwindedProperties(input: any, prefix: string ): any | undefined
{
    if ( typeof input === 'string' && isPrefixedField( input, prefix ) )
    {
        return input
    }

    if ( typeof input !== 'object' || Array.isArray( input ) )
    {
        throw new Error('Invalid input', input);
    }

    const result: any = {};

    for ( const [key, value] of Object.entries(input) )
    {
        if ( !key.startsWith('$') && !isPrefixedField( key, prefix ) )
        {
            // TODO: if value is object, it can be a field or an operator
            if ( typeof value === 'object' )
            {
                const resolved = filterUnwindedProperties(value, prefix);
                if ( resolved )
                {
                    result[key] = resolved;
                }
            }
            else
            {
                result[key] = value;
            }
            continue;
        }

        if ( COMPARISON_OPERATORS.includes( key ) )
        {
            if ( Array.isArray( value ) )
            {
                if ( value.length === 2 && Array.isArray(value[1]) )
                {
                    if ( typeof value[0] !== 'object' && !isPrefixedField(value[0], prefix ) )
                    {
                        result[key] = value;
                    }
                }
                else if ( value.every( (item: any) => !isPrefixedField( item, prefix ) ) )
                {
                    if ( typeof value[0] !== 'object' ) // $lt: [{$cond: {...}, 2]
                    {
                        result[key] = value;
                    }
                }
            }
            else if ( typeof value !== 'object' )
            {
                if ( !isPrefixedField( value, prefix ) )
                {
                    result[key] = value;
                }
            }
        }
        else if ( LOGICAL_OPERATORS.includes( key ) )
        {
            if ( Array.isArray( value ) )
            {
                const partial = [];

                for ( const item of value )
                {
                    const resolved = filterUnwindedProperties(item, prefix);
                    if ( resolved )
                    {
                        partial.push(resolved);
                    }
                }
                if ( partial.length )
                {
                    result[key] = partial;
                }
            }
            else if ( typeof value === 'object' )
            {
                const resolved = filterUnwindedProperties(value, prefix);
                if ( resolved )
                {
                    result[key] = resolved;
                }
            }
        }
        else if ( ELEMENT_OPERATORS.includes( key ) || ARRAY_OPERATORS.includes( key ) )
        {
            result[key] = value;
        }
        else if ( EVALUATION_OPERATORS.includes( key ) )
        {
            if ( key === '$expr' )
            {
                const resolved = filterUnwindedProperties(value, prefix);
                if ( resolved )
                {
                    result[key] = resolved;
                }
            }
            else
            {
                result[key] = value;
            }
        }
        else if ( key === '$function' && (value as any).args.every( (arg: any) => !isPrefixedField(arg, prefix) ) )
        {
            result[key] = value;
        }
        // TODO: more complex combinations - $cond inside $lt: [$cond, [ ... ]] and other aggregation operators
    }

    return Object.keys(result).length ? result : undefined;
}

function isPrefixedField( field: any, prefix: string ): boolean
{
    return typeof field === 'string' && (field.startsWith(prefix) || field.startsWith('$' + prefix));
}

export const isSet = ( value: any ): boolean => value !== undefined && value !== null && ( Array.isArray( value ) ? value.length > 0 : ( typeof value === 'object' ? Object.keys( value ).length > 0 : true ));
export const Arr = ( value: any ): any[] => Array.isArray( value ) ? value : [ value ];


/*
LOG( addPrefixToFilter(
{
    $and:
    [
        { active: true, $root: { active: true }, '$root.events.closed': { $exists: false }, $eq: [ '$events.closed', '$root.events.closed' ]},
        { $or:
        [
            { $root: { programmeID: { $gt: 1 }}},
            { $root: { programmeID: { $eq: 1 }}, '$root.events.closed': { $gt: 1 }},
            { $root: { programmeID: { $eq: 1 }}, '$root.events.closed': { $eq: 1 }, 'events.closed': { $gt: 1 }},
            { $root: { programmeID: { $eq: 1 }}, '$root.events.closed': { $eq: 1 }, 'events.closed': { $eq: 1 }, events: { created: { $gt: 1 }}},
            { $root: { programmeID: { $eq: 1 }}, '$root.events.closed': { $eq: 1 }, 'events.closed': { $eq: 1 }, events: { created: { $eq: 1 }}, id: { $gt: 1 }},
        ]}
    ]
},
'prefix' ));*/

//console.log( projectionToProject({ test: 1, 'foo.bar': 1 }));

// TODO podpora subobjektu
//console.log( projectionToProject({ testik: 'test', 'foo.bar': 1, 'jobID': '$root._id', zamestnanec: { janko: '$employer' } }));
//console.log( projectionToProject({ testik: 'test', 'foo.bar': 1, 'jobID': '$root._id' }) );
//console.log( addPrefixToFilter( projectionToProject({ testik: 'test', 'foo.bar': 1, 'jobID': '$root._id' }), 'prefixik', false ) )
