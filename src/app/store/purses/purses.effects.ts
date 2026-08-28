import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { PurseApiService } from '@core/services/purse-api.service';
import * as PursesActions from './purses.actions';

@Injectable()
export class PursesEffects {
    private readonly actions$ = inject(Actions);
    private readonly purseApi = inject(PurseApiService);

    readonly loadPurses$ = createEffect(() =>
        this.actions$.pipe(
            ofType(PursesActions.loadPurses.request),
            switchMap(() =>
                this.purseApi.loadPurses().pipe(
                    map((purses) => PursesActions.loadPurses.success({ purses })),
                    catchError(() => of(PursesActions.loadPurses.failure({ error: "Couldn't load party gold. Retry." })))
                )
            )
        )
    );

    readonly updateGold$ = createEffect(() =>
        this.actions$.pipe(
            ofType(PursesActions.updateGold.request),
            switchMap(({ owner, gold }) =>
                this.purseApi.updateGold(owner, gold).pipe(
                    map((purse) => PursesActions.updateGold.success({ purse })),
                    catchError((error: Error) => of(PursesActions.updateGold.failure({ error: error.message })))
                )
            )
        )
    );
}
