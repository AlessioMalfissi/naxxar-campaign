import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';
import { INITIAL_AUTH_STATE } from '@store/auth/auth.state';
import { authGuard, guestGuard } from './auth.guard';

describe('authGuard / guestGuard', () => {
    let store: MockStore;
    let router: { parseUrl: jest.Mock };

    const runGuard = (guard: typeof authGuard) =>
        TestBed.runInInjectionContext(
            () => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<boolean | UrlTree>
        );

    beforeEach(() => {
        // Arrange
        router = { parseUrl: jest.fn((url: string) => ({ url }) as unknown as UrlTree) };

        TestBed.configureTestingModule({
            providers: [
                provideMockStore({ initialState: { auth: INITIAL_AUTH_STATE } }),
                { provide: Router, useValue: router }
            ]
        });

        store = TestBed.inject(MockStore);
    });

    it('authGuard allows navigation once the session is checked and authenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true, authenticated: true } });

        // Act
        const result = await new Promise((resolve) => runGuard(authGuard).subscribe(resolve));

        // Assert
        expect(result).toBe(true);
    });

    it('authGuard redirects to /login once the session is checked and unauthenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true, authenticated: false } });

        // Act
        const result = await new Promise((resolve) => runGuard(authGuard).subscribe(resolve));

        // Assert
        expect(result).toEqual({ url: '/login' });
    });

    it('authGuard triggers a session check and waits for it when not yet checked', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        let result: boolean | UrlTree | undefined;
        runGuard(authGuard).subscribe((value) => (result = value));

        // Assert (dispatched immediately)
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.checkSession.request({}));
        expect(result).toBeUndefined();

        // Act
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true, authenticated: true } });

        // Assert
        expect(result).toBe(true);
    });

    it('guestGuard allows navigation to /login when unauthenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true, authenticated: false } });

        // Act
        const result = await new Promise((resolve) => runGuard(guestGuard).subscribe(resolve));

        // Assert
        expect(result).toBe(true);
    });

    it('guestGuard redirects to /campaign when already authenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true, authenticated: true } });

        // Act
        const result = await new Promise((resolve) => runGuard(guestGuard).subscribe(resolve));

        // Assert
        expect(result).toEqual({ url: '/campaign' });
    });
});
