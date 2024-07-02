import {DateInterval} from "@ramp-global/types";
import {AbstractModelSmartFilters, AbstractPropertyModelSmartFilters} from "../types";

export class ApplicationFilters implements AbstractModelSmartFilters<ApplicationFilters>
{
    applicationCreatedBetween( between: DateInterval )
    {
        return {
            filter: { 'events.created': { $gte: between.from, $lt: between.to } },
            pipeline: null,
        };
    }

    applicationClosedBetween( between: DateInterval )
    {
        return {
            filter: {
                $or: [
                    {'events.hired': { $gte: between.from, $lt: between.to }},
                    {'events.transferred': { $gte: between.from, $lt: between.to }},
                    {'events.rejected': { $gte: between.from, $lt: between.to }},
                    {'events.withdrawn': { $gte: between.from, $lt: between.to }},
                    {'events.dropout': { $gte: between.from, $lt: between.to }},
                ]
            },
            pipeline: null,
        };
    }
}

export class EngagementFilters implements AbstractModelSmartFilters<EngagementFilters>
{
    engagementCreatedBetween( between: DateInterval )
    {
        return {
            filter: { 'events.created': { $gte: between.from, $lt: between.to } },
            pipeline: null,
        };
    }

    engagementClosedBetween( between: DateInterval )
    {
        return {
            filter: {
                $or: [
                    {'events.hired': { $gte: between.from, $lt: between.to }},
                    {'events.transferred': { $gte: between.from, $lt: between.to }},
                    {'events.rejected': { $gte: between.from, $lt: between.to }},
                    {'events.withdrawn': { $gte: between.from, $lt: between.to }},
                    {'events.dropout': { $gte: between.from, $lt: between.to }},
                ]
            },
            pipeline: null,
        };
    }
}