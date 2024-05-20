import { AbstractModels, ObjectId, objectHash, objectHashID } from '..';

import ApplicationModel         from './models/application';

export default class Models extends AbstractModels
{
    public applications         : ApplicationModel;

    constructor( connectionString: string, dbName: string = 'ramp' )
    {
        super( connectionString );

        const db = this.client.db( dbName );

        this.applications       = new ApplicationModel( this, db );
    }
}