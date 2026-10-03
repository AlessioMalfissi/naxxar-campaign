import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import { sortByInitiative } from '@core/utils/combat.util';
import { COMBAT_FEATURE_KEY, ICombatState } from './combat.state';

export const selectCombatState = createFeatureSelector<ICombatState>(COMBAT_FEATURE_KEY);

export const selectEncounter = createSelector(selectCombatState, (state) => state.encounter);

export const selectTurnOrder = createSelector(selectEncounter, (encounter) =>
    sortByInitiative(encounter.combatants)
);

export const selectCombatRound = createSelector(selectEncounter, (encounter) => encounter.round);

export const selectActiveTurnId = createSelector(selectEncounter, (encounter) => encounter.turnId);

export const selectCombatInProgress = createSelector(selectEncounter, (encounter) => encounter.turnId !== null);

export const selectCombatLoading = createSelector(
    selectCombatState,
    (state) => state.loadStatus === ApiCallStatus.Pending
);

export const selectCombatError = createSelector(selectCombatState, (state) => state.error);
