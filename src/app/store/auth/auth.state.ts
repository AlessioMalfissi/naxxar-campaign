import { ApiCallStatus } from '@core/models';

export const AUTH_FEATURE_KEY = 'auth';

export interface IAuthState {
    authenticated: boolean;
    checked: boolean;
    status: ApiCallStatus;
    error: string | null;
}

export const INITIAL_AUTH_STATE: IAuthState = {
    authenticated: false,
    checked: false,
    status: ApiCallStatus.Idle,
    error: null
};
