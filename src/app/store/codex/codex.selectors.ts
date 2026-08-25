import { createFeatureSelector, createSelector } from '@ngrx/store';

import { ApiCallStatus, EntryVisibility, ICodexEntrySummary } from '@core/models';
import { CODEX_FEATURE_KEY, ICodexState } from './codex.state';

export const selectCodexState = createFeatureSelector<ICodexState>(CODEX_FEATURE_KEY);

export const selectPlayerMode = createSelector(selectCodexState, (state) => state.playerMode);

export const selectSidebarCollapsed = createSelector(selectCodexState, (state) => state.sidebarCollapsed);

export const selectActiveSection = createSelector(selectCodexState, (state) => state.activeSection);

export const selectFilters = createSelector(selectCodexState, (state) => state.filters);

export const selectError = createSelector(selectCodexState, (state) => state.error);

export const selectIndexLoading = createSelector(
    selectCodexState,
    (state) => state.indexStatus === ApiCallStatus.Pending
);

export const selectEntryLoading = createSelector(
    selectCodexState,
    (state) => state.openEntryStatus === ApiCallStatus.Pending
);

export const selectVisibleEntries = createSelector(selectCodexState, (state) =>
    state.playerMode
        ? state.entries.filter((entry) => entry.visibility === EntryVisibility.Revealed)
        : state.entries
);

export const selectEntryTitles = createSelector(selectVisibleEntries, (entries) =>
    entries.reduce<Record<string, string>>((titles, entry) => ({ ...titles, [entry.id]: entry.title }), {})
);

export const selectSectionCounts = createSelector(selectVisibleEntries, (entries) =>
    entries.reduce<Record<string, number>>(
        (counts, entry) => ({ ...counts, [entry.section]: (counts[entry.section] ?? 0) + 1 }),
        {}
    )
);

export const selectSectionEntries = createSelector(
    selectVisibleEntries,
    selectActiveSection,
    selectFilters,
    (entries, section, filters): ICodexEntrySummary[] =>
        entries
            .filter((entry) => entry.section === section)
            .filter((entry) => filters.status === null || entry.status === filters.status)
            .filter((entry) => filters.tags.length === 0 || filters.tags.every((tag) => entry.tags.includes(tag)))
            .filter((entry) => {
                const query = filters.query.trim().toLowerCase();
                return query === '' || entry.title.toLowerCase().includes(query) || entry.excerpt.toLowerCase().includes(query);
            })
);

export const selectSectionTags = createSelector(selectVisibleEntries, selectActiveSection, (entries, section) =>
    [...new Set(entries.filter((entry) => entry.section === section).flatMap((entry) => entry.tags))].toSorted()
);

export const selectRecentEntries = createSelector(selectCodexState, selectVisibleEntries, (state, entries) =>
    state.recentIds
        .filter((id) => entries.some((entry) => entry.id === id && entry.section === state.activeSection))
        .map((id) => entries.find((entry) => entry.id === id) as ICodexEntrySummary)
);

export const selectOpenEntry = createSelector(selectCodexState, (state) => state.openEntry);

export const selectReferencingEntries = createSelector(
    selectVisibleEntries,
    selectOpenEntry,
    (entries, openEntry) =>
        openEntry === null
            ? []
            : entries.filter(
                  (entry) => entry.id !== openEntry.id && entry.excerpt.includes(openEntry.title)
              )
);
