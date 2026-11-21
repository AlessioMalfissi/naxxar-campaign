import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import { CAMPAIGN_MEMBERS_FEATURE_KEY, ICampaignMembersState } from './campaign-members.state';

export const selectCampaignMembersState = createFeatureSelector<ICampaignMembersState>(
    CAMPAIGN_MEMBERS_FEATURE_KEY
);

export const selectMembers = createSelector(selectCampaignMembersState, (state) => state.members);

export const selectInvites = createSelector(selectCampaignMembersState, (state) => state.invites);

export const selectInvitePreview = createSelector(selectCampaignMembersState, (state) => state.invitePreview);

export const selectCreatedInviteUrl = createSelector(
    selectCampaignMembersState,
    (state) => state.createdInviteUrl
);

export const selectCampaignMembersStatus = createSelector(selectCampaignMembersState, (state) => state.status);

export const selectCampaignMembersLoading = createSelector(
    selectCampaignMembersState,
    (state) => state.status === ApiCallStatus.Pending
);

export const selectCampaignMembersError = createSelector(selectCampaignMembersState, (state) => state.error);

export const selectCampaignMembersErrorStatus = createSelector(
    selectCampaignMembersState,
    (state) => state.errorStatus
);
