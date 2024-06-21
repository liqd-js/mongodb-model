import assert from "node:assert";
import {deleteNullishProperties} from "../../src";

describe('deleteNullishProperties', () => {
    it('should delete null and undefined properties from an object', () => {
        const obj = { a: null, b: undefined, c: 1 };
        deleteNullishProperties(obj);
        assert.deepStrictEqual(obj, { c: 1 });
    });

    it('should delete null and undefined elements from an array', () => {
        const arr = [null, undefined, 1];
        deleteNullishProperties(arr);
        assert.deepStrictEqual(arr, [1]);
    });

    it('should delete null and undefined properties from nested objects', () => {
        const obj = { a: { b: null, c: undefined, d: 1 }, e: 2 };
        deleteNullishProperties(obj);
        assert.deepStrictEqual(obj, { a: { d: 1 }, e: 2 });
    });

    it('should delete null and undefined elements from nested arrays', () => {
        const arr = [[null, undefined, 1], 2];
        deleteNullishProperties(arr);
        assert.deepStrictEqual(arr, [[1], 2]);
    });

    it('should handle empty objects', () => {
        const obj = {};
        deleteNullishProperties(obj);
        assert.deepStrictEqual(obj, {});
    });

    it('should handle empty arrays', () => {
        const arr: any = [];
        deleteNullishProperties(arr);
        assert.deepStrictEqual(arr, []);
    });
});