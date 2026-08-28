import { ApiCallStatus, CodexSection, EntryVisibility, ICodexEntry, ICodexEntrySummary } from '@core/models';
import * as CodexActions from './codex.actions';
import { codexReducer } from './codex.reducer';
import { INITIAL_CODEX_STATE } from './codex.state';

const buildSummary = (id: string, title: string): ICodexEntrySummary => ({
    id,
    section: CodexSection.Npcs,
    slug: id.split(':')[1],
    path: `assets/codex/npcs/${id.split(':')[1]}.md`,
    title,
    status: 'Alive',
    tags: [],
    favourite: false,
    visibility: EntryVisibility.Revealed,
    author: 'DM',
    updatedAt: '2026-08-25T09:00:00.000Z',
    fields: {},
    excerpt: ''
});

const buildEntry = (id: string, title: string): ICodexEntry => ({ ...buildSummary(id, title), body: '# Body' });

describe('codexReducer', () => {
    it('should mark the index as pending on request', () => {
        // Arrange
        const action = CodexActions.loadIndex.request({});

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.indexStatus).toBe(ApiCallStatus.Pending);
    });

    it('should store entries on index success', () => {
        // Arrange
        const entries = [buildSummary('npcs:vaelith-corrun', 'Vaelith Corrun')];
        const action = CodexActions.loadIndex.success({ entries });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.entries.length).toBe(1);
        expect(state.indexStatus).toBe(ApiCallStatus.Success);
    });

    it('should track the opened entry as recent without duplicates', () => {
        // Arrange
        const entry = buildEntry('npcs:vaelith-corrun', 'Vaelith Corrun');
        const first = codexReducer(INITIAL_CODEX_STATE, CodexActions.loadEntry.success({ entry }));

        // Act
        const state = codexReducer(first, CodexActions.loadEntry.success({ entry }));

        // Assert
        expect(state.recentIds.length).toBe(1);
        expect(state.openEntry?.id).toBe('npcs:vaelith-corrun');
    });

    it('should replace the summary when an entry is saved', () => {
        // Arrange
        const entries = [buildSummary('npcs:vaelith-corrun', 'Vaelith Corrun')];
        const loaded = codexReducer(INITIAL_CODEX_STATE, CodexActions.loadIndex.success({ entries }));
        const saved = { ...buildEntry('npcs:vaelith-corrun', 'Vaelith Corrun'), status: 'Missing' };

        // Act
        const state = codexReducer(loaded, CodexActions.saveEntry.success({ entry: saved }));

        // Assert
        expect(state.entries[0].status).toBe('Missing');
    });

    it('should not mutate the previous state', () => {
        // Arrange
        const entries = [buildSummary('npcs:vaelith-corrun', 'Vaelith Corrun')];

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, CodexActions.loadIndex.success({ entries }));

        // Assert
        expect(state === INITIAL_CODEX_STATE).toBe(false);
        expect(INITIAL_CODEX_STATE.entries.length).toBe(0);
    });

    it('should set the sidebar collapsed state directly', () => {
        // Arrange
        const action = CodexActions.sidebarCollapsedSet({ collapsed: true });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.sidebarCollapsed).toBe(true);
    });

    it('should toggle the sidebar', () => {
        // Arrange
        const action = CodexActions.sidebarToggled();

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.sidebarCollapsed).toBe(true);
    });

    it('should record the error when the index fails', () => {
        // Arrange
        const action = CodexActions.loadIndex.failure({ error: 'offline' });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.indexStatus).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('offline');
    });

    it('should mark the open entry as pending on request', () => {
        // Arrange
        const action = CodexActions.loadEntry.request({ id: 'npcs:vaelith-corrun' });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.openEntryStatus).toBe(ApiCallStatus.Pending);
    });

    it('should record the error when an entry fails to load', () => {
        // Arrange
        const action = CodexActions.loadEntry.failure({ error: 'gone' });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.openEntryStatus).toBe(ApiCallStatus.Failed);
        expect(state.error).toBe('gone');
    });

    it('should keep the entry list sorted by title after a create', () => {
        // Arrange
        const seeded = codexReducer(
            INITIAL_CODEX_STATE,
            CodexActions.loadIndex.success({ entries: [buildSummary('npcs:zarid-vale', 'Zarid Vale')] })
        );
        const created = buildEntry('npcs:alma-quist', 'Alma Quist');

        // Act
        const state = codexReducer(seeded, CodexActions.createEntry.success({ entry: created }));

        // Assert
        expect(state.entries[0].title).toBe('Alma Quist');
        expect(state.openEntry?.id).toBe('npcs:alma-quist');
    });

    it('should drop the entry and close it on delete', () => {
        // Arrange
        const entry = buildEntry('npcs:vaelith-corrun', 'Vaelith Corrun');
        const opened = codexReducer(
            codexReducer(INITIAL_CODEX_STATE, CodexActions.loadIndex.success({ entries: [entry] })),
            CodexActions.loadEntry.success({ entry })
        );

        // Act
        const state = codexReducer(opened, CodexActions.deleteEntry.success({ id: entry.id }));

        // Assert
        expect(state.entries.length).toBe(0);
        expect(state.recentIds.length).toBe(0);
        expect(state.openEntry === null).toBe(true);
    });

    it('should reset the filters when a section is opened', () => {
        // Arrange
        const filtered = codexReducer(
            INITIAL_CODEX_STATE,
            CodexActions.filtersChanged({ status: 'Alive', tags: ['ally'], query: 'vael' })
        );

        // Act
        const state = codexReducer(filtered, CodexActions.sectionOpened({ section: CodexSection.Places }));

        // Assert
        expect(state.activeSection).toBe(CodexSection.Places);
        expect(state.filters.status === null).toBe(true);
        expect(state.filters.tags.length).toBe(0);
    });

    it('should clear the open entry when it is closed', () => {
        // Arrange
        const entry = buildEntry('npcs:vaelith-corrun', 'Vaelith Corrun');
        const opened = codexReducer(INITIAL_CODEX_STATE, CodexActions.loadEntry.success({ entry }));

        // Act
        const state = codexReducer(opened, CodexActions.entryClosed());

        // Assert
        expect(state.openEntry === null).toBe(true);
        expect(state.openEntryStatus).toBe(ApiCallStatus.Idle);
    });

    it('should toggle player mode', () => {
        // Arrange
        const action = CodexActions.playerModeToggled();

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.playerMode).toBe(true);
    });

    it('should toggle the favourite flag on the list and the open entry', () => {
        // Arrange
        const entry = buildEntry('npcs:vaelith-corrun', 'Vaelith Corrun');
        const opened = codexReducer(
            codexReducer(INITIAL_CODEX_STATE, CodexActions.loadIndex.success({ entries: [entry] })),
            CodexActions.loadEntry.success({ entry })
        );

        // Act
        const state = codexReducer(opened, CodexActions.favouriteToggled({ id: entry.id }));

        // Assert
        expect(state.entries[0].favourite).toBe(true);
        expect(state.openEntry?.favourite).toBe(true);
    });

    it('should store the requested filters', () => {
        // Arrange
        const action = CodexActions.filtersChanged({ status: 'Dead', tags: ['ally'], query: 'ledger' });

        // Act
        const state = codexReducer(INITIAL_CODEX_STATE, action);

        // Assert
        expect(state.filters).toEqual({ status: 'Dead', tags: ['ally'], query: 'ledger' });
    });
});
