import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';

import * as AuthActions from '@store/auth/auth.actions';

const AUTH_URL_PREFIX = '/api/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const store = inject(Store);
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.startsWith(AUTH_URL_PREFIX)) {
                store.dispatch(AuthActions.checkSession.success({ authenticated: false }));
                void router.navigateByUrl('/login');
            }

            return throwError(() => error);
        })
    );
};
