import { createAction, props } from '@ngrx/store';

import { ICodexEntry, ViewMode } from '@core/models';
import { MarkdownCommand } from '@core/services/markdown-command.service';

const SOURCE = 'Editor';

export const editorOpened = createAction(`[${SOURCE}] opened`, props<{ entry: ICodexEntry }>());

export const bodyChanged = createAction(`[${SOURCE}] body changed`, props<{ body: string }>());

export const commandApplied = createAction(`[${SOURCE}] command applied`, props<{ command: MarkdownCommand }>());

export const viewModeChanged = createAction(`[${SOURCE}] view mode changed`, props<{ viewMode: ViewMode }>());

export const saveRequested = createAction(`[${SOURCE}] save requested`);

export const autosaveRequested = createAction(`[${SOURCE}] autosave requested`);

export const changesDiscarded = createAction(`[${SOURCE}] changes discarded`);

export const saveSucceeded = createAction(`[${SOURCE}] save succeeded`, props<{ entry: ICodexEntry }>());

export const saveFailed = createAction(`[${SOURCE}] save failed`, props<{ error: string }>());
