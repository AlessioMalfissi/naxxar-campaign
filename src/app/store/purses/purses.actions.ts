import { IPurse } from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Purses';

export const loadPurses = createApiAction<Record<string, never>, { purses: IPurse[] }>(SOURCE, 'load purses');

export const updateGold = createApiAction<{ owner: string; gold: number }, { purse: IPurse }>(SOURCE, 'update gold');
