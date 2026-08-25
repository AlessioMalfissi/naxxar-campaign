import { SaveStatus, ViewMode } from '@core/models';

export const EDITOR_FEATURE_KEY = 'editor';

export interface IEditorState {
    entryId: string | null;
    baselineBody: string;
    draftBody: string;
    saveStatus: SaveStatus;
    viewMode: ViewMode;
    lastSavedAt: string | null;
    lastSavedBy: string | null;
    error: string | null;
}

export const INITIAL_EDITOR_STATE: IEditorState = {
    entryId: null,
    baselineBody: '',
    draftBody: '',
    saveStatus: SaveStatus.Idle,
    viewMode: ViewMode.Edit,
    lastSavedAt: null,
    lastSavedBy: null,
    error: null
};
