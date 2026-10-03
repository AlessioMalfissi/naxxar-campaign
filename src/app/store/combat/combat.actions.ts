import { createAction, props } from '@ngrx/store';

import { ICombatant, ICombatantChanges, ICombatCondition, IEncounter } from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Combat';

export const loadEncounter = createApiAction<Record<string, never>, { encounter: IEncounter }>(
    SOURCE,
    'load encounter'
);

export const saveEncounter = createApiAction<{ encounter: IEncounter }, { encounter: IEncounter }>(
    SOURCE,
    'save encounter'
);

export const combatantsAdded = createAction(`[${SOURCE}] combatants added`, props<{ combatants: ICombatant[] }>());

export const combatantUpdated = createAction(
    `[${SOURCE}] combatant updated`,
    props<{ id: string; changes: ICombatantChanges }>()
);

export const combatantRemoved = createAction(`[${SOURCE}] combatant removed`, props<{ id: string }>());

export const hpAdjusted = createAction(`[${SOURCE}] hp adjusted`, props<{ id: string; delta: number }>());

export const conditionAdded = createAction(
    `[${SOURCE}] condition added`,
    props<{ id: string; condition: ICombatCondition }>()
);

// `name` is the condition's name before the edit, so a rename still finds it.
export const conditionUpdated = createAction(
    `[${SOURCE}] condition updated`,
    props<{ id: string; name: string; condition: ICombatCondition }>()
);

export const conditionRemoved = createAction(`[${SOURCE}] condition removed`, props<{ id: string; name: string }>());

export const combatStarted = createAction(`[${SOURCE}] combat started`);

export const turnAdvanced = createAction(`[${SOURCE}] turn advanced`);

export const turnReverted = createAction(`[${SOURCE}] turn reverted`);

export const combatEnded = createAction(`[${SOURCE}] combat ended`);

// Every action that changes the encounter locally and must then be persisted.
export const ENCOUNTER_MUTATIONS = [
    combatantsAdded,
    combatantUpdated,
    combatantRemoved,
    hpAdjusted,
    conditionAdded,
    conditionUpdated,
    conditionRemoved,
    combatStarted,
    turnAdvanced,
    turnReverted,
    combatEnded
] as const;
