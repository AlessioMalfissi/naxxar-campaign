import { CombatLiveEventType } from './combat-live-event-type.enum';
import { IEncounter } from './i-encounter';

export interface ICombatLiveStatusEvent {
    type: CombatLiveEventType.Connected | CombatLiveEventType.Disconnected;
}

export interface ICombatLiveEncounterEvent {
    type: CombatLiveEventType.Encounter;
    encounter: IEncounter;
}

export type CombatLiveEvent = ICombatLiveStatusEvent | ICombatLiveEncounterEvent;
