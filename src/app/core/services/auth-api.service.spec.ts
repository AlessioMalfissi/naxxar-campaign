import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from './auth-api.service';

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

    it('should report whether the current session is authenticated', () => {
        // Arrange
        let authenticated: boolean | null = null;
        service.checkSession().subscribe((result) => (authenticated = result));

        // Act
        httpMock.expectOne('/api/auth/me').flush({ authenticated: true });

        // Assert
        expect(authenticated).toBe(true);
    });

    it('should POST the password on login', () => {
        // Arrange
        let completed = false;
        service.login('secret').subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/auth/login');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ password: 'secret' });
        request.flush({ authenticated: true });

        // Assert
        expect(completed).toBe(true);
    });

    it('should surface the server error message when login fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.login('wrong').subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/auth/login').flush({ error: 'Incorrect password.' }, { status: 401, statusText: 'Unauthorized' });

        // Assert
        expect(error!.message).toBe('Incorrect password.');
    });

    it('should fall back to a generic message when login fails without a server message', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.login('wrong').subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/auth/login').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe('Incorrect password.');
    });

    it('should POST to logout', () => {
        // Arrange
        let completed = false;
        service.logout().subscribe(() => (completed = true));

        // Act
        const request = httpMock.expectOne('/api/auth/logout');
        expect(request.request.method).toBe('POST');
        request.flush({ authenticated: false });

        // Assert
        expect(completed).toBe(true);
    });
});
