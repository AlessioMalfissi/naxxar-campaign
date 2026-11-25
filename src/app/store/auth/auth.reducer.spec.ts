import { ApiCallStatus, ICampaignSummary, IUser } from '@core/models';
import * as AuthActions from './auth.actions';
import { authReducer } from './auth.reducer';
import { INITIAL_AUTH_STATE } from './auth.state';

const USER: IUser = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const OTHER: ICampaignSummary = { id: 'campaign-2', slug: 'other', name: 'Other', role: 'player' };

const signedIn = {
    ...INITIAL_AUTH_STATE,
    user: USER,
    campaigns: [NAXXAR, OTHER],
    checked: true,
    status: ApiCallStatus.Success
};

describe('authReducer', () => {
    it('should mark the session check as pending and clear the previous error', () => {
        // Arrange
        const previous = { ...INITIAL_AUTH_STATE, error: 'Offline.', errorStatus: 0 };

        // Act
        const state = authReducer(previous, AuthActions.checkSession.request({}));

        // Assert
        expect(state.status).toBe(ApiCallStatus.Pending);
        expect(state.error).toBeNull();
        expect(state.errorStatus).toBeNull();
    });

    it('should store the user and campaigns and mark the session as checked', () => {
        // Arrange
        const action = AuthActions.checkSession.success({ user: USER, campaigns: [NAXXAR] });

        // Act
        const state = authReducer(INITIAL_AUTH_STATE, action);

        // Assert
        expect(state.user).toEqual(USER);
        expect(state.campaigns).toEqual([NAXXAR]);
        expect(state.checked).toBe(true);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should accept an anonymous session', () => {
        // Arrange
        const action = AuthActions.checkSession.success({ user: null, campaigns: [] });

        // Act
        const state = authReducer(signedIn, action);

        // Assert
        expect(state.user).toBeNull();
        expect(state.campaigns).toEqual([]);
        expect(state.activeCampaignSlug).toBeNull();
        expect(state.checked).toBe(true);
    });

    it('should enter a guest session without a server account', () => {
        // Arrange
        const previous = {
            ...INITIAL_AUTH_STATE,
            config: { googleClientId: 'client-id' },
            activeCampaignSlug: 'naxxar'
        };
        const guestCampaign: ICampaignSummary = {
            id: 'guest-campaign',
            slug: 'demo',
            name: 'Naxxar (demo)',
            role: 'player'
        };

        // Act
        const state = authReducer(previous, AuthActions.guestEntered({ user: USER, campaigns: [guestCampaign] }));

        // Assert
        expect(state.user).toEqual(USER);
        expect(state.campaigns).toEqual([guestCampaign]);
        expect(state.activeCampaignSlug).toBeNull();
        expect(state.config).toEqual({ googleClientId: 'client-id' });
        expect(state.checked).toBe(true);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should keep the active campaign when the refreshed list still contains it', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'other' };

        // Act
        const state = authReducer(
            previous,
            AuthActions.checkSession.success({ user: USER, campaigns: [NAXXAR, OTHER] })
        );

        // Assert
        expect(state.activeCampaignSlug).toBe('other');
    });

    it('should drop the active campaign when the refreshed list no longer contains it', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'other' };

        // Act
        const state = authReducer(previous, AuthActions.checkSession.success({ user: USER, campaigns: [NAXXAR] }));

        // Assert
        expect(state.activeCampaignSlug).toBeNull();
    });

    it('should store the user on login without selecting a campaign', () => {
        // Arrange
        const previous = { ...INITIAL_AUTH_STATE, activeCampaignSlug: 'naxxar' };

        // Act
        const state = authReducer(previous, AuthActions.login.success({ user: USER, campaigns: [NAXXAR, OTHER] }));

        // Assert
        expect(state.user).toEqual(USER);
        expect(state.activeCampaignSlug).toBeNull();
        expect(state.checked).toBe(true);
    });

    it('should select the joined campaign after invite registration', () => {
        // Arrange
        const action = AuthActions.registerViaInvite.success({
            user: USER,
            campaigns: [NAXXAR, OTHER],
            campaign: OTHER
        });

        // Act
        const state = authReducer(INITIAL_AUTH_STATE, action);

        // Assert
        expect(state.activeCampaignSlug).toBe('other');
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should clear the session on logout but keep the public config', () => {
        // Arrange
        const previous = {
            ...signedIn,
            config: { googleClientId: 'client-id' },
            activeCampaignSlug: 'naxxar'
        };

        // Act
        const state = authReducer(previous, AuthActions.logout.success({}));

        // Assert
        expect(state.user).toBeNull();
        expect(state.campaigns).toEqual([]);
        expect(state.activeCampaignSlug).toBeNull();
        expect(state.checked).toBe(true);
        expect(state.config.googleClientId).toBe('client-id');
    });

    it('should keep the active campaign when the campaign list is refreshed', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'naxxar' };

        // Act
        const state = authReducer(previous, AuthActions.loadCampaigns.success({ campaigns: [NAXXAR, OTHER] }));

        // Assert
        expect(state.campaigns).toEqual([NAXXAR, OTHER]);
        expect(state.activeCampaignSlug).toBe('naxxar');
    });

    it('should clear an active campaign that is no longer in the refreshed list', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'other' };

        // Act
        const state = authReducer(previous, AuthActions.loadCampaigns.success({ campaigns: [NAXXAR] }));

        // Assert
        expect(state.activeCampaignSlug).toBeNull();
    });

    it('should sort a new campaign into the list and activate it', () => {
        // Arrange
        const previous = { ...signedIn, campaigns: [OTHER] };

        // Act
        const state = authReducer(previous, AuthActions.createCampaign.success({ campaign: NAXXAR }));

        // Assert
        expect(state.campaigns.map((campaign) => campaign.slug)).toEqual(['naxxar', 'other']);
        expect(state.activeCampaignSlug).toBe('naxxar');
    });

    it('should not duplicate a campaign that is already in the list', () => {
        // Arrange
        const previous = { ...signedIn, campaigns: [NAXXAR] };

        // Act
        const state = authReducer(previous, AuthActions.createCampaign.success({ campaign: NAXXAR }));

        // Assert
        expect(state.campaigns).toEqual([NAXXAR]);
    });

    it('should store the public config', () => {
        // Act
        const state = authReducer(
            INITIAL_AUTH_STATE,
            AuthActions.loadConfig.success({ config: { googleClientId: 'client-id' } })
        );

        // Assert
        expect(state.config.googleClientId).toBe('client-id');
    });

    it('should remember the campaign activated by the shell', () => {
        // Act
        const state = authReducer(signedIn, AuthActions.campaignActivated({ slug: 'other' }));

        // Assert
        expect(state.activeCampaignSlug).toBe('other');
    });

    it('should clear the session when it expires', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'naxxar' };

        // Act
        const state = authReducer(previous, AuthActions.sessionExpired());

        // Assert
        expect(state.user).toBeNull();
        expect(state.campaigns).toEqual([]);
        expect(state.activeCampaignSlug).toBeNull();
        expect(state.checked).toBe(true);
    });

    it('should sign out after a password reset', () => {
        // Arrange
        const previous = { ...signedIn, activeCampaignSlug: 'naxxar' };

        // Act
        const state = authReducer(previous, AuthActions.resetPassword.success({}));

        // Assert
        expect(state.user).toBeNull();
        expect(state.checked).toBe(true);
    });

    it('should keep the HTTP status on a failure', () => {
        // Act
        const state = authReducer(
            INITIAL_AUTH_STATE,
            AuthActions.login.failure({ error: 'Incorrect email or password.', status: 401 })
        );

        // Assert
        expect(state.status).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('Incorrect email or password.');
        expect(state.errorStatus).toBe(401);
    });

    it('should leave the error status null when the failure has no HTTP status', () => {
        // Act
        const state = authReducer(INITIAL_AUTH_STATE, AuthActions.checkSession.failure({ error: 'Offline.' }));

        // Assert
        expect(state.errorStatus).toBeNull();
    });
});
