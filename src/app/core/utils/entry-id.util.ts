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

export const formatSlugLabel = (slug: string): string =>
    slug
        .split('-')
        .filter((part) => part !== '')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

export const formatReferenceValue = (value: string, titles: Record<string, string>): string => {
    const reference = parseEntryId(value);
    if (reference === null) {
        return value;
    }

    return titles[value] ?? formatSlugLabel(reference.slug);
};
