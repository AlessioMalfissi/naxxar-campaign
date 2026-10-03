import { ApiCallStatus } from '@core/models';
import { buildCombatant, buildEncounter } from '@testing/combat.fixtures';
import * as CombatActions from './combat.actions';
import { combatReducer } from './combat.reducer';
import { ICombatState, INITIAL_COMBAT_STATE } from './combat.state';

const withEncounter = (overrides: Partial<ICombatState> = {}): ICombatState => ({
    ...INITIAL_COMBAT_STATE,
    encounter: buildEncounter(),
    ...overrides
});

describe('combatReducer', () => {
    it('should mark the encounter as loading on request', () => {
        // Act
        const state = combatReducer(INITIAL_COMBAT_STATE, CombatActions.loadEncounter.request({}));

        // Assert
        expect(state.loadStatus).toBe(ApiCallStatus.Pending);
        expect(state.error === null).toBe(true);
    });

    it('should store the loaded encounter', () => {
        // Arrange
        const encounter = buildEncounter({ round: 3 });

        // Act
        const state = combatReducer(INITIAL_COMBAT_STATE, CombatActions.loadEncounter.success({ encounter }));

        // Assert
        expect(state.encounter).toEqual(encounter);
        expect(state.loadStatus).toBe(ApiCallStatus.Success);
    });

    it('should keep local edits when a load lands while a save is still pending', () => {
        // Arrange
        const local = withEncounter({ pendingSaves: 1 });

        // Act
        const state = combatReducer(
            local,
            CombatActions.loadEncounter.success({ encounter: buildEncounter({ combatants: [] }) })
        );

        // Assert
        expect(state.encounter === local.encounter).toBe(true);
    });

    it('should record the error when loading fails', () => {
        // Act
        const state = combatReducer(INITIAL_COMBAT_STATE, CombatActions.loadEncounter.failure({ error: 'offline' }));

        // Assert
        expect(state.loadStatus).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('offline');
    });

    it('should count saves in flight', () => {
        // Arrange
        const encounter = buildEncounter();

        // Act
        const requested = combatReducer(INITIAL_COMBAT_STATE, CombatActions.saveEncounter.request({ encounter }));
        const twice = combatReducer(requested, CombatActions.saveEncounter.request({ encounter }));
        const saved = combatReducer(twice, CombatActions.saveEncounter.success({ encounter }));

        // Assert
        expect(twice.pendingSaves).toBe(2);
        expect(saved.pendingSaves).toBe(1);
    });

    it('should record a save failure and release its pending slot', () => {
        // Arrange
        const pending = withEncounter({ pendingSaves: 1 });

        // Act
        const state = combatReducer(pending, CombatActions.saveEncounter.failure({ error: 'invalid' }));

        // Assert
        expect(state.pendingSaves).toBe(0);
        expect(state.error).toBe('invalid');
    });

    it('should not let the pending count drop below zero', () => {
        // Arrange
        const encounter = buildEncounter();

        // Act
        const state = combatReducer(INITIAL_COMBAT_STATE, CombatActions.saveEncounter.success({ encounter }));

        // Assert
        expect(state.pendingSaves).toBe(0);
    });

    it('should add combatants', () => {
        // Arrange
        const orc = buildCombatant({ id: 'orc', name: 'Orc' });

        // Act
        const state = combatReducer(withEncounter(), CombatActions.combatantsAdded({ combatants: [orc] }));

        // Assert
        expect(state.encounter.combatants.length).toBe(3);
    });

    it('should update a combatant', () => {
        // Act
        const state = combatReducer(
            withEncounter(),
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { initiative: 25 } })
        );

        // Assert
        expect(state.encounter.combatants[1].initiative).toBe(25);
    });

    it('should remove a combatant', () => {
        // Act
        const state = combatReducer(withEncounter(), CombatActions.combatantRemoved({ id: 'goblin-1' }));

        // Assert
        expect(state.encounter.combatants.length).toBe(1);
    });

    it('should adjust hit points', () => {
        // Act
        const state = combatReducer(withEncounter(), CombatActions.hpAdjusted({ id: 'tessaly', delta: -4 }));

        // Assert
        expect(state.encounter.combatants[0].hp).toBe(20);
    });

    it('should add and remove conditions', () => {
        // Arrange
        const condition = { name: 'Prone', rounds: null };

        // Act
        const added = combatReducer(withEncounter(), CombatActions.conditionAdded({ id: 'goblin-1', condition }));
        const removed = combatReducer(added, CombatActions.conditionRemoved({ id: 'goblin-1', name: 'Prone' }));

        // Assert
        expect(added.encounter.combatants[1].conditions).toEqual([condition]);
        expect(removed.encounter.combatants[1].conditions).toEqual([]);
    });

    it('should start, advance, revert and end combat', () => {
        // Act
        const started = combatReducer(withEncounter(), CombatActions.combatStarted());
        const advanced = combatReducer(started, CombatActions.turnAdvanced());
        const reverted = combatReducer(advanced, CombatActions.turnReverted());
        const ended = combatReducer(reverted, CombatActions.combatEnded());

        // Assert
        expect(started.encounter.turnId).toBe('tessaly');
        expect(advanced.encounter.turnId).toBe('goblin-1');
        expect(reverted.encounter.turnId).toBe('tessaly');
        expect(ended.encounter.round).toBe(0);
        expect(ended.encounter.combatants.length).toBe(1);
    });

    it('should not mutate the previous state', () => {
        // Arrange
        const previous = withEncounter();

        // Act
        const state = combatReducer(previous, CombatActions.combatantRemoved({ id: 'goblin-1' }));

        // Assert
        expect(state === previous).toBe(false);
        expect(previous.encounter.combatants.length).toBe(2);
    });
});
