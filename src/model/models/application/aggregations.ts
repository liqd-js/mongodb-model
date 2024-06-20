import {
    AccountID,
    ApplicationID, CandidateID,
    JobID,
    OrganizationID,
    ProgrammeID,
    ProgrammeLocationID
} from "@ramp-global/types";
import {ObjectId} from "../../..";

const aggregations: object = (
{
    overview: ( filter:
                    {
                        jobIDs?: JobID[],
                        employerIDs?: OrganizationID[],
                        programmeIDs?: ProgrammeID[],
                        programmeLocationIDs?: ProgrammeLocationID[],
                        accountManagerIDs?: AccountID[]
                    } = {}) =>
    {
        const match: any = {};

        filter.jobIDs?.length && (match._id = filter.jobIDs.length === 1 ? filter.jobIDs[0] : {$in: filter.jobIDs});
        filter.employerIDs?.length && ( match.employer.organizationID = filter.employerIDs.length === 1 ? new ObjectId( filter.employerIDs[0] ) : { $in: filter.employerIDs.map( v => new ObjectId( v ))});
        filter.programmeIDs?.length && (match.programmeID = filter.programmeIDs.length === 1 ? new ObjectId(filter.programmeIDs[0]) : {$in: filter.programmeIDs.map(v => new ObjectId(v))});
        filter.programmeLocationIDs?.length && (match.programmeLocationID = filter.programmeLocationIDs.length === 1 ? new ObjectId(filter.programmeLocationIDs[0]) : {$in: filter.programmeLocationIDs.map(v => new ObjectId(v))});
        filter.accountManagerIDs?.length && (match['contacts.accountManagerIDs'] = filter.accountManagerIDs.length === 1 ? filter.accountManagerIDs[0] : {$in: filter.accountManagerIDs});
        // TODO otestovat ked je viacero accountManagerIDs aby sme pozerali ci je prienik poli

        return (
            [
                {
                    $match: {
                        active: true,
                        ...match
                    },
                },
                {
                    $unwind: "$engagements",
                },
                {
                    $unwind: "$engagements.applications",
                },
                {
                    $project: {
                        applicationStatus: {
                            // TODO: check if recruiter and employerPlaced are underOffer
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "submitted",
                                            ],
                                        },
                                        then: "submitted",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "reviewed",
                                            ],
                                        },
                                        then: "reviewed",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "interviewing",
                                            ],
                                        },
                                        then: "interviewing",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "under-offer",
                                            ],
                                        },
                                        then: "under-offer",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "pending",
                                            ],
                                        },
                                        then: "under-offer",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "placed",
                                            ],
                                        },
                                        then: "hired",
                                    },
                                    {
                                        case: {
                                            $eq: [
                                                "$engagements.applications.status",
                                                "starting",
                                            ],
                                        },
                                        then: "hired",
                                    },
                                ],
                                default: null,
                            },
                        },
                    },
                },
                {
                    $match: {
                        applicationStatus: {
                            $ne: null,
                        },
                    },
                },
                {
                    $group: {
                        _id: "$applicationStatus",
                        count: {
                            $sum: 1,
                        },
                    },
                },
            ]
        );
    },
    applications: (
        filter: {
            applicationIDs?     : Array<ApplicationID>,
            jobIDs?             : JobID[],
            programmeIDs?       : Array<ProgrammeID>,
            candidateIDs?       : Array<CandidateID>
            accountManagerIDs?  : Array<AccountID>
        }
    ) => {

        const match: any = {};

        filter.applicationIDs?.length && ( match['engagements.applications.id'] = filter.applicationIDs.length === 1 ? filter.applicationIDs[0] : { $in: filter.applicationIDs });
        filter.jobIDs?.length && ( match._id = filter.jobIDs.length === 1 ? filter.jobIDs[0] : { $in: filter.jobIDs });
        filter.programmeIDs?.length && ( match.programmeID = filter.programmeIDs.length === 1 ? new ObjectId( filter.programmeIDs[0] ) : { $in: filter.programmeIDs.map( v => new ObjectId( v ))});
        filter.candidateIDs?.length && ( match['engagements.applications.candidateID'] = filter.candidateIDs.length === 1 ? filter.candidateIDs[0] : { $in: filter.candidateIDs });
        filter.accountManagerIDs?.length && ( match['contacts.accountManagerIDs'] = filter.accountManagerIDs.length === 1 ? filter.accountManagerIDs[0] : { $in: filter.accountManagerIDs });

        return [
            {
                $match: {
                    ...match
                },
            },
            {
                $unwind: {
                    path: "$engagements",
                },
            },
            {
                $unwind: {
                    path: "$engagements.applications",
                },
            },
            {
                $match: {
                    ...match
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$engagements.applications",
                },
            },
            {
                $addFields: {
                    _id: "$id",
                },
            },
        ]
    },
    /*
    applicationsList: (
        options: ListOptions<ApplicationDBE>,
        filters: ApplicationFilterDTO
    ) => {
        const match: any = {};

        if ( Object.values(filters).length )
        {
            filters.ids?.length && ( match['engagements.applications.id'] = filters.ids.length === 1 ? filters.ids[0] : { $in: filters.ids });
            filters.programmeIDs?.length && ( match.programmeID = filters.programmeIDs.length === 1 ? new ObjectId( filters.programmeIDs[0] ) : { $in: filters.programmeIDs.map( v => new ObjectId( v ))});
        }

        return [
            {
                $match: {
                    ...match,
                },
            },
            {
                $unwind: {
                    path: "$engagements",
                },
            },
            {
                $unwind: {
                    path: "$engagements.applications",
                },
            },
            {
                $match: {
                    ...match
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$engagements.applications",
                },
            },
            {
                $addFields: {
                    _id: "$id",
                },
            },
            ...addAggregationOptions( options )
        ]
    }*/
});

export default aggregations;