import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { IAuthResponse, IInviteAuthResponse, IPublicConfig, ISessionResponse } from '../models';

const AUTH_URL = '/api/auth';
const INVITES_URL = '/api/invites';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
    private readonly http = inject(HttpClient);

    checkSession(): Observable<ISessionResponse> {
        return this.http
            .get<ISessionResponse>(`${AUTH_URL}/me`)
            .pipe(catchError(this.toFriendlyError("Couldn't check your session.")));
    }

    login(email: string, password: string): Observable<IAuthResponse> {
        return this.http
            .post<IAuthResponse>(`${AUTH_URL}/login`, { email, password })
            .pipe(catchError(this.toFriendlyError('Incorrect email or password.')));
    }

    googleLogin(credential: string): Observable<IAuthResponse> {
        return this.http
            .post<IAuthResponse>(`${AUTH_URL}/google`, { credential })
            .pipe(catchError(this.toFriendlyError('Google sign-in failed.')));
    }

    // Invite registration returns the same auth envelope plus the campaign that was joined.
    registerWithInvite(
        token: string,
        credentials: { displayName: string; email: string; password: string }
    ): Observable<IInviteAuthResponse> {
        return this.http
            .post<IInviteAuthResponse>(`${INVITES_URL}/${encodeURIComponent(token)}/register`, credentials)
            .pipe(catchError(this.toFriendlyError("Couldn't create your account. Retry.")));
    }

    registerWithGoogleInvite(
        token: string,
        credentials: { credential: string; displayName?: string }
    ): Observable<IInviteAuthResponse> {
        return this.http
            .post<IInviteAuthResponse>(`${INVITES_URL}/${encodeURIComponent(token)}/google`, credentials)
            .pipe(catchError(this.toFriendlyError("Couldn't create your account with Google.")));
    }

    logout(): Observable<void> {
        return this.http.post<{ ok: boolean }>(`${AUTH_URL}/logout`, {}).pipe(
            map(() => undefined),
            catchError(this.toFriendlyError("Couldn't sign out."))
        );
    }

    loadConfig(): Observable<IPublicConfig> {
        return this.http
            .get<IPublicConfig>('/api/config')
            .pipe(catchError(this.toFriendlyError("Couldn't load the app configuration.")));
    }

    forgotPassword(email: string): Observable<void> {
        return this.http.post<{ ok: boolean }>(`${AUTH_URL}/forgot-password`, { email }).pipe(
            map(() => undefined),
            catchError(this.toFriendlyError("Couldn't send the reset email. Retry."))
        );
    }

    resetPassword(token: string, password: string): Observable<void> {
        return this.http.post<{ ok: boolean }>(`${AUTH_URL}/reset-password`, { token, password }).pipe(
            map(() => undefined),
            catchError(this.toFriendlyError('This reset link is invalid or has expired.'))
        );
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
