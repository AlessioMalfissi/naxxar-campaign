export const PARTY_OWNER_ID = 'party';

export interface IInventoryItem {
    id: string;
    name: string;
    description: string;
    quantity: number;
    owner: string;
    updatedAt: string;
}

export interface IInventoryItemChanges {
    name?: string;
    description?: string;
    quantity?: number;
    owner?: string;
}
