import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import * as InventoryActions from './inventory.actions';
import { IInventoryState, INITIAL_INVENTORY_STATE } from './inventory.state';

export const inventoryReducer = createReducer<IInventoryState>(
    INITIAL_INVENTORY_STATE,

    on(InventoryActions.loadItems.request, (state): IInventoryState => ({
        ...state,
        itemsStatus: ApiCallStatus.Pending,
        error: null
    })),

    on(InventoryActions.loadItems.success, (state, { items }): IInventoryState => ({
        ...state,
        items,
        itemsStatus: ApiCallStatus.Success
    })),

    on(InventoryActions.loadItems.failure, (state, { error }): IInventoryState => ({
        ...state,
        itemsStatus: ApiCallStatus.Failed,
        error
    })),

    on(InventoryActions.createItem.success, (state, { item }): IInventoryState => ({
        ...state,
        items: [...state.items, item].toSorted((a, b) => a.name.localeCompare(b.name))
    })),

    on(InventoryActions.createItem.failure, (state, { error }): IInventoryState => ({ ...state, error })),

    on(InventoryActions.updateItem.success, (state, { item }): IInventoryState => ({
        ...state,
        items: state.items.map((existing) => (existing.id === item.id ? item : existing))
    })),

    on(InventoryActions.updateItem.failure, (state, { error }): IInventoryState => ({ ...state, error })),

    on(InventoryActions.deleteItem.success, (state, { id }): IInventoryState => ({
        ...state,
        items: state.items.filter((item) => item.id !== id)
    })),

    on(InventoryActions.deleteItem.failure, (state, { error }): IInventoryState => ({ ...state, error }))
);
