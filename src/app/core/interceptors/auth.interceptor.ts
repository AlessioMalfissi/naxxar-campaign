import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';

// Invite registration is authorized by the invite token, so a 401 there is a bad/expired invite,
// not an expired session. Keep it out of the global handler as well.
const PUBLIC_INVITE_PATTERN = /^\/api\/invites\/[^/]+\/(register|google)(?:[?#]|$)/;

const isAuthUrl = (url: string): boolean => url.startsWith('/api/auth') || PUBLIC_INVITE_PATTERN.test(url);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const store = inject(Store);

    return next(req).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthUrl(req.url)) {
                store.dispatch(AuthActions.sessionExpired());
            }

            return throwError(() => error);
        })
    );
};
