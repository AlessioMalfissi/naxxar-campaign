import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus, CampaignRole, ICampaignSummary, IPublicConfig, IUser } from '@core/models';
import { AUTH_FEATURE_KEY, IAuthState } from './auth.state';

export const selectAuthState = createFeatureSelector<IAuthState>(AUTH_FEATURE_KEY);

export const selectUser = createSelector(selectAuthState, (state): IUser | null => state.user);

export const selectCampaigns = createSelector(selectAuthState, (state): ICampaignSummary[] => state.campaigns);

export const selectConfig = createSelector(selectAuthState, (state): IPublicConfig => state.config);

export const selectGoogleEnabled = createSelector(selectConfig, (config) => config.googleClientId !== null);

export const selectActiveCampaign = createSelector(
    selectAuthState,
    (state): ICampaignSummary | null =>
        state.campaigns.find((campaign) => campaign.slug === state.activeCampaignSlug) ?? null
);

export const selectActiveRole = createSelector(
    selectActiveCampaign,
    (campaign): CampaignRole | null => campaign?.role ?? null
);

export const selectHasCampaigns = createSelector(selectCampaigns, (campaigns) => campaigns.length > 0);

export const selectAuthenticated = createSelector(selectUser, (user) => user !== null);

export const selectAuthChecked = createSelector(selectAuthState, (state) => state.checked);

export const selectAuthError = createSelector(selectAuthState, (state) => state.error);

export const selectAuthErrorStatus = createSelector(selectAuthState, (state) => state.errorStatus);

export const selectAuthStatus = createSelector(selectAuthState, (state) => state.status);

export const selectAuthPending = createSelector(selectAuthState, (state) => state.status === ApiCallStatus.Pending);
