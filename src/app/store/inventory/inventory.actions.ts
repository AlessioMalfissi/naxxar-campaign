import { IInventoryItem, IInventoryItemChanges, ItemRarity, ItemStatus } from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Inventory';

export const loadItems = createApiAction<Record<string, never>, { items: IInventoryItem[] }>(SOURCE, 'load items');

export const createItem = createApiAction<
    { name: string; description: string; quantity: number; owner: string; rarity: ItemRarity; status: ItemStatus },
    { item: IInventoryItem }
>(SOURCE, 'create item');

export const updateItem = createApiAction<
    { id: string; changes: IInventoryItemChanges },
    { item: IInventoryItem }
>(SOURCE, 'update item');

export const deleteItem = createApiAction<{ id: string }, { id: string }>(SOURCE, 'delete item');
