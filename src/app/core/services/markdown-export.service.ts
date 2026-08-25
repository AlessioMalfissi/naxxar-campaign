import { Injectable } from '@angular/core';

import { ICodexEntry } from '../models';
import { serializeFrontMatter } from '../utils/front-matter.util';

@Injectable({ providedIn: 'root' })
export class MarkdownExportService {
    toMarkdown(entry: ICodexEntry): string {
        return serializeFrontMatter(entry);
    }

    download(entry: ICodexEntry): void {
        const blob = new Blob([this.toMarkdown(entry)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `${entry.slug}.md`;
        anchor.click();

        URL.revokeObjectURL(url);
    }
}
