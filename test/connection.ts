import { Collection, Document, FindOptions, Filter, WithId, ObjectId, MongoClient, OptionalUnlessRequiredId, UpdateFilter, UpdateOptions, MongoServerError, Sort } from 'mongodb';

const client = new MongoClient( 'mongodb+srv://ramp-admin:DdWxCOK31cDOgas1@ramplivecluster.cs9si.mongodb.net/?authSource=admin', { minPoolSize: 3, maxPoolSize: 50, maxIdleTimeMS: 15000 }); 
client.connect();

//client.on( 'connectionPoolCreated', ( pool:  ) => console.log('connectionPoolCreated') );

/*
const currentActivities = await db.admin().command({ currentOp: 1, $all: 1 });
const activeConnections: Record<string, number> =
  currentActivities.inprog.reduce(
    (acc: Record<string, number>, curr: Record<string, number>) => {
      const appName = curr.appName ? curr.appName : 'Unknown';
      acc[appName] = (acc[appName] || 0) + 1;
      acc['TOTAL_CONNECTION_COUNT']++;
      return acc;
    },
    { TOTAL_CONNECTION_COUNT: 0 }
  );


  const serverStatus = await this.client.db('admin').command({ serverStatus: 1 });
  const connectionCount = serverStatus.connections?.current || 0;*/

//const db = client.db('admin').command({ serverStatus: 1 }).then( console.log );
  
//db.currentOp(true)

setTimeout(() =>
{
   //console.log( client.topology.s.pool );


}, 5000 )