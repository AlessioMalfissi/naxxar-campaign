import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { IPurse } from '../models';

const PURSES_URL = '/api/purses';

@Injectable({ providedIn: 'root' })
export class PurseApiService {
    private readonly http = inject(HttpClient);

    loadPurses(): Observable<IPurse[]> {
        return this.http.get<IPurse[]>(PURSES_URL);
    }

    updateGold(owner: string, gold: number): Observable<IPurse> {
        return this.http
            .put<IPurse>(`${PURSES_URL}/${encodeURIComponent(owner)}`, { gold })
            .pipe(catchError(this.toFriendlyError("Couldn't update gold. Retry.")));
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: HttpErrorResponse): Observable<never> => {
            const body = error.error as { error?: unknown } | null;
            const message = typeof body?.error === 'string' && body.error.trim() !== '' ? body.error : defaultMessage;
            return throwError(() => new Error(message));
        };
    }
}
