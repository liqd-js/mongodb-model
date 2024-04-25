import {jobModel} from "../test";
import assert from "node:assert";

describe('QueryBuilder - list', () => {
    it('should build basic list pipeline', async () =>
    {
        const pipeline = await jobModel.newList({
            filter: { title: 'a' },
            sort: { title: 1 },
            cursor: 'prev:WyJhIl0',
        });
        assert.deepStrictEqual(pipeline, [
            {
                $match: {
                    title: { $eq: 'a', $lt: 'a' },
                    name: { $in: [ 'Test job 1 - all applications created after 2024-01-01' ] }
                }
            },
            { $sort: { title: -1 } }
        ])
    });
});
