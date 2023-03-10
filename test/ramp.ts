import { ObjectId } from 'mongodb';
import { JobDBE, ApplicationDBE, ApplicationDTO } from '@ramp-global/experiment-types';
import { AbstractModels, AbstractModel, AbstractPropertyModel, AbstractConverter } from '../src/model';

//class TestConverter extends AbstractConverter<TestModels>

const applicationConverter =
{
    dto: 
    {
        converter: ( bar: ApplicationDBE ): ApplicationDTO =>
        {
            return (
            { 
                id: bar.id,
                recruiter: { id: bar.recruiterID, firstName: 'bar.recruiter.firstName', lastName: 'bar.recruiter.lastName', contact: {  }, externalURLs: {}, position: { location: { id: 1, name: 'Slovakia' } }  },
                supplier: { id: bar.supplierID, name: 'bar.supplier.name', contact: {  }, flag: 'employer' },
                candidate: { id: bar.candidate._id, applications: [], firstName: '', lastName: '', salary: { latest: { amount: 0, currency: 'EUR', rate: 'day' }, desired: { amount: 0, currency: 'EUR', rate: 'day'  } } },
                offer:
                {
                    amount: bar.offer.amount,
                    rate: bar.offer.rate,
                    currency: bar.offer.currency,
                    proposer: 
                    {
                        firstName: '',
                        lastName: '',
                        id: bar.offer.proposer.accountID,
                        //organizationID?: OrganizationID;
                        contact: {},
                        position: { level: 'worker', function: 'recruitment-consultant', location: { id: 1, name: 'Slovakia' }},
                    }
                },
                commercials: { id: bar.commercialsID.toString(), currency: 'GBP', delay: { employer: { value: 0, unit: 'day' }, platform: { value: 0, unit: 'day' }}, advancePayment: true, fees: { supplier: [], platform: []}, rebates: [], events: { created: new Date(), updated: new Date() }},
                active: true,
                status: bar.status,
                events: bar.events,
                availability: bar.availability,
                contractType: bar.contractType,
                metadata: bar.metadata,
                history: []
            });
        }
    }
}

class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, typeof applicationConverter>
{
    constructor( collection: any )
    {
        super( collection, 'engagements[].applications', applicationConverter );
    }
}

import { MongoClient } from 'mongodb';

const client = new MongoClient( 'mongodb://ramp-read:A7E723tv367ALCNA@138.201.188.68/' ); 
client.connect();

const model = new ApplicationModel( client.db('ramp').collection('jobs') );

//model.list({ limit: 1, projection: { recruiterID: 1, $root: { programmeID: 1 }}}).then( console.log );
model.update( 1231, { $set: { 'events.created': new Date() }});
/*model.get( 4562 ).then( console.log );
model.get([ 4563, 4564 ]).then( console.log );

setTimeout(() => model.get( 4562 ), 1000 );*/



/*

const a = new FooModel( null );
const b = new BarModel( null );

async function test()
{
    let x = await a.get( '1' );
    let y = await a.get( [ '1', '2' ], 'basicDTO', true );
    let z = await a.get( [ '1', '2' ], 'basicDTO', false );
}

/*
class TestModels extends AbstractModels
{
    public foo: FooModel;

    constructor( connectionString: string )
    {
        super( connectionString );

        this.foo = new FooModel( this.client.db( 'ramp' ).collection( 'foo' ), new FooConverter( this ));
    }

    public get( id: FooDTO['id'], conversion: keyof FooConverter )
    {
        
    }

    public scope( callback: Function, scope: object )
    {
        
    }
}*/