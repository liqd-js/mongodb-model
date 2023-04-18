import { ObjectId, MongoClient, Document } from 'mongodb';

type Entry = {_id: number, email: string};

async function test()
{
    const client = new MongoClient( '' ); client.connect();

    try
    {
        await client.db('test').collection<Entry>('duplicate').insertOne({ _id: 1, email: 'dup' });
    }
    catch(e: any)
    {
        console.log(e, e.keyValue);
    }

    try
    {
        await client.db('test').collection<Entry>('duplicate').insertOne({ _id: 3, email: 'janko' });
    }
    catch(e: any)
    {
        console.log(e, e.keyValue);
    }

    console.log('test');
}

test();