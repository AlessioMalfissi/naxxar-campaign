import { CodexSection, ICodexReference } from '../models';

const SECTION_VALUES: readonly string[] = Object.values(CodexSection);

export const buildEntryId = (section: CodexSection, slug: string): string => `${section}:${slug}`;

export const parseEntryId = (id: string): ICodexReference | null => {
    const [section, slug] = id.split(':');
    if (slug === undefined || slug === '' || !SECTION_VALUES.includes(section)) {
        return null;
    }
    return { section: section as CodexSection, slug, id };
};

export const slugify = (title: string): string =>
    title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
