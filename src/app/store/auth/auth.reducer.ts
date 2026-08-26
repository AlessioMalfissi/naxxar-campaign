import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import * as AuthActions from './auth.actions';
import { IAuthState, INITIAL_AUTH_STATE } from './auth.state';

export const authReducer = createReducer<IAuthState>(
    INITIAL_AUTH_STATE,

    on(AuthActions.checkSession.request, (state): IAuthState => ({
        ...state,
        status: ApiCallStatus.Pending
    })),

    on(AuthActions.checkSession.success, (state, { authenticated }): IAuthState => ({
        ...state,
        authenticated,
        checked: true,
        status: ApiCallStatus.Success
    })),

    on(AuthActions.login.request, (state): IAuthState => ({
        ...state,
        status: ApiCallStatus.Pending,
        error: null
    })),

    on(AuthActions.login.success, (state): IAuthState => ({
        ...state,
        authenticated: true,
        checked: true,
        status: ApiCallStatus.Success,
        error: null
    })),

    on(AuthActions.login.failure, (state, { error }): IAuthState => ({
        ...state,
        authenticated: false,
        checked: true,
        status: ApiCallStatus.Failed,
        error
    })),

    on(AuthActions.logout.success, (): IAuthState => ({
        ...INITIAL_AUTH_STATE,
        checked: true
    }))
);
