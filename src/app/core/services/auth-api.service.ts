import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

const AUTH_URL = '/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
    private readonly http = inject(HttpClient);

    checkSession(): Observable<boolean> {
        return this.http
            .get<{ authenticated: boolean }>(`${AUTH_URL}/me`)
            .pipe(map((response) => response.authenticated));
    }

    login(password: string): Observable<void> {
        return this.http.post<{ authenticated: boolean }>(`${AUTH_URL}/login`, { password }).pipe(
            map(() => undefined),
            catchError(this.toFriendlyError('Incorrect password.'))
        );
    }

    logout(): Observable<void> {
        return this.http.post<{ authenticated: boolean }>(`${AUTH_URL}/logout`, {}).pipe(map(() => undefined));
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: HttpErrorResponse): Observable<never> => {
            const body = error.error as { error?: unknown } | null;
            const message = typeof body?.error === 'string' && body.error.trim() !== '' ? body.error : defaultMessage;
            return throwError(() => new Error(message));
        };
    }
}
