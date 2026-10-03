import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { IEncounter } from '../models';

const COMBAT_URL = '/api/combat';

@Injectable({ providedIn: 'root' })
export class CombatApiService {
    private readonly http = inject(HttpClient);

    loadEncounter(): Observable<IEncounter> {
        return this.http.get<IEncounter>(COMBAT_URL);
    }

    saveEncounter(encounter: IEncounter): Observable<IEncounter> {
        return this.http
            .put<IEncounter>(COMBAT_URL, encounter)
            .pipe(catchError(this.toFriendlyError("Couldn't save the combat tracker. Retry.")));
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: HttpErrorResponse): Observable<never> => {
            const body = error.error as { error?: unknown } | null;
            const message = typeof body?.error === 'string' && body.error.trim() !== '' ? body.error : defaultMessage;
            return throwError(() => new Error(message));
        };
    }
}
