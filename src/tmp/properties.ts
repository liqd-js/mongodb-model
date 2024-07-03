import {AbstractModelProperties} from "../types";

export class JobProperties implements AbstractModelProperties<JobProperties>
{
    applicationCount()
    {
        return [
            {
                $addFields: {
                    applicationCount: {
                        $sum: {
                            $map: {
                                input: "$engagements",
                                as: "engagement",
                                in: {$size: "$$engagement.applications"}
                            }
                        }
                    }
                }
            }
        ]
    }
}