import { ICampaignSummary } from './i-campaign';
import { IUser } from './i-user';

export interface IAuthResponse {
    user: IUser;
    campaigns: ICampaignSummary[];
}

// `GET /api/auth/me` always answers 200, with a null user when no session exists.
export interface ISessionResponse {
    user: IUser | null;
    campaigns: ICampaignSummary[];
}

export interface IInviteAuthResponse extends IAuthResponse {
    campaign: ICampaignSummary;
}
