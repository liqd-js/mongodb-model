import assert from "node:assert";
import {deleteNullProperties} from "../../src/helpers";

describe('deleteNullProperties', () => {
    it('should delete null and undefined properties from an object', () => {
        const obj = { a: null, b: undefined, c: 1 };
        deleteNullProperties(obj);
        assert.deepStrictEqual(obj, { c: 1 });
    });

    it('should delete null and undefined elements from an array', () => {
        const arr = [null, undefined, 1];
        deleteNullProperties(arr);
        assert.deepStrictEqual(arr, [1]);
    });

    it('should delete null and undefined properties from nested objects', () => {
        const obj = { a: { b: null, c: undefined, d: 1 }, e: 2 };
        deleteNullProperties(obj);
        assert.deepStrictEqual(obj, { a: { d: 1 }, e: 2 });
    });

    it('should delete null and undefined elements from nested arrays', () => {
        const arr = [[null, undefined, 1], 2];
        deleteNullProperties(arr);
        assert.deepStrictEqual(arr, [[1], 2]);
    });

    it('should handle empty objects', () => {
        const obj = {};
        deleteNullProperties(obj);
        assert.deepStrictEqual(obj, {});
    });

    it('should handle empty arrays', () => {
        const arr: any = [];
        deleteNullProperties(arr);
        assert.deepStrictEqual(arr, []);
    });
});