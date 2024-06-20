import {AbstractPropertyModel, Db, ObjectId, PublicMethodNames} from '../../..';
import {JobDBE, ApplicationDBE, ApplicationDTO} from '@ramp-global/types';
import Models from '../../index';
import ApplicationConverters from './converters';
import {ApplicationFilters} from "./filter";

type FirstParameter<T> = T extends (arg: infer P) => any ? P : never;
type TypSmartFiltera<T> = { [K in PublicMethodNames<T>]: FirstParameter<T[K]> }

type Y = TypSmartFiltera<ApplicationFilters>;

export default class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, ApplicationFilters, {
    converters: ReturnType<typeof ApplicationConverters['create']>;
    filters?: ApplicationFilters;
}>
{
    constructor( private models: Models, db: Db )
    {
        super( models, db.collection('jobs'), 'engagements[].applications[]', { converters: ApplicationConverters.create( models ), filters: new ApplicationFilters() });
    }

    public dbeID( dtoID: ApplicationDTO['id'] ){ return new ObjectId( dtoID )}
    public dtoID( dbeID: ApplicationDBE['id'] ){ return dbeID.toString()}

    async accessFilter()
    {

        const b: Y = { activeBetweenAggregation: { from: new Date(), to: new Date() } }

        this.list({smartFilter: { 'activeBetweenAggregation': { from: new Date(), to: new Date() }}})
       return {
        //foo: 'bar'
        };
    }
}