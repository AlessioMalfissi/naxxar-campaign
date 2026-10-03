import { ApiCallStatus } from '@core/models';
import { buildEncounter } from '@testing/combat.fixtures';
import {
    selectActiveTurnId,
    selectCombatError,
    selectCombatInProgress,
    selectCombatLoading,
    selectCombatRound,
    selectEncounter,
    selectTurnOrder
} from './combat.selectors';
import { ICombatState, INITIAL_COMBAT_STATE } from './combat.state';

describe('combatSelectors', () => {
    it('should expose the encounter', () => {
        // Arrange
        const encounter = buildEncounter();
        const state: ICombatState = { ...INITIAL_COMBAT_STATE, encounter };

        // Act
        const projected = selectEncounter.projector(state);

        // Assert
        expect(projected === encounter).toBe(true);
    });

    it('should list combatants in initiative order', () => {
        // Arrange
        const encounter = buildEncounter();
        const reversed = { ...encounter, combatants: encounter.combatants.toReversed() };

        // Act
        const order = selectTurnOrder.projector(reversed);

        // Assert
        expect(order.map((combatant) => combatant.id)).toEqual(['tessaly', 'goblin-1']);
    });

    it('should expose the round, the acting combatant and whether combat is running', () => {
        // Arrange
        const encounter = buildEncounter({ round: 2, turnId: 'goblin-1' });

        // Act
        const round = selectCombatRound.projector(encounter);
        const turnId = selectActiveTurnId.projector(encounter);
        const inProgress = selectCombatInProgress.projector(encounter);
        const idle = selectCombatInProgress.projector(buildEncounter());

        // Assert
        expect(round).toBe(2);
        expect(turnId).toBe('goblin-1');
        expect(inProgress).toBe(true);
        expect(idle).toBe(false);
    });

    it('should report loading only while a load is pending', () => {
        // Arrange
        const pending: ICombatState = { ...INITIAL_COMBAT_STATE, loadStatus: ApiCallStatus.Pending };

        // Act
        const loading = selectCombatLoading.projector(pending);
        const idle = selectCombatLoading.projector(INITIAL_COMBAT_STATE);

        // Assert
        expect(loading).toBe(true);
        expect(idle).toBe(false);
    });

    it('should expose the error', () => {
        // Arrange
        const state: ICombatState = { ...INITIAL_COMBAT_STATE, error: 'offline' };

        // Act
        const error = selectCombatError.projector(state);

        // Assert
        expect(error).toBe('offline');
    });
});
