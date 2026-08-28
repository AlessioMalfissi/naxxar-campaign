import { createReducer, on } from '@ngrx/store';

import { ApiCallStatus } from '@core/models';
import * as CodexActions from './codex.actions';
import { ICodexState, INITIAL_CODEX_STATE } from './codex.state';

const RECENT_LIMIT = 8;

const withRecent = (recentIds: string[], id: string): string[] =>
    [id, ...recentIds.filter((item) => item !== id)].slice(0, RECENT_LIMIT);

export const codexReducer = createReducer<ICodexState>(
    INITIAL_CODEX_STATE,

    on(CodexActions.loadIndex.request, (state): ICodexState => ({
        ...state,
        indexStatus: ApiCallStatus.Pending,
        error: null
    })),

    on(CodexActions.loadIndex.success, (state, { entries }): ICodexState => ({
        ...state,
        entries,
        indexStatus: ApiCallStatus.Success
    })),

    on(CodexActions.loadIndex.failure, (state, { error }): ICodexState => ({
        ...state,
        indexStatus: ApiCallStatus.Failed,
        error
    })),

    on(CodexActions.loadEntry.request, (state): ICodexState => ({
        ...state,
        openEntryStatus: ApiCallStatus.Pending,
        error: null
    })),

    on(CodexActions.loadEntry.success, (state, { entry }): ICodexState => ({
        ...state,
        openEntry: entry,
        openEntryStatus: ApiCallStatus.Success,
        activeSection: entry.section,
        recentIds: withRecent(state.recentIds, entry.id)
    })),

    on(CodexActions.loadEntry.failure, (state, { error }): ICodexState => ({
        ...state,
        openEntryStatus: ApiCallStatus.Failed,
        error
    })),

    on(CodexActions.saveEntry.success, (state, { entry }): ICodexState => ({
        ...state,
        openEntry: entry,
        entries: state.entries.map((item) => (item.id === entry.id ? { ...item, ...entry } : item))
    })),

    on(CodexActions.createEntry.success, (state, { entry }): ICodexState => ({
        ...state,
        entries: [...state.entries, entry].toSorted((a, b) => a.title.localeCompare(b.title)),
        openEntry: entry,
        recentIds: withRecent(state.recentIds, entry.id)
    })),

    on(CodexActions.deleteEntry.success, (state, { id }): ICodexState => ({
        ...state,
        entries: state.entries.filter((entry) => entry.id !== id),
        recentIds: state.recentIds.filter((item) => item !== id),
        openEntry: state.openEntry?.id === id ? null : state.openEntry
    })),

    on(CodexActions.sectionOpened, (state, { section }): ICodexState => ({
        ...state,
        activeSection: section,
        filters: INITIAL_CODEX_STATE.filters
    })),

    on(CodexActions.entryClosed, (state): ICodexState => ({
        ...state,
        openEntry: null,
        openEntryStatus: ApiCallStatus.Idle
    })),

    on(CodexActions.sidebarToggled, (state): ICodexState => ({
        ...state,
        sidebarCollapsed: !state.sidebarCollapsed
    })),

    on(CodexActions.sidebarCollapsedSet, (state, { collapsed }): ICodexState => ({
        ...state,
        sidebarCollapsed: collapsed
    })),

    on(CodexActions.playerModeToggled, (state): ICodexState => ({
        ...state,
        playerMode: !state.playerMode
    })),

    on(CodexActions.favouriteToggled, (state, { id }): ICodexState => ({
        ...state,
        entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, favourite: !entry.favourite } : entry
        ),
        openEntry:
            state.openEntry?.id === id
                ? { ...state.openEntry, favourite: !state.openEntry.favourite }
                : state.openEntry
    })),

    on(CodexActions.filtersChanged, (state, { status, tags, query }): ICodexState => ({
        ...state,
        filters: { status, tags, query }
    }))
);
