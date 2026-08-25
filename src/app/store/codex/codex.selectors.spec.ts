import { ApiCallStatus, CodexSection, EntryVisibility } from '@core/models';
import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import {
    selectActiveSection,
    selectEntryLoading,
    selectEntryTitles,
    selectError,
    selectFilters,
    selectIndexLoading,
    selectOpenEntry,
    selectPlayerMode,
    selectRecentEntries,
    selectReferencingEntries,
    selectSectionCounts,
    selectSectionEntries,
    selectSectionTags,
    selectSidebarCollapsed,
    selectVisibleEntries
} from './codex.selectors';
import { ICodexState, INITIAL_CODEX_STATE } from './codex.state';

const REVEALED = buildSummary();
const HIDDEN = buildSummary({
    id: 'npcs:mother-ilsabeth',
    slug: 'mother-ilsabeth',
    title: 'Mother Ilsabeth',
    status: 'Unknown',
    tags: ['ashen-choir'],
    visibility: EntryVisibility.Dm,
    excerpt: 'Terrifies Vaelith Corrun.'
});
const OTHER_SECTION = buildSummary({
    id: 'places:ashfall-city',
    section: CodexSection.Places,
    slug: 'ashfall-city',
    title: 'Ashfall city',
    tags: ['capital']
});

const buildState = (overrides: Partial<ICodexState> = {}): ICodexState => ({
    ...INITIAL_CODEX_STATE,
    entries: [REVEALED, HIDDEN, OTHER_SECTION],
    ...overrides
});

describe('codexSelectors', () => {
    it('should expose the simple slices of state', () => {
        // Arrange
        const state = buildState({
            playerMode: true,
            sidebarCollapsed: true,
            error: 'offline',
            filters: { status: 'Alive', tags: [], query: '' }
        });

        // Act
        const projected = {
            playerMode: selectPlayerMode.projector(state),
            collapsed: selectSidebarCollapsed.projector(state),
            section: selectActiveSection.projector(state),
            filters: selectFilters.projector(state),
            error: selectError.projector(state)
        };

        // Assert
        expect(projected.playerMode).toBe(true);
        expect(projected.collapsed).toBe(true);
        expect(projected.section).toBe(CodexSection.Npcs);
        expect(projected.filters.status).toBe('Alive');
        expect(projected.error).toBe('offline');
    });

    it('should report loading while a call is pending', () => {
        // Arrange
        const state = buildState({
            indexStatus: ApiCallStatus.Pending,
            openEntryStatus: ApiCallStatus.Pending
        });

        // Act
        const indexLoading = selectIndexLoading.projector(state);
        const entryLoading = selectEntryLoading.projector(state);

        // Assert
        expect(indexLoading).toBe(true);
        expect(entryLoading).toBe(true);
    });

    it('should hide DM-only entries in player mode', () => {
        // Arrange
        const state = buildState({ playerMode: true });

        // Act
        const entries = selectVisibleEntries.projector(state);

        // Assert
        expect(entries.length).toBe(2);
        expect(entries.some((entry) => entry.id === HIDDEN.id)).toBe(false);
    });

    it('should map ids to titles', () => {
        // Arrange
        const entries = [REVEALED, OTHER_SECTION];

        // Act
        const titles = selectEntryTitles.projector(entries);

        // Assert
        expect(titles['npcs:vaelith-corrun']).toBe('Vaelith Corrun');
    });

    it('should count entries per section', () => {
        // Arrange
        const entries = [REVEALED, HIDDEN, OTHER_SECTION];

        // Act
        const counts = selectSectionCounts.projector(entries);

        // Assert
        expect(counts[CodexSection.Npcs]).toBe(2);
        expect(counts[CodexSection.Places]).toBe(1);
    });

    it('should filter section entries by status, tags and query', () => {
        // Arrange
        const entries = [REVEALED, HIDDEN, OTHER_SECTION];

        // Act
        const byStatus = selectSectionEntries.projector(entries, CodexSection.Npcs, {
            status: 'Alive',
            tags: [],
            query: ''
        });
        const byTag = selectSectionEntries.projector(entries, CodexSection.Npcs, {
            status: null,
            tags: ['ashen-choir'],
            query: ''
        });
        const byQuery = selectSectionEntries.projector(entries, CodexSection.Npcs, {
            status: null,
            tags: [],
            query: ' ledger '
        });

        // Assert
        expect(byStatus.length).toBe(1);
        expect(byTag[0].id).toBe(HIDDEN.id);
        expect(byQuery[0].id).toBe(REVEALED.id);
    });

    it('should list the sorted unique tags of the active section', () => {
        // Arrange
        const entries = [REVEALED, HIDDEN, OTHER_SECTION];

        // Act
        const tags = selectSectionTags.projector(entries, CodexSection.Npcs);

        // Assert
        expect(tags).toEqual(['ally', 'ashen-choir', 'silver-ledger']);
    });

    it('should resolve recent entries of the active section only', () => {
        // Arrange
        const state = buildState({ recentIds: ['places:ashfall-city', 'npcs:vaelith-corrun'] });

        // Act
        const recent = selectRecentEntries.projector(state, [REVEALED, HIDDEN, OTHER_SECTION]);

        // Assert
        expect(recent.length).toBe(1);
        expect(recent[0].id).toBe('npcs:vaelith-corrun');
    });

    it('should list entries whose excerpt mentions the open entry', () => {
        // Arrange
        const openEntry = buildEntry();

        // Act
        const referencing = selectReferencingEntries.projector([REVEALED, HIDDEN], openEntry);

        // Assert
        expect(referencing.length).toBe(1);
        expect(referencing[0].id).toBe(HIDDEN.id);
    });

    it('should return no references when nothing is open', () => {
        // Arrange
        const state = buildState();

        // Act
        const openEntry = selectOpenEntry.projector(state);
        const referencing = selectReferencingEntries.projector([REVEALED], openEntry);

        // Assert
        expect(openEntry === null).toBe(true);
        expect(referencing.length).toBe(0);
    });
});
