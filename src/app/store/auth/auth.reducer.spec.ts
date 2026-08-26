import { ApiCallStatus } from '@core/models';
import * as AuthActions from './auth.actions';
import { authReducer } from './auth.reducer';
import { INITIAL_AUTH_STATE } from './auth.state';

describe('authReducer', () => {
    it('should mark the session check as pending on request', () => {
        // Arrange
        const action = AuthActions.checkSession.request({});

        // Act
        const state = authReducer(INITIAL_AUTH_STATE, action);

        // Assert
        expect(state.status).toBe(ApiCallStatus.Pending);
    });

    it('should store the result and mark the session as checked on success', () => {
        // Arrange
        const action = AuthActions.checkSession.success({ authenticated: true });

        // Act
        const state = authReducer(INITIAL_AUTH_STATE, action);

        // Assert
        expect(state.authenticated).toBe(true);
        expect(state.checked).toBe(true);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should clear any previous error on a login request', () => {
        // Arrange
        const previous = { ...INITIAL_AUTH_STATE, error: 'Incorrect password.' };

        // Act
        const state = authReducer(previous, AuthActions.login.request({ password: 'secret' }));

        // Assert
        expect(state.error).toBeNull();
        expect(state.status).toBe(ApiCallStatus.Pending);
    });

    it('should authenticate on login success', () => {
        // Act
        const state = authReducer(INITIAL_AUTH_STATE, AuthActions.login.success({}));

        // Assert
        expect(state.authenticated).toBe(true);
        expect(state.checked).toBe(true);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should record the error and stay unauthenticated on login failure', () => {
        // Act
        const state = authReducer(INITIAL_AUTH_STATE, AuthActions.login.failure({ error: 'Incorrect password.' }));

        // Assert
        expect(state.authenticated).toBe(false);
        expect(state.checked).toBe(true);
        expect(state.error).toBe('Incorrect password.');
        expect(state.status).toBe(ApiCallStatus.Failed);
    });

    it('should reset to a checked, unauthenticated state on logout success', () => {
        // Arrange
        const loggedIn = { ...INITIAL_AUTH_STATE, authenticated: true, checked: true };

        // Act
        const state = authReducer(loggedIn, AuthActions.logout.success({}));

        // Assert
        expect(state.authenticated).toBe(false);
        expect(state.checked).toBe(true);
    });
});
