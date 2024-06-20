import {AbstractPropertyModel, Db, ObjectId} from '../../..';
import {JobDBE, ApplicationDBE, ApplicationDTO} from '@ramp-global/types';
import Models from '../../index';
import ApplicationConverters from './converters';
import {ApplicationFilters1, ApplicationFilters2} from "./filter";

export default class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, {
    converters: ReturnType<typeof ApplicationConverters['create']>;
    smartFilters: ApplicationFilters1 | ApplicationFilters2;
}>
{
    constructor( private models: Models, db: Db )
    {
        super( models, db.collection('jobs'), 'engagements[].applications[]', {
            converters: ApplicationConverters.create( models ),
            smartFilters: new ApplicationFilters1()
        });
    }

    public dbeID( dtoID: ApplicationDTO['id'] ){ return new ObjectId( dtoID )}
    public dtoID( dbeID: ApplicationDBE['id'] ){ return dbeID.toString()}

    async accessFilter()
    {
        this.list({ smartFilter: { activeBetweenAggregation: { from: new Date(), to: new Date() }, filterDvojka: 3 }})
        return {
            // foo: 'bar'
        };
    }
}