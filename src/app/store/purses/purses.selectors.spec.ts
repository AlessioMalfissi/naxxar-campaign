import { buildPurse } from '@testing/purse.fixtures';
import { selectGoldByOwner, selectPurses } from './purses.selectors';
import { INITIAL_PURSES_STATE, IPursesState } from './purses.state';

describe('pursesSelectors', () => {
    it('should expose the purse list', () => {
        // Arrange
        const purses = [buildPurse()];
        const state: IPursesState = { ...INITIAL_PURSES_STATE, purses };

        // Act
        const projected = selectPurses.projector(state);

        // Assert
        expect(projected).toEqual(purses);
    });

    it('should index gold by owner', () => {
        // Arrange
        const purses = [buildPurse(), buildPurse({ owner: 'players:tessaly-oakhand', gold: 15 })];

        // Act
        const goldByOwner = selectGoldByOwner.projector(purses);

        // Assert
        expect(goldByOwner).toEqual({ party: 120, 'players:tessaly-oakhand': 15 });
    });
});
