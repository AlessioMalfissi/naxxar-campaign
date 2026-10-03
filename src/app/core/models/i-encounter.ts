import { CombatantKind } from './combatant-kind.enum';

// The fifteen conditions from the 2024 Player's Handbook, offered as suggestions - custom names are allowed too.
export const COMBAT_CONDITIONS: readonly string[] = [
    'Blinded',
    'Charmed',
    'Deafened',
    'Exhaustion',
    'Frightened',
    'Grappled',
    'Incapacitated',
    'Invisible',
    'Paralyzed',
    'Petrified',
    'Poisoned',
    'Prone',
    'Restrained',
    'Stunned',
    'Unconscious'
];

export interface ICombatCondition {
    name: string;
    // Rounds left, counted down at the end of the affected combatant's turn; null lasts until removed.
    rounds: number | null;
}

export interface ICombatant {
    id: string;
    name: string;
    kind: CombatantKind;
    // `players:<slug>` for a combatant added from the codex, null for a custom enemy.
    entryId: string | null;
    initiative: number;
    hp: number | null;
    maxHp: number | null;
    ac: number | null;
    conditions: ICombatCondition[];
}

export interface ICombatantChanges {
    name?: string;
    initiative?: number;
    hp?: number | null;
    maxHp?: number | null;
    ac?: number | null;
}

export interface IEncounter {
    // 0 while no fight is running.
    round: number;
    // Id of the combatant whose turn it is, null while no fight is running.
    turnId: string | null;
    combatants: ICombatant[];
}
