import { ApiCallStatus } from '@core/models';
import { selectAuthChecked, selectAuthenticated, selectAuthError, selectAuthPending } from './auth.selectors';
import { IAuthState, INITIAL_AUTH_STATE } from './auth.state';

const buildState = (overrides: Partial<IAuthState> = {}): IAuthState => ({ ...INITIAL_AUTH_STATE, ...overrides });

describe('authSelectors', () => {
    it('should expose the simple slices of state', () => {
        // Arrange
        const state = buildState({ authenticated: true, checked: true, error: 'Incorrect password.' });

        // Act
        const projected = {
            authenticated: selectAuthenticated.projector(state),
            checked: selectAuthChecked.projector(state),
            error: selectAuthError.projector(state)
        };

        // Assert
        expect(projected.authenticated).toBe(true);
        expect(projected.checked).toBe(true);
        expect(projected.error).toBe('Incorrect password.');
    });

    it('should report pending only while a request is in flight', () => {
        expect(selectAuthPending.projector(buildState({ status: ApiCallStatus.Pending }))).toBe(true);
        expect(selectAuthPending.projector(buildState({ status: ApiCallStatus.Success }))).toBe(false);
    });
});
