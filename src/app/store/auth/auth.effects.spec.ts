import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, ReplaySubject, throwError, toArray, take } from 'rxjs';

import { ApiError } from '@core/errors/api-error';
import { ICampaignSummary, IUser } from '@core/models';
import { AuthApiService } from '@core/services/auth-api.service';
import { CampaignApiService } from '@core/services/campaign-api.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';

const USER: IUser = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const OTHER: ICampaignSummary = { id: 'campaign-2', slug: 'other', name: 'Other', role: 'player' };

describe('AuthEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: AuthEffects;
    let authApi: jest.Mocked<
        Pick<
            AuthApiService,
            | 'checkSession'
            | 'login'
            | 'googleLogin'
            | 'registerWithInvite'
            | 'registerWithGoogleInvite'
            | 'logout'
            | 'loadConfig'
            | 'forgotPassword'
            | 'resetPassword'
        >
    >;
    let campaignApi: jest.Mocked<Pick<CampaignApiService, 'loadCampaigns' | 'createCampaign'>>;
    let router: { navigateByUrl: jest.Mock; parseUrl: jest.Mock; url: string };

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.pipe(take(1)).subscribe((action) => resolve(action)));

    const dispatchedMany = <T>(source: Observable<T>, count: number): Promise<T[]> =>
        new Promise<T[]>((resolve) => source.pipe(take(count), toArray()).subscribe(resolve));

    const parseReturnUrl = (url: string): { queryParams: Record<string, string> } => {
        const query = url.split('?')[1] ?? '';
        const values = new URLSearchParams(query);
        const returnUrl = values.get('returnUrl');
        return { queryParams: returnUrl === null ? {} : { returnUrl } };
    };

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        authApi = {
            checkSession: jest.fn(),
            login: jest.fn(),
            googleLogin: jest.fn(),
            registerWithInvite: jest.fn(),
            registerWithGoogleInvite: jest.fn(),
            logout: jest.fn(),
            loadConfig: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn()
        };
        campaignApi = { loadCampaigns: jest.fn(), createCampaign: jest.fn() };
        router = {
            url: '/login',
            navigateByUrl: jest.fn().mockResolvedValue(true),
            parseUrl: jest.fn(parseReturnUrl)
        };

        TestBed.configureTestingModule({
            providers: [
                AuthEffects,
                provideMockActions(() => actions$),
                { provide: AuthApiService, useValue: authApi },
                { provide: CampaignApiService, useValue: campaignApi },
                { provide: Router, useValue: router }
            ]
        });

        effects = TestBed.inject(AuthEffects);
    });

    it('should map a checked session onto a success action', async () => {
        // Arrange
        authApi.checkSession.mockReturnValue(of({ user: USER, campaigns: [NAXXAR] }));
        actions$.next(AuthActions.checkSession.request({}));

        // Act
        const result = await dispatched(effects.checkSession$);

        // Assert
        expect(result).toEqual(AuthActions.checkSession.success({ user: USER, campaigns: [NAXXAR] }));
    });

    it('should treat a failed session check as anonymous rather than an error', async () => {
        // Arrange
        authApi.checkSession.mockReturnValue(throwError(() => new Error('network down')));
        actions$.next(AuthActions.checkSession.request({}));

        // Act
        const result = await dispatched(effects.checkSession$);

        // Assert
        expect(result).toEqual(AuthActions.checkSession.success({ user: null, campaigns: [] }));
    });

    it('should map a successful login onto a success action', async () => {
        // Arrange
        authApi.login.mockReturnValue(of({ user: USER, campaigns: [NAXXAR] }));
        actions$.next(AuthActions.login.request({ email: 'dm@naxxar.local', password: 'secret' }));

        // Act
        const result = await dispatched(effects.login$);

        // Assert
        expect(authApi.login).toHaveBeenCalledWith('dm@naxxar.local', 'secret');
        expect(result).toEqual(AuthActions.login.success({ user: USER, campaigns: [NAXXAR] }));
    });

    it('should carry the message and status of a failed login', async () => {
        // Arrange
        authApi.login.mockReturnValue(throwError(() => new ApiError(401, 'Incorrect email or password.')));
        actions$.next(AuthActions.login.request({ email: 'dm@naxxar.local', password: 'wrong' }));

        // Act
        const result = await dispatched(effects.login$);

        // Assert
        expect(result).toEqual(AuthActions.login.failure({ error: 'Incorrect email or password.', status: 401 }));
    });

    it('should map Google sign-in onto a success action', async () => {
        // Arrange
        authApi.googleLogin.mockReturnValue(of({ user: USER, campaigns: [NAXXAR] }));
        actions$.next(AuthActions.googleLogin.request({ credential: 'credential' }));

        // Act
        const result = await dispatched(effects.googleLogin$);

        // Assert
        expect(authApi.googleLogin).toHaveBeenCalledWith('credential');
        expect(result).toEqual(AuthActions.googleLogin.success({ user: USER, campaigns: [NAXXAR] }));
    });

    it('should register through an invite', async () => {
        // Arrange
        authApi.registerWithInvite.mockReturnValue(of({ user: USER, campaigns: [NAXXAR], campaign: NAXXAR }));
        actions$.next(
            AuthActions.registerViaInvite.request({
                token: 'token',
                displayName: 'Player One',
                email: 'player@example.com',
                password: 'secret123'
            })
        );

        // Act
        const result = await dispatched(effects.registerViaInvite$);

        // Assert
        expect(authApi.registerWithInvite).toHaveBeenCalledWith('token', {
            displayName: 'Player One',
            email: 'player@example.com',
            password: 'secret123'
        });
        expect(result).toEqual(
            AuthActions.registerViaInvite.success({ user: USER, campaigns: [NAXXAR], campaign: NAXXAR })
        );
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

    it('should load the public config', async () => {
        // Arrange
        authApi.loadConfig.mockReturnValue(of({ googleClientId: 'client-id' }));
        actions$.next(AuthActions.loadConfig.request({}));

        // Act
        const result = await dispatched(effects.loadConfig$);

        // Assert
        expect(result).toEqual(AuthActions.loadConfig.success({ config: { googleClientId: 'client-id' } }));
    });

    it('should load the campaign list', async () => {
        // Arrange
        campaignApi.loadCampaigns.mockReturnValue(of([NAXXAR, OTHER]));
        actions$.next(AuthActions.loadCampaigns.request({}));

        // Act
        const result = await dispatched(effects.loadCampaigns$);

        // Assert
        expect(result).toEqual(AuthActions.loadCampaigns.success({ campaigns: [NAXXAR, OTHER] }));
    });

    it('should create a campaign, select it and navigate to it', async () => {
        // Arrange
        campaignApi.createCampaign.mockReturnValue(of(NAXXAR));
        actions$.next(AuthActions.createCampaign.request({ name: 'Naxxar' }));

        // Act
        const results = await dispatchedMany(effects.createCampaign$, 2);

        // Assert
        expect(campaignApi.createCampaign).toHaveBeenCalledWith('Naxxar');
        expect(results).toEqual([
            AuthActions.createCampaign.success({ campaign: NAXXAR }),
            AuthActions.campaignActivated({ slug: 'naxxar' })
        ]);
    });

    it('should request a password reset email', async () => {
        // Arrange
        authApi.forgotPassword.mockReturnValue(of(undefined));
        actions$.next(AuthActions.forgotPassword.request({ email: 'dm@naxxar.local' }));

        // Act
        const result = await dispatched(effects.forgotPassword$);

        // Assert
        expect(authApi.forgotPassword).toHaveBeenCalledWith('dm@naxxar.local');
        expect(result).toEqual(AuthActions.forgotPassword.success({}));
    });

    it('should reset the password', async () => {
        // Arrange
        authApi.resetPassword.mockReturnValue(of(undefined));
        actions$.next(AuthActions.resetPassword.request({ token: 'token', password: 'new-secret' }));

        // Act
        const result = await dispatched(effects.resetPassword$);

        // Assert
        expect(authApi.resetPassword).toHaveBeenCalledWith('token', 'new-secret');
        expect(result).toEqual(AuthActions.resetPassword.success({}));
    });

    it('should follow a safe returnUrl after login', async () => {
        // Arrange
        router.url = '/login?returnUrl=%2Fcampaigns%2Fother%2Fnpcs';
        actions$.next(AuthActions.login.success({ user: USER, campaigns: [NAXXAR] }));

        // Act
        await dispatched(effects.loginSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/other/npcs');
    });

    it('should refuse an external returnUrl after login', async () => {
        // Arrange
        router.url = '/login?returnUrl=%2F%2Fevil.example';
        actions$.next(AuthActions.login.success({ user: USER, campaigns: [NAXXAR] }));

        // Act
        await dispatched(effects.loginSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/naxxar/npcs');
    });

    it('should open the sole campaign after login', async () => {
        // Arrange
        actions$.next(AuthActions.login.success({ user: USER, campaigns: [NAXXAR] }));

        // Act
        await dispatched(effects.loginSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/naxxar/npcs');
    });

    it('should open the campaign picker when the user has several campaigns', async () => {
        // Arrange
        actions$.next(AuthActions.login.success({ user: USER, campaigns: [NAXXAR, OTHER] }));

        // Act
        await dispatched(effects.loginSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns');
    });

    it('should navigate to the joined campaign after invite registration', async () => {
        // Arrange
        actions$.next(AuthActions.registerViaInvite.success({ user: USER, campaigns: [NAXXAR], campaign: NAXXAR }));

        // Act
        await dispatched(effects.inviteRegistrationSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/naxxar/npcs');
    });

    it('should navigate to the new campaign after creating it', async () => {
        // Arrange
        actions$.next(AuthActions.createCampaign.success({ campaign: NAXXAR }));

        // Act
        await dispatched(effects.createCampaignSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/naxxar/npcs');
    });

    it('should navigate to login after a successful logout', async () => {
        // Arrange
        actions$.next(AuthActions.logout.success({}));

        // Act
        await dispatched(effects.logoutSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login with the reset flag after a password reset', async () => {
        // Arrange
        actions$.next(AuthActions.resetPassword.success({}));

        // Act
        await dispatched(effects.resetPasswordSuccess$);

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/login?reset=1');
    });
});
