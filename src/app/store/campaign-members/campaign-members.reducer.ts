import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import * as AuthActions from '@store/auth/auth.actions';
import * as CampaignMembersActions from './campaign-members.actions';
import { ICampaignMembersState, INITIAL_CAMPAIGN_MEMBERS_STATE } from './campaign-members.state';

const pending = (state: ICampaignMembersState): ICampaignMembersState => ({
    ...state,
    status: ApiCallStatus.Pending,
    error: null,
    errorStatus: null
});

const failed = (state: ICampaignMembersState, error: string, status?: number): ICampaignMembersState => ({
    ...state,
    status: ApiCallStatus.Failed,
    error,
    errorStatus: status ?? null
});

const cleared = (): ICampaignMembersState => ({ ...INITIAL_CAMPAIGN_MEMBERS_STATE });

export const campaignMembersReducer = createReducer<ICampaignMembersState>(
    INITIAL_CAMPAIGN_MEMBERS_STATE,

    on(
        CampaignMembersActions.loadMembers.request,
        CampaignMembersActions.loadInvites.request,
        CampaignMembersActions.loadInvitePreview.request,
        CampaignMembersActions.acceptInvite.request,
        pending
    ),

    on(CampaignMembersActions.createInvite.request, (state): ICampaignMembersState => ({
        ...pending(state),
        createdInviteUrl: null,
        createdInviteExpiresAt: null
    })),

    on(CampaignMembersActions.loadMembers.success, (state, { members }): ICampaignMembersState => ({
        ...state,
        members,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(CampaignMembersActions.loadInvites.success, (state, { invites }): ICampaignMembersState => ({
        ...state,
        invites,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(CampaignMembersActions.createInvite.success, (state, { invite }): ICampaignMembersState => ({
        ...state,
        createdInviteUrl: invite.url,
        createdInviteExpiresAt: invite.expiresAt,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(CampaignMembersActions.loadInvitePreview.success, (state, { preview }): ICampaignMembersState => ({
        ...state,
        invitePreview: preview,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(CampaignMembersActions.acceptInvite.success, (state): ICampaignMembersState => ({
        ...state,
        status: ApiCallStatus.Success,
        error: null,
        errorStatus: null
    })),

    on(
        CampaignMembersActions.loadMembers.failure,
        CampaignMembersActions.loadInvites.failure,
        CampaignMembersActions.createInvite.failure,
        CampaignMembersActions.loadInvitePreview.failure,
        CampaignMembersActions.acceptInvite.failure,
        (state, { error, status }): ICampaignMembersState => failed(state, error, status)
    ),

    on(CampaignMembersActions.membersCleared, cleared),

    // Never keep another account's or another campaign's roster.
    on(AuthActions.campaignActivated, AuthActions.logout.success, AuthActions.sessionExpired, cleared)
);
