import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';

import { AuthApiService } from '@core/services/auth-api.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';

describe('AuthEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: AuthEffects;
    let authApi: jest.Mocked<Pick<AuthApiService, 'checkSession' | 'login' | 'logout'>>;
    let router: { navigateByUrl: jest.Mock };

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        authApi = {
            checkSession: jest.fn(),
            login: jest.fn(),
            logout: jest.fn()
        };
        router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

        TestBed.configureTestingModule({
            providers: [
                AuthEffects,
                provideMockActions(() => actions$),
                { provide: AuthApiService, useValue: authApi },
                { provide: Router, useValue: router }
            ]
        });

        effects = TestBed.inject(AuthEffects);
    });

    it('should map a checked session onto a success action', async () => {
        // Arrange
        authApi.checkSession.mockReturnValue(of(true));
        actions$.next(AuthActions.checkSession.request({}));

        // Act
        const result = await dispatched(effects.checkSession$);

        // Assert
        expect(result).toEqual(AuthActions.checkSession.success({ authenticated: true }));
    });

    it('should treat a failed session check as unauthenticated rather than an error', async () => {
        // Arrange
        authApi.checkSession.mockReturnValue(throwError(() => new Error('network down')));
        actions$.next(AuthActions.checkSession.request({}));

        // Act
        const result = await dispatched(effects.checkSession$);

        // Assert
        expect(result).toEqual(AuthActions.checkSession.success({ authenticated: false }));
    });

    it('should map a successful login onto a success action', async () => {
        // Arrange
        authApi.login.mockReturnValue(of(undefined));
        actions$.next(AuthActions.login.request({ password: 'secret' }));

        // Act
        const result = await dispatched(effects.login$);

        // Assert
        expect(result).toEqual(AuthActions.login.success({}));
    });

    it('should map a failed login onto a failure action carrying the error message', async () => {
        // Arrange
        authApi.login.mockReturnValue(throwError(() => new Error('Incorrect password.')));
        actions$.next(AuthActions.login.request({ password: 'wrong' }));

        // Act
        const result = await dispatched(effects.login$);

        // Assert
        expect(result).toEqual(AuthActions.login.failure({ error: 'Incorrect password.' }));
    });

    it('should navigate to the campaign after a successful login', async () => {
        // Arrange
        actions$.next(AuthActions.login.success({}));

        // Act
        await dispatched(effects.loginSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaign');
    });

    it('should map a logout request onto a success action', async () => {
        // Arrange
        authApi.logout.mockReturnValue(of(undefined));
        actions$.next(AuthActions.logout.request({}));

        // Act
        const result = await dispatched(effects.logout$);

        // Assert
        expect(result).toEqual(AuthActions.logout.success({}));
    });

    it('should still succeed the logout locally even if the request fails', async () => {
        // Arrange
        authApi.logout.mockReturnValue(throwError(() => new Error('network down')));
        actions$.next(AuthActions.logout.request({}));

        // Act
        const result = await dispatched(effects.logout$);

        // Assert
        expect(result).toEqual(AuthActions.logout.success({}));
    });

    it('should navigate to login after a successful logout', async () => {
        // Arrange
        actions$.next(AuthActions.logout.success({}));

        // Act
        await dispatched(effects.logoutSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });
});
