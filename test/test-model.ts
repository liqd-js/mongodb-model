import Model from '../src/model/index';
import {ApplicationFilter} from "../src/model/models/application/filter";
import {ObjectId} from "mongodb";
import {LOG} from "../src";

const model = new Model( 'mongodb://ramp-sandbox-admin:N9zWDpYbLQ8rr5fJCw8zE4hz@sandbox.ramp.global:27017/?authMechanism=DEFAULT' );

console.log( 'Test' );

async function test( )
{
    // const app = await model.applications.get( 'b1cf05542624a700493074de' );

    const res = await model.applications.list({
        count: true,
        filter: {
            '$root.programmeID': new ObjectId('63e29c4cdcc1dceb68cdeb8c'),
        },
        limit: 3,
        sort: {
            id: -1,
        },
        /*pipeline: [
            ...ApplicationFilter.stagesAt( new Date('2024-01-01') ),
            {
                $match: {
                    statusAt: 'hired'
                }
            }
        ],*/
    }, 'dto' );

    console.log( res );

    //@ts-ignore
    console.log( res.map( r => ({ id: r.id, cursor: r.$cursor })));
    /*

    const res2 = await model.applications.list({
        count: true,
        filter: {
            '$root.programmeID': new ObjectId('63e29c4cdcc1dceb68cdeb8c'),
        },
        limit: 3,
        sort: {
            candidateApplicationID: -1,
        },
        //@ts-ignore
        cursor: 'prev:' + res[2].$cursor,
        pipeline: [
            ...ApplicationFilter.stagesAt( new Date('2024-01-01') ),
            {
                $match: {
                    statusAt: 'hired'
                }
            }
        ],
    })

    //@ts-ignore
    console.log( res2.map( r => ({ id: r.candidateApplicationID, cursor: r.$cursor })));

    const res3 = await model.applications.list({
        count: true,
        filter: {
            '$root.programmeID': new ObjectId('63e29c4cdcc1dceb68cdeb8c'),
        },
        limit: 3,
        sort: {
            candidateApplicationID: -1,
        },
        //@ts-ignore
        cursor: 'next:' + res[0].$cursor,
        pipeline: [
            ...ApplicationFilter.stagesAt( new Date('2024-01-01') ),
            {
                $match: {
                    statusAt: 'hired'
                }
            }
        ],
    })

    //@ts-ignore
    console.log( res3.map( r => ({ id: r.candidateApplicationID, cursor: r.$cursor })));

    return ;

    return ;


    const res22 = await model.applications.list({
        count: true,
        filter: {
            '$root.programmeID': new ObjectId('63e29c4cdcc1dceb68cdeb8c'),
        },
        limit: 3,
        sort: {
            candidateApplicationID: -1,
        },
        cursor: 'next:WzM0MTEwXQ',
        pipeline: [
            ...ApplicationFilter.stagesAt( new Date('2024-01-01') ),
            {
                $match: {
                    statusAt: 'hired'
                }
            }
        ],
    })

    const res33 = await model.applications.list({
        count: true,
        filter: {
            '$root.programmeID': new ObjectId('63e29c4cdcc1dceb68cdeb8c'),
        },
        limit: 3,
        sort: {
            candidateApplicationID: -1,
        },
        cursor: 'next:WzMzNzA0XQ',
        pipeline: [
            ...ApplicationFilter.stagesAt( new Date('2024-01-01') ),
            {
                $match: {
                    statusAt: 'hired'
                }
            }
        ],
    }, 'dbe')

    LOG(res, res.total);
    LOG(res2, res2.total);
    LOG(res3, res3.total);

    // console.log( res );*/
}

model.scope( test, { log: true });