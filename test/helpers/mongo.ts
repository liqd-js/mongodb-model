import * as assert from 'assert';
import {addPrefixToFilter, addPrefixToUpdate, bsonValue, collectAddedFields, generateCursorCondition, getCursor, isUpdateOperator, objectGet, objectHash, objectHashID, objectSet, projectionToProject, resolveBSONValue, reverseSort, sortProjection} from '../../src/helpers';
import crypto from 'crypto';
import {ObjectId, Sort} from "mongodb";


describe('objectHash', () =>
{
    it('should stringify string', () =>
    {
        const obj = 'test';
        const expected = JSON.stringify(obj);
        assert.equal( objectHash( obj, { alg: 'plain' } ), expected, 'ObjectId not correctly stringified' );
    });

    it('should stringify ObjectId', () =>
    {
        const obj = new ObjectId('5f4d6f9e6f0a4d001f9a2a4d');
        const expected = JSON.stringify('5f4d6f9e6f0a4d001f9a2a4d');
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'ObjectId not correctly stringified' );
    });

    it('should stringify Date', () =>
    {
        const obj = new Date('2020-08-31T14:00:00.000Z');
        const expected = JSON.stringify(obj);
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'Date not correctly stringified' );
    });

    it('should stringify RegExp', () =>
    {
        const obj = new RegExp('tes.*t', 'i');
        const expected = JSON.stringify('/tes.*t/i');
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'RegExp not correctly stringified' );
    });

    it('should stringify Set', () =>
    {
        const obj = new Set([3, 1, 2]);
        const expected = '[1,2,3]';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'Set not correctly stringified' );
    });

    it('should stringify Map', () =>
    {
        const obj = new Map([['a', 1], ['b', 2]]);
        const expected = '{"a":1,"b":2}';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'Map not correctly stringified' );
    });

    it('should stringify null', () =>
    {
        const obj = null;
        const expected = 'null';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'null not correctly stringified' );
    });

    it('should stringify simple objects', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = '{"a":1,"b":2}';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'simple object not correctly stringified' );
    });

    it('should stringify arrays with sort', () =>
    {
        const arr = [3, 1, 2];
        const expected = '[1,2,3]';
        assert.equal( objectHash( arr, { sort: true, alg: 'plain' } ), expected, 'array with sort not correctly stringified' );
    });

    it('should stringify arrays without sort', () =>
    {
        const arr = [3, 1, 2];
        const expected = '[3,1,2]';
        assert.equal( objectHash( arr, { sort: false, alg: 'plain' } ), expected, 'array without sort not correctly stringified' );
    });

    it('should stringify nested objects', () =>
    {
        const obj = { a: { b: 2, a: 1 }, b: 3 };
        const expected = '{"a":{"a":1,"b":2},"b":3}';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'nested object not correctly stringified' );
    });

    it('should stringify nested arrays with sort', () =>
    {
        const expected = '[4,[1,2,3]]';
        const arr = [[3, 1, 2], 4];
        assert.equal(objectHash(arr, { sort: true, alg: 'plain' }), expected, 'nested array with sort not correctly stringified');
    });

    it('should stringify nested arrays without sort', () =>
    {
        const expected = '[[3,1,2],4]';
        const arr = [[3, 1, 2], 4];
        assert.equal(objectHash(arr, { sort: false, alg: 'plain' }), expected, 'nested array without sort not correctly stringified');
    });

    it('should stringify nested objects combined with arrays with sort', () =>
    {
        const obj = { a: { b: [2, 1], a: 1 }, b: 3 };
        const expected = '{"a":{"a":1,"b":[1,2]},"b":3}';
        assert.equal( objectHash( obj, { sort: true, alg: 'plain' } ), expected, 'nested object with arrays with sort not correctly stringified' );
    });

    it('should stringify nested objects combined with arrays without sort', () =>
    {
        const obj = { a: { b: [2, 1], a: 1 }, b: 3 };
        const expected = '{"a":{"a":1,"b":[2,1]},"b":3}';
        assert.equal( objectHash( obj, { sort: false, alg: 'plain' } ), expected, 'nested object with arrays without sort not correctly stringified' );
    });

    it('should hash using sha1 algorithm - default params', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha1').update(JSON.stringify({ a: 1, b: 2 })).digest('hex');
        assert.equal( objectHash( obj ), expected, 'simple object not correctly hashed using SHA1' );
    });

    it('should hash using sha1 algorithm - explicit params', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha1').update(JSON.stringify({ a: 1, b: 2 })).digest('hex');
        assert.equal( objectHash( obj, { sort: true, alg: 'sha1' }), expected, 'simple object not correctly hashed using SHA1' );
    });

    it('should hash using sha256 algorithm', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha256').update(JSON.stringify({ a: 1, b: 2 })).digest('hex');
        assert.equal(objectHash(obj, { sort: true, alg: 'sha256' }), expected, 'simple object not correctly hashed using SHA256');
    });
});

describe('objectHashId', () =>
{
    it('should create correct hash ID using sha1', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha1').update('{"a":1,"b":2}').digest('hex').substring(0, 24);
        assert.equal( objectHashID( obj, { sort: true, alg: 'sha1' }), expected, 'incorrect object hash ID' );
    });

    it('should create correct hash ID using sha1 - default params', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha1').update('{"a":1,"b":2}').digest('hex').substring(0, 24);
        assert.equal( objectHashID( obj), expected, 'incorrect object hash ID' );
    });

    it('should create correct hash ID using sha256', () =>
    {
        const obj = { b: 2, a: 1 };
        const expected = crypto.createHash('sha256').update('{"a":1,"b":2}').digest('hex').substring(0, 24);
        assert.equal( objectHashID( obj, { sort: true, alg: 'sha256' }), expected, 'incorrect object hash ID' );
    });
});

describe('reverseSort', () =>
{
    it('should reverse sort direction for string values', () =>
    {
        const sort: Sort = { a: 'asc', b: 'desc' };
        const expected: Sort = { a: -1, b: 1 };
        assert.deepStrictEqual( reverseSort( sort ), expected, 'sort not correctly reversed for string values' );
    });

    it('should reverse sort direction for number values', () =>
    {
        const sort: Sort = { a: 1, b: -1 };
        const expected: Sort = { a: -1, b: 1 };
        assert.deepStrictEqual( reverseSort( sort ), expected, 'sort not correctly reversed for number values' );
    });
});

describe('sortProjection', () =>
{
    it('should add sort properties to projection', () =>
    {
        const sort: Sort = { a: 'asc', b: 'desc' };
        const id = 'c';
        const expected = { a: 1, b: 1, c: 1 };
        assert.deepStrictEqual( sortProjection( sort, id ), expected, 'sort properties not added to projection correctly' );
    });
});

describe('resolveBSONValue', () =>
{
    it('should return the same string', () =>
    {
        const value = 'test';
        assert.strictEqual(resolveBSONValue(value), value, 'string value changed');
    });

    it('should return the same number', () =>
    {
        const value = 123;
        assert.strictEqual(resolveBSONValue(value), value, 'number value changed');
    });

    it('should return null', () =>
    {
        const value = null;
        assert.strictEqual(resolveBSONValue(value), value, 'Didn\'t return null');
    });

    it('should return the same ObjectId', () =>
    {
        const value = new ObjectId();
        assert.strictEqual(resolveBSONValue(value), value, 'ObjectId changed');
    });

    it('should return the same Date', () =>
    {
        const value = new Date();
        assert.strictEqual(resolveBSONValue(value), value, 'Date changed');
    });

    it('should return the same RegExp', () =>
    {
        const value = /test/i;
        assert.strictEqual(resolveBSONValue(value), value, 'RegExp changed');
    });

    it('should convert $oid to ObjectId', () =>
    {
        const value = { $oid: '5f4d6f9e6f0a4d001f9a2a4d' };
        assert.deepStrictEqual(resolveBSONValue(value), new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'), 'ObjectId not converted correctly');
    });

    it('should convert $date to Date', () =>
    {
        const value = { $date: 1598961600000 };
        assert.deepStrictEqual(resolveBSONValue(value), new Date('2020-09-01T12:00:00.000Z'), 'Date not converted correctly');
    });

    it('should convert $function to function string', () =>
    {
        const value = { $function: { body: function() { return 'test'; } } };
        assert.deepStrictEqual(resolveBSONValue(value), { $function: { body: function() { return 'test'; }.toString() } }, 'function not converted correctly');
    });

    it('should handle $function property where body is not a function', () => {
        const value = {
            $function: {
                body: 'This is not a function'
            }
        };
        assert.deepStrictEqual(resolveBSONValue(value), value);
    });
});

describe('resolveBSONObject', () =>
{
    it('should resolve BSON values in an object', () =>
    {
        const obj = {
            a: { $oid: '5f4d6f9e6f0a4d001f9a2a4d' },
            b: { $date: 1598961600000 },
            c: 'test',
            d: [{ $function: { body: function() { return 'test'; } } }],
        };
        const expected = {
            a: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'),
            b: new Date('2020-09-01T12:00:00.000Z'),
            c: 'test',
            d: [{ $function: { body: function() { return 'test'; }.toString() } }]
        };
        assert.deepStrictEqual( resolveBSONValue( obj ), expected, 'BSON values not resolved correctly' );
    });

    it('should resolve BSON values in an array', () =>
    {
        const arr = [
            { $oid: '5f4d6f9e6f0a4d001f9a2a4d' },
            { $date: 1598961600000 },
            'test',
            [{ $function: { body: function() { return 'test'; } } }],
        ];
        const expected = [
            new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'),
            new Date('2020-09-01T12:00:00.000Z'),
            'test',
            [{ $function: { body: function() { return 'test'; }.toString() } }]
        ];
        assert.deepStrictEqual( resolveBSONValue( arr ), expected, 'BSON values not resolved correctly' );
    });
});

describe('addPrefixToFilter', () =>
{
    it('should add prefix to keys in an object', () =>
    {
        const filter = { a: 1, b: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d') };
        const prefix = 'prefix';
        const expected = { 'prefix.a': filter.a, 'prefix.b': filter.b };
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix), expected, 'prefix not added to keys in object');
    });

    it('should add prefix to keys in an array', () =>
    {
        const filter = [{ a: 1 }, { b: 2 }];
        const prefix = 'prefix';
        const expected = [{ 'prefix.a': 1 }, { 'prefix.b': 2 }];
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix), expected, 'prefix not added to keys in array');
    });

    it('should not add prefix to keys starting with $', () =>
    {
        const filter = { $a: 1, b: 2 };
        const prefix = 'prefix';
        const expected = { $a: 1, 'prefix.b': 2 };
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix), expected, 'prefix added to keys starting with $');
    });

    it('should not add prefix to keys when prefixKeys is false', () =>
    {
        const filter = { a: 1, b: 2 };
        const prefix = 'prefix';
        const expected = { a: 1, b: 2 };
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix, false), expected, 'prefix added to keys when prefixKeys is false');
    });

    it('should handle $root key correctly as nested object', () =>
    {
        const filter = { $root: { a: { b: 1 } }, b: 2 };
        const prefix = 'prefix';
        const expected = { a: { b: 1 }, 'prefix.b': 2 };
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix), expected, 'prefix not added to $root key');
    });

    it('should handle $root key correctly as concatenated string', () =>
    {
        const filter = { '$root.a.b': 1, b: 2 };
        const prefix = 'prefix';
        const expected = { 'a.b': 1, 'prefix.b': 2 };
        assert.deepStrictEqual(addPrefixToFilter(filter, prefix), expected, 'prefix not added to $root key');
    });
});

describe('addPrefixToUpdate', () =>
{
    it('should add prefix to keys in an object', () =>
    {
        const update = { a: 1, b: 2 };
        const prefix = 'prefix';
        const expected = { 'prefix.a': 1, 'prefix.b': 2 };
        assert.deepStrictEqual(addPrefixToUpdate(update, prefix), expected, 'prefix not added to keys in object');
    });

    it('should not add prefix to keys starting with $', () =>
    {
        const update = { $set: { a: 1, b: 2 } };
        const prefix = 'prefix';
        const expected = { $set: { 'prefix.a': 1, 'prefix.b': 2 } };
        assert.deepStrictEqual(addPrefixToUpdate(update, prefix), expected, 'prefix not added to keys in object');
    });

    it('should handle nested updates correctly', () =>
    {
        const update = { $set: { a: 1, b: 2 }, c: { $set: { d: 3 } } };
        const prefix = 'prefix';
        const expected = { $set: { 'prefix.a': 1, 'prefix.b': 2 }, 'prefix.c': { $set: { 'd': 3 } } };
        assert.deepStrictEqual(addPrefixToUpdate(update, prefix), expected, 'prefix not added to nested updates');
    });

    it('should handle empty update', () =>
    {
        const update = {};
        const prefix = 'prefix';
        const expected = {};
        assert.deepStrictEqual(addPrefixToUpdate(update, prefix), expected, 'empty update not handled');
    });
});

describe('objectSet', () =>
{
    it('should set value at path in object', () =>
    {
        const obj = { a: 1, b: 2 };
        const path = ['b'];
        const value = 3;
        const expected = { a: 1, b: 3 };
        assert.deepStrictEqual(objectSet(obj, path, value), expected, 'value not set at path in object');
    });

    it('should create nested objects if path does not exist', () =>
    {
        const obj = { a: 1 };
        const path = ['b', 'c', 'd'];
        const value = 2;
        const expected = { a: 1, b: { c: { d: 2 } } };
        assert.deepStrictEqual(objectSet(obj, path, value), expected, 'nested objects not created');
    });

    it('should overwrite existing value at path', () =>
    {
        const obj = { a: 1, b: { c: 2 } };
        const path = ['b', 'c'];
        const value = 3;
        const expected = { a: 1, b: { c: 3 } };
        assert.deepStrictEqual(objectSet(obj, path, value), expected, 'existing value not overwritten');
    });

    it('should handle empty path', () =>
    {
        const obj = { a: 1 };
        const path: string[] = [];
        const value = 2;
        assert.throws(() => objectSet(obj, path, value), 'empty path not handled');
    });
});

describe('objectGet', () =>
{
    it('should get value at path in object', () =>
    {
        const obj = { a: 1, b: 2 };
        const path = ['b'];
        const expected = 2;
        assert.strictEqual(objectGet(obj, path), expected);
    });

    it('should return undefined if path does not exist', () =>
    {
        const obj = { a: 1 };
        const path = ['b'];
        assert.strictEqual(objectGet(obj, path), undefined, 'value returned for non-existent path');
    });

    it('should get nested value at path', () =>
    {
        const obj = { a: 1, b: { c: 2 } };
        const path = ['b', 'c'];
        const expected = 2;
        assert.strictEqual(objectGet(obj, path), expected, 'nested value not returned');
    });

    it('should throw error for empty path', () =>
    {
        const obj = { a: 1 };
        const path: string[] = [];
        assert.throws(() => objectGet(obj, path), Error, 'Path is empty');
    });
});

describe('projectionToProject', () =>
{
    it('should handle projection with string property', () =>
    {
        const projection = { 'a.b': 'c' };
        const expected = { 'a': { 'b': '$c' } };
        assert.deepStrictEqual(projectionToProject(projection), expected);
    });

    it('should handle projection with string property starting with $root', () =>
    {
        const projection = { 'a.b': '$root.c' };
        const expected = { 'a': { 'b': '$$ROOT.c' } };
        assert.deepStrictEqual(projectionToProject(projection), expected);
    });

    it('should handle projection with non-string property', () =>
    {
        const projection = { 'a.b': 1 };
        const expected = { 'a': { 'b': '$a.b' } };
        assert.deepStrictEqual(projectionToProject(projection), expected);
    });

    it('should handle empty projection', () =>
    {
        const projection = {};
        const expected = {};
        assert.deepStrictEqual(projectionToProject(projection), expected);
    });

    it('should handle projection with nested properties', () =>
    {
        const projection = { 'a.b.c': 1, 'a.b.d': 1, 'c': 1 };
        const expected = { 'a': { 'b': { 'c': '$a.b.c', 'd': '$a.b.d' }}, 'c': '$c' };
        assert.deepStrictEqual(projectionToProject(projection), expected);
    });
});

describe('bsonValue', () =>
{
    it('should handle instances of ObjectId', () =>
    {
        const value = new ObjectId('5f4d6f9e6f0a4d001f9a2a4d');
        const expected = { $oid: '5f4d6f9e6f0a4d001f9a2a4d' };
        assert.deepStrictEqual(bsonValue(value), expected);
    });

    it('should handle instances of Date', () =>
    {
        const value = new Date('2020-08-31T14:00:00.000Z');
        const expected = { $date: value.getTime() };
        assert.deepStrictEqual(bsonValue(value), expected);
    });

    it('should return the same value for other types', () =>
    {
        const value = 'test';
        assert.strictEqual(bsonValue(value), value);
    });
});

describe('isUpdateOperator', () =>
{
    it('should return true for objects with keys starting with $', () =>
    {
        const update = { $set: { a: 1 }, $unset: { b: 1 } };
        assert.strictEqual(isUpdateOperator(update), true);
    });

    it('should return false for objects with keys not starting with $', () =>
    {
        const update = { set: { a: 1 }, unset: { b: 1 } };
        assert.strictEqual(isUpdateOperator(update), false);
    });

    it('should handle objects with some keys starting with $', () =>
    {
        const update = { $set: { a: 1 }, unset: { b: 1 } };
        assert.strictEqual(isUpdateOperator(update), false);
    });
});

describe('getCursor', () =>
{
    it('should generate cursor from data', () =>
    {
        const data = {_id: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'), a: { b: new Date('2024-01-01') } };
        const sort: Sort = {'a.b': 1, _id: -1};
        assert.equal(getCursor(data, sort), 'W3siJGRhdGUiOjE3MDQwNjcyMDAwMDB9LHsiJG9pZCI6IjVmNGQ2ZjllNmYwYTRkMDAxZjlhMmE0ZCJ9XQ')
    });

    it('should only include sort properties', () =>
    {
        const data = {_id: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'), a: { b: new Date('2024-01-01'), c: 'test' }, d: 100 };
        const sort: Sort = {'a.b': 1, _id: -1};
        const actual = getCursor(data, sort);
        const expected = getCursor({ a: { b: new Date('2024-01-01') }, _id: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d') }, sort);
        assert.equal(actual, expected);
    });

    it('should use intersection of sort and projection properties', () =>
    {
        const data = {_id: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d'), a: { c: 'test' }, d: 100 };
        const sort: Sort = {'a.b': 1, _id: -1};
        const actual = getCursor(data, sort);
        const expected = getCursor({ _id: new ObjectId('5f4d6f9e6f0a4d001f9a2a4d') }, sort);
        assert.equal(actual, expected);
    });

    it('should handle empty empty data', () =>
    {
        const data = {};
        const sort: Sort = { a: 1, b: -1 };
        assert.strictEqual(getCursor(data, sort), 'W251bGwsbnVsbF0');
    });
});

describe('generateCursorCondition', () =>
{
    it('should generate filter for single sort key with next direction', () => {
        const cursor = 'next:W3siJGRhdGUiOjE3MDQwNjM1OTkwMDB9XQ=';
        const sort: Sort = { 'events.created': -1 };
        const expected = { 'events.created': { '$lt': { '$date': 1704063599000 } } };
        assert.deepStrictEqual(generateCursorCondition(cursor, sort), expected);
    });

    it('should generate filter for single sort key with prev direction', () => {
        const cursor = 'prev:W3siJGRhdGUiOjE3MDQwNjM1OTkwMDB9XQ=';
        const sort: Sort = { 'events.created': -1 };
        const expected = { 'events.created': { '$gt': { '$date': 1704063599000 } } };
        assert.deepStrictEqual(generateCursorCondition(cursor, sort), expected);
    });

    it('should handle multiple key sort with next direction', () => {
        const cursor = 'next:W3siJG9pZCI6IjYwZTc3ZDY3N2ZiNmNmMjYxZThiOWQwZCJ9LHsiJGRhdGUiOjE3MDQwNjM1OTkwMDB9XQ=';
        const sort: Sort = { _id: -1, 'events.created': -1 };
        const expected = {
            '$or': [
                { _id: { '$lt': { '$oid': '60e77d677fb6cf261e8b9d0d' } } },
                {
                    _id: { '$eq': { '$oid': '60e77d677fb6cf261e8b9d0d' } },
                    'events.created': { '$lt': { '$date': 1704063599000 } }
                }
            ]
        };
        assert.deepStrictEqual(generateCursorCondition(cursor, sort), expected);
    });

    it('should handle multiple key sort with prev direction', () => {
        const cursor = 'prev:W3siJG9pZCI6IjYwZTc3ZDY3N2ZiNmNmMjYxZThiOWQwZCJ9LHsiJGRhdGUiOjE3MDQwNjM1OTkwMDB9XQ=';
        const sort: Sort = { _id: -1, 'events.created': -1 };
        const expected = {
            '$or': [
                { _id: { '$gt': { '$oid': '60e77d677fb6cf261e8b9d0d' } } },
                {
                    _id: { '$eq': { '$oid': '60e77d677fb6cf261e8b9d0d' } },
                    'events.created': { '$gt': { '$date': 1704063599000 } }
                }
            ]
        };
        assert.deepStrictEqual(generateCursorCondition(cursor, sort), expected);
    });

    it('should throw error for cursor generated with different sort properties', () =>
    {
        const cursor = 'next:W3siJG9pZCI6IjYwZTc3ZDY3N2ZiNmNmMjYxZThiOWQwZCJ9LHsiJGRhdGUiOjE3MDQwNjM1OTkwMDB9XQ=';
        const sort: Sort = { 'events.created': -1 };
        assert.throws(() => generateCursorCondition(cursor, sort), 'Cursor and sort keys do not match');
    });
});

describe('collectAddedFields', () =>
{
    it('should handle $addFields', () =>
    {
        const pipeline = [{ $addFields: { a: 1, b: 2 } }];
        const expected = ['a', 'b'];
        assert.deepStrictEqual(collectAddedFields(pipeline), expected);
    });

    it('should handle $lookup', () =>
    {
        const pipeline = [{ $lookup: { as: 'c' } }];
        const expected = ['c'];
        assert.deepStrictEqual(collectAddedFields(pipeline), expected);
    });

    it('should handle $unset', () =>
    {
        const pipeline = [{ $addFields: { a: 1, b: 2 } }, { $unset: ['a'] }];
        const expected = ['b'];
        assert.deepStrictEqual(collectAddedFields(pipeline), expected);
    });

    it('should throw error for unsupported stages', () =>
    {
        const pipeline = [{ $unsupported: {} }];
        assert.throws(() => collectAddedFields(pipeline), /Unsupported pipeline stage: "\$unsupported"/);
    });
});
