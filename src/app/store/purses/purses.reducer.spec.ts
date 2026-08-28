import { ApiCallStatus } from '@core/models';
import { buildPurse } from '@testing/purse.fixtures';
import * as PursesActions from './purses.actions';
import { pursesReducer } from './purses.reducer';
import { INITIAL_PURSES_STATE } from './purses.state';

describe('pursesReducer', () => {
    it('should mark purses as pending on request', () => {
        // Arrange
        const action = PursesActions.loadPurses.request({});

        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, action);

        // Assert
        expect(state.status).toBe(ApiCallStatus.Pending);
        expect(state.error === null).toBe(true);
    });

    it('should store purses on load success', () => {
        // Arrange
        const purses = [buildPurse()];
        const action = PursesActions.loadPurses.success({ purses });

        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, action);

        // Assert
        expect(state.purses).toEqual(purses);
        expect(state.status).toBe(ApiCallStatus.Success);
    });

    it('should record the error when loading fails', () => {
        // Arrange
        const action = PursesActions.loadPurses.failure({ error: 'offline' });

        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, action);

        // Assert
        expect(state.status).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('offline');
    });

    it('should replace an existing purse on update success', () => {
        // Arrange
        const seeded = pursesReducer(INITIAL_PURSES_STATE, PursesActions.loadPurses.success({ purses: [buildPurse()] }));
        const updated = buildPurse({ gold: 999 });

        // Act
        const state = pursesReducer(seeded, PursesActions.updateGold.success({ purse: updated }));

        // Assert
        expect(state.purses.length).toBe(1);
        expect(state.purses[0].gold).toBe(999);
    });

    it('should append a new purse on update success when the owner had none yet', () => {
        // Arrange
        const created = buildPurse({ owner: 'players:tessaly-oakhand', gold: 15 });

        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, PursesActions.updateGold.success({ purse: created }));

        // Assert
        expect(state.purses).toEqual([created]);
    });

    it('should record the error when updating fails', () => {
        // Arrange
        const action = PursesActions.updateGold.failure({ error: 'locked' });

        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, action);

        // Assert
        expect(state.error).toBe('locked');
    });

    it('should not mutate the previous state', () => {
        // Act
        const state = pursesReducer(INITIAL_PURSES_STATE, PursesActions.loadPurses.request({}));

        // Assert
        expect(state === INITIAL_PURSES_STATE).toBe(false);
        expect(INITIAL_PURSES_STATE.status).toBe(ApiCallStatus.Idle);
    });
});
