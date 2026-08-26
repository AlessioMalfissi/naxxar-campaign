import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
    let store: MockStore;
    let router: { navigateByUrl: jest.Mock };

    beforeEach(() => {
        // Arrange
        router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

        TestBed.configureTestingModule({
            providers: [provideMockStore({ initialState: {} }), { provide: Router, useValue: router }]
        });

        store = TestBed.inject(MockStore);
    });

    it('should pass a successful response through unchanged', async () => {
        // Arrange
        const req = new HttpRequest('GET', '/api/entries');
        const response = new HttpResponse({ status: 200 });
        const next = jest.fn().mockReturnValue(of(response));

        // Act
        const result = await firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(req, next)));

        // Assert
        expect(result).toBe(response);
    });

    it('should sign the session out and redirect to login on a 401 from a protected endpoint', async () => {
        // Arrange
        const req = new HttpRequest('GET', '/api/entries');
        const error = new HttpErrorResponse({ status: 401, url: '/api/entries' });
        const next = jest.fn().mockReturnValue(throwError(() => error));
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        await expect(firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(req, next)))).rejects.toBe(
            error
        );

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.checkSession.success({ authenticated: false }));
        expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('should not redirect for a 401 on the login endpoint itself', async () => {
        // Arrange
        const req = new HttpRequest('POST', '/api/auth/login', { password: 'wrong' });
        const error = new HttpErrorResponse({ status: 401, url: '/api/auth/login' });
        const next = jest.fn().mockReturnValue(throwError(() => error));
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        await expect(firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(req, next)))).rejects.toBe(
            error
        );

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should leave other error statuses untouched', async () => {
        // Arrange
        const req = new HttpRequest('GET', '/api/entries');
        const error = new HttpErrorResponse({ status: 500, url: '/api/entries' });
        const next = jest.fn().mockReturnValue(throwError(() => error));

        // Act
        await expect(firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(req, next)))).rejects.toBe(
            error
        );

        // Assert
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
});
