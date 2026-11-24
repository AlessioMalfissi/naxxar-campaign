import { Action } from '@ngrx/store';

import { ApiCallStatus, ICampaignMember } from '@core/models';
import * as AuthActions from '@store/auth/auth.actions';
import * as CampaignMembersActions from './campaign-members.actions';
import { campaignMembersReducer } from './campaign-members.reducer';
import {
    selectCampaignMembersError,
    selectCampaignMembersErrorStatus,
    selectCampaignMembersLoading,
    selectCreatedInviteExpiresAt,
    selectCreatedInviteUrl,
    selectInvitePreview,
    selectInvites,
    selectMembers
} from './campaign-members.selectors';
import { ICampaignMembersState, INITIAL_CAMPAIGN_MEMBERS_STATE } from './campaign-members.state';

const MEMBER: ICampaignMember = {
    userId: 'user-1',
    displayName: 'Dungeon Master',
    role: 'dm',
    joinedAt: '2026-01-01T00:00:00.000Z',
    email: 'dm@naxxar.local'
};
const PLAYER: ICampaignMember = {
    userId: 'user-2',
    displayName: 'Player One',
    role: 'player',
    joinedAt: '2026-02-01T00:00:00.000Z'
};
const PREVIEW = {
    campaignName: 'Naxxar',
    campaignSlug: 'naxxar',
    expiresAt: '2026-03-01T00:00:00.000Z'
};

const populated: ICampaignMembersState = {
    ...INITIAL_CAMPAIGN_MEMBERS_STATE,
    members: [MEMBER, PLAYER],
    invites: [
        {
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-08T00:00:00.000Z',
            usedAt: null,
            status: 'active'
        }
    ],
    invitePreview: PREVIEW,
    createdInviteUrl: 'https://example.test/invite/token',
    createdInviteExpiresAt: '2026-01-08T00:00:00.000Z',
    status: ApiCallStatus.Success
};

describe('campaignMembersReducer', () => {
    it('should store the roster', () => {
        // Act
        const state = campaignMembersReducer(
            INITIAL_CAMPAIGN_MEMBERS_STATE,
            CampaignMembersActions.loadMembers.success({ members: [MEMBER, PLAYER] })
        );

        // Assert
        expect(state.members).toEqual([MEMBER, PLAYER]);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should store the invite list and the created invite', () => {
        // Act
        const withInvites = campaignMembersReducer(
            INITIAL_CAMPAIGN_MEMBERS_STATE,
            CampaignMembersActions.loadInvites.success({ invites: populated.invites })
        );
        const created = campaignMembersReducer(
            withInvites,
            CampaignMembersActions.createInvite.success({
                invite: { url: 'https://example.test/invite/token', expiresAt: '2026-01-08T00:00:00.000Z' }
            })
        );

        // Assert
        expect(created.invites).toEqual(populated.invites);
        expect(created.createdInviteUrl).toBe('https://example.test/invite/token');
        expect(created.createdInviteExpiresAt).toBe('2026-01-08T00:00:00.000Z');
    });

    it('should clear the previous invite link when a new one is requested', () => {
        // Act
        const state = campaignMembersReducer(
            populated,
            CampaignMembersActions.createInvite.request({ campaignSlug: 'naxxar' })
        );

        // Assert
        expect(state.createdInviteUrl).toBeNull();
        expect(state.createdInviteExpiresAt).toBeNull();
        expect(state.status).toBe(ApiCallStatus.Pending);
    });

    it('should store the invite preview', () => {
        // Act
        const state = campaignMembersReducer(
            INITIAL_CAMPAIGN_MEMBERS_STATE,
            CampaignMembersActions.loadInvitePreview.success({ preview: PREVIEW })
        );

        // Assert
        expect(state.invitePreview).toEqual(PREVIEW);
    });

    it('should keep the HTTP status of a failure', () => {
        // Act
        const state = campaignMembersReducer(
            INITIAL_CAMPAIGN_MEMBERS_STATE,
            CampaignMembersActions.loadInvitePreview.failure({ error: 'Gone.', status: 410 })
        );

        // Assert
        expect(state.status).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('Gone.');
        expect(state.errorStatus).toBe(410);
    });

    it('should clear the roster on membersCleared', () => {
        // Act
        const state = campaignMembersReducer(populated, CampaignMembersActions.membersCleared());

        // Assert
        expect(state).toEqual(INITIAL_CAMPAIGN_MEMBERS_STATE);
    });

    it.each([
        ['campaignActivated', AuthActions.campaignActivated({ slug: 'other' })],
        ['logout.success', AuthActions.logout.success({})],
        ['sessionExpired', AuthActions.sessionExpired()],
        ['resetPassword.success', AuthActions.resetPassword.success({})]
    ] as Array<[string, Action]>)('should clear the roster on %s', (_label, action) => {
        // Act
        const state = campaignMembersReducer(populated, action);

        // Assert
        expect(state).toEqual(INITIAL_CAMPAIGN_MEMBERS_STATE);
    });
});

describe('campaignMembersSelectors', () => {
    it('should project the roster, invites and invite preview', () => {
        // Act
        const projected = {
            members: selectMembers.projector(populated),
            invites: selectInvites.projector(populated),
            preview: selectInvitePreview.projector(populated),
            url: selectCreatedInviteUrl.projector(populated),
            expiresAt: selectCreatedInviteExpiresAt.projector(populated)
        };

        // Assert
        expect(projected.members).toEqual([MEMBER, PLAYER]);
        expect(projected.invites).toEqual(populated.invites);
        expect(projected.preview).toEqual(PREVIEW);
        expect(projected.url).toBe('https://example.test/invite/token');
        expect(projected.expiresAt).toBe('2026-01-08T00:00:00.000Z');
    });

    it('should report loading and failure state', () => {
        // Arrange
        const loading = { ...populated, status: ApiCallStatus.Pending };
        const failure = { ...populated, status: ApiCallStatus.Failed, error: 'Offline.', errorStatus: 0 };

        // Act
        const projected = {
            loading: selectCampaignMembersLoading.projector(loading),
            error: selectCampaignMembersError.projector(failure),
            errorStatus: selectCampaignMembersErrorStatus.projector(failure)
        };

        // Assert
        expect(projected.loading).toBe(true);
        expect(projected.error).toBe('Offline.');
        expect(projected.errorStatus).toBe(0);
    });
});
