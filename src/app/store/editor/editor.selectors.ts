import { createFeatureSelector, createSelector } from '@ngrx/store';

import { SaveStatus, ViewMode } from '@core/models';
import { EDITOR_FEATURE_KEY, IEditorState } from './editor.state';

export const selectEditorState = createFeatureSelector<IEditorState>(EDITOR_FEATURE_KEY);

export const selectDraftBody = createSelector(selectEditorState, (state) => state.draftBody);

export const selectSaveStatus = createSelector(selectEditorState, (state) => state.saveStatus);

export const selectViewMode = createSelector(selectEditorState, (state) => state.viewMode);

export const selectLastSavedAt = createSelector(selectEditorState, (state) => state.lastSavedAt);

export const selectLastSavedBy = createSelector(selectEditorState, (state) => state.lastSavedBy);

export const selectEditorError = createSelector(selectEditorState, (state) => state.error);

export const selectIsDirty = createSelector(
    selectEditorState,
    (state) => state.draftBody !== state.baselineBody
);

export const selectIsSaving = createSelector(
    selectSaveStatus,
    (status) => status === SaveStatus.Saving
);

export const selectShowEditor = createSelector(selectViewMode, (mode) => mode !== ViewMode.Preview);

export const selectShowPreview = createSelector(selectViewMode, (mode) => mode !== ViewMode.Edit);
