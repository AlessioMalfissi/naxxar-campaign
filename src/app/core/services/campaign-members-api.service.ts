import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { ICampaignInvite, ICampaignMember, ICreatedInvite, IInvitePreview } from '../models';

const CAMPAIGNS_URL = '/api/campaigns';
const INVITES_URL = '/api/invites';

const campaignUrl = (slug: string): string => `${CAMPAIGNS_URL}/${encodeURIComponent(slug)}`;

@Injectable({ providedIn: 'root' })
export class CampaignMembersApiService {
    private readonly http = inject(HttpClient);

    loadMembers(campaignSlug: string): Observable<ICampaignMember[]> {
        return this.http.get<{ members: ICampaignMember[] }>(`${campaignUrl(campaignSlug)}/members`).pipe(
            map((response) => response.members),
            catchError(this.toFriendlyError("Couldn't load the campaign members."))
        );
    }

    loadInvites(campaignSlug: string): Observable<ICampaignInvite[]> {
        return this.http.get<{ invites: ICampaignInvite[] }>(`${campaignUrl(campaignSlug)}/invites`).pipe(
            map((response) => response.invites),
            catchError(this.toFriendlyError("Couldn't load the invites."))
        );
    }

    createInvite(campaignSlug: string): Observable<ICreatedInvite> {
        return this.http.post<{ invite: ICreatedInvite }>(`${campaignUrl(campaignSlug)}/invites`, {}).pipe(
            map((response) => response.invite),
            catchError(this.toFriendlyError("Couldn't create an invite. Retry."))
        );
    }

    loadInvitePreview(token: string): Observable<IInvitePreview> {
        return this.http.get<IInvitePreview>(`${INVITES_URL}/${encodeURIComponent(token)}`).pipe(
            catchError(this.toFriendlyError("This invite link isn't valid."))
        );
    }

    acceptInvite(token: string): Observable<{ campaign: { slug: string } }> {
        return this.http
            .post<{ campaign: { slug: string } }>(`${INVITES_URL}/${encodeURIComponent(token)}/accept`, {})
            .pipe(catchError(this.toFriendlyError("Couldn't join the campaign. Retry.")));
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
