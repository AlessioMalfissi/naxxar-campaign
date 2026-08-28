import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus, PARTY_OWNER_ID } from '@core/models';
import { IInventoryState, INVENTORY_FEATURE_KEY } from './inventory.state';

export const selectInventoryState = createFeatureSelector<IInventoryState>(INVENTORY_FEATURE_KEY);

export const selectInventoryItems = createSelector(selectInventoryState, (state) => state.items);

export const selectInventoryLoading = createSelector(
    selectInventoryState,
    (state) => state.itemsStatus === ApiCallStatus.Pending
);

export const selectInventoryError = createSelector(selectInventoryState, (state) => state.error);

export const selectInventoryItemCount = createSelector(selectInventoryItems, (items) => items.length);

export const selectPartyItems = createSelector(selectInventoryItems, (items) =>
    items.filter((item) => item.owner === PARTY_OWNER_ID)
);
