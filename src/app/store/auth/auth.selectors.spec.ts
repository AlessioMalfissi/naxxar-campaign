import { ApiCallStatus, ICampaignSummary, IUser } from '@core/models';
import {
    selectActiveCampaign,
    selectActiveRole,
    selectAuthChecked,
    selectAuthError,
    selectAuthErrorStatus,
    selectAuthPending,
    selectAuthenticated,
    selectCampaigns,
    selectConfig,
    selectGoogleEnabled,
    selectHasCampaigns,
    selectUser
} from './auth.selectors';
import { IAuthState, INITIAL_AUTH_STATE } from './auth.state';

const USER: IUser = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const OTHER: ICampaignSummary = { id: 'campaign-2', slug: 'other', name: 'Other', role: 'player' };

const buildState = (overrides: Partial<IAuthState> = {}): IAuthState => ({
    ...INITIAL_AUTH_STATE,
    user: USER,
    campaigns: [NAXXAR, OTHER],
    activeCampaignSlug: 'naxxar',
    checked: true,
    ...overrides
});

describe('authSelectors', () => {
    it('should project the session, campaigns, config and status', () => {
        // Arrange
        const state = buildState({
            config: { googleClientId: 'client-id' },
            status: ApiCallStatus.Failed,
            error: 'Offline.',
            errorStatus: 0
        });

        // Act
        const projected = {
            user: selectUser.projector(state),
            campaigns: selectCampaigns.projector(state),
            config: selectConfig.projector(state),
            checked: selectAuthChecked.projector(state),
            authenticated: selectAuthenticated.projector(state.user),
            hasCampaigns: selectHasCampaigns.projector(state.campaigns),
            pending: selectAuthPending.projector(state),
            error: selectAuthError.projector(state),
            errorStatus: selectAuthErrorStatus.projector(state)
        };

        // Assert
        expect(projected.user).toEqual(USER);
        expect(projected.campaigns).toEqual([NAXXAR, OTHER]);
        expect(projected.config.googleClientId).toBe('client-id');
        expect(projected.checked).toBe(true);
        expect(projected.authenticated).toBe(true);
        expect(projected.hasCampaigns).toBe(true);
        expect(projected.pending).toBe(false);
        expect(projected.error).toBe('Offline.');
        expect(projected.errorStatus).toBe(0);
    });

    it('should resolve the active campaign and its role from the slug', () => {
        // Arrange
        const state = buildState({ activeCampaignSlug: 'other' });

        // Act
        const campaign = selectActiveCampaign.projector(state);
        const role = selectActiveRole.projector(campaign);

        // Assert
        expect(campaign).toEqual(OTHER);
        expect(role).toBe('player');
    });

    it('should return null when the active slug is missing or stale', () => {
        // Arrange
        const missing = buildState({ activeCampaignSlug: null });
        const stale = buildState({ activeCampaignSlug: 'gone' });

        // Act
        const campaigns = [selectActiveCampaign.projector(missing), selectActiveCampaign.projector(stale)];

        // Assert
        expect(campaigns).toEqual([null, null]);
        expect(selectActiveRole.projector(null)).toBeNull();
    });

    it('should report an anonymous, unchecked session', () => {
        // Act
        const projected = {
            authenticated: selectAuthenticated.projector(null),
            hasCampaigns: selectHasCampaigns.projector([]),
            checked: selectAuthChecked.projector(INITIAL_AUTH_STATE)
        };

        // Assert
        expect(projected.authenticated).toBe(false);
        expect(projected.hasCampaigns).toBe(false);
        expect(projected.checked).toBe(false);
    });

    it('should report pending while any auth call is in flight', () => {
        // Act
        const pending = selectAuthPending.projector({ ...buildState(), status: ApiCallStatus.Pending });

        // Assert
        expect(pending).toBe(true);
    });

    it('should expose whether Google sign-in is configured', () => {
        // Act
        const disabled = selectGoogleEnabled.projector({ googleClientId: null });
        const enabled = selectGoogleEnabled.projector({ googleClientId: 'client-id' });

        // Assert
        expect(disabled).toBe(false);
        expect(enabled).toBe(true);
    });
});
