import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { CodexApiService } from '@core/services/codex-api.service';
import { slugify } from '@core/utils/entry-id.util';
import * as CodexActions from './codex.actions';
import { selectCodexState } from './codex.selectors';

@Injectable()
export class CodexEffects {
    private readonly actions$ = inject(Actions);
    private readonly store = inject(Store);
    private readonly codexApi = inject(CodexApiService);

    readonly loadIndex$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.loadIndex.request),
            switchMap(() =>
                this.codexApi.loadIndex().pipe(
                    map((entries) => CodexActions.loadIndex.success({ entries })),
                    catchError(() =>
                        of(CodexActions.loadIndex.failure({ error: "Couldn't load the codex index. Retry." }))
                    )
                )
            )
        )
    );

    readonly loadEntry$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.loadEntry.request),
            withLatestFrom(this.store.select(selectCodexState)),
            switchMap(([{ id }, state]) => {
                const summary = state.entries.find((entry) => entry.id === id);
                if (summary === undefined) {
                    return of(CodexActions.loadEntry.failure({ error: 'That entry no longer exists.' }));
                }

                return this.codexApi.loadEntry(summary).pipe(
                    map((entry) => CodexActions.loadEntry.success({ entry })),
                    catchError(() =>
                        of(CodexActions.loadEntry.failure({ error: "Couldn't load that entry. Retry." }))
                    )
                );
            })
        )
    );

    readonly saveEntry$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.saveEntry.request),
            switchMap(({ entry }) =>
                this.codexApi.saveEntry(entry).pipe(
                    map((saved) => CodexActions.saveEntry.success({ entry: saved })),
                    catchError((error: Error) => of(CodexActions.saveEntry.failure({ error: error.message })))
                )
            )
        )
    );

    readonly createEntry$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.createEntry.request),
            switchMap(({ section, title, status, tags, visibility, fields }) =>
                this.codexApi.createEntry(section, slugify(title), title, status, tags, visibility, fields).pipe(
                    map((entry) => CodexActions.createEntry.success({ entry })),
                    catchError((error: Error) => of(CodexActions.createEntry.failure({ error: error.message })))
                )
            )
        )
    );

    readonly deleteEntry$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CodexActions.deleteEntry.request),
            switchMap(({ id }) =>
                this.codexApi.deleteEntry(id).pipe(
                    map((deletedId) => CodexActions.deleteEntry.success({ id: deletedId })),
                    catchError(() =>
                        of(CodexActions.deleteEntry.failure({ error: "Couldn't delete that entry. Retry." }))
                    )
                )
            )
        )
    );
}
