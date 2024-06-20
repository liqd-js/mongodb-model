import {DateInterval} from "@ramp-global/types";
import {applicationStatusAt} from "./property";
import {AbstractSmartFilters} from "../../../types/external";
import {ApplicationFilters} from "../../../../dist/model/models/application/filter";

export class ApplicationFilters1 implements AbstractSmartFilters<ApplicationFilters>
{
    activeBetweenAggregation( between: DateInterval )
    {
        return { pipeline: [
                {
                    $match: {
                        $expr: {
                            $function: {
                                body: applicationActiveBetween.toString(),
                                args: [ '$events', between ],
                                lang: "js",
                            }
                        }
                    }
                }
            ],
            filter: null }
    }

    static closedBetween(from: Date, to: Date)
    {
        return [{
            $or: [
                {'events.hired': { $gte: from, $lt: to }},
                {'events.transferred': { $gte: from, $lt: to }},
                {'events.rejected': { $gte: from, $lt: to }},
                {'events.withdrawn': { $gte: from, $lt: to }},
                {'events.dropout': { $gte: from, $lt: to }},
            ]
        }];
    }

    static stagesAt(date: Date, between?: DateInterval)
    {
        return [
            {
                $addFields: {
                    statusAt: {
                        $function: {
                            body: applicationStatusAt.toString(),
                            args: ["$history", date, between],
                            lang: "js"
                        }
                    },
                }
            },
            {
                $addFields: {
                    stagesAt: {
                        $function: {
                            body: function( stages: string[], statusAt: string )
                            {
                                const index = stages.indexOf( statusAt );

                                if( index === -1 )
                                {
                                    return stages;
                                }

                                return stages.slice( 0, index + 1 );
                            },
                            args: [ '$stages', '$statusAt' ],
                            lang: "js"
                        }
                    }
                }
            }
        ];
    }
}

export class ApplicationFilters2 implements AbstractSmartFilters<ApplicationFilters>
{
    filterDvojka( a: 'b' | 'c' | 3 )
    {
        return { pipeline: null, filter: null };
    }
}

export function applicationActiveBetween( events: any, between: DateInterval )
{
    return events.submitted < between.to
        && (
            events.hired >= between.from
            || events.dropout >= between.from
            || events.rejected >= between.from
            || events.withdrawn >= between.from
            || (!events.hired && !events.dropout && !events.rejected && !events.withdrawn)
        )
}
