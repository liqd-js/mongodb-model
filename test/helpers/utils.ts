import assert from "node:assert";
import { deleteNullishProperties } from "../../src";

describe('const res = deleteNullishProperties', () => {
    it('should delete null andres properties from an object', () => {
        const obj = { a: null, b: undefined, c: 1 };
        const res = deleteNullishProperties(obj);
        assert.deepStrictEqual(res, { c: 1 });
    });

    it('should delete null and undefined elements from an array', () => {
        const arr = [null, undefined, 1];
        const res = deleteNullishProperties(arr);
        assert.deepStrictEqual(res, [1]);
    });

    it('should delete null and undefined properties from nested objects', () => {
        const obj = { a: { b: null, c: undefined, d: 1 }, e: 2 };
        const res = deleteNullishProperties(obj);
        assert.deepStrictEqual(res, { a: { d: 1 }, e: 2 });
    });

    it('should delete null and undefined elements from nested arrays', () => {
        const arr = [[null, undefined, 1], 2];
        const res = deleteNullishProperties(arr);
        assert.deepStrictEqual(res, [[1], 2]);
    });

    it('should handle empty objects', () => {
        const obj = {};
        const res = deleteNullishProperties(obj);
        assert.deepStrictEqual(res, {});
    });

    it('should handle empty arrays', () => {
        const arr: any = [];
        const res = deleteNullishProperties(arr);
        assert.deepStrictEqual(res, []);
    });
});