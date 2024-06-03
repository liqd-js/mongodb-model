import {AbstractPropertyModel, Db, ObjectId, Filter} from '../../..';
import {JobDBE, ApplicationDBE, ApplicationDTO, ApplicationOverviewDTO, EngagementID, ApplicationID, ApplicationCreateDTO, OrganizationID, AccountID, ApplicationStatus, MediaCreateDTO, CDNUrl, DocumentType} from '@ramp-global/types';
import Models from '../../index';
import ApplicationConverters from './converters';

import aggregations from "./aggregations";
import {UpdateFilter} from "mongodb";
import {applicationCreatedBetween, jobCreatedBetween} from "../../../../test/test";

export default class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, ReturnType<typeof ApplicationConverters['create']>>
{
    private models: Models;

    constructor( models: Models, db: Db )
    {
        super( db.collection('jobs'), 'engagements[].applications[]', ApplicationConverters.create( models ));
        this.models = models;
    }

    public dbeID( dtoID: ApplicationDTO['id'] ){ return new ObjectId( dtoID )}
    public dtoID( dbeID: ApplicationDBE['id'] ){ return dbeID.toString()}

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        // TODO: prefix?

        customFilter.jobCreatedBetween && pipeline.push(...jobCreatedBetween(customFilter.jobCreatedBetween));

        customFilter.applicationStatus && (filter['status'] = { $in: customFilter.applicationStatus });
        customFilter.applicationCreatedBetween && pipeline.push(...applicationCreatedBetween(customFilter.applicationCreatedBetween));

        return { filter, pipeline: [{$match: {'_root.engagements.status': 'active'}}] };
    }

    async accessFilter()
    {
       return {
        //foo: 'bar'
       };
    }
}