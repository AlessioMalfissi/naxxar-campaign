import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, switchMap, take, tap } from 'rxjs';

import { toApiError } from '@core/errors/api-error';
import { CampaignMembersApiService } from '@core/services/campaign-members-api.service';
import * as AuthActions from '@store/auth/auth.actions';
import * as CampaignMembersActions from './campaign-members.actions';

const campaignUrl = (slug: string): string => `/campaigns/${encodeURIComponent(slug)}/npcs`;

@Injectable()
export class CampaignMembersEffects {
    private readonly actions$ = inject(Actions);
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly api = inject(CampaignMembersApiService);

    readonly loadMembers$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CampaignMembersActions.loadMembers.request),
            switchMap(({ campaignSlug }) =>
                this.api.loadMembers(campaignSlug).pipe(
                    map((members) => CampaignMembersActions.loadMembers.success({ members })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't load the campaign members.");
                        return of(
                            CampaignMembersActions.loadMembers.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly loadInvites$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CampaignMembersActions.loadInvites.request),
            switchMap(({ campaignSlug }) =>
                this.api.loadInvites(campaignSlug).pipe(
                    map((invites) => CampaignMembersActions.loadInvites.success({ invites })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't load the invites.");
                        return of(
                            CampaignMembersActions.loadInvites.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly createInvite$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CampaignMembersActions.createInvite.request),
            switchMap(({ campaignSlug }) =>
                this.api.createInvite(campaignSlug).pipe(
                    mergeMap((invite) => [
                        CampaignMembersActions.createInvite.success({ invite }),
                        // Refresh the statuses without waiting for the user to reload the page.
                        CampaignMembersActions.loadInvites.request({ campaignSlug })
                    ]),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't create an invite. Retry.");
                        return of(
                            CampaignMembersActions.createInvite.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly loadInvitePreview$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CampaignMembersActions.loadInvitePreview.request),
            switchMap(({ token }) =>
                this.api.loadInvitePreview(token).pipe(
                    map((preview) => CampaignMembersActions.loadInvitePreview.success({ preview })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "This invite link isn't valid.");
                        return of(
                            CampaignMembersActions.loadInvitePreview.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    /*
     * Accepting an invite refreshes the auth campaign list before navigating. Waiting for the
     * refreshed list keeps `campaignMemberGuard` from seeing a stale membership and bouncing the
     * user back to the picker.
     */
    readonly acceptInvite$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CampaignMembersActions.acceptInvite.request),
            switchMap(({ token }) =>
                this.api.acceptInvite(token).pipe(
                    switchMap(({ campaign }) => {
                        this.store.dispatch(AuthActions.loadCampaigns.request({}));
                        return this.actions$.pipe(
                            ofType(AuthActions.loadCampaigns.success, AuthActions.loadCampaigns.failure),
                            take(1),
                            mergeMap((result) => {
                                if (!('campaigns' in result)) {
                                    return of(
                                        CampaignMembersActions.acceptInvite.failure({
                                            error: result.error,
                                            status: result.status
                                        })
                                    );
                                }

                                void this.router.navigateByUrl(campaignUrl(campaign.slug));
                                return of(CampaignMembersActions.acceptInvite.success({ campaign }));
                            })
                        );
                    }),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't join the campaign. Retry.");
                        return of(
                            CampaignMembersActions.acceptInvite.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly clearOnCampaignChange$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.campaignActivated, AuthActions.logout.success, AuthActions.sessionExpired),
                tap(() => this.store.dispatch(CampaignMembersActions.membersCleared()))
            ),
        { dispatch: false }
    );
}
