import { Filter, ObjectId } from "mongodb";
import 'dotenv/config';
import { AbstractConverters, AbstractModel, AbstractPropertyModel, ModelAggregateOptions } from "../src";
type JobDBE = {
    _id: ObjectId;
    title: string;
    name: string;
    events: {
        created: Date;
    };
    positions: PositionDBE[];
    engagements: EngagementDBE[];
};
type JobDTO = {
    _id: string;
    title: string;
    name: string;
    events: {
        created: Date;
    };
    positions: PositionDTO[];
    engagements: EngagementDTO[];
};
type EngagementDBE = {
    id: ObjectId;
    agencyID: ObjectId;
    recruiterID: ObjectId;
    date: Date;
    applications: ApplicationDBE[];
};
type EngagementDTO = {
    id: string;
    agencyID: string;
    recruiterID: string;
    date: Date;
    applications: ApplicationDTO[];
};
type ApplicationDBE = {
    id: ObjectId;
    date: Date;
    status: string;
};
type ApplicationDTO = {
    id: string;
    date: Date;
    status: string;
};
type PositionDBE = {
    id: ObjectId;
    events: {
        opened: Date;
        closed?: Date;
    };
};
type PositionDTO = {
    id: string;
    events: {
        opened: Date;
        closed?: Date;
    };
};
export declare const accessFilter: {
    $and: never[];
};
/**
 * Pipelines
 */
export declare const jobCreatedBetween: (params: {
    between: {
        from: Date;
        to: Date;
    };
}) => {
    $match: {
        'events.created': {
            $gte: Date;
            $lt: Date;
        };
    };
}[];
export declare const applicationCreatedBetween: (params: {
    between: {
        from: Date;
        to: Date;
    };
}) => {
    $match: {
        'events.created': {
            $gte: Date;
            $lt: Date;
        };
    };
}[];
export declare class JobModel extends AbstractModel<JobDBE, JobDTO, AbstractConverters<JobDBE>> {
    constructor();
    dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"];
    dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"];
    protected accessFilter(): Promise<Filter<JobDBE>>;
    resolveCustomFilter(customFilter: any): Promise<{
        filter: any;
        pipeline: any[];
    }>;
    pipeline(options: ModelAggregateOptions<JobDBE>): Promise<import("bson").Document[]>;
}
export declare class EngagementModel extends AbstractPropertyModel<JobDBE, EngagementDBE, EngagementDTO, AbstractConverters<EngagementDBE>> {
    constructor();
    dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"];
    dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"];
    pipeline(options: ModelAggregateOptions<EngagementDBE>): Promise<import("bson").Document[]>;
    resolveCustomFilter(customFilter: any): Promise<{
        filter: any;
        pipeline: any[];
    }>;
}
export declare class ApplicationModel extends AbstractPropertyModel<JobDBE, ApplicationDBE, ApplicationDTO, AbstractConverters<ApplicationDBE>> {
    constructor();
    dbeID(id: ApplicationDTO["id"] | ApplicationDBE["id"]): ApplicationDBE["id"];
    dtoID(dbeID: ApplicationDBE["id"]): ApplicationDTO["id"];
    pipeline(options: ModelAggregateOptions<ApplicationDBE>): Promise<import("bson").Document[]>;
    resolveCustomFilter(customFilter: any): Promise<{
        filter: any;
        pipeline: any[];
    }>;
}
export declare class PositionModel extends AbstractPropertyModel<JobDBE, PositionDBE, PositionDTO, AbstractConverters<PositionDBE>> {
    constructor();
    pipeline(options: ModelAggregateOptions<PositionDBE>): Promise<import("bson").Document[]>;
    resolveCustomFilter(customFilter: any): Promise<{
        filter: any;
        pipeline: any[];
    }>;
}
export declare const jobModel: JobModel;
export declare const engagementModel: EngagementModel;
export declare const applicationModel: ApplicationModel;
export declare const positionModel: PositionModel;
export {};
