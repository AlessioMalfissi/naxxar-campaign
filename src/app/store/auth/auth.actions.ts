import { createAction, props } from '@ngrx/store';

import {
    IAuthResponse,
    ICampaignSummary,
    IInviteAuthResponse,
    IPublicConfig,
    ISessionResponse
} from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Auth';

export const checkSession = createApiAction<Record<string, never>, ISessionResponse>(SOURCE, 'check session');

export const login = createApiAction<{ email: string; password: string }, IAuthResponse>(SOURCE, 'login');

export const googleLogin = createApiAction<{ credential: string }, IAuthResponse>(SOURCE, 'google login');

export const registerViaInvite = createApiAction<
    { token: string; displayName: string; email: string; password: string },
    IInviteAuthResponse
>(SOURCE, 'register via invite');

export const googleRegisterViaInvite = createApiAction<
    { token: string; credential: string; displayName?: string },
    IInviteAuthResponse
>(SOURCE, 'google register via invite');

export const logout = createApiAction<Record<string, never>, Record<string, never>>(SOURCE, 'logout');

export const loadConfig = createApiAction<Record<string, never>, { config: IPublicConfig }>(SOURCE, 'load config');

export const loadCampaigns = createApiAction<Record<string, never>, { campaigns: ICampaignSummary[] }>(
    SOURCE,
    'load campaigns'
);

export const createCampaign = createApiAction<{ name: string }, { campaign: ICampaignSummary }>(
    SOURCE,
    'create campaign'
);

export const forgotPassword = createApiAction<{ email: string }, Record<string, never>>(SOURCE, 'forgot password');

export const resetPassword = createApiAction<{ token: string; password: string }, Record<string, never>>(
    SOURCE,
    'reset password'
);

export const campaignActivated = createAction(`[${SOURCE}] campaign activated`, props<{ slug: string }>());

// Dispatched by the HTTP interceptor on a 401 from a protected endpoint. Never navigates directly.
export const sessionExpired = createAction(`[${SOURCE}] session expired`);
