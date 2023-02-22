import { ObjectId } from 'mongodb';
import { AbstractModels, AbstractModel, AbstractConverter } from '../src/model';

//class TestConverter extends AbstractConverter<TestModels>

type FooDBE =
{
    _id     : ObjectId
    name    : string
}

type FooDTO =
{
    id     : string
    name    : string
}

type FooBasicDTO =
{
    id     : string
}

function fooToDTO( foo: FooDBE ): FooDTO
{
    return { id: foo._id.toString(), name: foo.name };  
}

function fooToBasicDTO( foo: FooDBE ): FooBasicDTO
{
    return { id: foo._id.toString() };
}

const fooConverter =
{
    dto: { convertor: fooToDTO },
    basicDTO: { convertor: fooToBasicDTO }
}

/*class FooConverter extends AbstractConverter<TestModels>
{
    constructor( models: TestModels )
    {
        super( models );
    }

    public toDTO( foo: FooDBE ): FooDTO
    {
        return { id: foo._id.toString(), name: foo.name };
    }

    public toBasicDTO( foo: FooDBE ): FooBasicDTO
    {
        return { id: foo._id.toString() };
    }
}*/

class FooModel extends AbstractModel<FooDBE, FooDTO, typeof fooConverter>
{
    constructor( collection: any )
    {
        super( collection, fooConverter );
    }
}

const x = new FooModel( null );

let y = x.get( '1', 'dto' );
let z = x.get( '1', 'basicDTO' );

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
}