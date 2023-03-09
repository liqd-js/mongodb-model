import { ObjectId } from 'mongodb';
import { AbstractModels, AbstractModel, AbstractPropertyModel, AbstractConverter } from '../src/model';

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

type BarDBE =
{
    id: string
}

type BarDTO =
{
    id: string
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
    dto: { converter: fooToDTO },
    basicDTO: { converter: fooToBasicDTO }
}

const barConverter =
{
    dto: { converter: ( bar: BarDBE ): BarDTO => ({ id: bar.id }) }
}

class FooModel extends AbstractModel<FooDBE, FooDTO, typeof fooConverter>
{
    constructor( collection: any )
    {
        super( collection, fooConverter );
    }
}

class BarModel extends AbstractPropertyModel<FooDBE, BarDBE, BarDTO, typeof barConverter>
{
    constructor( collection: any )
    {
        super( collection, 'foo.bar', barConverter );
    }
}

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