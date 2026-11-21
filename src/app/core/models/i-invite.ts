export type InviteStatus = 'active' | 'used' | 'expired';

export interface IInvitePreview {
    campaignName: string;
    campaignSlug: string;
    expiresAt: string;
}

export interface ICampaignInvite {
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    status: InviteStatus;
}

// The full URL is only ever returned when the invite is created, never in the list.
export interface ICreatedInvite {
    url: string;
    expiresAt: string;
}
