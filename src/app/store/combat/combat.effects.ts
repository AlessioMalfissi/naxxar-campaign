import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, map, of, switchMap, takeUntil, withLatestFrom } from 'rxjs';

import { CombatLiveEventType } from '@core/models';
import { CombatApiService } from '@core/services/combat-api.service';
import { CombatLiveService } from '@core/services/combat-live.service';
import * as CombatActions from './combat.actions';
import { selectEncounter } from './combat.selectors';

@Injectable()
export class CombatEffects {
    private readonly actions$ = inject(Actions);
    private readonly store = inject(Store);
    private readonly combatApi = inject(CombatApiService);
    private readonly combatLive = inject(CombatLiveService);

    readonly loadEncounter$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CombatActions.loadEncounter.request),
            switchMap(() =>
                this.combatApi.loadEncounter().pipe(
                    map((encounter) => CombatActions.loadEncounter.success({ encounter })),
                    catchError(() =>
                        of(CombatActions.loadEncounter.failure({ error: "Couldn't load the combat tracker. Retry." }))
                    )
                )
            )
        )
    );

    // Keeps the encounter in sync with every other open tracker until live sync is stopped.
    readonly liveSync$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CombatActions.liveSyncStarted),
            switchMap(() =>
                this.combatLive.connect().pipe(
                    map((event) =>
                        event.type === CombatLiveEventType.Encounter
                            ? CombatActions.encounterReceived({ encounter: event.encounter })
                            : CombatActions.liveStatusChanged({
                                  connected: event.type === CombatLiveEventType.Connected
                              })
                    ),
                    takeUntil(this.actions$.pipe(ofType(CombatActions.liveSyncStopped)))
                )
            )
        )
    );

    // Edits apply locally first; the resulting encounter is then written back whole.
    readonly persistEncounter$ = createEffect(() =>
        this.actions$.pipe(
            ofType(...CombatActions.ENCOUNTER_MUTATIONS),
            withLatestFrom(this.store.select(selectEncounter)),
            map(([, encounter]) => CombatActions.saveEncounter.request({ encounter }))
        )
    );

    // concatMap keeps the writes in order, so the last edit is always the one the server keeps.
    readonly saveEncounter$ = createEffect(() =>
        this.actions$.pipe(
            ofType(CombatActions.saveEncounter.request),
            concatMap(({ encounter }) =>
                this.combatApi.saveEncounter(encounter).pipe(
                    map((saved) => CombatActions.saveEncounter.success({ encounter: saved })),
                    catchError((error: Error) => of(CombatActions.saveEncounter.failure({ error: error.message })))
                )
            )
        )
    );
}
