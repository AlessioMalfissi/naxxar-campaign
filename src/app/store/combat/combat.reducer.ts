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

const newest = (held: IEncounter | null, incoming: IEncounter): IEncounter =>
    held !== null && held.revision > incoming.revision ? held : incoming;

/*
 * Takes in a server snapshot, from a load, a save response or the live socket. While saves are in
 * flight the local encounter is ahead of the server, so the snapshot is held back; otherwise it
 * replaces the encounter unless it is older than the one already shown.
 */
const receive = (state: ICombatState, encounter: IEncounter): ICombatState => {
    if (state.pendingSaves > 0) {
        return { ...state, heldEncounter: newest(state.heldEncounter, encounter) };
    }

    return encounter.revision >= state.encounter.revision ? { ...state, encounter, heldEncounter: null } : state;
};

// Once the last save settles, the newest snapshot the server sent meanwhile becomes the encounter.
const settle = (state: ICombatState): ICombatState => {
    if (state.pendingSaves > 0 || state.heldEncounter === null) {
        return state;
    }

    return receive({ ...state, heldEncounter: null }, state.heldEncounter);
};

const releaseSave = (state: ICombatState): number => Math.max(0, state.pendingSaves - 1);

export const combatReducer = createReducer<ICombatState>(
    INITIAL_COMBAT_STATE,

    on(CombatActions.loadEncounter.request, (state): ICombatState => ({
        ...state,
        loadStatus: ApiCallStatus.Pending,
        error: null
    })),

    on(CombatActions.loadEncounter.success, (state, { encounter }): ICombatState => ({
        ...receive(state, encounter),
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

    on(CombatActions.saveEncounter.success, (state, { encounter }): ICombatState =>
        settle({ ...state, pendingSaves: releaseSave(state), heldEncounter: newest(state.heldEncounter, encounter) })
    ),

    // A failed save leaves the local edits unsaved; a newer server snapshot, if one arrived, still wins.
    on(CombatActions.saveEncounter.failure, (state, { error }): ICombatState =>
        settle({ ...state, pendingSaves: releaseSave(state), error })
    ),

    on(CombatActions.encounterReceived, (state, { encounter }): ICombatState => receive(state, encounter)),

    on(CombatActions.liveStatusChanged, (state, { connected }): ICombatState => ({ ...state, live: connected })),

    on(CombatActions.liveSyncStopped, (state): ICombatState => ({ ...state, live: false })),

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
