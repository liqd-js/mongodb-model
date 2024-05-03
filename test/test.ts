import {Filter, MongoClient, ObjectId} from "mongodb";
import 'dotenv/config';
import {
    AbstractConverters,
    AbstractModel,
    AbstractPropertyModel,
    ModelAggregateOptions,
} from "../src";

type JobDBE = { _id: ObjectId, name: string, events: { created: Date }, positions: PositionDBE[], engagements: EngagementDBE[] };
type JobDTO = { _id: string, name: string, events: { created: Date }, positions: PositionDTO[], engagements: EngagementDTO[] };

type EngagementDBE = { id: ObjectId, agencyID: ObjectId, recruiterID: ObjectId, date: Date, applications: ApplicationDBE[] };
type EngagementDTO = { id: string, agencyID: string, recruiterID: string, date: Date, applications: ApplicationDTO[] };

type ApplicationDBE = { id: ObjectId, date: Date, status: string };
type ApplicationDTO = { id: string, date: Date, status: string };

type PositionDBE = { id: ObjectId, events: { opened: Date, closed?: Date } };
type PositionDTO = { id: string, events: { opened: Date, closed?: Date } };

export const accessFilter = { $and: [{name: { $in: ['Test job 1 - all applications created after 2024-01-01'] } }, {}] };

/**
 * Pipelines
 */
export const jobCreatedBetween = (params: {between: {from: Date, to: Date}}) => ([{$match: { 'events.created': { $gte: params.between.from, $lt: params.between.to } } }]);
export const applicationCreatedBetween = (params: {between: {from: Date, to: Date}}) => ([{$match: { 'events.created': { $gte: params.between.from, $lt: params.between.to } } }]);

export class JobModel extends AbstractModel<JobDBE, JobDTO, AbstractConverters<JobDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            {
                dbe: {
                    converter: ( dbe: JobDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: JobDBE ) => ({
                        _id: dbe._id.toString(),
                        name: dbe.name,
                        positions: dbe.positions.map( position => positionModel.converters.dto.converter( position ) ),
                        engagements: dbe.engagements.map( engagement => engagementModel.converters.dto.converter( engagement ) )
                    }),
                }
            }
        );
    }

    public dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"]
    {
        return new ObjectId(id);
    }

    public dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"]
    {
        return dbeID.toString();
    }

    protected async accessFilter(): Promise<Filter<JobDBE>>
    {
        return accessFilter;
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        customFilter.jobCreatedBetween && pipeline.push(...jobCreatedBetween(customFilter.jobCreatedBetween));

        return { filter, pipeline };
    }

    public pipeline( options: ModelAggregateOptions<JobDBE> )
    {
        return super.pipeline( options );
    }
}

export class EngagementModel extends AbstractPropertyModel<JobDBE, EngagementDBE, EngagementDTO, AbstractConverters<EngagementDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'engagements[]',
            {
                dbe: {
                    converter: ( dbe: EngagementDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: EngagementDBE ) => ({
                        id: dbe.id.toString(),
                        agencyID: dbe.agencyID.toString(),
                        recruiterID: dbe.recruiterID.toString(),
                        date: dbe.date,
                        applications: dbe.applications.map( application => applicationModel.converters.dto.converter( application ) )
                    }),
                }
            }
        );
    }

    public dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"]
    {
        return new ObjectId(id);
    }

    public dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"]
    {
        return dbeID.toString();
    }

    public pipeline( options: ModelAggregateOptions<EngagementDBE> )
    {
        return super.pipeline( options );
    }

    public newPipeline( options: ModelAggregateOptions<EngagementDBE> )
    {
        return super.newPipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        return { filter, pipeline };
    }

}

export class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, AbstractConverters<ApplicationDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'engagements[].applications[]',
            {
                dbe: {
                    converter: ( dbe: ApplicationDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: ApplicationDBE ) => ({
                        id: dbe.id.toString(),
                        date: dbe.date,
                        status: dbe.status,
                    }),
                }
            }
        );
    }

    public dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"]
    {
        return new ObjectId(id);
    }

    public dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"]
    {
        return dbeID.toString();
    }

    public pipeline( options: ModelAggregateOptions<ApplicationDBE> )
    {
        return super.pipeline( options );
    }

    public newPipeline( options: ModelAggregateOptions<ApplicationDBE> )
    {
        return super.newPipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        customFilter.jobCreatedBetween && pipeline.push(...jobCreatedBetween(customFilter.jobCreatedBetween));

        customFilter.applicationStatus  && (filter['status'] = { $in: customFilter.applicationStatus });
        customFilter.applicationCreatedBetween && pipeline.push(...applicationCreatedBetween(customFilter.applicationCreatedBetween));

        return { filter, pipeline };
    }
}

export class PositionModel extends AbstractPropertyModel<JobDBE, PositionDBE, PositionDTO, AbstractConverters<PositionDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'positions[]',
            {
                dbe: {
                    converter: ( dbe: PositionDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: PositionDBE ) => ({
                        _id: dbe.id.toString(),
                        events: dbe.events,
                    }),
                }
            }
        );
    }

    public pipeline( options: ModelAggregateOptions<PositionDBE> )
    {
        return super.pipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        return { filter, pipeline };
    }
}


export const jobModel = new JobModel();
export const engagementModel = new EngagementModel();
export const applicationModel = new ApplicationModel();
export const positionModel = new PositionModel();


const pipeline0 = [{
    "$unwind": "$engagements"
},{
    "$unwind": "$engagements.applications"
},{
    "$match": {
        "$and": [{
            "engagements.applications.status": {
                "$in": ["hired"]
            }
        },{
            "$and": [{
                "engagements.applications.events.created": {
                    "$gte": new Date("2023-02-21T00:00:00.000Z"),
                    "$lt": new Date("2024-02-16T00:00:00.000Z")
                }
            },{
                "programmeID": {
                    "$in": [new ObjectId("63e29c4cdcc1dceb68cdeb8c")]
                },
                "status": {
                    "$in": ["active"]
                }
            }]
        }]
    }
},{
    "$replaceWith": {
        "id": "$engagements.applications.id",
        "stages": "$engagements.applications.stages",
        "status": "$engagements.applications.status",
        "events": "$engagements.applications.events"
    }
},{
    "$match": {
        "$expr": {
            "$function": {
                "body": "function applicationActiveBetween(events, between) {\n    if (Array.isArray(events)) {\n        return events.some((event) => applicationActiveBetween(event, between));\n    }\n    return events.submitted < between.to\n        && (events.hired >= between.from\n            || events.dropout >= between.from\n            || events.rejected >= between.from\n            || events.withdrawn >= between.from\n            || (!events.hired && !events.dropout && !events.rejected && !events.withdrawn));\n}",
"args": ["$events",{
    "from": new Date("2023-02-21T00:00:00.000Z"),
    "to": new Date("2024-02-16T00:00:00.000Z")
}],
    "lang": "js"
}
}
}
},{
    "$match": {
        "$expr": {
            "$function": {
                "body": "function jobPositionActiveBetween(positions /*PositionDBE - chyba tam events v types*/, between) {\n    if (!Array.isArray(positions)){\n        positions = [positions];\n    }\n    return positions.some((position) => ((position.events && position.events.opened < between.to\n && (position.events.closed >= between.from\n            || position.events.hired >= between.from\n            || (!position.events.closed && !position.events.hired)))\n        && position.closeReason !== 'created-by-mistage'));\n}",
            "args": ["$_root.positions",{
                "from": new Date("2023-02-21T00:00:00.000Z"),
                "to": new Date("2024-02-16T00:00:00.000Z")
            }],
                "lang": "js"
        }
    }
}
},{
    "$addFields": {
        "activePositions": {
            "$filter": {
                "input": {
                    "$cond": {
                        "if": {
                            "$isArray": "$root.positions"
                        },
                        "then": "$root.positions",
                            "else": ["$root.positions"]
                    }
                },
                "as": "position",
                    "cond": {
                    "$and": [{
                        "$lt": ["$$position.events.opened",new Date("2024-02-16T00:00:00.000Z")]
                    },{
                        "$or": [{
                            "$gte": ["$$position.events.closed",new Date("2023-02-21T00:00:00.000Z")]
                        },{
                            "$gte": ["$$position.events.hired",new Date("2023-02-21T00:00:00.000Z")]
                        },{
                            "$and": [{
                                "$eq": [{
                                    "$ifNull": ["$$position.events.closed",null]
                                },null]
                            },{
                                "$eq": [{
                                    "$ifNull": ["$$position.events.hired",null]
                                },null]
                            }]
                        }]
                    }]
                }
            }
        }
    }
},{
    "$addFields": {
        "activePositionsSize": {
            "$size": "$activePositions"
        }
    }
},{
    "$match": {
        "activePositionsSize": {
            "$gt": 0
        }
    }
},{
    "$group": {
        "_id": null,
            "existing": {
            "$sum": {
                "$cond": [{
                    "$lt": ["$events.created",new Date("2023-02-21T00:00:00.000Z")]
                },1,0]
            }
        },
        "new": {
            "$sum": {
                "$cond": [{
                    "$gte": ["$events.created",new Date("2023-02-21T00:00:00.000Z")]
                },1,0]
            }
        }
    }
}]

const pipeline1 = [
    {
    "$match": {
        _id: 1,
        "programmeID": {
            "$in": [new ObjectId("63e29c4cdcc1dceb68cdeb8c")]
        },
        "positions.events.opened": {
            "$lt": new Date("2023-07-05T00:00:00.000Z")
        },
        "$and": [{
            "$or": [{
                "positions.events.closed": {
                    "$gte": new Date("2023-07-03T00:00:00.000Z")
                }
            },{
                "positions.events.hired": {
                    "$gte": new Date("2023-07-03T00:00:00.000Z")
                }
            },{
                "positions.events.closed": {
                    "$exists": false
                },
                "positions.events.hired": {
                    "$exists": false
                }
            }]
        }]
    }
},{
    "$unwind": "$positions"
},{
    "$replaceWith": {
        "id": "$positions.id",
        "jobID": "$$ROOT._id",
        "agencyID": "$$ROOT.engagements.agencyID",
        "applications": "$$ROOT.engagements.applications",
        "userID": "$$ROOT.employer.accountIDs",
        "status": "$positions.status"
    }
},{
    "$project": {
        "statusAt": {
            "$function": {
                "body": "function jobPositionStatusAt(events, date, between) {    if (between        && !(events.opened < between.to            && (events.closed >= between.from                || events.hired >= between.from                || (!events.closed && !events.hired)))) {        returnnull;    }    if (events.closed !== null && events.closed <= date) {        return \"closed\";    }    if (events.hired !== null && events.hired <= date) {        return \"hired\";    }    if (events.paused !== null && events.paused <= date) {        return \"paused\";    }    if (events.opened !== null && events.opened <= date) {        return \"open\";    }    return null;}",
                "args": ["$events",new Date("2023-07-05T00:00:00.000Z"),{
                    "from": new Date("2023-07-03T00:00:00.000Z"),
                    "to": new Date("2023-07-05T00:00:00.000Z")
                }],
                "lang": "js"
            }
        }
    }
},
    {
        $match: {
            statusAt: {
                $ne: null
            }
        }
    },
    {
    "$group": {
        "_id": null,
        "placedJobs": {
            "$sum": {
                "$cond": [{
                    "$eq": ["$statusAt","hired"]
                },1,0]
            }
        },
        "onholdJobs": {
            "$sum": {
                "$cond": [{
                    "$eq": ["$statusAt","paused"]
                },1,0]
            }
        },
        "closedJobs": {
            "$sum": {
                "$cond": [{
                    "$in": ["$statusAt",["closed","dropout"]]
                },1,0]
            }
        },
        "openJobs": {
            "$sum": {
                "$cond": [{
                    "$eq": ["$statusAt","open"]
                },1,0]
            }
        }
    }
},
    {
        $match: {
            openJobs: 1
        }
    }
]



const pipeline2 = [
    {
    "$unwind": "$positions"
},{
    "$match": {
        "positions.events.hired": {
            "$gte": new Date("2024-03-12T10:58:31.921Z"),
            "$lt": new Date("2024-03-12T10:58:31.921Z")
        }
    }
},{
    "$replaceWith": {
        "id": "$positions.id",
        "jobID": "$$ROOT._id",
        "agencyID": "$$ROOT.engagements.agencyID",
        "applications": "$$ROOT.engagements.applications",
        "userID": "$$ROOT.employer.accountIDs",
        "status": "$positions.status"
    }
},{
    "$group": {
        "_id": "$jobID",
        "userID": {
            "$first": "$userID"
        },
        "jobs": {
            "$sum": 1
        }
    }
},{
    "$unwind": "$userID"
},{
    "$group": {
        "_id": "$userID",
        "jobs": {
            "$sum": "$jobs"
        }
    }
},{
    "$lookup": {
        "from": "users",
        "localField": "_id",
        "foreignField": "accounts.id",
        "as": "user"
    }
},{
    "$match": {
        "user": {
            "$ne": []
        }
    }
},{
    "$unwind": "$user"
},{
    "$addFields": {
        "_id": {
            "$arrayElemAt": ["$user.accounts.id",0]
        }
    }
},{
    "$addFields": {
        "user": "$user.name"
    }
}]
const pipelineMergeObjects = [
    {
        $project: {
            test: {
                $mergeObjects: [
                    "$positions",
                    { a: 1 },
                    { b: 2 }
                ]
            },
            a: {
                $map: {
                    input: "$engagements.applications",
                    as: "position",
                    in: {
                        $mergeObjects: [
                            "$$position",
                            { a: "$$position.id" },
                            { b: 2 }
                        ]
                    }
                }
            },
            b: {
                $filter: {
                    input: "$engagements",
                    as: "position",
                    cond: {
                        $eq: ["$$position.a", 1]
                    }
                }
            },

        }
    }
]


// LOG(extractFields(pipeline1))
/*
LOG(extractFromMatch({
    b: 2,
    "$expr": {
        $or: [
            { $and: [
                    { $eq: [ "$id", 1206 ] },
                    { $eq: [ "$field1", 0 ] }
                ]},
            { $and: [
                    { $ne: [ "$id", 1206 ] },
                    { $eq: [ "$field1", 1545001200 ] }
                ]},
        ],
        "$function": {
            "body": "function applicationActiveBetween(events, between) {\n    if (Array.isArray(events)) {\n        return events.some((event) => applicationActiveBetween(event, between));\n    }\n    return events.submitted < between.to\n        && (events.hired >= between.from\n            || events.dropout >= between.from\n            || events.rejected >= between.from\n            || events.withdrawn >= between.from\n            || (!events.hired && !events.dropout && !events.rejected && !events.withdrawn));\n}",
            "args": ["$events",{
                "from": new Date("2023-02-21T00:00:00.000Z"),
                "to": new Date("2024-02-16T00:00:00.000Z")
            }],
            "lang": "js"
        }
    },
        "$and": [{
        c: 1,
            "$and": [{
                "programmeID": {
                    "$in": [new ObjectId("63e29c4cdcc1dceb68cdeb8c")]
                }
            },
                {
                    a: 1
                }]
        }]
}))
*/

const matchUnwind1 = {
    x: { $in: [1, 2, 3] },
    'a.x': {$eq: 2},
    'a.y': {$not: {$eq: 2}},
    'a.b.x': 3,
    $expr: {
        $eq: ['$a.b.x', 4],
        $nin: ['$a.b.c.x', [1, 2, 3]],
        $lt: [{
            $cond: {
                if: { $gte: ["$qty", 100] },
                then: { $multiply: ["$price", 0.5] },
                else: { $multiply: ["$price", 0.75] }
            }
        }, 2],
        $and: [
            {
                $expr: {
                    $function: {
                        body: '...',
                        args: ['$_root.positions', '$a.b.c.x', {from: new Date(), to: new Date()}],
                        lang: 'js'
                    }
                }
            }
        ]
    }
}
// LOG(filterUnwindedProperties(matchUnwind1, 'a.b.cd'));