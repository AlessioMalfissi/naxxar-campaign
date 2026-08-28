import { IPurse } from '@core/models';

export const buildPurse = (overrides: Partial<IPurse> = {}): IPurse => ({
    owner: 'party',
    gold: 120,
    ...overrides
});
