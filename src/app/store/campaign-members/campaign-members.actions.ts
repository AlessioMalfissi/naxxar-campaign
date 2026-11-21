import { createAction } from '@ngrx/store';

import { ICampaignInvite, ICampaignMember, ICreatedInvite, IInvitePreview } from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Campaign members';

export const loadMembers = createApiAction<{ campaignSlug: string }, { members: ICampaignMember[] }>(
    SOURCE,
    'load members'
);

export const loadInvites = createApiAction<{ campaignSlug: string }, { invites: ICampaignInvite[] }>(
    SOURCE,
    'load invites'
);

export const createInvite = createApiAction<{ campaignSlug: string }, { invite: ICreatedInvite }>(
    SOURCE,
    'create invite'
);

export const loadInvitePreview = createApiAction<{ token: string }, { preview: IInvitePreview }>(
    SOURCE,
    'load invite preview'
);

export const acceptInvite = createApiAction<{ token: string }, { campaign: { slug: string } }>(
    SOURCE,
    'accept invite'
);

export const membersCleared = createAction(`[${SOURCE}] cleared`);
