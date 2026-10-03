import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus, IEncounter } from '@core/models';
import {
    addCombatants,
    addCondition,
    adjustHp,
    advanceTurn,
    endCombat,
    removeCombatant,
    removeCondition,
    revertTurn,
    startCombat,
    updateCombatant,
    updateCondition
} from '@core/utils/combat.util';
import * as CombatActions from './combat.actions';
import { ICombatState, INITIAL_COMBAT_STATE } from './combat.state';

const withEncounter = (state: ICombatState, encounter: IEncounter): ICombatState => ({ ...state, encounter });

export const combatReducer = createReducer<ICombatState>(
    INITIAL_COMBAT_STATE,

    on(CombatActions.loadEncounter.request, (state): ICombatState => ({
        ...state,
        loadStatus: ApiCallStatus.Pending,
        error: null
    })),

    // A load that lands while local edits are still saving would roll them back, so it is ignored.
    on(CombatActions.loadEncounter.success, (state, { encounter }): ICombatState => ({
        ...state,
        encounter: state.pendingSaves > 0 ? state.encounter : encounter,
        loadStatus: ApiCallStatus.Success
    })),

    on(CombatActions.loadEncounter.failure, (state, { error }): ICombatState => ({
        ...state,
        loadStatus: ApiCallStatus.Failed,
        error
    })),

    on(CombatActions.saveEncounter.request, (state): ICombatState => ({
        ...state,
        pendingSaves: state.pendingSaves + 1,
        error: null
    })),

    on(CombatActions.saveEncounter.success, (state): ICombatState => ({
        ...state,
        pendingSaves: Math.max(0, state.pendingSaves - 1)
    })),

    on(CombatActions.saveEncounter.failure, (state, { error }): ICombatState => ({
        ...state,
        pendingSaves: Math.max(0, state.pendingSaves - 1),
        error
    })),

    on(CombatActions.combatantsAdded, (state, { combatants }): ICombatState =>
        withEncounter(state, addCombatants(state.encounter, combatants))
    ),

    on(CombatActions.combatantUpdated, (state, { id, changes }): ICombatState =>
        withEncounter(state, updateCombatant(state.encounter, id, changes))
    ),

    on(CombatActions.combatantRemoved, (state, { id }): ICombatState =>
        withEncounter(state, removeCombatant(state.encounter, id))
    ),

    on(CombatActions.hpAdjusted, (state, { id, delta }): ICombatState =>
        withEncounter(state, adjustHp(state.encounter, id, delta))
    ),

    on(CombatActions.conditionAdded, (state, { id, condition }): ICombatState =>
        withEncounter(state, addCondition(state.encounter, id, condition))
    ),

    on(CombatActions.conditionUpdated, (state, { id, name, condition }): ICombatState =>
        withEncounter(state, updateCondition(state.encounter, id, name, condition))
    ),

    on(CombatActions.conditionRemoved, (state, { id, name }): ICombatState =>
        withEncounter(state, removeCondition(state.encounter, id, name))
    ),

    on(CombatActions.combatStarted, (state): ICombatState => withEncounter(state, startCombat(state.encounter))),

    on(CombatActions.turnAdvanced, (state): ICombatState => withEncounter(state, advanceTurn(state.encounter))),

    on(CombatActions.turnReverted, (state): ICombatState => withEncounter(state, revertTurn(state.encounter))),

    on(CombatActions.combatEnded, (state): ICombatState => withEncounter(state, endCombat(state.encounter)))
);
