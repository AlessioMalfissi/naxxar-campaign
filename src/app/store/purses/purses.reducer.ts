import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import * as PursesActions from './purses.actions';
import { INITIAL_PURSES_STATE, IPursesState } from './purses.state';

export const pursesReducer = createReducer<IPursesState>(
    INITIAL_PURSES_STATE,

    on(PursesActions.loadPurses.request, (state): IPursesState => ({
        ...state,
        status: ApiCallStatus.Pending,
        error: null
    })),

    on(PursesActions.loadPurses.success, (state, { purses }): IPursesState => ({
        ...state,
        purses,
        status: ApiCallStatus.Success
    })),

    on(PursesActions.loadPurses.failure, (state, { error }): IPursesState => ({
        ...state,
        status: ApiCallStatus.Failed,
        error
    })),

    on(PursesActions.updateGold.success, (state, { purse }): IPursesState => ({
        ...state,
        purses: state.purses.some((existing) => existing.owner === purse.owner)
            ? state.purses.map((existing) => (existing.owner === purse.owner ? purse : existing))
            : [...state.purses, purse]
    })),

    on(PursesActions.updateGold.failure, (state, { error }): IPursesState => ({ ...state, error }))
);
