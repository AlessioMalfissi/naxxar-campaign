import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus, ICampaignSummary } from '@core/models';
import * as AuthActions from './auth.actions';
import { IAuthState, INITIAL_AUTH_STATE } from './auth.state';

const pending = (state: IAuthState): IAuthState => ({
    ...state,
    status: ApiCallStatus.Pending,
    error: null,
    errorStatus: null
});

const failed = (state: IAuthState, error: string, status?: number): IAuthState => ({
    ...state,
    status: ApiCallStatus.Failed,
    error,
    errorStatus: status ?? null
});

const withCampaigns = (campaigns: ICampaignSummary[], activeCampaignSlug: string | null): string | null =>
    activeCampaignSlug !== null && campaigns.some((campaign) => campaign.slug === activeCampaignSlug)
        ? activeCampaignSlug
        : null;

const signedOut = (state: IAuthState): IAuthState => ({
    ...INITIAL_AUTH_STATE,
    config: state.config,
    checked: true
});

export const authReducer = createReducer<IAuthState>(
    INITIAL_AUTH_STATE,

    on(
        AuthActions.checkSession.request,
        AuthActions.login.request,
        AuthActions.googleLogin.request,
        AuthActions.registerViaInvite.request,
        AuthActions.googleRegisterViaInvite.request,
        AuthActions.logout.request,
        AuthActions.loadConfig.request,
        AuthActions.loadCampaigns.request,
        AuthActions.createCampaign.request,
        AuthActions.forgotPassword.request,
        AuthActions.resetPassword.request,
        pending
    ),

    on(AuthActions.checkSession.success, (state, { user, campaigns }): IAuthState => ({
        ...state,
        user,
        campaigns,
        activeCampaignSlug: withCampaigns(campaigns, state.activeCampaignSlug),
        checked: true,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(AuthActions.login.success, AuthActions.googleLogin.success, (state, { user, campaigns }): IAuthState => ({
        ...state,
        user,
        campaigns,
        activeCampaignSlug: null,
        checked: true,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(
        AuthActions.registerViaInvite.success,
        AuthActions.googleRegisterViaInvite.success,
        (state, { user, campaigns, campaign }): IAuthState => ({
            ...state,
            user,
            campaigns,
            activeCampaignSlug: campaign.slug,
            checked: true,
            status: ApiCallStatus.Success,
            error: null,
            errorStatus: null
        })
    ),

    on(AuthActions.logout.success, (state): IAuthState => signedOut(state)),

    on(AuthActions.loadConfig.success, (state, { config }): IAuthState => ({
        ...state,
        config,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(AuthActions.loadCampaigns.success, (state, { campaigns }): IAuthState => ({
        ...state,
        campaigns,
        activeCampaignSlug: withCampaigns(campaigns, state.activeCampaignSlug),
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(AuthActions.createCampaign.success, (state, { campaign }): IAuthState => ({
        ...state,
        campaigns: state.campaigns.some((existing) => existing.id === campaign.id)
            ? state.campaigns
            : [...state.campaigns, campaign].toSorted((a, b) => a.name.localeCompare(b.name)),
        activeCampaignSlug: campaign.slug,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(AuthActions.forgotPassword.success, (state): IAuthState => ({
        ...state,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(AuthActions.resetPassword.success, (state): IAuthState => signedOut(state)),

    on(AuthActions.campaignActivated, (state, { slug }): IAuthState => ({
        ...state,
        activeCampaignSlug: slug
    })),

    on(AuthActions.sessionExpired, (state): IAuthState => signedOut(state)),

    on(
        AuthActions.checkSession.failure,
        AuthActions.login.failure,
        AuthActions.googleLogin.failure,
        AuthActions.registerViaInvite.failure,
        AuthActions.googleRegisterViaInvite.failure,
        AuthActions.logout.failure,
        AuthActions.loadConfig.failure,
        AuthActions.loadCampaigns.failure,
        AuthActions.createCampaign.failure,
        AuthActions.forgotPassword.failure,
        AuthActions.resetPassword.failure,
        (state, { error, status }): IAuthState => failed(state, error, status)
    )
);
