import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';

import { CombatApiService } from '@core/services/combat-api.service';
import { buildEncounter } from '@testing/combat.fixtures';
import * as CombatActions from './combat.actions';
import { CombatEffects } from './combat.effects';
import { selectEncounter } from './combat.selectors';

describe('CombatEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: CombatEffects;
    let store: MockStore;
    let combatApi: jest.Mocked<Pick<CombatApiService, 'loadEncounter' | 'saveEncounter'>>;

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        combatApi = { loadEncounter: jest.fn(), saveEncounter: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                CombatEffects,
                provideMockActions(() => actions$),
                provideMockStore({ initialState: {} }),
                { provide: CombatApiService, useValue: combatApi }
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
});
