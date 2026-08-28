import { IInventoryItem } from '@core/models';

export const buildInventoryItem = (overrides: Partial<IInventoryItem> = {}): IInventoryItem => ({
    id: 'a5c8f9d0-1111-4a2b-9c3d-000000000001',
    name: 'Potion of healing',
    description: 'Restores 2d4+2 hit points.',
    quantity: 3,
    owner: 'party',
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides
});
