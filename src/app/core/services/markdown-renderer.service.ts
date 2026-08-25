import { Injectable } from '@angular/core';

import { parseEntryId } from '../utils/entry-id.util';

export interface IRenderOptions {
    titles: Record<string, string>;
    showDmBlocks: boolean;
}

const DEFAULT_OPTIONS: IRenderOptions = { titles: {}, showDmBlocks: true };

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

@Injectable({ providedIn: 'root' })
export class MarkdownRendererService {
    render(markdown: string, options: Partial<IRenderOptions> = {}): string {
        const resolved: IRenderOptions = { ...DEFAULT_OPTIONS, ...options };
        const codeBlocks: string[] = [];

        const withoutCode = escapeHtml(markdown).replace(/```([\s\S]*?)```/g, (_match, code: string) => {
            codeBlocks.push(code.replace(/^\r?\n/, ''));
            return `\u0000CODE${codeBlocks.length - 1}\u0000`;
        });

        const html = this.renderBlocks(withoutCode.split(/\r?\n/), resolved);

        return html.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => {
            const block = codeBlocks[Number(index)] ?? '';
            return `<pre class="codex-code-block"><code>${block}</code></pre>`;
        });
    }

    renderInline(text: string, options: Partial<IRenderOptions> = {}): string {
        return this.inline(escapeHtml(text), { ...DEFAULT_OPTIONS, ...options });
    }

    private renderBlocks(lines: string[], options: IRenderOptions): string {
        const html: string[] = [];
        let index = 0;

        while (index < lines.length) {
            const line = lines[index];

            if (line.trim() === '') {
                index += 1;
                continue;
            }

            if (line.startsWith(':::dm')) {
                const block: string[] = [];
                index += 1;
                while (index < lines.length && !lines[index].startsWith(':::')) {
                    block.push(lines[index]);
                    index += 1;
                }
                index += 1;
                if (options.showDmBlocks) {
                    html.push(`<div class="codex-dm-block">${this.renderBlocks(block, options)}</div>`);
                }
                continue;
            }

            const heading = /^(#{1,3})\s+(.*)$/.exec(line);
            if (heading !== null) {
                const level = heading[1].length;
                html.push(`<h${level} class="codex-h${level}">${this.inline(heading[2], options)}</h${level}>`);
                index += 1;
                continue;
            }

            if (line.trim().startsWith('|') && lines[index + 1]?.includes('---')) {
                const table: string[] = [];
                while (index < lines.length && lines[index].trim().startsWith('|')) {
                    table.push(lines[index]);
                    index += 1;
                }
                html.push(this.renderTable(table, options));
                continue;
            }

            if (line.startsWith('>')) {
                const quote: string[] = [];
                while (index < lines.length && lines[index].startsWith('>')) {
                    quote.push(lines[index].replace(/^>\s?/, ''));
                    index += 1;
                }
                html.push(`<blockquote class="codex-quote">${this.inline(quote.join(' '), options)}</blockquote>`);
                continue;
            }

            if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
                const items: string[] = [];
                while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
                    items.push(lines[index]);
                    index += 1;
                }
                html.push(this.renderList(items, options));
                continue;
            }

            if (line.startsWith('\u0000CODE')) {
                html.push(line);
                index += 1;
                continue;
            }

            const paragraph: string[] = [];
            while (index < lines.length && lines[index].trim() !== '' && !/^(#{1,3}\s|>|:::|\s*([-*]|\d+\.)\s)/.test(lines[index])) {
                paragraph.push(lines[index]);
                index += 1;
            }
            html.push(`<p class="codex-paragraph">${this.inline(paragraph.join(' '), options)}</p>`);
        }

        return html.join('');
    }

    private renderList(items: string[], options: IRenderOptions): string {
        const ordered = /^\s*\d+\./.test(items[0]);
        const tag = ordered ? 'ol' : 'ul';
        const baseIndent = Math.min(...items.map((item) => item.length - item.trimStart().length));
        const html: string[] = [`<${tag} class="codex-list">`];
        let index = 0;

        while (index < items.length) {
            const item = items[index];
            const indent = item.length - item.trimStart().length;

            if (indent > baseIndent) {
                const nested: string[] = [];
                while (index < items.length && items[index].length - items[index].trimStart().length > baseIndent) {
                    nested.push(items[index]);
                    index += 1;
                }
                html.push(this.renderList(nested, options));
                continue;
            }

            const content = item.trimStart().replace(/^([-*]|\d+\.)\s+/, '');
            html.push(`<li>${this.inline(content, options)}</li>`);
            index += 1;
        }

        html.push(`</${tag}>`);
        return html.join('');
    }

    private renderTable(rows: string[], options: IRenderOptions): string {
        const cells = (row: string): string[] =>
            row
                .trim()
                .replace(/^\||\|$/g, '')
                .split('|')
                .map((cell) => cell.trim());

        const header = cells(rows[0]);
        const body = rows.slice(2).map((row) => cells(row));

        const headerHtml = header.map((cell) => `<th>${this.inline(cell, options)}</th>`).join('');
        const bodyHtml = body
            .map((row) => `<tr>${row.map((cell) => `<td>${this.inline(cell, options)}</td>`).join('')}</tr>`)
            .join('');

        return `<table class="codex-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    }

    private inline(text: string, options: IRenderOptions): string {
        return text
            .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img class="codex-image" src="$2" alt="$1" />')
            .replace(/\[\[([a-z]+:[a-z0-9-]+)\]\]/g, (match, id: string) => this.entityLink(match, id, options))
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="codex-link" href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/`([^`]+)`/g, '<code class="codex-code">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    }

    private entityLink(match: string, id: string, options: IRenderOptions): string {
        const reference = parseEntryId(id);
        if (reference === null) {
            return match;
        }

        const title = options.titles[id] ?? reference.slug.replace(/-/g, ' ');
        return `<a class="codex-entity-link" data-entry-id="${id}" href="/campaign/${reference.section}/${reference.slug}">${title}</a>`;
    }
}
