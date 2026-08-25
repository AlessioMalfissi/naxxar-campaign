import { SaveStatus, ViewMode } from '@core/models';
import {
    selectDraftBody,
    selectEditorError,
    selectIsDirty,
    selectIsSaving,
    selectLastSavedAt,
    selectLastSavedBy,
    selectSaveStatus,
    selectShowEditor,
    selectShowPreview,
    selectViewMode
} from './editor.selectors';
import { IEditorState, INITIAL_EDITOR_STATE } from './editor.state';

const buildState = (overrides: Partial<IEditorState> = {}): IEditorState => ({
    ...INITIAL_EDITOR_STATE,
    entryId: 'npcs:vaelith-corrun',
    baselineBody: '# Body',
    draftBody: '# Body',
    lastSavedAt: '2026-08-25T09:00:00.000Z',
    lastSavedBy: 'DM',
    ...overrides
});

describe('editorSelectors', () => {
    it('should expose the simple slices of state', () => {
        // Arrange
        const state = buildState({ saveStatus: SaveStatus.Dirty, error: 'storage full' });

        // Act
        const projected = {
            body: selectDraftBody.projector(state),
            status: selectSaveStatus.projector(state),
            mode: selectViewMode.projector(state),
            savedAt: selectLastSavedAt.projector(state),
            savedBy: selectLastSavedBy.projector(state),
            error: selectEditorError.projector(state)
        };

        // Assert
        expect(projected.body).toBe('# Body');
        expect(projected.status).toBe(SaveStatus.Dirty);
        expect(projected.mode).toBe(ViewMode.Edit);
        expect(projected.savedAt).toBe('2026-08-25T09:00:00.000Z');
        expect(projected.savedBy).toBe('DM');
        expect(projected.error).toBe('storage full');
    });

    it('should report a dirty draft', () => {
        // Arrange
        const state = buildState({ draftBody: '# Edited' });

        // Act
        const dirty = selectIsDirty.projector(state);

        // Assert
        expect(dirty).toBe(true);
    });

    it('should report a clean draft', () => {
        // Arrange
        const state = buildState();

        // Act
        const dirty = selectIsDirty.projector(state);

        // Assert
        expect(dirty).toBe(false);
    });

    it('should report an in-flight save', () => {
        // Arrange
        const status = SaveStatus.Saving;

        // Act
        const saving = selectIsSaving.projector(status);

        // Assert
        expect(saving).toBe(true);
    });

    it('should show the editor in edit and split modes only', () => {
        // Arrange
        const modes = [ViewMode.Edit, ViewMode.Split, ViewMode.Preview];

        // Act
        const visible = modes.map((mode) => selectShowEditor.projector(mode));

        // Assert
        expect(visible).toEqual([true, true, false]);
    });

    it('should show the preview in preview and split modes only', () => {
        // Arrange
        const modes = [ViewMode.Edit, ViewMode.Split, ViewMode.Preview];

        // Act
        const visible = modes.map((mode) => selectShowPreview.projector(mode));

        // Assert
        expect(visible).toEqual([false, true, true]);
    });
});
