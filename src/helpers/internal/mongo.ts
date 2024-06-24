import {Document, Filter as MongoFilter, FindOptions, ObjectId, Sort, UpdateFilter} from "mongodb";
import {ModelConverterError, objectGet, objectHash, objectSet} from "../external";
import {AbstractModelConverter} from "../../types";

type Filter = Record<string, any>;
const SORT_DESC = [ -1, '-1', 'desc', 'descending' ];

export const toBase64 = ( str: string ) => Buffer.from( str, 'utf8' ).toString('base64url');
export const fromBase64 = ( str: string ) => Buffer.from( str, 'base64url' ).toString('utf8');

export async function convert<DBE extends Document>(model: object, converter: AbstractModelConverter<DBE>, dbe: DBE, conversion: string | number | symbol )
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
    if( typeof filter === 'string' && filter.match(/^\$_root\./) ){ return '$' + filter.substring('$_root.'.length); }
    if( typeof filter === 'string' && filter.match(/^\$[^\$]/) ){ return filter.replace(/^\$/, '$' + prefix + '.' ); }
    if( typeof filter !== 'object' || filter === null ){ return filter; }
    if( typeof filter === 'object' && !Array.isArray( filter ) && Object.keys( filter ).length === 1 && [ '$cond', '$switch', '$function', '$accumulator', '$reduce', '$map', '$filter', '$convert', '$dateFromString' ].includes( Object.keys( filter )[0] ))
    {
        const key = Object.keys( filter )[0];

        if( key === '$switch' )
        {
            return { $switch: { branches: filter.$switch.branches.map(( branch: any ) => ({ ...branch, case: addPrefixToValue( branch.case, prefix, prefixKeys )})), default: addPrefixToValue( filter.$switch.default, prefix, prefixKeys ) }};
        }
        else
        {
            return Object.fromEntries( Object.entries( filter ).map(([ key, value ]) => [ key, addPrefixToValue( value, prefix )]));
        }
    }
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
            if( key === '_root' )
            {
                Object.assign( newFilter, addPrefixToValue( filter[key], prefix, false ));
            }
            else if( key.startsWith('_root.') )
            {
                newFilter[key.substring('_root.'.length)] = addPrefixToValue( filter[key], prefix, false );
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

/**/export function addPrefixToPipeline( pipeline: Document[], prefix: string ): Document[]
{
    if( !prefix ){ return pipeline; }

    let prefixed = [];

    for( const pipelineStage of pipeline )
    {
        const [ stage, query ] = Object.entries( pipelineStage )[0];

        if([ '$addFields', '$facet', '$match', '$set', '$sort' ].includes( stage ))
        {
            prefixed.push( { [stage]: Object.fromEntries( Object.entries( query ).map(([ key, value ]) => [ prefix + '.' + key, addPrefixToValue( value, prefix )]))});
        }
        else if([ '$group' ].includes( stage ))
        {
            prefixed.push( { [stage]: Object.fromEntries( Object.entries( query ).map(([ key, value ]) => [ key === '_id' ? key : prefix + '.' + key, addPrefixToValue( value, prefix )]))});
        }
        else if([ '$limit', '$skip' ].includes( stage ))
        {
            prefixed.push({ [stage]: query });
        }
        else if([ '$unset', '$count' ].includes( stage ))
        {
            prefixed.push({ [stage]: Array.isArray( query ) ? query.map(( field ) => `${prefix}.${field}`) : `${prefix}.${query}` });
        }
        else if([ '$project' ].includes( stage ))
        {
            prefixed.push({ [stage]: projectionToProject( query, prefix ) });
        }
        else if([ '$bucket', '$bucketAuto', '$densify', '$fill', '$geoNear', '$graphLookup',  '$lookup', '$replaceRoot', '$replaceWith', '$sample', '$unwind' ].includes( stage ))
        {
            // TODO toto nie je uplne dobre
            prefixed.push( { [stage]: Object.fromEntries( Object.entries( query ).map(([ key, value ]) => [ key, addPrefixToValue( value, prefix )]))});
        }
        // zakazat graphLookup, collStats, indexStats merge, out, $redact $search, $searchMeta, $setWindowFields, $sortByCount, '$unionWith' vectorSearch
        else
        {
            throw new Error(`Unsupported pipeline stage: "${stage}"`);
        }

        //lookup - prefixovat localField a as
    }

    return prefixed;
}
/**/

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

export function isExclusionProjection<DBE extends Document>( projection: FindOptions<DBE>['projection'] ): boolean
{
    if ( typeof projection !== 'object' || projection === null )
    {
        return false;
    }

    let isExclusion = undefined;
    for( const value of Object.values( projection ))
    {
        if ( typeof value === 'number' && value === 0 )
        {
            if ( isExclusion === false )
            {
                throw new Error('Projection cannot contain both exclusion and inclusion');
            }

            isExclusion = true;
        }
        else if ( typeof value === 'object' && Object.keys( value ).every( key => !key.startsWith('$') ) )
        {
            const res = isExclusionProjection( value );
            if ( isExclusion !== undefined && isExclusion !== res )
            {
                throw new Error('Projection cannot contain both exclusion and inclusion');
            }

            isExclusion = res;
        }
        else
        {
            if ( isExclusion === true )
            {
                throw new Error('Projection cannot contain both exclusion and inclusion');
            }

            isExclusion = false;
        }
    }

    return isExclusion ?? false;
}

export function projectionToProject<DBE extends Document>( projection: FindOptions<DBE>['projection'] = {}, prefix: string = '' ): Record<string, unknown>
{
    const result: Document = {};

    for ( const [ key, value ] of Object.entries( projection ))
    {
        if ( key.startsWith('$') )
        {
            result[key] = value;
            continue;
        }

        switch ( typeof value )
        {
            case 'number':
                if (value === 0)
                {
                    objectSet( result, key.split('.'), 0 );
                }
                else {
                    objectSet( result, key.split('.'), '$' + prefixField(key, prefix) );
                }
                break;

            case 'string':
                objectSet( result, key.split('.'), value );
                break;

            case 'object':
                objectSet( result, key.split('.'), projectionToProject( value, prefixField(key, prefix) ));
                break;

            default:
                throw new Error('Unsupported projection value type');
        }
    }

    return result;
}

function prefixField( field: string, prefix: string ): string
{
    if ( prefix === '' ) { return field; }

    return prefix + '.' + field;
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

/**
 * Optimizes match filter by merging conditions and removing unnecessary operators
 * @param obj - filter to optimize
 * @returns optimized filter
 */
export function optimizeMatch( obj: MongoFilter<any> ): MongoFilter<any> | undefined {
    if ( !obj ) { return undefined }

    let result: any = {};

    for ( const [key, value] of Object.entries(obj) )
    {
        if ( key === '$and' || key === '$or' )
        {
            const filteredArray = value
                .map( (item: any) => optimizeMatch(item) )
                .filter( (optimizedItem: any) => optimizedItem && Object.keys(optimizedItem).length );

            if ( filteredArray.length > 1 )
            {
                if ( key === '$and' )
                {
                    // TODO: combo $and + key na jednej úrovni
                    if ( filteredArray.every( ( item: any ) => Object.keys(item).every( (itemKey: string) => !itemKey.startsWith('$') ))
                        || filteredArray.every( ( item: any ) => Object.keys(item).every( (itemKey: string) => itemKey === '$and' )))
                    {
                        const merged = mergeProperties(...filteredArray);
                        if ( merged === false )
                        {
                            result[key] = filteredArray;
                        }
                        else
                        {
                            result = { ...result, ...merged }
                        }
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
                        const or = filteredArray.filter( (el: MongoFilter<any>) => Object.keys(el).length === 1 && el.$or );
                        const rest = filteredArray.filter( (el: MongoFilter<any>) => Object.keys(el).length > 1 || !el.$or );
                        result[key] = [ ...rest, ...(or[0]?.$or || []) ]
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
            if ( value.$in && value.$in.length === 1 )
            {
                result[key] = value.$in[0];
            }
            else if ( value.$nin && value.$nin.length === 1 )
            {
                result[key] = { $ne: value.$nin[0] };
            }
            else if ( value.$not && value.$not.$in && value.$not.$in.length === 1 )
            {
                result[key] = { $ne: value.$not.$in[0] };
            }
            else if ( value.$elemMatch )
            {
                const elemMatch = optimizeMatch(value.$elemMatch);
                if ( elemMatch && Object.keys(elemMatch).length === 1 && !Object.keys(elemMatch).every( key => key.startsWith('$')) )
                {
                    const [elemMatchKey, elemMatchValue] = Object.entries(elemMatch)[0];
                    result[key + '.' + elemMatchKey] = elemMatchValue;
                }
                else
                {
                    result[key] = value;
                }
            }
            else
            {
                result[key] = value;
            }
        }
    }

    return result;
}

/**
 * Merges properties of multiple objects into one object - helper for optimizeMatch
 * @param objects - objects to merge
 * @returns merged object or false if there are conflicting properties
 */
export function mergeProperties( ...objects: object[] ): object | false
{
    const result: any = {};

    if ( !objects.every(el => typeof el === 'object' && !Array.isArray(el)) )
    {
        throw new Error('Invalid input - expected objects');
    }

    for ( const obj of objects as any[] )
    {
        for ( const [key, value] of Object.entries(obj) )
        {
            if ( !result[key] )
            {
                result[key] = value;
                continue;
            }

            if ( isConflicting( result[key], value ) )
            {
                return false;
            }

            if ( isEq( result[key] ) )
            {
                result[key] = { $eq: result[key] };
            }

            if ( typeof value === 'object' && ( value instanceof Date || value instanceof ObjectId || value instanceof RegExp ) )
            {
                result[key] = { ...result[key], $eq: value };
            }
            else if ( typeof value === 'object' )
            {
                result[key] = { ...result[key], ...value };
            }
            else
            {
                if ( Object.keys(result[key]).length === 0 )
                {
                    result[key] = value;
                }
                else
                {
                    result[key] = { ...result[key], $eq: value };
                }
            }
        }
    }

    return result;
}

function isConflicting( obj1: any, obj2: any )
{
    if ( !obj1 || !obj2 ) { return false; }

    if ( isEq( obj1 ) && isEq( obj2 ) )
    {
        return true;
    }

    if ( typeof obj1 === 'object' && typeof obj2 === 'object' )
    {
        for ( const key of Object.keys(obj1) )
        {
            if ( obj2.hasOwnProperty(key) )
            {
                return true;
            }
        }
    }

    return false;
}

function isEq( obj: any )
{
    return typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj === null
        || ( typeof obj === 'object'
            && (
                (
                    ( obj instanceof ObjectId ) ||
                    ( obj instanceof Date ) ||
                    ( obj instanceof RegExp )
                )
                ||
                ( Object.keys( obj ).length === 1 && Object.keys( obj ).every( key => key === '$eq' ) )
            )
        );
}

/**
 * Extracts fields used in the pipeline
 * @param pipeline
 */
export function getUsedFields( pipeline: Document[] ): {used: string[], ignored: string[]}
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
            else if ( ['$size'].includes(key) && typeof value === 'string' )
            {
                fields.add( value );
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

function isPrefixedField( field: any, prefix: string ): boolean
{
    return typeof field === 'string' && (field.startsWith(prefix) || field.startsWith('$' + prefix));
}

/**
 * Splits filter into stages to be put between unwinds based on the path
 * @param filter
 * @param path
 * @returns {MongoFilter[]} - array of optimized filters for each stage
 */
export function splitFilterToStages<DBE>( filter: MongoFilter<DBE>, path: string ): MongoFilter<DBE>[]
{
    const stages = path.split('.');
    const result: MongoFilter<DBE>[] = [];

    for ( let i = 0; i <= stages.length; i++ )
    {
        const stage = stages.slice(0, i).join('.');
        const nextStage = stages.slice(0, i + 1).join('.');
        result.push( optimizeMatch( subfilter( filter, stage, nextStage, path ) ) as MongoFilter<DBE> );
    }

    return result;
}

/**
 * Extracts properties from filter that are relevant for the given stage
 * @param filter
 * @param stage
 * @param nextStage
 * @param fullPath
 */
export function subfilter( filter: MongoFilter<any>, stage: string, nextStage: string, fullPath: string )
{
    const result: MongoFilter<any> = {};

    if ( stage === nextStage )
    {
        return filter;
    }

    for ( const [key, value] of Object.entries(filter) )
    {
        if ( key === '$and' )
        {
            for ( const andCondition of value as any[] )
            {
                const sub = subfilter( andCondition, stage, nextStage, fullPath );
                if ( Object.keys(sub).length )
                {
                    if ( !result.$and )
                    {
                        result.$and = [];
                    }
                    result.$and.push( sub );
                }
            }
        }
        else if ( key === '$or' )
        {
            const tmpFilter: MongoFilter<any> = {};
            for ( const orCondition of value as any[] )
            {
                // try to extract, if they're equal, add, otherwise skip
                const sub = subfilter( orCondition, stage, nextStage, fullPath );
                if ( !tmpFilter.$or )
                {
                    tmpFilter.$or = [];
                }
                tmpFilter.$or.push( sub );
            }

            if ( objectHash(tmpFilter.$or) === objectHash(value) )
            {
                result.$or = tmpFilter.$or;
            }
        }
        else if ( shouldBeAddedToStage( key, value, stage, nextStage ) )
        {
            result[key] = value;
        }
        else if ( typeof value === 'object' && Object.keys(value).length === 1 )
        {
            const operator = value.$in
                ? '$in'
                : (value.$nin || value.$not?.$in ? '$nin' : undefined);

            if ( operator )
            {
                const elemMatch = transformToElemMatch( key, value.$in || value.$nin || value.$not.$in, operator, fullPath );
                if ( elemMatch )
                {
                    result[elemMatch.key] = elemMatch.value;
                }
            }
        }
    }

    return result;
}

export function transformToElemMatch( key: string, value: any[], operator: '$in' | '$nin', fullPath: string ): {key: string, value: {$elemMatch: object}} | false
{
    const path = splitToSubPaths( key, fullPath );
    return {
        key: path.prefix,
        value: { $elemMatch: { [path.property]: {[operator]: value} } }
    }
}

/**
 * Splits given path into prefix that is part of the full model path and the rest
 * @param path - path to split
 * @param fullPath - reference full path
 */
function splitToSubPaths( path: string, fullPath: string ): {prefix: string, property: string}
{
    let prefix = '';
    let property = '';
    for ( const subpath of path.split('.') )
    {
        if ( fullPath.startsWith(prefix + subpath) )
        {
            prefix += subpath + '.';
        }
        else {
            property += subpath + '.';
        }
    }

    return {
        prefix: prefix.endsWith('.') ? prefix.substring(0, prefix.length - 1) : prefix,
        property: property.endsWith('.') ? property.substring(0, property.length - 1) : property
    };
}

const BREAKING_OPERATORS = ['$not', '$in', '$nin', '$expr', '$elemMatch', '$function'];
function shouldBeAddedToStage( key: string, value: any, stage: string, nextStage: string ): boolean
{
    // if key is in previous stages or current stage
    if ( !key.startsWith('$') && ( !key.startsWith(stage) || ( key.startsWith(stage) && !key.startsWith( nextStage ))))
    {
        return true;
    }

    // if key is in next stages, add it has non-breaking operator
    if ( key.startsWith(nextStage) )
    {
        if ( typeof value !== 'object' || ( typeof value === 'object' && allOperationsAllowed( value ) ) )
        {
            return true;
        }
    }

    return false;
}

function allOperationsAllowed( obj: any )
{
    const operations = getOperations(obj);
    return operations.every( operation => !BREAKING_OPERATORS.includes(operation))
        && ( obj['$exists'] === undefined || obj['$exists'] === true );
}

/**
 * Gets all operations in an object recursively
 * @param obj
 */
function getOperations( obj: object )
{
    const operations: string[] = [];

    for ( const [key, value] of Object.entries(obj || {}) )
    {
        if ( key.startsWith('$') )
        {
            operations.push(key);
        }
        if ( typeof value === 'object' )
        {
            operations.push(...getOperations(value));
        }
    }

    return operations;
}

export function mergeFilters<DBE>( ...filters: (MongoFilter<DBE> | undefined | void)[] ): MongoFilter<DBE>
{
    const nonEmpty = filters.filter( isSet );
    if ( nonEmpty.length === 0 )
    {
        return {};
    }

    if ( nonEmpty.length === 1 )
    {
        return nonEmpty[0] as MongoFilter<DBE>;
    }

    return { $and: nonEmpty } as MongoFilter<DBE>;
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