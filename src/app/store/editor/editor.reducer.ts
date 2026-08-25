import { createReducer, on } from '@ngrx/store';

import { SaveStatus } from '@core/models';
import * as EditorActions from './editor.actions';
import { IEditorState, INITIAL_EDITOR_STATE } from './editor.state';

export const editorReducer = createReducer<IEditorState>(
    INITIAL_EDITOR_STATE,

    on(EditorActions.editorOpened, (state, { entry }): IEditorState => ({
        ...state,
        entryId: entry.id,
        baselineBody: entry.body,
        draftBody: entry.body,
        saveStatus: SaveStatus.Idle,
        lastSavedAt: entry.updatedAt,
        lastSavedBy: entry.author,
        error: null
    })),

    on(EditorActions.bodyChanged, (state, { body }): IEditorState => ({
        ...state,
        draftBody: body,
        saveStatus: body === state.baselineBody ? SaveStatus.Idle : SaveStatus.Dirty
    })),

    on(EditorActions.viewModeChanged, (state, { viewMode }): IEditorState => ({
        ...state,
        viewMode
    })),

    on(EditorActions.saveRequested, EditorActions.autosaveRequested, (state): IEditorState => ({
        ...state,
        saveStatus: state.draftBody === state.baselineBody ? state.saveStatus : SaveStatus.Saving,
        error: null
    })),

    on(EditorActions.saveSucceeded, (state, { entry }): IEditorState => ({
        ...state,
        baselineBody: entry.body,
        draftBody: entry.body,
        saveStatus: SaveStatus.Saved,
        lastSavedAt: entry.updatedAt,
        lastSavedBy: entry.author,
        error: null
    })),

    on(EditorActions.saveFailed, (state, { error }): IEditorState => ({
        ...state,
        saveStatus: SaveStatus.Failed,
        error
    })),

    on(EditorActions.changesDiscarded, (state): IEditorState => ({
        ...state,
        draftBody: state.baselineBody,
        saveStatus: SaveStatus.Idle,
        error: null
    }))
);
