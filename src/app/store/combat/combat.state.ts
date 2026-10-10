import { ApiCallStatus, IEncounter } from '@core/models';
import { EMPTY_ENCOUNTER } from '@core/utils/combat.util';

export const COMBAT_FEATURE_KEY = 'combat';

export interface ICombatState {
    encounter: IEncounter;
    loadStatus: ApiCallStatus;
    // Saves still in flight; while any are, the local encounter is newer than the server's copy.
    pendingSaves: number;
    // Newest server snapshot received while saves were in flight; adopted once they settle.
    heldEncounter: IEncounter | null;
    // Whether the live socket is currently connected.
    live: boolean;
    error: string | null;
}

export const INITIAL_COMBAT_STATE: ICombatState = {
    encounter: EMPTY_ENCOUNTER,
    loadStatus: ApiCallStatus.Idle,
    pendingSaves: 0,
    heldEncounter: null,
    live: false,
    error: null
};
