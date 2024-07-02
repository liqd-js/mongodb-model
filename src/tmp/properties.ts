import {AbstractModelProperties} from "../types";

export class JobProperties implements AbstractModelProperties<JobProperties>
{
    applicationCount()
    {
        return { $sum: { $map: { input: "$engagements", as: "engagement", in: { $size: "$$engagement.applications" } } } };
    }
}