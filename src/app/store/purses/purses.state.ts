import { ApiCallStatus, IPurse } from '@core/models';

export const PURSES_FEATURE_KEY = 'purses';

export interface IPursesState {
    purses: IPurse[];
    status: ApiCallStatus;
    error: string | null;
}

export const INITIAL_PURSES_STATE: IPursesState = {
    purses: [],
    status: ApiCallStatus.Idle,
    error: null
};
