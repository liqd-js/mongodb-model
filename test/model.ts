import {accessFilter, applicationCreatedBetween, applicationModel, jobCreatedBetween, jobModel} from "./test";
import assert from "node:assert";
import {ObjectId} from "mongodb";
import {DUMP, LOG, optimizeMatch} from "../src/helpers";

const accessFilterPipeline = [ { "$match": accessFilter } ];
const engagementsPipeline = [ {$unwind: '$engagements'}, {$replaceWith: '$engagements'} ];
const applicationPipeline = [{$unwind: '$engagements'}, {$unwind: '$engagements.applications'}, {$replaceWith: '$engagements.applications'}];

const betweenFilter = { between: { from: new Date('2024-01-01'), to: new Date('2024-12-01') } };

describe('list test', () => {
    it('should return a pipeline with access filter', async () => {
        const res = await jobModel.list({
            filter: {'engagements.id': new ObjectId('65e703099c9f4de34fc18db2')},
        });
        LOG(res);
    });
});

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
        assert.deepStrictEqual( pipeline, [ ...accessFilterPipeline, { $match: { 'events.created': { $gte: new Date('2024-01-01'), $lt: new Date('2024-12-01') } } }]);
    });

    it('should combine all options', async () =>
    {
        const pipeline = await jobModel.pipeline({ filter: { name: 'a' }, customFilter: { jobCreatedBetween: { between: { from: new Date('2024-01-01'), to: new Date('2024-12-01') } } } });
        assert.deepStrictEqual( pipeline, [ ...accessFilterPipeline, { $match: { name: 'a' } }, { $match: { 'events.created': { $gte: new Date('2024-01-01'), $lt: new Date('2024-12-01') } } }]);
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
            ...applicationCreatedBetween(betweenFilter),
        ]);
    });

    it('should combine application and job custom filters', async () =>
    {
        const pipeline = await applicationModel.pipeline({ customFilter: { applicationCreatedBetween: betweenFilter, jobCreatedBetween: betweenFilter }, filter: { name: 'a', '$root.engagements.agencyID': new ObjectId('65e7053f3c67bebc2e959378'), status: 'dropout' } });
        LOG(pipeline);
        assert.deepStrictEqual( pipeline, [
            applicationPipeline[0],
            applicationPipeline[1],
            {
                "$match": {
                    'engagements.applications.status': 'dropout',
                    'engagements.agencyID': new ObjectId('65e7053f3c67bebc2e959378'),
                    'engagements.applications.name': 'a'
                }
            },
            applicationPipeline[2],
            ...jobCreatedBetween(betweenFilter),
            ...applicationCreatedBetween(betweenFilter),
        ]);
    });

    it('tmp', async () =>
    {
        const pipeline = await applicationModel.list({
            filter: {
                $and: [
                    { name: 'a'/*, '$root.engagements.id': 10 */},
                    { '$root.engagements.agencyID': new ObjectId('65e7053f3c67bebc2e959378') },
                    { status: 'dropout' },
                    {
                        $or: [
                            { '$root.engagements.x': new ObjectId('65e7053f3c67bebc2e959378')},
                            { name: 'b' }
                        ]
                    },
                    {
                        $or: [
                            { '$root.engagements.applications.id': new ObjectId('65e7053f3c67bebc2e959378')},
                            { '$root.engagements.applications.recruiterID': new ObjectId('65e7053f3c67bebc2e959378')},
                        ]
                    },
                    // {'$root._id': { $in: [new ObjectId('65e703099c9f4de34fc18db2')] }}
                ]
            },
            sort: { name: -1 },
            limit: 100,
            projection: {
                name: 1
            },
            pipeline: [{$lookup: 1}]
        });
        LOG(pipeline);
        // assert.deepStrictEqual( pipeline, applicationPipeline);
    });

    it('should combine application and job custom filters - property + property');

    it('should combine application and position custom filters - property + property');

    it('should combine application, engagement and position custom filters - pipeline + pipeline + pipeline');
})