import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';

import { PurseApiService } from '@core/services/purse-api.service';
import { buildPurse } from '@testing/purse.fixtures';
import * as PursesActions from './purses.actions';
import { PursesEffects } from './purses.effects';

describe('PursesEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: PursesEffects;
    let purseApi: jest.Mocked<Pick<PurseApiService, 'loadPurses' | 'updateGold'>>;

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        purseApi = { loadPurses: jest.fn(), updateGold: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                PursesEffects,
                provideMockActions(() => actions$),
                { provide: PurseApiService, useValue: purseApi }
            ]
        });

        effects = TestBed.inject(PursesEffects);
    });

    it('should map loaded purses onto a success action', async () => {
        // Arrange
        const purses = [buildPurse()];
        purseApi.loadPurses.mockReturnValue(of(purses));
        actions$.next(PursesActions.loadPurses.request({}));

        // Act
        const result = await dispatched(effects.loadPurses$);

        // Assert
        expect(result).toEqual(PursesActions.loadPurses.success({ purses }));
    });

    it('should map a load error onto a failure action', async () => {
        // Arrange
        purseApi.loadPurses.mockReturnValue(throwError(() => new Error('offline')));
        actions$.next(PursesActions.loadPurses.request({}));

        // Act
        const result = await dispatched(effects.loadPurses$);

        // Assert
        expect(result).toEqual(PursesActions.loadPurses.failure({ error: "Couldn't load party gold. Retry." }));
    });

    it('should request a gold update for the given owner', async () => {
        // Arrange
        const purse = buildPurse({ gold: 50 });
        purseApi.updateGold.mockReturnValue(of(purse));
        actions$.next(PursesActions.updateGold.request({ owner: 'party', gold: 50 }));

        // Act
        const result = await dispatched(effects.updateGold$);

        // Assert
        expect(purseApi.updateGold).toHaveBeenCalledWith('party', 50);
        expect(result).toEqual(PursesActions.updateGold.success({ purse }));
    });

    it('should surface the update error message', async () => {
        // Arrange
        purseApi.updateGold.mockReturnValue(throwError(() => new Error('invalid')));
        actions$.next(PursesActions.updateGold.request({ owner: 'party', gold: -5 }));

        // Act
        const result = await dispatched(effects.updateGold$);

        // Assert
        expect(result).toEqual(PursesActions.updateGold.failure({ error: 'invalid' }));
    });
});
