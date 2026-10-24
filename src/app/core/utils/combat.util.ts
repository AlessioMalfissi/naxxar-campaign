import {
    CombatantKind,
    DEFAULT_COMBATANT_COLORS,
    ICombatant,
    ICombatantChanges,
    ICombatCondition,
    IEncounter
} from '../models';

const D20_SIDES = 20;

export const EMPTY_ENCOUNTER: IEncounter = { revision: 0, round: 0, turnId: null, combatants: [] };

/*
 * Highest initiative acts first, then the highest nudge among equal initiatives. toSorted is stable,
 * so remaining ties keep the order the combatants were added in.
 */
export const sortByInitiative = (combatants: ICombatant[]): ICombatant[] =>
    combatants.toSorted((a, b) => b.initiative - a.initiative || b.initiativeNudge - a.initiativeNudge);

// Alphabetical, ignoring case.
export const sortConditions = (conditions: ICombatCondition[]): ICombatCondition[] =>
    conditions.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

export const colorOf = (combatant: ICombatant): string => combatant.color ?? DEFAULT_COMBATANT_COLORS[combatant.kind];

let fallbackIdCounter = 0;

// randomUUID needs a secure context; the fallback's counter keeps ids made in one tick distinct.
export const createCombatantId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    fallbackIdCounter += 1;
    return `${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const rollD20 = (random: () => number = Math.random): number => Math.floor(random() * D20_SIDES) + 1;

const tickConditions = (combatant: ICombatant): ICombatant => ({
    ...combatant,
    conditions: combatant.conditions
        .map((condition) => (condition.rounds === null ? condition : { ...condition, rounds: condition.rounds - 1 }))
        .filter((condition) => condition.rounds === null || condition.rounds > 0)
});

const updateById = (encounter: IEncounter, id: string, update: (combatant: ICombatant) => ICombatant): IEncounter => ({
    ...encounter,
    combatants: encounter.combatants.map((combatant) => (combatant.id === id ? update(combatant) : combatant))
});

export const startCombat = (encounter: IEncounter): IEncounter => {
    const [first] = sortByInitiative(encounter.combatants).filter((combatant) => !combatant.dead);
    return first === undefined ? encounter : { ...encounter, round: 1, turnId: first.id };
};

export const hasLivingCombatant = (combatants: ICombatant[]): boolean =>
    combatants.some((combatant) => !combatant.dead);

interface ITurnStep {
    index: number;
    // True when the step passed the end of the order (forwards) or the start of it (backwards).
    wrapped: boolean;
}

/*
 * Steps from `index` one place at a time in `direction`, returning the first living combatant reached within
 * `steps` places, or null when none is. Dead combatants are passed over, so they never take a turn.
 */
const stepTurn = (order: ICombatant[], index: number, direction: 1 | -1, steps = order.length): ITurnStep | null => {
    const count = order.length;
    for (let k = 1; k <= steps; k++) {
        const raw = index + direction * k;
        const next = ((raw % count) + count) % count;
        if (!order[next].dead) {
            return { index: next, wrapped: raw < 0 || raw >= count };
        }
    }

    return null;
};

export const advanceTurn = (encounter: IEncounter): IEncounter => {
    const order = sortByInitiative(encounter.combatants);
    const index = order.findIndex((combatant) => combatant.id === encounter.turnId);
    if (index === -1) {
        return startCombat(encounter);
    }

    const step = stepTurn(order, index, 1);
    if (step === null) {
        return encounter;
    }

    // A dead combatant has no turn to finish, so its conditions do not tick.
    const ticked = order[index].dead ? encounter : updateById(encounter, order[index].id, tickConditions);
    return {
        ...ticked,
        round: step.wrapped ? encounter.round + 1 : encounter.round,
        turnId: order[step.index].id
    };
};

// Steps the pointer back only - condition durations that ticked down are not restored.
export const revertTurn = (encounter: IEncounter): IEncounter => {
    const order = sortByInitiative(encounter.combatants);
    const index = order.findIndex((combatant) => combatant.id === encounter.turnId);
    if (index === -1) {
        return encounter;
    }

    const step = stepTurn(order, index, -1);
    if (step === null || (step.wrapped && encounter.round <= 1)) {
        return encounter;
    }

    return {
        ...encounter,
        round: step.wrapped ? encounter.round - 1 : encounter.round,
        turnId: order[step.index].id
    };
};

export const canRevertTurn = (encounter: IEncounter): boolean => revertTurn(encounter) !== encounter;

// Ends the fight: enemies leave the tracker, the party stays with its current hit points and conditions.
export const endCombat = (encounter: IEncounter): IEncounter => ({
    ...encounter,
    round: 0,
    turnId: null,
    combatants: encounter.combatants.filter((combatant) => combatant.kind === CombatantKind.Player)
});

export const addCombatants = (encounter: IEncounter, combatants: ICombatant[]): IEncounter => ({
    ...encounter,
    combatants: [...encounter.combatants, ...combatants]
});

// Removing whoever is acting hands the turn to the next combatant in order.
export const removeCombatant = (encounter: IEncounter, id: string): IEncounter => {
    const remaining = encounter.combatants.filter((combatant) => combatant.id !== id);
    if (encounter.turnId !== id) {
        return { ...encounter, combatants: remaining };
    }
    if (remaining.length === 0) {
        return { ...EMPTY_ENCOUNTER, revision: encounter.revision };
    }

    const order = sortByInitiative(encounter.combatants);
    const index = order.findIndex((combatant) => combatant.id === id);
    // Steps over the other combatants only, so the removed one is never picked. With nobody else living, the turn
    // falls to the next seat, which the turn invariant allows only when every combatant is dead.
    const step = stepTurn(order, index, 1, order.length - 1) ?? {
        index: (index + 1) % order.length,
        wrapped: index === order.length - 1
    };
    return {
        ...encounter,
        round: step.wrapped ? encounter.round + 1 : encounter.round,
        turnId: order[step.index].id,
        combatants: remaining
    };
};

export const updateCombatant = (encounter: IEncounter, id: string, changes: ICombatantChanges): IEncounter =>
    updateById(encounter, id, (combatant) => ({ ...combatant, ...changes }));

/*
 * Marking the acting combatant dead hands the turn on without ticking their conditions; the dead combatant stays in
 * the list. Reviving someone only changes the flag, so they rejoin the cycle in initiative order.
 */
export const setCombatantDead = (encounter: IEncounter, id: string, dead: boolean): IEncounter => {
    if (!encounter.combatants.some((combatant) => combatant.id === id)) {
        return encounter;
    }

    const updated = updateById(encounter, id, (combatant) => ({ ...combatant, dead }));
    if (!dead || encounter.turnId !== id || !hasLivingCombatant(updated.combatants.filter((c) => c.id !== id))) {
        return updated;
    }

    const order = sortByInitiative(updated.combatants);
    const step = stepTurn(
        order,
        order.findIndex((combatant) => combatant.id === id),
        1
    );
    if (step === null) {
        return updated;
    }

    return {
        ...updated,
        round: step.wrapped ? encounter.round + 1 : encounter.round,
        turnId: order[step.index].id
    };
};

/*
 * Damage floors at 0. Healing stops at max HP, but never lowers a total the DM deliberately set
 * above it (temporary hit points).
 */
export const adjustHp = (encounter: IEncounter, id: string, delta: number): IEncounter =>
    updateById(encounter, id, (combatant) => {
        if (combatant.hp === null) {
            return combatant;
        }

        const raw = Math.max(0, combatant.hp + delta);
        const ceiling = combatant.maxHp === null ? raw : Math.max(combatant.maxHp, combatant.hp);
        return { ...combatant, hp: delta > 0 ? Math.min(raw, ceiling) : raw };
    });

const isSameCondition = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

// Re-applying a condition the combatant already has replaces it, so its duration resets.
export const addCondition = (encounter: IEncounter, id: string, condition: ICombatCondition): IEncounter =>
    updateById(encounter, id, (combatant) => ({
        ...combatant,
        conditions: sortConditions([
            ...combatant.conditions.filter((existing) => !isSameCondition(existing.name, condition.name)),
            condition
        ])
    }));

// Replaces the condition called `name`; renaming onto another condition the combatant has merges the two.
export const updateCondition = (
    encounter: IEncounter,
    id: string,
    name: string,
    condition: ICombatCondition
): IEncounter =>
    updateById(encounter, id, (combatant) => ({
        ...combatant,
        conditions: sortConditions([
            ...combatant.conditions.filter(
                (existing) => existing.name !== name && !isSameCondition(existing.name, condition.name)
            ),
            condition
        ])
    }));

export const removeCondition = (encounter: IEncounter, id: string, name: string): IEncounter =>
    updateById(encounter, id, (combatant) => ({
        ...combatant,
        conditions: combatant.conditions.filter((condition) => condition.name !== name)
    }));

export const describeHealth = (combatant: ICombatant): string => {
    if (combatant.hp === null) {
        return '';
    }
    if (combatant.hp === 0) {
        return 'Down';
    }
    if (combatant.maxHp !== null && combatant.hp <= combatant.maxHp / 2) {
        return 'Bloodied';
    }
    return 'Healthy';
};
