import { createFeatureSelector, createSelector } from '@ngrx/store';

import { IPursesState, PURSES_FEATURE_KEY } from './purses.state';

export const selectPursesState = createFeatureSelector<IPursesState>(PURSES_FEATURE_KEY);

export const selectPurses = createSelector(selectPursesState, (state) => state.purses);

export const selectGoldByOwner = createSelector(selectPurses, (purses) =>
    purses.reduce<Record<string, number>>((gold, purse) => ({ ...gold, [purse.owner]: purse.gold }), {})
);
