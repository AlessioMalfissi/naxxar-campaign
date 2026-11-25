import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { CodexSection, EntryVisibility, ICodexEntry, ICodexEntryFilter, ICodexEntrySummary } from '../models';
import { toApiError } from '../errors/api-error';
import { parseEntryId } from '../utils/entry-id.util';
import { toEntry, toEntrySummary } from '../utils/front-matter.util';
import { CampaignContextService } from './campaign-context.service';

@Injectable({ providedIn: 'root' })
export class CodexApiService {
    private readonly http = inject(HttpClient);
    private readonly campaignContext = inject(CampaignContextService);

    loadIndex(filter: ICodexEntryFilter = {}): Observable<ICodexEntrySummary[]> {
        let params = new HttpParams();

        if (filter.section !== undefined) {
            params = params.set('section', filter.section);
        }
        if (filter.status !== undefined) {
            params = params.set('status', filter.status);
        }
        if (filter.visibility !== undefined) {
            params = params.set('visibility', filter.visibility);
        }
        if (filter.tags !== undefined && filter.tags.length > 0) {
            params = params.set('tags', filter.tags.join(','));
        }
        if (filter.query !== undefined && filter.query.trim() !== '') {
            params = params.set('query', filter.query.trim());
        }

        return this.http
            .get<Record<string, unknown>[]>(this.entriesUrl(), { params })
            .pipe(map((entries) => entries.map((entry) => toEntrySummary(entry))));
    }

    loadEntry(summary: ICodexEntrySummary): Observable<ICodexEntry> {
        return this.http
            .get<Record<string, unknown>>(`${this.entriesUrl()}/${summary.section}/${summary.slug}`)
            .pipe(map((raw) => toEntry(raw)));
    }

    saveEntry(entry: ICodexEntry): Observable<ICodexEntry> {
        return this.http
            .put<Record<string, unknown>>(`${this.entriesUrl()}/${entry.section}/${entry.slug}`, entry)
            .pipe(
                map((raw) => toEntry(raw)),
                catchError(this.toFriendlyError("Couldn't save the entry. Retry."))
            );
    }

    createEntry(
        section: CodexSection,
        title: string,
        status: string,
        tags: string[] = [],
        visibility: EntryVisibility = EntryVisibility.Dm,
        fields: Record<string, string> = {}
    ): Observable<ICodexEntry> {
        return this.http
            .post<Record<string, unknown>>(this.entriesUrl(), {
                section,
                title,
                status,
                tags,
                visibility,
                fields
            })
            .pipe(
                map((raw) => toEntry(raw)),
                catchError(this.toFriendlyError("Couldn't create the entry. Retry."))
            );
    }

    deleteEntry(id: string): Observable<string> {
        const reference = parseEntryId(id);
        if (reference === null) {
            return throwError(() => new Error('Invalid entry id.'));
        }

        return this.http
            .delete<void>(`${this.entriesUrl()}/${reference.section}/${reference.slug}`)
            .pipe(map(() => id));
    }

    private entriesUrl(): string {
        return `${this.campaignContext.baseUrl()}/entries`;
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
