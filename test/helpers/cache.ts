import * as assert from 'assert';
import Cache from '../../src/helpers/cache';

describe('Cache', () => {
    it('should set and get value when convertor is not in cache', () => {
        const value = Cache.set('convertor1', 'type1', 'id1', 'value1');
        assert.strictEqual(value, 'value1');
        assert.strictEqual(Cache.get('convertor1', 'type1', 'id1'), 'value1');
    });

    it('should set and get value when convertor is in cache but type is not', () => {
        Cache.set('convertor2', 'type1', 'id1', 'value1');
        const value = Cache.set('convertor2', 'type2', 'id2', 'value2');
        assert.strictEqual(value, 'value2');
        assert.strictEqual(Cache.get('convertor2', 'type2', 'id2'), 'value2');
    });

    it('should set and get value when convertor and type are in cache', () => {
        Cache.set('convertor3', 'type3', 'id1', 'value1');
        const value = Cache.set('convertor3', 'type3', 'id2', 'value2');
        assert.strictEqual(value, 'value2');
        assert.strictEqual(Cache.get('convertor3', 'type3', 'id2'), 'value2');
    });

    it('should return undefined when convertor is not in cache', () => {
        assert.strictEqual(Cache.get('convertor4', 'type1', 'id1'), undefined);
    });

    it('should return undefined when convertor is in cache but type is not', () => {
        Cache.set('convertor5', 'type1', 'id1', 'value1');
        assert.strictEqual(Cache.get('convertor5', 'type2', 'id1'), undefined);
    });

    it('should return undefined when convertor and type are in cache but id is not', () => {
        Cache.set('convertor6', 'type6', 'id1', 'value1');
        assert.strictEqual(Cache.get('convertor6', 'type6', 'id2'), undefined);
    });

    it('should return value when convertor, type, and id are all in cache', () => {
        Cache.set('convertor7', 'type7', 'id7', 'value7');
        assert.strictEqual(Cache.get('convertor7', 'type7', 'id7'), 'value7');
    });
});

