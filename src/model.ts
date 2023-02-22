import { Collection, Document, FindOptions, Filter, WithId, ObjectId, MongoClient, OptionalUnlessRequiredId, UpdateFilter } from 'mongodb';
import { flowStart } from './helpers';

export * from './helpers';
export { flowStart as _ };

export type ListOptions<DBE extends Document> = FindOptions<DBE> & { filter? : Filter<DBE> };

export type AbstractConverter<DBE extends Document> = ( dbe: WithId<DBE> ) => unknown | Promise<unknown>;

export type AbstractConverters<DBE extends Document> = 
{
    dto:
    {
        converter: AbstractConverter<DBE>,
        projection?: FindOptions<DBE>['projection']
    }
    [key: string]: 
    {
        converter: AbstractConverter<DBE>,
        projection?: FindOptions<DBE>['projection']
    }
}

export abstract class AbstractModel<DBE extends Document, DTO extends Document, Converters extends AbstractConverters<DBE>>
{
    protected constructor( public collection: Collection<DBE>, public converters: Converters )
    {
        //console.log( 'parada' );
    }

    protected id(): DTO['id'] | Promise<DTO['id']>{ return new ObjectId().toString() as DTO['id']; }
    public dbeID( dtoID: DTO['id'] ): WithId<DBE>['_id']{ return dtoID as WithId<DBE>['_id']; }
    public dtoID( dbeID: WithId<DBE>['_id'] ): DTO['id']{ return dbeID as DTO['id']; }

    //public async create( dbe: Omit<DBE, '_id'>, id?: DTO['id'] ): Promise<DTO['id']>
    public async create( dbe: OptionalUnlessRequiredId<DBE>, id?: DTO['id'] ): Promise<DTO['id']> // TODO: fix this
    {
        const _id: DTO['id'] = id ?? await this.id();

        await this.collection.insertOne({ ...dbe, _id: this.dbeID( _id ) });

        return _id;
    }

    public async get<K extends keyof Converters>( id: DTO['id'], conversion: K = 'dto' as K ): Promise<ReturnType<Converters[K]['converter']> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, { projection }); // TODO aggregate

        return dbe ? converter( dbe ) as ReturnType<Converters[K]['converter']> : null;
    }

    public async find<K extends keyof Converters>( filter: Filter<DBE>, conversion: K = 'dto' as K ): Promise<ReturnType<Converters[K]['converter']> | null>
    {
        const { converter, projection } = this.converters[conversion];

        const dbe = await this.collection.findOne( filter, { projection });

        return dbe ? converter( dbe ) as ReturnType<Converters[K]['converter']> : null;
    }

    public async list<K extends keyof Converters>( list: ListOptions<DBE>, conversion: K = 'dto' as K ): Promise<Array<ReturnType<Converters[K]['converter']>>>
    {
        const { converter, projection } = this.converters[conversion];
        const { filter = {}, ...options } = list;
        
        let entries = await this.collection.find( filter, { projection, ...options }).toArray();

        return Promise.all( entries.map( dbe => converter( dbe ) as ReturnType<Converters[K]['converter']> ));
    }

    public async update( id: DTO['id'], update: Partial<DBE> | UpdateFilter<DBE> ): Promise<void>
    {
        await this.collection.updateOne({ _id: ( this.dbeID ? this.dbeID( id ) : id ) as WithId<DBE>['_id'] }, update );
    }
}

export class AbstractModels
{
    protected client: MongoClient;

    protected constructor( connectionString: string )
    {
        this.client = new MongoClient( connectionString ); 
        this.client.connect();
    }

    public scope( callback: Function, scope: object )
    {
        flowStart( callback, scope );
    }
}