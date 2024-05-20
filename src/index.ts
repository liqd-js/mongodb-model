import { MongoClient, MongoClientOptions } from 'mongodb';
import Cache from './helpers/cache';
import { flowStart } from './helpers';

export * from 'mongodb';
export * from './types';
export * from './helpers';
export * from './model';
export * from './property-model';

const Clients = new Map<string, MongoClient>();

export class AbstractModels
{
    protected client: MongoClient;
    public cache = new Cache();

    protected constructor( connectionString: string, options: MongoClientOptions = {} )
    {
        if( Clients.has( connectionString ))
        {
            this.client = Clients.get( connectionString )!;
        }
        else
        {
            this.client = new MongoClient( connectionString, { minPoolSize: 0, maxPoolSize: 100, maxIdleTimeMS: 15000, compressors: [ 'snappy' ], ...options });
            this.client.connect();

            Clients.set( connectionString, this.client );
        }
    }

    public scope( callback: Function, scope: object )
    {
        flowStart( callback, scope );
    }
}