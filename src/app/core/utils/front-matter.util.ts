import { CodexSection, EntryVisibility, ICodexEntry, ICodexEntrySummary } from '../models';

export interface IFrontMatterResult {
    data: Record<string, unknown>;
    body: string;
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const parseScalar = (raw: string): string | boolean => {
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return value;
};

export const parseFrontMatter = (source: string): IFrontMatterResult => {
    const match = FRONT_MATTER_PATTERN.exec(source);
    if (match === null) {
        return { data: {}, body: source };
    }

    const data: Record<string, unknown> = {};
    let nested: string | null = null;

    for (const line of match[1].split(/\r?\n/)) {
        if (line.trim() === '') {
            continue;
        }

        const indented = /^\s{2,}/.test(line);
        const separator = line.indexOf(':');
        if (separator === -1) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const raw = line.slice(separator + 1).trim();

        if (indented && nested !== null) {
            (data[nested] as Record<string, string>)[key] = String(parseScalar(raw));
            continue;
        }

        if (raw === '') {
            nested = key;
            data[key] = {};
            continue;
        }

        nested = null;
        data[key] = raw.startsWith('[')
            ? raw
                  .slice(1, -1)
                  .split(',')
                  .map((item) => String(parseScalar(item)))
                  .filter((item) => item !== '')
            : parseScalar(raw);
    }

    return { data, body: source.slice(match[0].length) };
};

export const stripFrontMatter = (source: string): string => parseFrontMatter(source).body;

export const serializeFrontMatter = (entry: ICodexEntry): string => {
    const fieldLines = Object.entries(entry.fields).map(([key, value]) => `  ${key}: ${value}`);

    const lines = [
        '---',
        `title: ${entry.title}`,
        `status: ${entry.status}`,
        `tags: [${entry.tags.join(', ')}]`,
        `favourite: ${entry.favourite}`,
        `visibility: ${entry.visibility}`,
        `author: ${entry.author}`,
        `updatedAt: ${entry.updatedAt}`,
        'fields:',
        ...fieldLines,
        '---',
        ''
    ];

    return `${lines.join('\n')}\n${entry.body.trimStart()}`;
};

export const toEntrySummary = (raw: Record<string, unknown>): ICodexEntrySummary => ({
    id: String(raw['id'] ?? ''),
    section: String(raw['section'] ?? CodexSection.Npcs) as CodexSection,
    slug: String(raw['slug'] ?? ''),
    path: String(raw['path'] ?? ''),
    title: String(raw['title'] ?? ''),
    status: String(raw['status'] ?? ''),
    tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : [],
    favourite: raw['favourite'] === true,
    visibility: raw['visibility'] === EntryVisibility.Dm ? EntryVisibility.Dm : EntryVisibility.Revealed,
    author: String(raw['author'] ?? 'DM'),
    updatedAt: String(raw['updatedAt'] ?? new Date().toISOString()),
    fields: (raw['fields'] ?? {}) as Record<string, string>,
    excerpt: String(raw['excerpt'] ?? '')
});
