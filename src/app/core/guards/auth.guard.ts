import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take, tap, withLatestFrom } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthChecked, selectAuthenticated } from '@store/auth/auth.selectors';

const awaitSessionChecked = (store: Store) =>
    store.select(selectAuthChecked).pipe(
        tap((checked) => {
            if (!checked) {
                store.dispatch(AuthActions.checkSession.request({}));
            }
        }),
        filter((checked) => checked),
        take(1),
        withLatestFrom(store.select(selectAuthenticated)),
        map(([, authenticated]) => authenticated)
    );

export const authGuard: CanActivateFn = () => {
    const store = inject(Store);
    const router = inject(Router);

    return awaitSessionChecked(store).pipe(map((authenticated) => authenticated || router.parseUrl('/login')));
};

export const guestGuard: CanActivateFn = () => {
    const store = inject(Store);
    const router = inject(Router);

    return awaitSessionChecked(store).pipe(map((authenticated) => !authenticated || router.parseUrl('/campaign')));
};
