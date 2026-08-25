import { CodexSection } from './codex-section.enum';
import { EntryVisibility } from './entry-visibility.enum';

export interface ICodexEntrySummary {
    id: string;
    section: CodexSection;
    slug: string;
    path: string;
    title: string;
    status: string;
    tags: string[];
    favourite: boolean;
    visibility: EntryVisibility;
    author: string;
    updatedAt: string;
    fields: Record<string, string>;
    excerpt: string;
}

export interface ICodexEntry extends ICodexEntrySummary {
    body: string;
}

export interface ICodexReference {
    section: CodexSection;
    slug: string;
    id: string;
}

export interface ICodexEntryFilter {
    section?: CodexSection;
    status?: string;
    tags?: string[];
    query?: string;
    visibility?: EntryVisibility;
}
