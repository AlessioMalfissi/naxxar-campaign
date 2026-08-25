import { CodexSection, EntryVisibility } from '@core/models';
import { buildEntry } from '@testing/entry.fixtures';
import { parseFrontMatter, serializeFrontMatter, stripFrontMatter, toEntrySummary } from './front-matter.util';

const SOURCE = [
    '---',
    'title: Vaelith Corrun',
    'status: Alive',
    'tags: [ally, silver-ledger]',
    'favourite: true',
    'visibility: revealed',
    'fields:',
    '  race: Half-elf',
    '  role: "Broker of debts"',
    '---',
    '# Who he is',
    '',
    'Speaks softly.'
].join('\n');

describe('frontMatterUtil', () => {
    it('should parse scalars, arrays and booleans', () => {
        // Arrange
        const source = SOURCE;

        // Act
        const result = parseFrontMatter(source);

        // Assert
        expect(result.data['title']).toBe('Vaelith Corrun');
        expect(result.data['tags']).toEqual(['ally', 'silver-ledger']);
        expect(result.data['favourite']).toBe(true);
    });

    it('should parse an indented nested block into an object', () => {
        // Arrange
        const source = SOURCE;

        // Act
        const result = parseFrontMatter(source);

        // Assert
        expect(result.data['fields']).toEqual({ race: 'Half-elf', role: 'Broker of debts' });
    });

    it('should return the body without the front matter block', () => {
        // Arrange
        const source = SOURCE;

        // Act
        const body = stripFrontMatter(source);

        // Assert
        expect(body.startsWith('# Who he is')).toBe(true);
    });

    it('should return the whole source when there is no front matter', () => {
        // Arrange
        const source = '# Plain markdown';

        // Act
        const result = parseFrontMatter(source);

        // Assert
        expect(result.body).toBe(source);
        expect(Object.keys(result.data).length).toBe(0);
    });

    it('should ignore blank lines and lines without a separator', () => {
        // Arrange
        const source = ['---', '', 'no-separator-here', 'title: Grum', '---', 'Body'].join('\n');

        // Act
        const result = parseFrontMatter(source);

        // Assert
        expect(result.data['title']).toBe('Grum');
        expect(Object.keys(result.data).length).toBe(1);
    });

    it('should read false as a boolean', () => {
        // Arrange
        const source = ['---', 'favourite: false', '---', 'Body'].join('\n');

        // Act
        const result = parseFrontMatter(source);

        // Assert
        expect(result.data['favourite']).toBe(false);
    });

    it('should round-trip an entry through serialisation', () => {
        // Arrange
        const entry = buildEntry({ favourite: true });

        // Act
        const serialized = serializeFrontMatter(entry);
        const parsed = parseFrontMatter(serialized);

        // Assert
        expect(parsed.data['title']).toBe(entry.title);
        expect(parsed.data['tags']).toEqual(entry.tags);
        expect(parsed.data['favourite']).toBe(true);
        expect(parsed.body.trim()).toBe(entry.body.trim());
    });

    it('should map a raw index record onto a summary', () => {
        // Arrange
        const raw = {
            id: 'places:ashfall-city',
            section: CodexSection.Places,
            slug: 'ashfall-city',
            path: 'assets/codex/places/ashfall-city.md',
            title: 'Ashfall city',
            status: 'Visited',
            tags: ['capital'],
            favourite: true,
            visibility: EntryVisibility.Dm,
            author: 'DM',
            updatedAt: '2026-08-01T00:00:00.000Z',
            fields: { type: 'Settlement' },
            excerpt: 'Ash on every roof.'
        };

        // Act
        const summary = toEntrySummary(raw);

        // Assert
        expect(summary.id).toBe('places:ashfall-city');
        expect(summary.visibility).toBe(EntryVisibility.Dm);
        expect(summary.favourite).toBe(true);
    });

    it('should fall back to safe defaults for a sparse record', () => {
        // Arrange
        const raw: Record<string, unknown> = {};

        // Act
        const summary = toEntrySummary(raw);

        // Assert
        expect(summary.section).toBe(CodexSection.Npcs);
        expect(summary.visibility).toBe(EntryVisibility.Revealed);
        expect(summary.tags.length).toBe(0);
        expect(summary.author).toBe('DM');
    });
});
