import * as assert from 'assert';
import { addPrefixToFilter } from '../../src/helpers';

describe('- addPrefixToFilter', () =>
{
	it('should be ok', () =>
	{
		const prefixed = addPrefixToFilter({ a: 1, b: 2 }, 'prefix');

        assert.deepStrictEqual( prefixed, { 'prefix.a': 1, 'prefix.b': 2 }, 'filter not correctly prefixed' );
	});

    it('should be ok', () =>
	{
		const prefixed = addPrefixToFilter({ a: 1, b: 2 }, 'prefix');

        assert.deepStrictEqual( prefixed, { 'prefix.aFAIL': 1, 'prefix.b': 2 }, 'filter not correctly prefixed' );
	});
});