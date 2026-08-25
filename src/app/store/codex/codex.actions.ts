import { createAction, props } from '@ngrx/store';

import { CodexSection, ICodexEntry, ICodexEntrySummary } from '@core/models';
import { createApiAction } from '../create-api-action';

const SOURCE = 'Codex';

export const loadIndex = createApiAction<Record<string, never>, { entries: ICodexEntrySummary[] }>(SOURCE, 'load index');

export const loadEntry = createApiAction<{ id: string }, { entry: ICodexEntry }>(SOURCE, 'load entry');

export const saveEntry = createApiAction<{ entry: ICodexEntry }, { entry: ICodexEntry }>(SOURCE, 'save entry');

export const createEntry = createApiAction<
    { section: CodexSection; title: string; status: string },
    { entry: ICodexEntry }
>(SOURCE, 'create entry');

export const deleteEntry = createApiAction<{ id: string }, { id: string }>(SOURCE, 'delete entry');

export const sectionOpened = createAction(`[${SOURCE}] section opened`, props<{ section: CodexSection }>());

export const entryClosed = createAction(`[${SOURCE}] entry closed`);

export const sidebarToggled = createAction(`[${SOURCE}] sidebar toggled`);

export const playerModeToggled = createAction(`[${SOURCE}] player mode toggled`);

export const favouriteToggled = createAction(`[${SOURCE}] favourite toggled`, props<{ id: string }>());

export const filtersChanged = createAction(
    `[${SOURCE}] filters changed`,
    props<{ status: string | null; tags: string[]; query: string }>()
);
