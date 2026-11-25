import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { ICampaignSummary } from '../models';

const CAMPAIGNS_URL = '/api/campaigns';

@Injectable({ providedIn: 'root' })
export class CampaignApiService {
    private readonly http = inject(HttpClient);

    loadCampaigns(): Observable<ICampaignSummary[]> {
        return this.http
            .get<ICampaignSummary[]>(CAMPAIGNS_URL)
            .pipe(catchError(this.toFriendlyError("Couldn't load your campaigns.")));
    }

    getCampaign(slug: string): Observable<ICampaignSummary> {
        return this.http.get<{ campaign: ICampaignSummary }>(`${CAMPAIGNS_URL}/${encodeURIComponent(slug)}`).pipe(
            map((response) => response.campaign),
            catchError(this.toFriendlyError('Campaign not found.'))
        );
    }

    createCampaign(name: string): Observable<ICampaignSummary> {
        return this.http.post<{ campaign: ICampaignSummary }>(CAMPAIGNS_URL, { name }).pipe(
            map((response) => response.campaign),
            catchError(this.toFriendlyError("Couldn't create the campaign. Retry."))
        );
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
