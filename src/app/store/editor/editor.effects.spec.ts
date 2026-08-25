import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ReplaySubject } from 'rxjs';

import { buildEntry } from '@testing/entry.fixtures';
import * as CodexActions from '../codex/codex.actions';
import { selectOpenEntry } from '../codex/codex.selectors';
import * as EditorActions from './editor.actions';
import { EditorEffects } from './editor.effects';
import { selectDraftBody, selectIsDirty } from './editor.selectors';

describe('EditorEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: EditorEffects;
    let store: MockStore;
    let snackBar: { open: jest.Mock };

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        snackBar = { open: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                EditorEffects,
                provideMockActions(() => actions$),
                provideMockStore({ initialState: {} }),
                { provide: MatSnackBar, useValue: snackBar }
            ]
        });

        effects = TestBed.inject(EditorEffects);
        store = TestBed.inject(MockStore);
        store.overrideSelector(selectOpenEntry, buildEntry());
        store.overrideSelector(selectDraftBody, '# Edited');
        store.overrideSelector(selectIsDirty, true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should request an autosave once typing settles', () => {
        // Arrange
        jest.useFakeTimers();
        const emitted: Action[] = [];
        effects.autosave$.subscribe((action) => emitted.push(action));
        actions$.next(EditorActions.bodyChanged({ body: '# Edited' }));

        // Act
        jest.advanceTimersByTime(2000);

        // Assert
        expect(emitted).toEqual([EditorActions.autosaveRequested()]);
    });

    it('should not autosave a clean draft', () => {
        // Arrange
        jest.useFakeTimers();
        store.overrideSelector(selectIsDirty, false);
        store.refreshState();
        const emitted: Action[] = [];
        effects.autosave$.subscribe((action) => emitted.push(action));
        actions$.next(EditorActions.bodyChanged({ body: '# Body' }));

        // Act
        jest.advanceTimersByTime(2000);

        // Assert
        expect(emitted.length).toBe(0);
    });

    it('should submit the open entry with the current draft body', () => {
        // Arrange
        const emitted: Action[] = [];
        effects.save$.subscribe((action) => emitted.push(action));

        // Act
        actions$.next(EditorActions.saveRequested());

        // Assert
        expect(emitted).toEqual([
            CodexActions.saveEntry.request({ entry: { ...buildEntry(), body: '# Edited' } })
        ]);
    });

    it('should ignore a save when no entry is open', () => {
        // Arrange
        store.overrideSelector(selectOpenEntry, null);
        store.refreshState();
        const emitted: Action[] = [];
        effects.save$.subscribe((action) => emitted.push(action));

        // Act
        actions$.next(EditorActions.saveRequested());

        // Assert
        expect(emitted.length).toBe(0);
    });

    it('should mirror a codex save success onto the editor', () => {
        // Arrange
        const entry = buildEntry();
        const emitted: Action[] = [];
        effects.saveSucceeded$.subscribe((action) => emitted.push(action));

        // Act
        actions$.next(CodexActions.saveEntry.success({ entry }));

        // Assert
        expect(emitted).toEqual([EditorActions.saveSucceeded({ entry })]);
    });

    it('should mirror a codex save failure onto the editor', () => {
        // Arrange
        const emitted: Action[] = [];
        effects.saveFailed$.subscribe((action) => emitted.push(action));

        // Act
        actions$.next(CodexActions.saveEntry.failure({ error: 'storage full' }));

        // Assert
        expect(emitted).toEqual([EditorActions.saveFailed({ error: 'storage full' })]);
    });

    it('should open the editor when an entry is loaded', () => {
        // Arrange
        const entry = buildEntry();
        const emitted: Action[] = [];
        effects.openEditor$.subscribe((action) => emitted.push(action));

        // Act
        actions$.next(CodexActions.loadEntry.success({ entry }));

        // Assert
        expect(emitted).toEqual([EditorActions.editorOpened({ entry })]);
    });

    it('should notify the user when a save fails', () => {
        // Arrange
        effects.notifyFailure$.subscribe();

        // Act
        actions$.next(EditorActions.saveFailed({ error: 'storage full' }));

        // Assert
        expect(snackBar.open).toHaveBeenCalledWith('storage full', 'Dismiss', { duration: 6000 });
    });
});
