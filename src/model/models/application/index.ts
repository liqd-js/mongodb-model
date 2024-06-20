import {AbstractFilters, AbstractModels, AbstractPropertyModel, Db, ModelParams, ObjectId} from '../../..';
import {JobDBE, ApplicationDBE, ApplicationDTO} from '@ramp-global/types';
import Models from '../../index';
import ApplicationConverters from './converters';
import {ApplicationFilters} from "./filter";

export default class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, {
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
        this.list({smartFilter: {
            activeBetweenAggregation: 3,
        }})
       return {
        //foo: 'bar'
       };
    }
}