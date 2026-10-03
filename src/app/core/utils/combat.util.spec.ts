import { CombatantKind } from '@core/models';
import { buildCombatant, buildEncounter, buildPlayerCombatant } from '@testing/combat.fixtures';
import {
    addCombatants,
    addCondition,
    adjustHp,
    advanceTurn,
    createCombatantId,
    describeHealth,
    EMPTY_ENCOUNTER,
    endCombat,
    removeCombatant,
    removeCondition,
    revertTurn,
    rollD20,
    sortByInitiative,
    startCombat,
    updateCombatant
} from './combat.util';

const ORC = buildCombatant({ id: 'orc', name: 'Orc', initiative: 5 });

describe('combat util', () => {
    describe('sortByInitiative', () => {
        it('should order by initiative, highest first, keeping insertion order on ties', () => {
            // Arrange
            const tiedGoblin = buildCombatant({ id: 'goblin-2', name: 'Goblin 2', initiative: 12 });
            const combatants = [ORC, buildCombatant(), buildPlayerCombatant(), tiedGoblin];

            // Act
            const order = sortByInitiative(combatants).map((combatant) => combatant.id);

            // Assert
            expect(order).toEqual(['tessaly', 'goblin-1', 'goblin-2', 'orc']);
        });
    });

    describe('createCombatantId', () => {
        it('should produce distinct ids', () => {
            // Act
            const first = createCombatantId();
            const second = createCombatantId();

            // Assert
            expect(first === second).toBe(false);
            expect(first.length > 0).toBe(true);
        });

        it('should fall back when randomUUID is unavailable', () => {
            // Arrange
            const original = globalThis.crypto;
            Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

            // Act
            const id = createCombatantId();
            Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });

            // Assert
            expect(id.includes('-')).toBe(true);
        });
    });

    describe('rollD20', () => {
        it('should map the random source onto 1 to 20', () => {
            // Act
            const lowest = rollD20(() => 0);
            const highest = rollD20(() => 0.9999);

            // Assert
            expect(lowest).toBe(1);
            expect(highest).toBe(20);
        });
    });

    describe('startCombat', () => {
        it('should begin round 1 on the highest initiative', () => {
            // Arrange
            const encounter = buildEncounter();

            // Act
            const started = startCombat(encounter);

            // Assert
            expect(started.round).toBe(1);
            expect(started.turnId).toBe('tessaly');
        });

        it('should leave an empty encounter unchanged', () => {
            // Act
            const started = startCombat(EMPTY_ENCOUNTER);

            // Assert
            expect(started === EMPTY_ENCOUNTER).toBe(true);
        });
    });

    describe('advanceTurn', () => {
        it('should hand the turn to the next combatant in the same round', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'tessaly' });

            // Act
            const advanced = advanceTurn(encounter);

            // Assert
            expect(advanced.turnId).toBe('goblin-1');
            expect(advanced.round).toBe(1);
        });

        it('should wrap to the top of the order and start a new round', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'goblin-1' });

            // Act
            const advanced = advanceTurn(encounter);

            // Assert
            expect(advanced.turnId).toBe('tessaly');
            expect(advanced.round).toBe(2);
        });

        it('should start combat when nobody is acting yet', () => {
            // Act
            const advanced = advanceTurn(buildEncounter());

            // Assert
            expect(advanced.round).toBe(1);
            expect(advanced.turnId).toBe('tessaly');
        });

        it('should count down the ending combatant conditions and drop expired ones', () => {
            // Arrange
            const encounter = buildEncounter({
                round: 1,
                turnId: 'tessaly',
                combatants: [
                    buildPlayerCombatant({
                        conditions: [
                            { name: 'Frightened', rounds: 1 },
                            { name: 'Blessed', rounds: 3 },
                            { name: 'Prone', rounds: null }
                        ]
                    }),
                    buildCombatant({ conditions: [{ name: 'Poisoned', rounds: 1 }] })
                ]
            });

            // Act
            const advanced = advanceTurn(encounter);

            // Assert
            expect(advanced.combatants[0].conditions).toEqual([
                { name: 'Blessed', rounds: 2 },
                { name: 'Prone', rounds: null }
            ]);
            expect(advanced.combatants[1].conditions).toEqual([{ name: 'Poisoned', rounds: 1 }]);
        });
    });

    describe('revertTurn', () => {
        it('should step back within the round', () => {
            // Arrange
            const encounter = buildEncounter({ round: 2, turnId: 'goblin-1' });

            // Act
            const reverted = revertTurn(encounter);

            // Assert
            expect(reverted.turnId).toBe('tessaly');
            expect(reverted.round).toBe(2);
        });

        it('should step back into the previous round from the top of the order', () => {
            // Arrange
            const encounter = buildEncounter({ round: 2, turnId: 'tessaly' });

            // Act
            const reverted = revertTurn(encounter);

            // Assert
            expect(reverted.turnId).toBe('goblin-1');
            expect(reverted.round).toBe(1);
        });

        it('should not step back past the first turn of round 1', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'tessaly' });

            // Act
            const reverted = revertTurn(encounter);

            // Assert
            expect(reverted === encounter).toBe(true);
        });

        it('should do nothing while no fight is running', () => {
            // Arrange
            const encounter = buildEncounter();

            // Act
            const reverted = revertTurn(encounter);

            // Assert
            expect(reverted === encounter).toBe(true);
        });
    });

    describe('endCombat', () => {
        it('should reset the round and keep only the party', () => {
            // Arrange
            const encounter = buildEncounter({ round: 4, turnId: 'goblin-1' });

            // Act
            const ended = endCombat(encounter);

            // Assert
            expect(ended.round).toBe(0);
            expect(ended.turnId === null).toBe(true);
            expect(ended.combatants.every((combatant) => combatant.kind === CombatantKind.Player)).toBe(true);
            expect(ended.combatants.length).toBe(1);
        });
    });

    describe('addCombatants', () => {
        it('should append without touching the turn', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'goblin-1' });

            // Act
            const updated = addCombatants(encounter, [ORC]);

            // Assert
            expect(updated.combatants.length).toBe(3);
            expect(updated.turnId).toBe('goblin-1');
        });
    });

    describe('removeCombatant', () => {
        it('should remove an idle combatant and keep the turn', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'tessaly' });

            // Act
            const updated = removeCombatant(encounter, 'goblin-1');

            // Assert
            expect(updated.combatants.length).toBe(1);
            expect(updated.turnId).toBe('tessaly');
        });

        it('should pass the turn on when the acting combatant is removed', () => {
            // Arrange
            const encounter = buildEncounter({
                round: 1,
                turnId: 'tessaly',
                combatants: [buildPlayerCombatant(), buildCombatant(), ORC]
            });

            // Act
            const updated = removeCombatant(encounter, 'tessaly');

            // Assert
            expect(updated.turnId).toBe('goblin-1');
            expect(updated.round).toBe(1);
        });

        it('should wrap into a new round when the last in order is removed on their turn', () => {
            // Arrange
            const encounter = buildEncounter({ round: 1, turnId: 'goblin-1' });

            // Act
            const updated = removeCombatant(encounter, 'goblin-1');

            // Assert
            expect(updated.turnId).toBe('tessaly');
            expect(updated.round).toBe(2);
        });

        it('should reset the encounter when the only combatant is removed', () => {
            // Arrange
            const encounter = buildEncounter({ round: 3, turnId: 'tessaly', combatants: [buildPlayerCombatant()] });

            // Act
            const updated = removeCombatant(encounter, 'tessaly');

            // Assert
            expect(updated).toEqual(EMPTY_ENCOUNTER);
        });
    });

    describe('updateCombatant', () => {
        it('should merge the changes into the matching combatant only', () => {
            // Arrange
            const encounter = buildEncounter();

            // Act
            const updated = updateCombatant(encounter, 'goblin-1', { initiative: 20, ac: null });

            // Assert
            expect(updated.combatants[1].initiative).toBe(20);
            expect(updated.combatants[1].ac === null).toBe(true);
            expect(updated.combatants[0] === encounter.combatants[0]).toBe(true);
        });
    });

    describe('adjustHp', () => {
        it('should floor damage at 0', () => {
            // Act
            const updated = adjustHp(buildEncounter(), 'goblin-1', -50);

            // Assert
            expect(updated.combatants[1].hp).toBe(0);
        });

        it('should cap healing at max HP', () => {
            // Arrange
            const encounter = buildEncounter({ combatants: [buildCombatant({ hp: 3 })] });

            // Act
            const updated = adjustHp(encounter, 'goblin-1', 10);

            // Assert
            expect(updated.combatants[0].hp).toBe(7);
        });

        it('should not lower hit points already above max when healing', () => {
            // Arrange
            const encounter = buildEncounter({ combatants: [buildCombatant({ hp: 12 })] });

            // Act
            const updated = adjustHp(encounter, 'goblin-1', 4);

            // Assert
            expect(updated.combatants[0].hp).toBe(12);
        });

        it('should heal without a cap when max HP is unknown', () => {
            // Arrange
            const encounter = buildEncounter({ combatants: [buildCombatant({ hp: 3, maxHp: null })] });

            // Act
            const updated = adjustHp(encounter, 'goblin-1', 10);

            // Assert
            expect(updated.combatants[0].hp).toBe(13);
        });

        it('should ignore a combatant without tracked hit points', () => {
            // Arrange
            const encounter = buildEncounter({ combatants: [buildCombatant({ hp: null })] });

            // Act
            const updated = adjustHp(encounter, 'goblin-1', -3);

            // Assert
            expect(updated.combatants[0] === encounter.combatants[0]).toBe(true);
        });
    });

    describe('conditions', () => {
        it('should add a condition', () => {
            // Act
            const updated = addCondition(buildEncounter(), 'goblin-1', { name: 'Prone', rounds: null });

            // Assert
            expect(updated.combatants[1].conditions).toEqual([{ name: 'Prone', rounds: null }]);
        });

        it('should replace a condition of the same name, case-insensitively', () => {
            // Arrange
            const encounter = buildEncounter({
                combatants: [buildCombatant({ conditions: [{ name: 'Poisoned', rounds: 1 }] })]
            });

            // Act
            const updated = addCondition(encounter, 'goblin-1', { name: 'poisoned', rounds: 10 });

            // Assert
            expect(updated.combatants[0].conditions).toEqual([{ name: 'poisoned', rounds: 10 }]);
        });

        it('should remove a condition by name', () => {
            // Arrange
            const encounter = buildEncounter({
                combatants: [
                    buildCombatant({
                        conditions: [
                            { name: 'Prone', rounds: null },
                            { name: 'Grappled', rounds: null }
                        ]
                    })
                ]
            });

            // Act
            const updated = removeCondition(encounter, 'goblin-1', 'Prone');

            // Assert
            expect(updated.combatants[0].conditions).toEqual([{ name: 'Grappled', rounds: null }]);
        });
    });

    describe('describeHealth', () => {
        it('should describe each health band', () => {
            // Act
            const untracked = describeHealth(buildCombatant({ hp: null }));
            const down = describeHealth(buildCombatant({ hp: 0 }));
            const bloodied = describeHealth(buildCombatant({ hp: 3 }));
            const healthy = describeHealth(buildCombatant({ hp: 6 }));
            const unknownMax = describeHealth(buildCombatant({ hp: 1, maxHp: null }));

            // Assert
            expect(untracked).toBe('');
            expect(down).toBe('Down');
            expect(bloodied).toBe('Bloodied');
            expect(healthy).toBe('Healthy');
            expect(unknownMax).toBe('Healthy');
        });
    });
});
