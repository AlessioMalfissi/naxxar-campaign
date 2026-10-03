import { ApiCallStatus, IEncounter } from '@core/models';
import { EMPTY_ENCOUNTER } from '@core/utils/combat.util';

export const COMBAT_FEATURE_KEY = 'combat';

export interface ICombatState {
    encounter: IEncounter;
    loadStatus: ApiCallStatus;
    // Saves still in flight; while any are, the local encounter is newer than the server's copy.
    pendingSaves: number;
    error: string | null;
}

export const INITIAL_COMBAT_STATE: ICombatState = {
    encounter: EMPTY_ENCOUNTER,
    loadStatus: ApiCallStatus.Idle,
    pendingSaves: 0,
    error: null
};
