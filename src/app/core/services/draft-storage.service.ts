import { Injectable } from '@angular/core';

import { ICodexEntry, ICodexEntrySummary } from '../models';

const DRAFT_PREFIX = 'naxxar-campaign:entry:';

@Injectable({ providedIn: 'root' })
export class DraftStorageService {
    read(id: string): ICodexEntry | null {
        const raw = localStorage.getItem(`${DRAFT_PREFIX}${id}`);
        if (raw === null) {
            return null;
        }

        try {
            return JSON.parse(raw) as ICodexEntry;
        } catch {
            return null;
        }
    }

    write(entry: ICodexEntry): void {
        localStorage.setItem(`${DRAFT_PREFIX}${entry.id}`, JSON.stringify(entry));
    }

    remove(id: string): void {
        localStorage.removeItem(`${DRAFT_PREFIX}${id}`);
    }

    listIds(): string[] {
        const ids: string[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key !== null && key.startsWith(DRAFT_PREFIX)) {
                ids.push(key.slice(DRAFT_PREFIX.length));
            }
        }

        return ids;
    }

    applySummaryOverlay(summary: ICodexEntrySummary): ICodexEntrySummary {
        const draft = this.read(summary.id);
        if (draft === null) {
            return summary;
        }

        const { body: _body, ...rest } = draft;
        return { ...summary, ...rest };
    }
}
