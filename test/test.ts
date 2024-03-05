import {AbstractConverters, AbstractModel, AbstractPropertyModel, AggregateOptions} from "../src/model";
import {Filter, MongoClient, ObjectId} from "mongodb";
import 'dotenv/config';

type JobDBE = { _id: ObjectId, name: string, created: Date, positions: PositionDBE[], engagements: EngagementDBE[] };
type JobDTO = { _id: string, name: string, created: Date, positions: PositionDTO[], engagements: EngagementDTO[] };

type EngagementDBE = { id: ObjectId, agencyID: ObjectId, recruiterID: ObjectId, date: Date, applications: ApplicationDBE[] };
type EngagementDTO = { id: string, agencyID: string, recruiterID: string, date: Date, applications: ApplicationDTO[] };

type ApplicationDBE = { id: ObjectId, date: Date, status: string };
type ApplicationDTO = { id: string, date: Date, status: string };

type PositionDBE = { id: ObjectId, events: { opened: Date, closed?: Date } };
type PositionDTO = { id: string, events: { opened: Date, closed?: Date } };

export const accessFilter = { name: { $in: ['a', 'b'] } };

/**
 * Pipelines
 */
export const jobCreatedBetween = (params: {between: {from: Date, to: Date}}) => ([{$match: { created: { $gte: params.between.from, $lt: params.between.to } } }]);
export const applicationCreatedBetween = (params: {between: {from: Date, to: Date}}) => ([{$match: { 'events.created': { $gte: params.between.from, $lt: params.between.to } } }]);

export class JobModel extends AbstractModel<JobDBE, JobDTO, AbstractConverters<JobDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            {
                dbe: {
                    converter: ( dbe: JobDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: JobDBE ) => ({
                        _id: dbe._id.toString(),
                        name: dbe.name,
                        positions: dbe.positions.map( position => positionModel.converters.dto.converter( position ) ),
                        engagements: dbe.engagements.map( engagement => engagementModel.converters.dto.converter( engagement ) )
                    }),
                }
            }
        );
    }

    protected async accessFilter(): Promise<Filter<JobDBE>>
    {
        return accessFilter;
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        customFilter.jobCreatedBetween && pipeline.push(...jobCreatedBetween(customFilter.jobCreatedBetween));

        return { filter, pipeline };
    }

    public pipeline( options: AggregateOptions<JobDBE> )
    {
        return super.pipeline( options );
    }
}

export class EngagementModel extends AbstractPropertyModel<JobDBE, EngagementDBE, EngagementDTO, AbstractConverters<EngagementDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'engagements[]',
            {
                dbe: {
                    converter: ( dbe: EngagementDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: EngagementDBE ) => ({
                        id: dbe.id.toString(),
                        agencyID: dbe.agencyID.toString(),
                        recruiterID: dbe.recruiterID.toString(),
                        date: dbe.date,
                        applications: dbe.applications.map( application => applicationModel.converters.dto.converter( application ) )
                    }),
                }
            }
        );
    }

    public pipeline( options: AggregateOptions<EngagementDBE> )
    {
        return super.pipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        return { filter, pipeline };
    }

}

export class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, AbstractConverters<ApplicationDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'engagements[].applications[]',
            {
                dbe: {
                    converter: ( dbe: ApplicationDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: ApplicationDBE ) => ({
                        id: dbe.id.toString(),
                        date: dbe.date,
                        status: dbe.status,
                    }),
                }
            }
        );
    }

    public pipeline( options: AggregateOptions<ApplicationDBE> )
    {
        return super.pipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        customFilter.applicationStatus  && (filter['status'] = { $in: customFilter.applicationStatus });
        customFilter.applicationCreatedBetween      && pipeline.push(applicationCreatedBetween(customFilter.applicationCreatedBetween));

        return { filter, pipeline };
    }
}

export class PositionModel extends AbstractPropertyModel<JobDBE, PositionDBE, PositionDTO, AbstractConverters<PositionDBE>>
{
    public constructor()
    {
        super(
            new MongoClient(process.env.DB_CONN_STRING!).db(process.env.DB_NAME).collection(process.env.COLL_NAME!),
            'positions[]',
            {
                dbe: {
                    converter: ( dbe: PositionDBE ) => dbe,
                },
                dto: {
                    converter: ( dbe: PositionDBE ) => ({
                        _id: dbe.id.toString(),
                        events: dbe.events,
                    }),
                }
            }
        );
    }

    public pipeline( options: AggregateOptions<PositionDBE> )
    {
        return super.pipeline( options );
    }

    public async resolveCustomFilter( customFilter: any )
    {
        const filter: any = {};
        const pipeline: any[] = [];

        return { filter, pipeline };
    }
}


export const jobModel = new JobModel();
export const engagementModel = new EngagementModel();
export const applicationModel = new ApplicationModel();
export const positionModel = new PositionModel();

// const dbe: JobDBE = {
//     _id: new ObjectId(),
//     test: 'a',
//     date: new Date('2024-01-01'),
//     child: { id: new ObjectId(), prop: 'a' },
//     children: [
//         { id: new ObjectId(), prop: 'a', children: [ { id: new ObjectId(), prop: 'a' } ] },
//         { id: new ObjectId(), prop: 'a', children: [ { id: new ObjectId(), prop: 'a' } ] }
//     ],
//
// }
