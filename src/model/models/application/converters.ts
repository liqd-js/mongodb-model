import {AccountBasicDTO, AccountDbID, AccountID, ApplicationBasicDTO, ApplicationCreateDTO, ApplicationDBE, ApplicationDTO, ApplicationHistoryDTO, ApplicationID, ApplicationListItemDTO, CDNUrl, CommercialsID, DocumentType, EngagementID, JobDbID, MediaCreateDTO, OrganizationID, ProgrammeDbID, ProgrammeLocationDbID, SalaryDTO} from '@ramp-global/types';
import Models from '../../index';

export default class ApplicationConverters
{
    public static create( models: Models )
    {
        return (
        {
            dbe:
            {
                converter: ( dbe: ApplicationDBE ): ApplicationDBE =>
                {
                    return dbe;
                }
            },
            dto:
            {
                converter: async( dbe: ApplicationDBE ): Promise<ApplicationDTO> =>
                {
                    //@ts-ignore
                    return dbe as ApplicationDBE;
                }
            },
        });
    }
}