import { Injectable } from '@angular/core';

export type MarkdownCommand =
    | 'bold'
    | 'italic'
    | 'strikethrough'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'numberedList'
    | 'quote'
    | 'link'
    | 'code'
    | 'table'
    | 'image';

export interface ISelection {
    start: number;
    end: number;
}

export interface ICommandResult {
    value: string;
    selection: ISelection;
}

interface IWrapper {
    marker: string;
    placeholder: string;
}

const WRAPPERS: Partial<Record<MarkdownCommand, IWrapper>> = {
    bold: { marker: '**', placeholder: 'bold text' },
    italic: { marker: '*', placeholder: 'italic text' },
    strikethrough: { marker: '~~', placeholder: 'struck text' },
    code: { marker: '`', placeholder: 'code' }
};

const LINE_PREFIXES: Partial<Record<MarkdownCommand, string>> = {
    heading1: '# ',
    heading2: '## ',
    heading3: '### ',
    bulletList: '- ',
    quote: '> '
};

const TABLE_TEMPLATE = '| Column | Column |\n| --- | --- |\n| Value | Value |';

@Injectable({ providedIn: 'root' })
export class MarkdownCommandService {
    apply(command: MarkdownCommand, value: string, selection: ISelection): ICommandResult {
        const wrapper = WRAPPERS[command];
        if (wrapper !== undefined) {
            return this.applyWrapper(wrapper, value, selection);
        }

        const prefix = LINE_PREFIXES[command];
        if (prefix !== undefined) {
            return this.applyLinePrefix(prefix, value, selection);
        }

        if (command === 'numberedList') {
            return this.applyNumberedList(value, selection);
        }

        if (command === 'link') {
            return this.applyInsertion(value, selection, '[', '](https://)', 'link text');
        }

        if (command === 'image') {
            return this.applyInsertion(value, selection, '![', '](https://)', 'alt text');
        }

        return this.applyBlock(value, selection, TABLE_TEMPLATE);
    }

    isActive(command: MarkdownCommand, value: string, selection: ISelection): boolean {
        const wrapper = WRAPPERS[command];
        if (wrapper === undefined) {
            return false;
        }

        return this.isMarkerActive(wrapper.marker, value, selection);
    }

    private applyWrapper(wrapper: IWrapper, value: string, selection: ISelection): ICommandResult {
        const { marker, placeholder } = wrapper;
        const selected = value.slice(selection.start, selection.end);

        if (this.isMarkerActive(marker, value, selection)) {
            const start = selection.start - marker.length;
            const end = selection.end + marker.length;
            return {
                value: value.slice(0, start) + selected + value.slice(end),
                selection: { start, end: start + selected.length }
            };
        }

        const text = selected === '' ? placeholder : selected;
        const inserted = `${marker}${text}${marker}`;

        return {
            value: value.slice(0, selection.start) + inserted + value.slice(selection.end),
            selection: {
                start: selection.start + marker.length,
                end: selection.start + marker.length + text.length
            }
        };
    }

    private isMarkerActive(marker: string, value: string, selection: ISelection): boolean {
        const before = value.slice(Math.max(0, selection.start - marker.length), selection.start);
        const after = value.slice(selection.end, selection.end + marker.length);

        if (before !== marker || after !== marker) {
            return false;
        }

        // A single asterisk belonging to a surrounding bold pair is not italic emphasis.
        const outerBefore = value.charAt(selection.start - marker.length - 1);
        const outerAfter = value.charAt(selection.end + marker.length);

        return !(outerBefore === marker && outerAfter === marker);
    }

    private applyLinePrefix(prefix: string, value: string, selection: ISelection): ICommandResult {
        const start = value.lastIndexOf('\n', selection.start - 1) + 1;
        const end = value.indexOf('\n', selection.end) === -1 ? value.length : value.indexOf('\n', selection.end);
        const lines = value.slice(start, end).split('\n');
        const allPrefixed = lines.every((line) => line.startsWith(prefix));

        const updated = lines
            .map((line) => (allPrefixed ? line.slice(prefix.length) : `${prefix}${line.replace(/^(#{1,3}\s|-\s|>\s)/, '')}`))
            .join('\n');

        return {
            value: value.slice(0, start) + updated + value.slice(end),
            selection: { start, end: start + updated.length }
        };
    }

    private applyNumberedList(value: string, selection: ISelection): ICommandResult {
        const start = value.lastIndexOf('\n', selection.start - 1) + 1;
        const end = value.indexOf('\n', selection.end) === -1 ? value.length : value.indexOf('\n', selection.end);
        const lines = value.slice(start, end).split('\n');
        const allPrefixed = lines.every((line) => /^\d+\.\s/.test(line));

        const updated = lines
            .map((line, index) => (allPrefixed ? line.replace(/^\d+\.\s/, '') : `${index + 1}. ${line}`))
            .join('\n');

        return {
            value: value.slice(0, start) + updated + value.slice(end),
            selection: { start, end: start + updated.length }
        };
    }

    private applyInsertion(
        value: string,
        selection: ISelection,
        open: string,
        close: string,
        placeholder: string
    ): ICommandResult {
        const selected = value.slice(selection.start, selection.end);
        const text = selected === '' ? placeholder : selected;
        const inserted = `${open}${text}${close}`;

        return {
            value: value.slice(0, selection.start) + inserted + value.slice(selection.end),
            selection: { start: selection.start + open.length, end: selection.start + open.length + text.length }
        };
    }

    private applyBlock(value: string, selection: ISelection, block: string): ICommandResult {
        const prefix = selection.start === 0 || value[selection.start - 1] === '\n' ? '' : '\n\n';
        const inserted = `${prefix}${block}\n`;

        return {
            value: value.slice(0, selection.start) + inserted + value.slice(selection.end),
            selection: { start: selection.start + inserted.length, end: selection.start + inserted.length }
        };
    }
}
