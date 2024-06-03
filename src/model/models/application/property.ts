import {DateInterval} from "@ramp-global/types";

export default class ApplicationProperty
{
    static statusAt(date: Date, between?: DateInterval)
    {
        return {
            statusesAt: {
                $function: {
                    body: applicationStatusAt.toString(),
                    args: ["$history", date, between],
                    lang: "js"
                }
            },
        }
    }
}

/**
 * Retrieves status of job position at given date
 * @param history - history array
 * @param date - date to check status at
 * @param between - optional date interval to filter active positions between
 * @returns If array of positions is given, returns array of statuses, otherwise returns single status
 */
export function applicationStatusAt( history: any, date: Date, between?: DateInterval )
{
    if( !history ){ return "unknown"; }

    const filteredHistory = between
        ? history.filter( (event: any) => event.events.created <= date && event.events.created >= between.from )
        : history.filter( (event: any) => event.events.created <= date );

    if (filteredHistory.length >= 1)
    {
        return filteredHistory[0].status;
    }

    return "unknown";
}
