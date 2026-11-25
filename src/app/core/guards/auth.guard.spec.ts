import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable } from 'rxjs';

import { IUser } from '@core/models';
import * as AuthActions from '@store/auth/auth.actions';
import { INITIAL_AUTH_STATE } from '@store/auth/auth.state';
import { authGuard, campaignMemberGuard, guestGuard } from './auth.guard';

const USER: IUser = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const NAXXAR = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' as const };

describe('auth guards', () => {
    let store: MockStore;
    let router: { parseUrl: jest.Mock };

    const state = (url = '/campaigns/naxxar/npcs'): RouterStateSnapshot => ({ url }) as RouterStateSnapshot;

    const route = (slug: string | null): ActivatedRouteSnapshot =>
        ({
            paramMap: convertToParamMap(slug === null ? {} : { campaignSlug: slug })
        }) as ActivatedRouteSnapshot;

    const run = (
        guard: typeof authGuard | typeof guestGuard | typeof campaignMemberGuard,
        snapshot = route('naxxar'),
        routerState = state()
    ): Observable<boolean | UrlTree> =>
        TestBed.runInInjectionContext(() => guard(snapshot, routerState) as Observable<boolean | UrlTree>);

    const first = (source: Observable<boolean | UrlTree>): Promise<boolean | UrlTree> =>
        new Promise((resolve) => source.subscribe(resolve));

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

    it('should allow navigation once the session is checked and authenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, user: USER, checked: true } });

        // Act
        const result = await first(run(authGuard));

        // Assert
        expect(result).toBe(true);
    });

    it('should redirect to login with the requested URL when unauthenticated', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true } });

        // Act
        const result = await first(run(authGuard, route('naxxar'), state('/campaigns/naxxar/npcs')));

        // Assert
        expect(router.parseUrl).toHaveBeenCalledWith('/login?returnUrl=%2Fcampaigns%2Fnaxxar%2Fnpcs');
        expect(result).toEqual({ url: '/login?returnUrl=%2Fcampaigns%2Fnaxxar%2Fnpcs' });
    });

    it('should trigger a session check and wait for it when not yet checked', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        let result: boolean | UrlTree | undefined;
        run(authGuard).subscribe((value) => (result = value));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.checkSession.request({}));
        expect(result).toBeUndefined();

        // Act
        store.setState({ auth: { ...INITIAL_AUTH_STATE, user: USER, checked: true } });

        // Assert
        expect(result).toBe(true);
    });

    it('should allow anonymous visitors onto the login page', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, checked: true } });

        // Act
        const result = await first(run(guestGuard));

        // Assert
        expect(result).toBe(true);
    });

    it('should send signed-in users away from the login page', async () => {
        // Arrange
        store.setState({ auth: { ...INITIAL_AUTH_STATE, user: USER, checked: true } });

        // Act
        const result = await first(run(guestGuard));

        // Assert
        expect(router.parseUrl).toHaveBeenCalledWith('/campaigns');
        expect(result).toEqual({ url: '/campaigns' });
    });

    it('should allow a member into the campaign route', async () => {
        // Arrange
        store.setState({
            auth: { ...INITIAL_AUTH_STATE, user: USER, campaigns: [NAXXAR], checked: true }
        });

        // Act
        const result = await first(run(campaignMemberGuard, route('naxxar')));

        // Assert
        expect(result).toBe(true);
    });

    it('should send a non-member back to the campaign picker', async () => {
        // Arrange
        store.setState({
            auth: { ...INITIAL_AUTH_STATE, user: USER, campaigns: [NAXXAR], checked: true }
        });

        // Act
        const result = await first(run(campaignMemberGuard, route('other')));

        // Assert
        expect(router.parseUrl).toHaveBeenCalledWith('/campaigns');
        expect(result).toEqual({ url: '/campaigns' });
    });

    it('should send a route without a campaign slug back to the picker', async () => {
        // Arrange
        store.setState({
            auth: { ...INITIAL_AUTH_STATE, user: USER, campaigns: [NAXXAR], checked: true }
        });

        // Act
        const result = await first(run(campaignMemberGuard, route(null)));

        // Assert
        expect(result).toEqual({ url: '/campaigns' });
    });

    it('should check the session before resolving campaign membership', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        let result: boolean | UrlTree | undefined;
        run(campaignMemberGuard, route('naxxar')).subscribe((value) => (result = value));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.checkSession.request({}));

        // Act
        store.setState({
            auth: { ...INITIAL_AUTH_STATE, user: USER, campaigns: [NAXXAR], checked: true }
        });

        // Assert
        expect(result).toBe(true);
    });
});
