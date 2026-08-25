import { SaveStatus, ViewMode } from '@core/models';
import { buildEntry } from '@testing/entry.fixtures';
import * as EditorActions from './editor.actions';
import { editorReducer } from './editor.reducer';
import { INITIAL_EDITOR_STATE } from './editor.state';

const OPENED = editorReducer(INITIAL_EDITOR_STATE, EditorActions.editorOpened({ entry: buildEntry() }));

describe('editorReducer', () => {
    it('should seed the draft from the opened entry', () => {
        // Arrange
        const entry = buildEntry();

        // Act
        const state = editorReducer(INITIAL_EDITOR_STATE, EditorActions.editorOpened({ entry }));

        // Assert
        expect(state.entryId).toBe(entry.id);
        expect(state.draftBody).toBe(entry.body);
        expect(state.saveStatus).toBe(SaveStatus.Idle);
    });

    it('should mark the draft dirty when the body diverges', () => {
        // Arrange
        const action = EditorActions.bodyChanged({ body: '# Edited' });

        // Act
        const state = editorReducer(OPENED, action);

        // Assert
        expect(state.saveStatus).toBe(SaveStatus.Dirty);
    });

    it('should return to idle when the body matches the baseline again', () => {
        // Arrange
        const dirty = editorReducer(OPENED, EditorActions.bodyChanged({ body: '# Edited' }));

        // Act
        const state = editorReducer(dirty, EditorActions.bodyChanged({ body: OPENED.baselineBody }));

        // Assert
        expect(state.saveStatus).toBe(SaveStatus.Idle);
    });

    it('should switch the view mode', () => {
        // Arrange
        const action = EditorActions.viewModeChanged({ viewMode: ViewMode.Split });

        // Act
        const state = editorReducer(OPENED, action);

        // Assert
        expect(state.viewMode).toBe(ViewMode.Split);
    });

    it('should move to saving when a dirty draft is submitted', () => {
        // Arrange
        const dirty = editorReducer(OPENED, EditorActions.bodyChanged({ body: '# Edited' }));

        // Act
        const state = editorReducer(dirty, EditorActions.saveRequested());

        // Assert
        expect(state.saveStatus).toBe(SaveStatus.Saving);
    });

    it('should leave the status untouched when an unchanged draft is autosaved', () => {
        // Arrange
        const clean = OPENED;

        // Act
        const state = editorReducer(clean, EditorActions.autosaveRequested());

        // Assert
        expect(state.saveStatus).toBe(SaveStatus.Idle);
    });

    it('should rebaseline the draft after a successful save', () => {
        // Arrange
        const saved = buildEntry({ body: '# Saved', updatedAt: '2026-08-25T10:00:00.000Z' });

        // Act
        const state = editorReducer(OPENED, EditorActions.saveSucceeded({ entry: saved }));

        // Assert
        expect(state.baselineBody).toBe('# Saved');
        expect(state.saveStatus).toBe(SaveStatus.Saved);
        expect(state.lastSavedAt).toBe('2026-08-25T10:00:00.000Z');
    });

    it('should record a save failure', () => {
        // Arrange
        const action = EditorActions.saveFailed({ error: 'storage full' });

        // Act
        const state = editorReducer(OPENED, action);

        // Assert
        expect(state.saveStatus).toBe(SaveStatus.Failed);
        expect(state.error).toBe('storage full');
    });

    it('should restore the baseline when changes are discarded', () => {
        // Arrange
        const dirty = editorReducer(OPENED, EditorActions.bodyChanged({ body: '# Edited' }));

        // Act
        const state = editorReducer(dirty, EditorActions.changesDiscarded());

        // Assert
        expect(state.draftBody).toBe(OPENED.baselineBody);
        expect(state.saveStatus).toBe(SaveStatus.Idle);
    });

    it('should not mutate the previous state', () => {
        // Arrange
        const previous = OPENED;

        // Act
        const state = editorReducer(previous, EditorActions.bodyChanged({ body: '# Edited' }));

        // Assert
        expect(state === previous).toBe(false);
        expect(previous.draftBody === state.draftBody).toBe(false);
    });
});
