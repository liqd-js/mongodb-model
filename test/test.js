"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionModel = exports.applicationModel = exports.engagementModel = exports.jobModel = exports.PositionModel = exports.ApplicationModel = exports.EngagementModel = exports.JobModel = exports.applicationCreatedBetween = exports.jobCreatedBetween = exports.accessFilter = void 0;
const mongodb_1 = require("mongodb");
require("dotenv/config");
const src_1 = require("../src");
exports.accessFilter = { $and: [] };
/**
 * Pipelines
 */
const jobCreatedBetween = (params) => ([{ $match: { 'events.created': { $gte: params.between.from, $lt: params.between.to } } }]);
exports.jobCreatedBetween = jobCreatedBetween;
const applicationCreatedBetween = (params) => ([{ $match: { 'events.created': { $gte: params.between.from, $lt: params.between.to } } }]);
exports.applicationCreatedBetween = applicationCreatedBetween;
class JobModel extends src_1.AbstractModel {
    constructor() {
        super(new mongodb_1.MongoClient(process.env.DB_CONN_STRING).db(process.env.DB_NAME).collection(process.env.COLL_NAME), {
            dbe: {
                converter: (dbe) => dbe,
            },
            dto: {
                converter: (dbe) => ({
                    _id: dbe._id.toString(),
                    title: dbe.title,
                    // name: dbe.name,
                    // positions: dbe.positions.map( position => positionModel.converters.dto.converter( position ) ),
                    // engagements: dbe.engagements.map( engagement => engagementModel.converters.dto.converter( engagement ) )
                }),
            }
        });
    }
    dbeID(id) {
        return new mongodb_1.ObjectId(id);
    }
    dtoID(dbeID) {
        return dbeID.toString();
    }
    async accessFilter() {
        return exports.accessFilter;
    }
    async resolveCustomFilter(customFilter) {
        const filter = {};
        const pipeline = [];
        customFilter.jobCreatedBetween && pipeline.push(...(0, exports.jobCreatedBetween)(customFilter.jobCreatedBetween));
        return { filter, pipeline };
    }
    pipeline(options) {
        return super.pipeline(options);
    }
}
exports.JobModel = JobModel;
class EngagementModel extends src_1.AbstractPropertyModel {
    constructor() {
        super(new mongodb_1.MongoClient(process.env.DB_CONN_STRING).db(process.env.DB_NAME).collection(process.env.COLL_NAME), 'engagements[]', {
            dbe: {
                converter: (dbe) => dbe,
            },
            dto: {
                converter: (dbe) => ({
                    id: dbe.id.toString(),
                    agencyID: dbe.agencyID.toString(),
                    recruiterID: dbe.recruiterID.toString(),
                    date: dbe.date,
                    applications: dbe.applications.map(application => exports.applicationModel.converters.dto.converter(application))
                }),
            }
        });
    }
    dbeID(id) {
        return new mongodb_1.ObjectId(id);
    }
    dtoID(dbeID) {
        return dbeID.toString();
    }
    pipeline(options) {
        return super.pipeline(options);
    }
    async resolveCustomFilter(customFilter) {
        const filter = {};
        const pipeline = [];
        return { filter, pipeline };
    }
}
exports.EngagementModel = EngagementModel;
class ApplicationModel extends src_1.AbstractPropertyModel {
    constructor() {
        super(new mongodb_1.MongoClient(process.env.DB_CONN_STRING).db(process.env.DB_NAME).collection(process.env.COLL_NAME), 'engagements[].applications[]', {
            dbe: {
                converter: (dbe) => dbe,
            },
            dto: {
                converter: (dbe) => ({
                    id: dbe.id.toString(),
                    date: dbe.date,
                    status: dbe.status,
                }),
            }
        });
    }
    dbeID(id) {
        return new mongodb_1.ObjectId(id);
    }
    dtoID(dbeID) {
        return dbeID.toString();
    }
    pipeline(options) {
        return super.pipeline(options);
    }
    async resolveCustomFilter(customFilter) {
        const filter = {};
        const pipeline = [];
        customFilter.jobCreatedBetween && pipeline.push(...(0, exports.jobCreatedBetween)(customFilter.jobCreatedBetween));
        customFilter.applicationStatus && (filter['status'] = { $in: customFilter.applicationStatus });
        customFilter.applicationCreatedBetween && pipeline.push(...(0, exports.applicationCreatedBetween)(customFilter.applicationCreatedBetween));
        return { filter, pipeline };
    }
}
exports.ApplicationModel = ApplicationModel;
class PositionModel extends src_1.AbstractPropertyModel {
    constructor() {
        super(new mongodb_1.MongoClient(process.env.DB_CONN_STRING).db(process.env.DB_NAME).collection(process.env.COLL_NAME), 'positions[]', {
            dbe: {
                converter: (dbe) => dbe,
            },
            dto: {
                converter: (dbe) => ({
                    _id: dbe.id.toString(),
                    events: dbe.events,
                }),
            }
        });
    }
    pipeline(options) {
        return super.pipeline(options);
    }
    async resolveCustomFilter(customFilter) {
        const filter = {};
        const pipeline = [];
        return { filter, pipeline };
    }
}
exports.PositionModel = PositionModel;
exports.jobModel = new JobModel();
exports.engagementModel = new EngagementModel();
exports.applicationModel = new ApplicationModel();
exports.positionModel = new PositionModel();
const pipeline0 = [{
        "$unwind": "$engagements"
    }, {
        "$unwind": "$engagements.applications"
    }, {
        "$match": {
            "$and": [{
                    "engagements.applications.status": {
                        "$in": ["hired"]
                    }
                }, {
                    "$and": [{
                            "engagements.applications.events.created": {
                                "$gte": new Date("2023-02-21T00:00:00.000Z"),
                                "$lt": new Date("2024-02-16T00:00:00.000Z")
                            }
                        }, {
                            "programmeID": {
                                "$in": [new mongodb_1.ObjectId("63e29c4cdcc1dceb68cdeb8c")]
                            },
                            "status": {
                                "$in": ["active"]
                            }
                        }]
                }]
        }
    }, {
        "$replaceWith": {
            "id": "$engagements.applications.id",
            "stages": "$engagements.applications.stages",
            "status": "$engagements.applications.status",
            "events": "$engagements.applications.events"
        }
    }, {
        "$match": {
            "$expr": {
                "$function": {
                    "body": "function applicationActiveBetween(events, between) {\n    if (Array.isArray(events)) {\n        return events.some((event) => applicationActiveBetween(event, between));\n    }\n    return events.submitted < between.to\n        && (events.hired >= between.from\n            || events.dropout >= between.from\n            || events.rejected >= between.from\n            || events.withdrawn >= between.from\n            || (!events.hired && !events.dropout && !events.rejected && !events.withdrawn));\n}",
                    "args": ["$events", {
                            "from": new Date("2023-02-21T00:00:00.000Z"),
                            "to": new Date("2024-02-16T00:00:00.000Z")
                        }],
                    "lang": "js"
                }
            }
        }
    }, {
        "$match": {
            "$expr": {
                "$function": {
                    "body": "function jobPositionActiveBetween(positions /*PositionDBE - chyba tam events v types*/, between) {\n    if (!Array.isArray(positions)){\n        positions = [positions];\n    }\n    return positions.some((position) => ((position.events && position.events.opened < between.to\n && (position.events.closed >= between.from\n            || position.events.hired >= between.from\n            || (!position.events.closed && !position.events.hired)))\n        && position.closeReason !== 'created-by-mistage'));\n}",
                    "args": ["$_root.positions", {
                            "from": new Date("2023-02-21T00:00:00.000Z"),
                            "to": new Date("2024-02-16T00:00:00.000Z")
                        }],
                    "lang": "js"
                }
            }
        }
    }, {
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
                                "$lt": ["$$position.events.opened", new Date("2024-02-16T00:00:00.000Z")]
                            }, {
                                "$or": [{
                                        "$gte": ["$$position.events.closed", new Date("2023-02-21T00:00:00.000Z")]
                                    }, {
                                        "$gte": ["$$position.events.hired", new Date("2023-02-21T00:00:00.000Z")]
                                    }, {
                                        "$and": [{
                                                "$eq": [{
                                                        "$ifNull": ["$$position.events.closed", null]
                                                    }, null]
                                            }, {
                                                "$eq": [{
                                                        "$ifNull": ["$$position.events.hired", null]
                                                    }, null]
                                            }]
                                    }]
                            }]
                    }
                }
            }
        }
    }, {
        "$addFields": {
            "activePositionsSize": {
                "$size": "$activePositions"
            }
        }
    }, {
        "$match": {
            "activePositionsSize": {
                "$gt": 0
            }
        }
    }, {
        "$group": {
            "_id": null,
            "existing": {
                "$sum": {
                    "$cond": [{
                            "$lt": ["$events.created", new Date("2023-02-21T00:00:00.000Z")]
                        }, 1, 0]
                }
            },
            "new": {
                "$sum": {
                    "$cond": [{
                            "$gte": ["$events.created", new Date("2023-02-21T00:00:00.000Z")]
                        }, 1, 0]
                }
            }
        }
    }];
const pipeline1 = [
    {
        "$match": {
            _id: 1,
            "programmeID": {
                "$in": [new mongodb_1.ObjectId("63e29c4cdcc1dceb68cdeb8c")]
            },
            "positions.events.opened": {
                "$lt": new Date("2023-07-05T00:00:00.000Z")
            },
            "$and": [{
                    "$or": [{
                            "positions.events.closed": {
                                "$gte": new Date("2023-07-03T00:00:00.000Z")
                            }
                        }, {
                            "positions.events.hired": {
                                "$gte": new Date("2023-07-03T00:00:00.000Z")
                            }
                        }, {
                            "positions.events.closed": {
                                "$exists": false
                            },
                            "positions.events.hired": {
                                "$exists": false
                            }
                        }]
                }]
        }
    }, {
        "$unwind": "$positions"
    }, {
        "$replaceWith": {
            "id": "$positions.id",
            "jobID": "$$ROOT._id",
            "agencyID": "$$ROOT.engagements.agencyID",
            "applications": "$$ROOT.engagements.applications",
            "userID": "$$ROOT.employer.accountIDs",
            "status": "$positions.status"
        }
    }, {
        "$project": {
            "statusAt": {
                "$function": {
                    "body": "function jobPositionStatusAt(events, date, between) {    if (between        && !(events.opened < between.to            && (events.closed >= between.from                || events.hired >= between.from                || (!events.closed && !events.hired)))) {        returnnull;    }    if (events.closed !== null && events.closed <= date) {        return \"closed\";    }    if (events.hired !== null && events.hired <= date) {        return \"hired\";    }    if (events.paused !== null && events.paused <= date) {        return \"paused\";    }    if (events.opened !== null && events.opened <= date) {        return \"open\";    }    return null;}",
                    "args": ["$events", new Date("2023-07-05T00:00:00.000Z"), {
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
                            "$eq": ["$statusAt", "hired"]
                        }, 1, 0]
                }
            },
            "onholdJobs": {
                "$sum": {
                    "$cond": [{
                            "$eq": ["$statusAt", "paused"]
                        }, 1, 0]
                }
            },
            "closedJobs": {
                "$sum": {
                    "$cond": [{
                            "$in": ["$statusAt", ["closed", "dropout"]]
                        }, 1, 0]
                }
            },
            "openJobs": {
                "$sum": {
                    "$cond": [{
                            "$eq": ["$statusAt", "open"]
                        }, 1, 0]
                }
            }
        }
    },
    {
        $match: {
            openJobs: 1
        }
    }
];
const pipeline2 = [
    {
        "$unwind": "$positions"
    }, {
        "$match": {
            "positions.events.hired": {
                "$gte": new Date("2024-03-12T10:58:31.921Z"),
                "$lt": new Date("2024-03-12T10:58:31.921Z")
            }
        }
    }, {
        "$replaceWith": {
            "id": "$positions.id",
            "jobID": "$$ROOT._id",
            "agencyID": "$$ROOT.engagements.agencyID",
            "applications": "$$ROOT.engagements.applications",
            "userID": "$$ROOT.employer.accountIDs",
            "status": "$positions.status"
        }
    }, {
        "$group": {
            "_id": "$jobID",
            "userID": {
                "$first": "$userID"
            },
            "jobs": {
                "$sum": 1
            }
        }
    }, {
        "$unwind": "$userID"
    }, {
        "$group": {
            "_id": "$userID",
            "jobs": {
                "$sum": "$jobs"
            }
        }
    }, {
        "$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "accounts.id",
            "as": "user"
        }
    }, {
        "$match": {
            "user": {
                "$ne": []
            }
        }
    }, {
        "$unwind": "$user"
    }, {
        "$addFields": {
            "_id": {
                "$arrayElemAt": ["$user.accounts.id", 0]
            }
        }
    }, {
        "$addFields": {
            "user": "$user.name"
        }
    }
];
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
];
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
    'a.x': { $eq: 2 },
    'a.y': { $not: { $eq: 2 } },
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
                        args: ['$_root.positions', '$a.b.c.x', { from: new Date(), to: new Date() }],
                        lang: 'js'
                    }
                }
            }
        ]
    }
};
// LOG(filterUnwindedProperties(matchUnwind1, 'a.b.cd'));
