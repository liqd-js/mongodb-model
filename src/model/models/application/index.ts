import {AbstractPropertyModel, Db, ObjectId} from '../../..';
import {JobDBE, ApplicationDBE, ApplicationDTO} from '@ramp-global/types';
import Models from '../../index';
import ApplicationConverters from './converters';
import {ApplicationFilters} from "./filter";

export default class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, ReturnType<typeof ApplicationConverters['create']>, ApplicationFilters>
{
    constructor( models: Models, db: Db )
    {
        super( models, db.collection('jobs'), 'engagements[].applications[]', ApplicationConverters.create( models ), new ApplicationFilters());
    }

    public dbeID( dtoID: ApplicationDTO['id'] ){ return new ObjectId( dtoID )}
    public dtoID( dbeID: ApplicationDBE['id'] ){ return dbeID.toString()}

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        // TODO: prefix?

        // customFilter.jobCreatedBetween && pipeline.push(...jobCreatedBetween(customFilter.jobCreatedBetween));
        //
        // customFilter.applicationStatus && (filter['status'] = { $in: customFilter.applicationStatus });
        // customFilter.applicationCreatedBetween && pipeline.push(...applicationCreatedBetween(customFilter.applicationCreatedBetween));

        return { filter, pipeline: [{$match: {'_root.engagements.status': 'active'}}] };
    }

    async accessFilter()
    {
       return {
        //foo: 'bar'
       };
    }
}