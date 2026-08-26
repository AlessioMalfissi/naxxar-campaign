import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import { AUTH_FEATURE_KEY, IAuthState } from './auth.state';

export const selectAuthState = createFeatureSelector<IAuthState>(AUTH_FEATURE_KEY);

export const selectAuthenticated = createSelector(selectAuthState, (state) => state.authenticated);

export const selectAuthChecked = createSelector(selectAuthState, (state) => state.checked);

export const selectAuthError = createSelector(selectAuthState, (state) => state.error);

export const selectAuthPending = createSelector(
    selectAuthState,
    (state) => state.status === ApiCallStatus.Pending
);
