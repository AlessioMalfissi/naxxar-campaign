import { ApiCallStatus, IInventoryItem } from '@core/models';

export const INVENTORY_FEATURE_KEY = 'inventory';

export interface IInventoryState {
    items: IInventoryItem[];
    itemsStatus: ApiCallStatus;
    error: string | null;
}

export const INITIAL_INVENTORY_STATE: IInventoryState = {
    items: [],
    itemsStatus: ApiCallStatus.Idle,
    error: null
};
