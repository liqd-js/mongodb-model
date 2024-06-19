import {Collection, MongoClient, MongoClientOptions} from 'mongodb';
import Cache from './helpers/cache';
import {flowStart, GET_PARENT, REGISTER_MODEL} from './helpers';
import {AbstractPropertyModel} from "./property-model";
import {AbstractModel} from "./model";

export * from 'mongodb';
export * from './types';
export * from './helpers';
export * from './model';
export * from './property-model';

const Clients = new Map<string, MongoClient>();
type ModelInstance = AbstractModel<any, any, any, any> | AbstractPropertyModel<any, any, any, any, any>;

export class AbstractModels
{
    protected client: MongoClient;
    public cache = new Cache();
    private models = new Map<string, ModelInstance>();

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

    [REGISTER_MODEL]( instance: ModelInstance, collection: string, path?: string )
    {
        this.models.set( collection + (path ? '.' + path : ''), instance );
    }

    [GET_PARENT]( collection: string, path: string ): ModelInstance | undefined
    {
        let parent = collection + (path && path !== '' ? '.' + path : '');

        while ( parent.includes('.') )
        {
            parent = parent.replace( /\.[^.]+$/, '' );

            if( this.models.has( parent ) && this.models.get( parent )?.filters )
            {
                return this.models.get( parent );
            }
        }
    }

    public scope( callback: Function, scope: object )
    {
        flowStart( callback, scope );
    }
}