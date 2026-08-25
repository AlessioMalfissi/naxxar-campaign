import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';

import { CodexSection } from '@core/models';
import { CodexApiService } from '@core/services/codex-api.service';
import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import * as CodexActions from './codex.actions';
import { CodexEffects } from './codex.effects';
import { selectCodexState } from './codex.selectors';
import { INITIAL_CODEX_STATE } from './codex.state';

describe('CodexEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: CodexEffects;
    let store: MockStore;
    let codexApi: jest.Mocked<Pick<CodexApiService, 'loadIndex' | 'loadEntry' | 'saveEntry' | 'createEntry' | 'deleteEntry'>>;

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        codexApi = {
            loadIndex: jest.fn(),
            loadEntry: jest.fn(),
            saveEntry: jest.fn(),
            createEntry: jest.fn(),
            deleteEntry: jest.fn()
        };

        TestBed.configureTestingModule({
            providers: [
                CodexEffects,
                provideMockActions(() => actions$),
                provideMockStore({ initialState: {} }),
                { provide: CodexApiService, useValue: codexApi }
            ]
        });

        effects = TestBed.inject(CodexEffects);
        store = TestBed.inject(MockStore);
        store.overrideSelector(selectCodexState, { ...INITIAL_CODEX_STATE, entries: [buildSummary()] });
    });

    it('should map a loaded index onto a success action', async () => {
        // Arrange
        const entries = [buildSummary()];
        codexApi.loadIndex.mockReturnValue(of(entries));
        actions$.next(CodexActions.loadIndex.request({}));

        // Act
        const result = await dispatched(effects.loadIndex$);

        // Assert
        expect(result).toEqual(CodexActions.loadIndex.success({ entries }));
    });

    it('should map an index error onto a failure action', async () => {
        // Arrange
        codexApi.loadIndex.mockReturnValue(throwError(() => new Error('offline')));
        actions$.next(CodexActions.loadIndex.request({}));

        // Act
        const result = await dispatched(effects.loadIndex$);

        // Assert
        expect(result.type).toBe(CodexActions.loadIndex.failure.type);
    });

    it('should load the entry that matches the requested id', async () => {
        // Arrange
        const entry = buildEntry();
        codexApi.loadEntry.mockReturnValue(of(entry));
        actions$.next(CodexActions.loadEntry.request({ id: entry.id }));

        // Act
        const result = await dispatched(effects.loadEntry$);

        // Assert
        expect(result).toEqual(CodexActions.loadEntry.success({ entry }));
    });

    it('should fail when the requested id is not in the index', async () => {
        // Arrange
        actions$.next(CodexActions.loadEntry.request({ id: 'npcs:nobody' }));

        // Act
        const result = await dispatched(effects.loadEntry$);

        // Assert
        expect(result).toEqual(CodexActions.loadEntry.failure({ error: 'That entry no longer exists.' }));
    });

    it('should fail when the entry cannot be fetched', async () => {
        // Arrange
        codexApi.loadEntry.mockReturnValue(throwError(() => new Error('404')));
        actions$.next(CodexActions.loadEntry.request({ id: 'npcs:vaelith-corrun' }));

        // Act
        const result = await dispatched(effects.loadEntry$);

        // Assert
        expect(result).toEqual(CodexActions.loadEntry.failure({ error: "Couldn't load that entry. Retry." }));
    });

    it('should map a saved entry onto a success action', async () => {
        // Arrange
        const entry = buildEntry();
        codexApi.saveEntry.mockReturnValue(of(entry));
        actions$.next(CodexActions.saveEntry.request({ entry }));

        // Act
        const result = await dispatched(effects.saveEntry$);

        // Assert
        expect(result).toEqual(CodexActions.saveEntry.success({ entry }));
    });

    it('should surface the save error message', async () => {
        // Arrange
        codexApi.saveEntry.mockReturnValue(throwError(() => new Error('storage full')));
        actions$.next(CodexActions.saveEntry.request({ entry: buildEntry() }));

        // Act
        const result = await dispatched(effects.saveEntry$);

        // Assert
        expect(result).toEqual(CodexActions.saveEntry.failure({ error: 'storage full' }));
    });

    it('should slugify the title when creating an entry', async () => {
        // Arrange
        const entry = buildEntry();
        codexApi.createEntry.mockReturnValue(of(entry));
        actions$.next(
            CodexActions.createEntry.request({
                section: CodexSection.Npcs,
                title: 'Vaelith Corrun',
                status: 'Alive'
            })
        );

        // Act
        const result = await dispatched(effects.createEntry$);

        // Assert
        expect(codexApi.createEntry).toHaveBeenCalledWith(
            CodexSection.Npcs,
            'vaelith-corrun',
            'Vaelith Corrun',
            'Alive'
        );
        expect(result).toEqual(CodexActions.createEntry.success({ entry }));
    });

    it('should surface the create error message', async () => {
        // Arrange
        codexApi.createEntry.mockReturnValue(throwError(() => new Error('taken')));
        actions$.next(
            CodexActions.createEntry.request({ section: CodexSection.Npcs, title: 'Vaelith', status: 'Alive' })
        );

        // Act
        const result = await dispatched(effects.createEntry$);

        // Assert
        expect(result).toEqual(CodexActions.createEntry.failure({ error: 'taken' }));
    });

    it('should confirm a deletion', async () => {
        // Arrange
        codexApi.deleteEntry.mockReturnValue(of('npcs:vaelith-corrun'));
        actions$.next(CodexActions.deleteEntry.request({ id: 'npcs:vaelith-corrun' }));

        // Act
        const result = await dispatched(effects.deleteEntry$);

        // Assert
        expect(result).toEqual(CodexActions.deleteEntry.success({ id: 'npcs:vaelith-corrun' }));
    });

    it('should map a deletion error onto a failure action', async () => {
        // Arrange
        codexApi.deleteEntry.mockReturnValue(throwError(() => new Error('locked')));
        actions$.next(CodexActions.deleteEntry.request({ id: 'npcs:vaelith-corrun' }));

        // Act
        const result = await dispatched(effects.deleteEntry$);

        // Assert
        expect(result.type).toBe(CodexActions.deleteEntry.failure.type);
    });
});
