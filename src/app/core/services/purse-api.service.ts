import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { IPurse } from '../models';
import { CampaignContextService } from './campaign-context.service';

@Injectable({ providedIn: 'root' })
export class PurseApiService {
    private readonly http = inject(HttpClient);
    private readonly campaignContext = inject(CampaignContextService);

    loadPurses(): Observable<IPurse[]> {
        return this.http.get<IPurse[]>(this.pursesUrl());
    }

    updateGold(owner: string, gold: number): Observable<IPurse> {
        return this.http
            .put<IPurse>(`${this.pursesUrl()}/${encodeURIComponent(owner)}`, { gold })
            .pipe(catchError(this.toFriendlyError("Couldn't update gold. Retry.")));
    }

    private pursesUrl(): string {
        return `${this.campaignContext.baseUrl()}/purses`;
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
