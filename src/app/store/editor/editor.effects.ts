import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { debounceTime, filter, map, tap, withLatestFrom } from 'rxjs';

import { ICodexEntry } from '@core/models';
import * as CodexActions from '../codex/codex.actions';
import { selectOpenEntry } from '../codex/codex.selectors';
import * as EditorActions from './editor.actions';
import { selectDraftBody, selectIsDirty } from './editor.selectors';

const AUTOSAVE_DELAY_MS = 2000;

@Injectable()
export class EditorEffects {
    private readonly actions$ = inject(Actions);
    private readonly store = inject(Store);
    private readonly snackBar = inject(MatSnackBar);

    readonly autosave$ = createEffect(() =>
        this.actions$.pipe(
            ofType(EditorActions.bodyChanged),
            debounceTime(AUTOSAVE_DELAY_MS),
            withLatestFrom(this.store.select(selectIsDirty)),
            filter(([, dirty]) => dirty),
            map(() => EditorActions.autosaveRequested())
        )
    );

    readonly save$ = createEffect(() =>
        this.actions$.pipe(
            ofType(EditorActions.saveRequested, EditorActions.autosaveRequested),
            withLatestFrom(this.store.select(selectOpenEntry), this.store.select(selectDraftBody)),
            filter(([, entry]) => entry !== null),
            map(([, entry, body]) => {
                const openEntry = entry as ICodexEntry;
                return CodexActions.saveEntry.request({ entry: { ...openEntry, body } });
            })
        )
    );

    readonly saveSucceeded$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.saveEntry.success),
            map(({ entry }) => EditorActions.saveSucceeded({ entry }))
        )
    );

    readonly saveFailed$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.saveEntry.failure),
            map(({ error }) => EditorActions.saveFailed({ error }))
        )
    );

    readonly openEditor$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.loadEntry.success, CodexActions.createEntry.success),
            map(({ entry }) => EditorActions.editorOpened({ entry }))
        )
    );

    readonly notifyFailure$ = createEffect(
        () =>
            this.actions$.pipe(
                ofType(EditorActions.saveFailed),
                tap(({ error }) => this.snackBar.open(error, 'Dismiss', { duration: 6000 }))
            ),
        { dispatch: false }
    );
}
