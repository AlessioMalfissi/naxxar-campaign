import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { IEncounter } from '../models';
import { CampaignContextService } from './campaign-context.service';

@Injectable({ providedIn: 'root' })
export class CombatApiService {
    private readonly http = inject(HttpClient);
    private readonly campaignContext = inject(CampaignContextService);

    loadEncounter(): Observable<IEncounter> {
        return this.http.get<IEncounter>(this.combatUrl());
    }

    saveEncounter(encounter: IEncounter): Observable<IEncounter> {
        return this.http
            .put<IEncounter>(this.combatUrl(), encounter)
            .pipe(catchError(this.toFriendlyError("Couldn't save the combat tracker. Retry.")));
    }

    private combatUrl(): string {
        return `${this.campaignContext.baseUrl()}/combat`;
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
