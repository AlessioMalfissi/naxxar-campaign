import { ApiCallStatus, ICampaignSummary, IPublicConfig, IUser } from '@core/models';

export const AUTH_FEATURE_KEY = 'auth';

export interface IAuthState {
    user: IUser | null;
    campaigns: ICampaignSummary[];
    config: IPublicConfig;
    activeCampaignSlug: string | null;
    checked: boolean;
    status: ApiCallStatus;
    error: string | null;
    errorStatus: number | null;
}

export const INITIAL_AUTH_STATE: IAuthState = {
    user: null,
    campaigns: [],
    config: { googleClientId: null },
    activeCampaignSlug: null,
    checked: false,
    status: ApiCallStatus.Idle,
    error: null,
    errorStatus: null
};
