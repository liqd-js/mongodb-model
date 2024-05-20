import Model from '../src/model/index';

const model = new Model( 'mongodb://ramp-sandbox-admin:N9zWDpYbLQ8rr5fJCw8zE4hz@sandbox.ramp.global:27017/?authMechanism=DEFAULT' );

console.log( 'Test' );

async function test( )
{
    const app = await model.applications.get( 'b1cf05542624a700493074de' );

    console.log( app );
}

model.scope( test, { log: true });