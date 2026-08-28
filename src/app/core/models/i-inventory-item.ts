import { ItemRarity } from './item-rarity.enum';
import { ItemStatus } from './item-status.enum';

export const PARTY_OWNER_ID = 'party';

export interface IInventoryItem {
    id: string;
    name: string;
    description: string;
    quantity: number;
    owner: string;
    rarity: ItemRarity;
    status: ItemStatus;
    updatedAt: string;
}

export interface IInventoryItemChanges {
    name?: string;
    description?: string;
    quantity?: number;
    owner?: string;
    rarity?: ItemRarity;
    status?: ItemStatus;
}
