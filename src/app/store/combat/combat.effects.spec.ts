import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, ReplaySubject, Subject, throwError, toArray } from 'rxjs';

import { CombatLiveEvent, CombatLiveEventType } from '@core/models';
import { CampaignContextService } from '@core/services/campaign-context.service';
import { CombatApiService } from '@core/services/combat-api.service';
import { CombatLiveService } from '@core/services/combat-live.service';
import { buildEncounter } from '@testing/combat.fixtures';
import * as CombatActions from './combat.actions';
import { CombatEffects } from './combat.effects';
import { selectEncounter } from './combat.selectors';

describe('CombatEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: CombatEffects;
    let store: MockStore;
    let combatApi: jest.Mocked<Pick<CombatApiService, 'loadEncounter' | 'saveEncounter'>>;
    let combatLive: jest.Mocked<Pick<CombatLiveService, 'connect'>>;
    let liveEvents: Subject<CombatLiveEvent>;
    let currentSlug: string | null;

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        combatApi = { loadEncounter: jest.fn(), saveEncounter: jest.fn() };
        liveEvents = new Subject<CombatLiveEvent>();
        currentSlug = 'naxxar';
        combatLive = { connect: jest.fn(() => liveEvents.asObservable()) };

        TestBed.configureTestingModule({
            providers: [
                CombatEffects,
                provideMockActions(() => actions$),
                provideMockStore({ initialState: {} }),
                { provide: CampaignContextService, useValue: { slug: () => currentSlug } },
                { provide: CombatApiService, useValue: combatApi },
                { provide: CombatLiveService, useValue: combatLive }
            ]
        });

        store = TestBed.inject(MockStore);
        effects = TestBed.inject(CombatEffects);
    });

    it('should map the loaded encounter onto a success action', async () => {
        // Arrange
        const encounter = buildEncounter();
        combatApi.loadEncounter.mockReturnValue(of(encounter));
        actions$.next(CombatActions.loadEncounter.request({}));

        // Act
        const result = await dispatched(effects.loadEncounter$);

        // Assert
        expect(result).toEqual(CombatActions.loadEncounter.success({ encounter }));
    });

    it('should map a load error onto a failure action', async () => {
        // Arrange
        combatApi.loadEncounter.mockReturnValue(throwError(() => new Error('offline')));
        actions$.next(CombatActions.loadEncounter.request({}));

        // Act
        const result = await dispatched(effects.loadEncounter$);

        // Assert
        expect(result).toEqual(
            CombatActions.loadEncounter.failure({ error: "Couldn't load the combat tracker. Retry." })
        );
    });

    it('should request a save of the current encounter after a local change', async () => {
        // Arrange
        const encounter = buildEncounter({ round: 1, turnId: 'goblin-1' });
        store.overrideSelector(selectEncounter, encounter);
        actions$.next(CombatActions.turnAdvanced());

        // Act
        const result = await dispatched(effects.persistEncounter$);

        // Assert
        expect(result).toEqual(CombatActions.saveEncounter.request({ encounter }));
    });

    it('should save the encounter through the API', async () => {
        // Arrange
        const encounter = buildEncounter();
        combatApi.saveEncounter.mockReturnValue(of(encounter));
        actions$.next(CombatActions.saveEncounter.request({ encounter }));

        // Act
        const result = await dispatched(effects.saveEncounter$);

        // Assert
        expect(combatApi.saveEncounter).toHaveBeenCalledWith(encounter);
        expect(result).toEqual(CombatActions.saveEncounter.success({ encounter }));
    });

    it('should surface the save error message', async () => {
        // Arrange
        const encounter = buildEncounter();
        combatApi.saveEncounter.mockReturnValue(throwError(() => new Error('invalid')));
        actions$.next(CombatActions.saveEncounter.request({ encounter }));

        // Act
        const result = await dispatched(effects.saveEncounter$);

        // Assert
        expect(result).toEqual(CombatActions.saveEncounter.failure({ error: 'invalid' }));
    });

    it('should map live socket events onto status and encounter actions until sync stops', async () => {
        // Arrange
        const encounter = buildEncounter({ revision: 3 });
        const collected = new Promise<Action[]>((resolve) => effects.liveSync$.pipe(toArray()).subscribe(resolve));
        actions$.next(CombatActions.liveSyncStarted());

        // Act
        liveEvents.next({ type: CombatLiveEventType.Connected });
        liveEvents.next({ type: CombatLiveEventType.Encounter, encounter });
        liveEvents.next({ type: CombatLiveEventType.Disconnected });
        actions$.next(CombatActions.liveSyncStopped());
        liveEvents.next({ type: CombatLiveEventType.Connected });
        actions$.complete();
        const result = await collected;

        // Assert
        expect(combatLive.connect).toHaveBeenCalledWith('naxxar');
        expect(combatLive.connect).toHaveBeenCalledTimes(1);
        expect(result).toEqual([
            CombatActions.liveStatusChanged({ connected: true }),
            CombatActions.encounterReceived({ encounter }),
            CombatActions.liveStatusChanged({ connected: false })
        ]);
        expect(liveEvents.observed).toBe(false);
    });

    it('should report a disconnected live status when there is no active campaign', async () => {
        // Arrange
        currentSlug = null;

        // Act
        actions$.next(CombatActions.liveSyncStarted());
        const result = await dispatched(effects.liveSync$);

        // Assert
        expect(combatLive.connect).not.toHaveBeenCalled();
        expect(result).toEqual(CombatActions.liveStatusChanged({ connected: false }));
    });
});
