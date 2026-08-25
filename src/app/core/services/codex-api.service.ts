import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap, throwError } from 'rxjs';

import { CodexSection, EntryVisibility, ICodexEntry, ICodexEntrySummary, ICodexIndex } from '../models';
import { buildEntryId } from '../utils/entry-id.util';
import { stripFrontMatter, toEntrySummary } from '../utils/front-matter.util';
import { DraftStorageService } from './draft-storage.service';

const CODEX_INDEX_URL = 'assets/codex/index.json';

@Injectable({ providedIn: 'root' })
export class CodexApiService {
    private readonly http = inject(HttpClient);
    private readonly draftStorage = inject(DraftStorageService);

    loadIndex(): Observable<ICodexEntrySummary[]> {
        return this.http.get<ICodexIndex>(CODEX_INDEX_URL).pipe(
            map((index) => index.entries.map((entry) => toEntrySummary(entry as unknown as Record<string, unknown>))),
            map((entries) => entries.map((entry) => this.draftStorage.applySummaryOverlay(entry)))
        );
    }

    loadEntry(summary: ICodexEntrySummary): Observable<ICodexEntry> {
        const draft = this.draftStorage.read(summary.id);
        if (draft !== null) {
            return of({ ...summary, ...draft });
        }

        return this.http.get(summary.path, { responseType: 'text' }).pipe(
            map((source) => ({ ...summary, body: stripFrontMatter(source).trim() }))
        );
    }

    saveEntry(entry: ICodexEntry): Observable<ICodexEntry> {
        const saved: ICodexEntry = { ...entry, updatedAt: new Date().toISOString() };

        try {
            this.draftStorage.write(saved);
            return of(saved);
        } catch {
            return throwError(() => new Error("Couldn't save the entry to local storage."));
        }
    }

    createEntry(section: CodexSection, slug: string, title: string, status: string): Observable<ICodexEntry> {
        const id = buildEntryId(section, slug);

        return this.loadIndex().pipe(
            switchMap((entries) => {
                if (entries.some((entry) => entry.id === id)) {
                    return throwError(() => new Error('That name is already taken in this section.'));
                }

                const created: ICodexEntry = {
                    id,
                    section,
                    slug,
                    path: `assets/codex/${section}/${slug}.md`,
                    title,
                    status,
                    tags: [],
                    favourite: false,
                    visibility: EntryVisibility.Dm,
                    author: 'DM',
                    updatedAt: new Date().toISOString(),
                    fields: {},
                    excerpt: '',
                    body: `# ${title}\n\n`
                };

                this.draftStorage.write(created);
                return of(created);
            })
        );
    }

    deleteEntry(id: string): Observable<string> {
        this.draftStorage.remove(id);
        return of(id);
    }
}
