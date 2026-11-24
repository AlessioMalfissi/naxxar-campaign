import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
    let store: MockStore;

    const run = (url: string, error: unknown): Promise<unknown> => {
        const req = new HttpRequest('GET', url);
        const next = jest.fn().mockReturnValue(throwError(() => error));
        return firstValueFrom(TestBed.runInInjectionContext(() => authInterceptor(req, next))).catch(
            (thrown: unknown) => thrown
        );
    };

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({ providers: [provideMockStore({ initialState: {} })] });
        store = TestBed.inject(MockStore);
    });

    it('should pass a successful response through unchanged', async () => {
        // Arrange
        const req = new HttpRequest('GET', '/api/campaigns/naxxar/entries');
        const response = new HttpResponse({ status: 200 });
        const next = jest.fn().mockReturnValue(of(response));

        // Act
        const result = await firstValueFrom(
            TestBed.runInInjectionContext(() => authInterceptor(req, next))
        );

        // Assert
        expect(result).toBe(response);
    });

    it('should clear the session on a 401 from a protected endpoint', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });

        // Act
        const thrown = await run('/api/campaigns/naxxar/entries', error);

        // Assert
        expect(thrown).toBe(error);
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.sessionExpired());
    });

    it('should leave the session alone on a 401 from the auth endpoints', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });

        // Act
        await run('/api/auth/login', error);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalledWith(AuthActions.sessionExpired());
    });

    it('should leave the session alone on a 401 from invite registration', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });

        // Act
        await run('/api/invites/token/register', error);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalledWith(AuthActions.sessionExpired());
    });

    it('should leave the session alone on other HTTP errors', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

        // Act
        const thrown = await run('/api/campaigns/naxxar/entries', error);

        // Assert
        expect(thrown).toBe(error);
        expect(dispatchSpy).not.toHaveBeenCalledWith(AuthActions.sessionExpired());
    });

    it('should rethrow non-HTTP errors untouched', async () => {
        // Arrange
        const error = new Error('network down');

        // Act
        const thrown = await run('/api/campaigns/naxxar/entries', error);

        // Assert
        expect(thrown).toBe(error);
    });
});
