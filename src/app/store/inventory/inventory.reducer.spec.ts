import { ApiCallStatus } from '@core/models';
import { buildInventoryItem } from '@testing/inventory.fixtures';
import * as InventoryActions from './inventory.actions';
import { inventoryReducer } from './inventory.reducer';
import { INITIAL_INVENTORY_STATE } from './inventory.state';

describe('inventoryReducer', () => {
    it('should mark items as pending on request', () => {
        // Arrange
        const action = InventoryActions.loadItems.request({});

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.itemsStatus).toBe(ApiCallStatus.Pending);
        expect(state.error === null).toBe(true);
    });

    it('should store items on load success', () => {
        // Arrange
        const items = [buildInventoryItem()];
        const action = InventoryActions.loadItems.success({ items });

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.items).toEqual(items);
        expect(state.itemsStatus).toBe(ApiCallStatus.Success);
    });

    it('should record the error when loading fails', () => {
        // Arrange
        const action = InventoryActions.loadItems.failure({ error: 'offline' });

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.itemsStatus).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('offline');
    });

    it('should insert a created item sorted by name', () => {
        // Arrange
        const seeded = inventoryReducer(
            INITIAL_INVENTORY_STATE,
            InventoryActions.loadItems.success({ items: [buildInventoryItem({ id: 'zzz', name: 'Zweihander' })] })
        );
        const created = buildInventoryItem({ id: 'aaa', name: 'Antitoxin' });

        // Act
        const state = inventoryReducer(seeded, InventoryActions.createItem.success({ item: created }));

        // Assert
        expect(state.items.map((item) => item.id)).toEqual(['aaa', 'zzz']);
    });

    it('should record the error when creating fails', () => {
        // Arrange
        const action = InventoryActions.createItem.failure({ error: 'taken' });

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.error).toBe('taken');
    });

    it('should replace the item on update success', () => {
        // Arrange
        const seeded = inventoryReducer(
            INITIAL_INVENTORY_STATE,
            InventoryActions.loadItems.success({ items: [buildInventoryItem()] })
        );
        const updated = buildInventoryItem({ quantity: 9 });

        // Act
        const state = inventoryReducer(seeded, InventoryActions.updateItem.success({ item: updated }));

        // Assert
        expect(state.items[0].quantity).toBe(9);
    });

    it('should record the error when updating fails', () => {
        // Arrange
        const action = InventoryActions.updateItem.failure({ error: 'locked' });

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.error).toBe('locked');
    });

    it('should remove the item on delete success', () => {
        // Arrange
        const seeded = inventoryReducer(
            INITIAL_INVENTORY_STATE,
            InventoryActions.loadItems.success({ items: [buildInventoryItem()] })
        );

        // Act
        const state = inventoryReducer(seeded, InventoryActions.deleteItem.success({ id: buildInventoryItem().id }));

        // Assert
        expect(state.items.length).toBe(0);
    });

    it('should record the error when deleting fails', () => {
        // Arrange
        const action = InventoryActions.deleteItem.failure({ error: 'locked' });

        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, action);

        // Assert
        expect(state.error).toBe('locked');
    });

    it('should not mutate the previous state', () => {
        // Act
        const state = inventoryReducer(INITIAL_INVENTORY_STATE, InventoryActions.loadItems.request({}));

        // Assert
        expect(state === INITIAL_INVENTORY_STATE).toBe(false);
        expect(INITIAL_INVENTORY_STATE.itemsStatus).toBe(ApiCallStatus.Idle);
    });
});
