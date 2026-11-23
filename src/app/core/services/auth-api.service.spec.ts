import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../errors/api-error';
import { IAuthResponse } from '../models';
import { AuthApiService } from './auth-api.service';

const USER = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const CAMPAIGN = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' as const };

describe('AuthApiService', () => {
    let service: AuthApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(AuthApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should load the session with the user and campaigns', () => {
        // Arrange
        let result: { user: typeof USER | null; campaigns: (typeof CAMPAIGN)[] } | null = null;
        service.checkSession().subscribe((response) => (result = response));

        // Act
        httpMock.expectOne('/api/auth/me').flush({ user: USER, campaigns: [CAMPAIGN] });

        // Assert
        expect(result).toEqual({ user: USER, campaigns: [CAMPAIGN] });
    });

    it('should accept an anonymous session', () => {
        // Arrange
        let result: { user: typeof USER | null; campaigns: (typeof CAMPAIGN)[] } | null = null;
        service.checkSession().subscribe((response) => (result = response));

        // Act
        httpMock.expectOne('/api/auth/me').flush({ user: null, campaigns: [] });

        // Assert
        expect(result).toEqual({ user: null, campaigns: [] });
    });

    it('should POST the email and password on login', () => {
        // Arrange
        let response: IAuthResponse | null = null;
        service.login('dm@naxxar.local', 'secret').subscribe((result) => (response = result));

        // Act
        const request = httpMock.expectOne('/api/auth/login');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ email: 'dm@naxxar.local', password: 'secret' });
        request.flush({ user: USER, campaigns: [CAMPAIGN] });

        // Assert
        expect(response).toEqual({ user: USER, campaigns: [CAMPAIGN] });
    });

    it('should surface the server message and status when login fails', () => {
        // Arrange
        let error: ApiError | null = null;

        // Act
        service.login('dm@naxxar.local', 'wrong').subscribe({ error: (thrown: ApiError) => (error = thrown) });
        httpMock
            .expectOne('/api/auth/login')
            .flush({ error: 'Incorrect email or password.' }, { status: 401, statusText: 'Unauthorized' });

        // Assert
        expect(error!.message).toBe('Incorrect email or password.');
        expect(error!.status).toBe(401);
    });

    it('should fall back to a generic login message when the server sends none', () => {
        // Arrange
        let error: ApiError | null = null;

        // Act
        service.login('dm@naxxar.local', 'wrong').subscribe({ error: (thrown: ApiError) => (error = thrown) });
        httpMock.expectOne('/api/auth/login').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe('Incorrect email or password.');
        expect(error!.status).toBe(500);
    });

    it('should POST the Google credential', () => {
        // Arrange
        let response: IAuthResponse | null = null;
        service.googleLogin('credential').subscribe((result) => (response = result));

        // Act
        const request = httpMock.expectOne('/api/auth/google');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ credential: 'credential' });
        request.flush({ user: USER, campaigns: [CAMPAIGN] });

        // Assert
        expect(response).toEqual({ user: USER, campaigns: [CAMPAIGN] });
    });

    it('should register through an invite and return the joined campaign', () => {
        // Arrange
        let campaign: typeof CAMPAIGN | null = null;
        service
            .registerWithInvite('token/with space', {
                displayName: 'Player One',
                email: 'player@example.com',
                password: 'secret123'
            })
            .subscribe((result) => (campaign = result.campaign));

        // Act
        const request = httpMock.expectOne('/api/invites/token%2Fwith%20space/register');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            displayName: 'Player One',
            email: 'player@example.com',
            password: 'secret123'
        });
        request.flush({ user: USER, campaigns: [CAMPAIGN], campaign: CAMPAIGN });

        // Assert
        expect(campaign).toEqual(CAMPAIGN);
    });

    it('should register with Google through an invite', () => {
        // Arrange
        let completed = false;
        service
            .registerWithGoogleInvite('token', { credential: 'credential', displayName: 'Player One' })
            .subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/invites/token/google');
        expect(request.request.body).toEqual({ credential: 'credential', displayName: 'Player One' });
        request.flush({ user: USER, campaigns: [CAMPAIGN], campaign: CAMPAIGN });

        // Assert
        expect(completed).toBe(true);
    });

    it('should POST to logout', () => {
        // Arrange
        let completed = false;
        service.logout().subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/auth/logout');
        expect(request.request.method).toBe('POST');
        request.flush({ ok: true });

        // Assert
        expect(completed).toBe(true);
    });

    it('should load the public config', () => {
        // Arrange
        let clientId: string | null = 'unset';
        service.loadConfig().subscribe((config) => (clientId = config.googleClientId));

        // Act
        httpMock.expectOne('/api/config').flush({ googleClientId: 'client-id' });

        // Assert
        expect(clientId).toBe('client-id');
    });

    it('should request a password reset email', () => {
        // Arrange
        let completed = false;
        service.forgotPassword('dm@naxxar.local').subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/auth/forgot-password');
        expect(request.request.body).toEqual({ email: 'dm@naxxar.local' });
        request.flush({ ok: true });

        // Assert
        expect(completed).toBe(true);
    });

    it('should reset the password with the token', () => {
        // Arrange
        let completed = false;
        service.resetPassword('reset-token', 'new-secret').subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/auth/reset-password');
        expect(request.request.body).toEqual({ token: 'reset-token', password: 'new-secret' });
        request.flush({ ok: true });

        // Assert
        expect(completed).toBe(true);
    });

    it('should keep the status of an expired reset link', () => {
        // Arrange
        let error: ApiError | null = null;

        // Act
        service.resetPassword('expired', 'new-secret').subscribe({ error: (thrown: ApiError) => (error = thrown) });
        httpMock
            .expectOne('/api/auth/reset-password')
            .flush({ error: 'This reset link is invalid or has expired.' }, { status: 410, statusText: 'Gone' });

        // Assert
        expect(error!.status).toBe(410);
        expect(error!.message).toBe('This reset link is invalid or has expired.');
    });
});
