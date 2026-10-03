import { CombatantKind, ICombatant, IEncounter } from '@core/models';

export const buildCombatant = (overrides: Partial<ICombatant> = {}): ICombatant => ({
    id: 'goblin-1',
    name: 'Goblin 1',
    kind: CombatantKind.Enemy,
    entryId: null,
    initiative: 12,
    initiativeNudge: 0,
    color: null,
    hp: null,
    maxHp: null,
    ac: null,
    conditions: [],
    ...overrides
});

export const buildPlayerCombatant = (overrides: Partial<ICombatant> = {}): ICombatant =>
    buildCombatant({
        id: 'tessaly',
        name: 'Tessaly Oakhand',
        kind: CombatantKind.Player,
        entryId: 'players:tessaly-oakhand',
        initiative: 18,
        hp: 24,
        maxHp: 24,
        ac: 16,
        ...overrides
    });

export const buildEncounter = (overrides: Partial<IEncounter> = {}): IEncounter => ({
    round: 0,
    turnId: null,
    combatants: [buildPlayerCombatant(), buildCombatant()],
    ...overrides
});
