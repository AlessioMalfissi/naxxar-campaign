import { ApiCallStatus, ICampaignInvite, ICampaignMember, IInvitePreview } from '@core/models';

export const CAMPAIGN_MEMBERS_FEATURE_KEY = 'campaignMembers';

export interface ICampaignMembersState {
    members: ICampaignMember[];
    invites: ICampaignInvite[];
    invitePreview: IInvitePreview | null;
    createdInviteUrl: string | null;
    createdInviteExpiresAt: string | null;
    status: ApiCallStatus;
    error: string | null;
    errorStatus: number | null;
}

export const INITIAL_CAMPAIGN_MEMBERS_STATE: ICampaignMembersState = {
    members: [],
    invites: [],
    invitePreview: null,
    createdInviteUrl: null,
    createdInviteExpiresAt: null,
    status: ApiCallStatus.Idle,
    error: null,
    errorStatus: null
};
