import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, switchMap, tap } from 'rxjs';

import { toApiError } from '@core/errors/api-error';
import { AuthApiService } from '@core/services/auth-api.service';
import { CampaignApiService } from '@core/services/campaign-api.service';
import * as AuthActions from './auth.actions';

const isInternalUrl = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');

const campaignUrl = (slug: string): string => `/campaigns/${encodeURIComponent(slug)}/npcs`;

@Injectable()
export class AuthEffects {
    private readonly actions$ = inject(Actions);
    private readonly store = inject(Store);
    private readonly authApi = inject(AuthApiService);
    private readonly campaignApi = inject(CampaignApiService);
    private readonly router = inject(Router);

    readonly checkSession$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.checkSession.request),
            switchMap(() =>
                this.authApi.checkSession().pipe(
                    map(({ user, campaigns }) => AuthActions.checkSession.success({ user, campaigns })),
                    // `/me` always answers 200; a transport failure is treated like a signed-out visit
                    // so the app can still render the login screen.
                    catchError(() => of(AuthActions.checkSession.success({ user: null, campaigns: [] })))
                )
            )
        )
    );

    readonly login$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.login.request),
            switchMap(({ email, password }) =>
                this.authApi.login(email, password).pipe(
                    map(({ user, campaigns }) => AuthActions.login.success({ user, campaigns })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, 'Incorrect email or password.');
                        return of(AuthActions.login.failure({ error: apiError.message, status: apiError.status }));
                    })
                )
            )
        )
    );

    readonly googleLogin$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.googleLogin.request),
            switchMap(({ credential }) =>
                this.authApi.googleLogin(credential).pipe(
                    map(({ user, campaigns }) => AuthActions.googleLogin.success({ user, campaigns })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, 'Google sign-in failed.');
                        return of(
                            AuthActions.googleLogin.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    readonly registerViaInvite$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.registerViaInvite.request),
            switchMap(({ token, displayName, email, password }) =>
                this.authApi.registerWithInvite(token, { displayName, email, password }).pipe(
                    map((response) => AuthActions.registerViaInvite.success(response)),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't create your account. Retry.");
                        return of(
                            AuthActions.registerViaInvite.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly googleRegisterViaInvite$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.googleRegisterViaInvite.request),
            switchMap(({ token, credential, displayName }) =>
                this.authApi.registerWithGoogleInvite(token, { credential, displayName }).pipe(
                    map((response) => AuthActions.googleRegisterViaInvite.success(response)),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't create your account with Google.");
                        return of(
                            AuthActions.googleRegisterViaInvite.failure({
                                error: apiError.message,
                                status: apiError.status
                            })
                        );
                    })
                )
            )
        )
    );

    readonly logout$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.logout.request),
            switchMap(() =>
                this.authApi.logout().pipe(
                    map(() => AuthActions.logout.success({})),
                    catchError(() => of(AuthActions.logout.success({})))
                )
            )
        )
    );

    readonly loadConfig$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.loadConfig.request),
            switchMap(() =>
                this.authApi.loadConfig().pipe(
                    map((config) => AuthActions.loadConfig.success({ config })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't load the app configuration.");
                        return of(
                            AuthActions.loadConfig.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    readonly loadCampaigns$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.loadCampaigns.request),
            switchMap(() =>
                this.campaignApi.loadCampaigns().pipe(
                    map((campaigns) => AuthActions.loadCampaigns.success({ campaigns })),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't load your campaigns.");
                        return of(
                            AuthActions.loadCampaigns.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    readonly createCampaign$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.createCampaign.request),
            switchMap(({ name }) =>
                this.campaignApi.createCampaign(name).pipe(
                    mergeMap((campaign) => [
                        AuthActions.createCampaign.success({ campaign }),
                        AuthActions.campaignActivated({ slug: campaign.slug })
                    ]),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't create the campaign. Retry.");
                        return of(
                            AuthActions.createCampaign.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    readonly forgotPassword$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.forgotPassword.request),
            switchMap(({ email }) =>
                this.authApi.forgotPassword(email).pipe(
                    map(() => AuthActions.forgotPassword.success({})),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, "Couldn't send the reset email. Retry.");
                        return of(
                            AuthActions.forgotPassword.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    readonly resetPassword$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.resetPassword.request),
            switchMap(({ token, password }) =>
                this.authApi.resetPassword(token, password).pipe(
                    map(() => AuthActions.resetPassword.success({})),
                    catchError((error: unknown) => {
                        const apiError = toApiError(error, 'This reset link is invalid or has expired.');
                        return of(
                            AuthActions.resetPassword.failure({ error: apiError.message, status: apiError.status })
                        );
                    })
                )
            )
        )
    );

    // Password or Google sign-in: returnUrl wins, then a single campaign, then the picker.
    readonly loginSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.login.success, AuthActions.googleLogin.success),
                tap(({ campaigns }) => {
                    const returnUrl = this.router.parseUrl(this.router.url).queryParams['returnUrl'];
                    void this.router.navigateByUrl(
                        isInternalUrl(returnUrl)
                            ? returnUrl
                            : campaigns.length === 1
                              ? campaignUrl(campaigns[0].slug)
                              : '/campaigns'
                    );
                })
            ),
        { dispatch: false }
    );

    // Registration through an invite always lands in the campaign that was just joined.
    readonly inviteRegistrationSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.registerViaInvite.success, AuthActions.googleRegisterViaInvite.success),
                tap(({ campaign }) => void this.router.navigateByUrl(campaignUrl(campaign.slug)))
            ),
        { dispatch: false }
    );

    readonly createCampaignSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.createCampaign.success),
                tap(({ campaign }) => void this.router.navigateByUrl(campaignUrl(campaign.slug)))
            ),
        { dispatch: false }
    );

    readonly logoutSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.logout.success),
                tap(() => void this.router.navigateByUrl('/login'))
            ),
        { dispatch: false }
    );

    readonly resetPasswordSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.resetPassword.success),
                tap(() => void this.router.navigateByUrl('/login?reset=1'))
            ),
        { dispatch: false }
    );
}
