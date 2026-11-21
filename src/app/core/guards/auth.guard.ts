import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, switchMap, take, tap } from 'rxjs';

import { selectAuthChecked, selectAuthenticated, selectCampaigns } from '@store/auth/auth.selectors';
import * as AuthActions from '@store/auth/auth.actions';

const awaitSessionChecked = (store: Store) =>
    store.select(selectAuthChecked).pipe(
        tap((checked) => {
            if (!checked) {
                store.dispatch(AuthActions.checkSession.request({}));
            }
        }),
        filter((checked) => checked),
        take(1)
    );

export const authGuard: CanActivateFn = (_route, state) => {
    const store = inject(Store);
    const router = inject(Router);

    return awaitSessionChecked(store).pipe(
        switchMap(() => store.select(selectAuthenticated).pipe(take(1))),
        map((authenticated) =>
            authenticated ? true : router.parseUrl(`/login?returnUrl=${encodeURIComponent(state.url)}`)
        )
    );
};

export const guestGuard: CanActivateFn = () => {
    const store = inject(Store);
    const router = inject(Router);

    return awaitSessionChecked(store).pipe(
        switchMap(() => store.select(selectAuthenticated).pipe(take(1))),
        map((authenticated) => !authenticated || router.parseUrl('/campaigns'))
    );
};

export const campaignMemberGuard: CanActivateFn = (route) => {
    const store = inject(Store);
    const router = inject(Router);

    return awaitSessionChecked(store).pipe(
        switchMap(() => store.select(selectCampaigns).pipe(take(1))),
        map((campaigns) => {
            const slug = route.paramMap.get('campaignSlug');
            return slug !== null && campaigns.some((campaign) => campaign.slug === slug)
                ? true
                : router.parseUrl('/campaigns');
        })
    );
};
