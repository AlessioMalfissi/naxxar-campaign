import { CampaignRole } from './i-campaign';

export interface ICampaignMember {
    userId: string;
    displayName: string;
    role: CampaignRole;
    joinedAt: string;
    // Only returned to the campaign DM.
    email?: string;
}
