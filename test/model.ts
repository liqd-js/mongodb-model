import {accessFilter, applicationCreatedBetween, applicationModel, jobModel} from "./test";
import assert from "node:assert";

const accessFilterPipeline = [ { "$match": accessFilter } ];
// const engagementsPipeline = [ { "$replaceWith": "$child" } ];
const applicationPipeline = [{$unwind: '$engagements'}, {$unwind: '$engagements.applications'}, {$replaceWith: '$engagements.applications'}];

const betweenFilter = { between: { from: new Date('2024-01-01'), to: new Date('2024-12-01') } };
// const arrayPropertyPipeline = [ { "$unwind": "$children" }, { "$replaceWith": "$children" } ];

describe('AbstractModel - job', () =>
{
    it('should create empty pipeline with access filter', async () =>
    {
        const pipeline = await jobModel.pipeline({});
        assert.deepStrictEqual( pipeline, accessFilterPipeline);
    });

    it('should create pipeline with filter', async () => {
        const pipeline = await jobModel.pipeline({ filter: { name: 'a' } });
        assert.deepStrictEqual( pipeline, [ ...accessFilterPipeline, { $match: { name: 'a' } } ]);
    });

    it('should create pipeline with custom filter', async () =>
    {
        const pipeline = await jobModel.pipeline({ customFilter: { jobCreatedBetween: { between: { from: new Date('2024-01-01'), to: new Date('2024-12-01') } } } });
        assert.deepStrictEqual( pipeline, [ ...accessFilterPipeline, { $match: { created: { $gte: new Date('2024-01-01'), $lt: new Date('2024-12-01') } } }]);
    });

    it('should combine all options', async () =>
    {
        const pipeline = await jobModel.pipeline({ filter: { name: 'a' }, customFilter: { jobCreatedBetween: { between: { from: new Date('2024-01-01'), to: new Date('2024-12-01') } } } });
        assert.deepStrictEqual( pipeline, [ ...accessFilterPipeline, { $match: { name: 'a' } }, { $match: { created: { $gte: new Date('2024-01-01'), $lt: new Date('2024-12-01') } } }]);
    });
})


describe('AbstractPropertyModel - application', () =>
{
    it('should create empty pipeline without access filter', async () =>
    {
        const pipeline = await applicationModel.pipeline({});
        assert.deepStrictEqual( pipeline, applicationPipeline);
    });

    it('should create pipeline with filter', async () => {
        const pipeline = await applicationModel.pipeline({ filter: { name: 'a' } });
        assert.deepStrictEqual( pipeline, [
            applicationPipeline[0],
            applicationPipeline[1],
            { "$match": { 'engagements.applications.name': 'a' } },
            applicationPipeline[2],
        ]);
    });

    it('should create pipeline with custom property filter', async () =>
    {
        const pipeline = await applicationModel.pipeline({ customFilter: { applicationStatus: ['a'] } });
        assert.deepStrictEqual( pipeline, [
            applicationPipeline[0],
            applicationPipeline[1],
            { "$match": { 'engagements.applications.status': { $in: ['a'] } } },
            applicationPipeline[2],
        ]);
    });

    it('should create pipeline with custom pipeline filter', async () =>
    {
        const pipeline = await applicationModel.pipeline({ customFilter: { applicationCreatedBetween: betweenFilter } });
        assert.deepStrictEqual( pipeline, [
            applicationPipeline[0],
            applicationPipeline[1],
            applicationPipeline[2],
            applicationCreatedBetween(betweenFilter),
        ]);
    });

    it('should combine application and job custom filters - pipeline + pipeline', async () =>
    {
        const pipeline = await applicationModel.pipeline({ customFilter: { applicationCreatedBetween: betweenFilter, jobCreatedBetween: betweenFilter }, filter: { name: 'a' } });
        assert.deepStrictEqual( pipeline, [
            applicationPipeline[0],
            applicationPipeline[1],
            { "$match": { 'engagements.applications.name': 'a' } },
            applicationPipeline[2],
            applicationCreatedBetween(betweenFilter),
            { "$match": { created: { $gte: new Date('2024-01-01'), $lt: new Date('2024-12-01') } } },
        ]);
    });

    it('should combine application and job custom filters - pipeline + property');
    it('should combine application and job custom filters - property + pipeline');
    it('should combine application and job custom filters - property + property');
})