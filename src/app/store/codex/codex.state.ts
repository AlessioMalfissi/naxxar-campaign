import { ApiCallStatus, CodexSection, ICodexEntry, ICodexEntrySummary } from '@core/models';

export const CODEX_FEATURE_KEY = 'codex';

export interface ICodexFilters {
    status: string | null;
    tags: string[];
    query: string;
}

export interface ICodexState {
    entries: ICodexEntrySummary[];
    indexStatus: ApiCallStatus;
    openEntry: ICodexEntry | null;
    openEntryStatus: ApiCallStatus;
    activeSection: CodexSection;
    recentIds: string[];
    filters: ICodexFilters;
    sidebarCollapsed: boolean;
    playerMode: boolean;
    error: string | null;
}

export const INITIAL_CODEX_STATE: ICodexState = {
    entries: [],
    indexStatus: ApiCallStatus.Idle,
    openEntry: null,
    openEntryStatus: ApiCallStatus.Idle,
    activeSection: CodexSection.Npcs,
    recentIds: [],
    filters: { status: null, tags: [], query: '' },
    sidebarCollapsed: false,
    playerMode: false,
    error: null
};
