import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { AuthApiService } from '@core/services/auth-api.service';
import * as AuthActions from './auth.actions';

@Injectable()
export class AuthEffects {
    private readonly actions$ = inject(Actions);
    private readonly authApi = inject(AuthApiService);
    private readonly router = inject(Router);

    readonly checkSession$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.checkSession.request),
            switchMap(() =>
                this.authApi.checkSession().pipe(
                    map((authenticated) => AuthActions.checkSession.success({ authenticated })),
                    catchError(() => of(AuthActions.checkSession.success({ authenticated: false })))
                )
            )
        )
    );

    readonly login$ = createEffect(() =>
        this.actions$.pipe(
            ofType(AuthActions.login.request),
            switchMap(({ password }) =>
                this.authApi.login(password).pipe(
                    map(() => AuthActions.login.success({})),
                    catchError((error: Error) => of(AuthActions.login.failure({ error: error.message })))
                )
            )
        )
    );

    readonly loginSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.login.success),
                tap(() => void this.router.navigateByUrl('/campaign'))
            ),
        { dispatch: false }
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

    readonly logoutSuccess$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(AuthActions.logout.success),
                tap(() => void this.router.navigateByUrl('/login'))
            ),
        { dispatch: false }
    );
}
