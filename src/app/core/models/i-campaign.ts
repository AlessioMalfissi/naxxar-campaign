export type CampaignRole = 'dm' | 'player';

export interface ICampaignSummary {
    id: string;
    slug: string;
    name: string;
    role: CampaignRole;
}
