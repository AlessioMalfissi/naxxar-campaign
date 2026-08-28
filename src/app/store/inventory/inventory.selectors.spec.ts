import { ApiCallStatus } from '@core/models';
import { buildInventoryItem } from '@testing/inventory.fixtures';
import {
    selectInventoryError,
    selectInventoryItemCount,
    selectInventoryItems,
    selectInventoryLoading,
    selectPartyItems
} from './inventory.selectors';
import { IInventoryState, INITIAL_INVENTORY_STATE } from './inventory.state';

const buildState = (overrides: Partial<IInventoryState> = {}): IInventoryState => ({
    ...INITIAL_INVENTORY_STATE,
    ...overrides
});

describe('inventorySelectors', () => {
    it('should expose the item list and error', () => {
        // Arrange
        const items = [buildInventoryItem()];
        const state = buildState({ items, error: 'offline' });

        // Act
        const projected = {
            items: selectInventoryItems.projector(state),
            error: selectInventoryError.projector(state)
        };

        // Assert
        expect(projected.items).toEqual(items);
        expect(projected.error).toBe('offline');
    });

    it('should report loading while the call is pending', () => {
        // Arrange
        const state = buildState({ itemsStatus: ApiCallStatus.Pending });

        // Act
        const loading = selectInventoryLoading.projector(state);

        // Assert
        expect(loading).toBe(true);
    });

    it('should count the items', () => {
        // Arrange
        const items = [buildInventoryItem(), buildInventoryItem({ id: 'item-2' })];

        // Act
        const count = selectInventoryItemCount.projector(items);

        // Assert
        expect(count).toBe(2);
    });

    it('should filter items owned by the party', () => {
        // Arrange
        const items = [
            buildInventoryItem({ id: 'party-item', owner: 'party' }),
            buildInventoryItem({ id: 'player-item', owner: 'players:tessaly-oakhand' })
        ];

        // Act
        const partyItems = selectPartyItems.projector(items);

        // Assert
        expect(partyItems.length).toBe(1);
        expect(partyItems[0].id).toBe('party-item');
    });
});
