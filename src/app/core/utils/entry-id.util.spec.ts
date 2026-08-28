import { CodexSection } from '@core/models';
import { buildEntryId, formatReferenceValue, formatSlugLabel, parseEntryId, slugify } from './entry-id.util';

describe('entryIdUtil', () => {
    it('should build an id from a section and a slug', () => {
        // Arrange
        const section = CodexSection.Organizations;

        // Act
        const id = buildEntryId(section, 'silver-ledger');

        // Assert
        expect(id).toBe('organizations:silver-ledger');
    });

    it('should parse a valid id into a reference', () => {
        // Arrange
        const id = 'npcs:vaelith-corrun';

        // Act
        const reference = parseEntryId(id);

        // Assert
        expect(reference?.section).toBe(CodexSection.Npcs);
        expect(reference?.slug).toBe('vaelith-corrun');
    });

    it('should reject an id with an unknown section', () => {
        // Arrange
        const id = 'monsters:owlbear';

        // Act
        const reference = parseEntryId(id);

        // Assert
        expect(reference === null).toBe(true);
    });

    it('should reject an id without a slug', () => {
        // Arrange
        const id = 'npcs:';

        // Act
        const reference = parseEntryId(id);

        // Assert
        expect(reference === null).toBe(true);
    });

    it('should slugify a title with accents and punctuation', () => {
        // Arrange
        const title = '  Mother Ilsabeth, the Áshen Choir!  ';

        // Act
        const slug = slugify(title);

        // Assert
        expect(slug).toBe('mother-ilsabeth-the-ashen-choir');
    });

    it('should format a slug into a readable title-case label', () => {
        // Arrange
        const slug = 'mother-ilsabeth';

        // Act
        const label = formatSlugLabel(slug);

        // Assert
        expect(label).toBe('Mother Ilsabeth');
    });

    it('should format a reference value using the known title', () => {
        // Arrange
        const value = 'npcs:vaelith-corrun';
        const titles = { 'npcs:vaelith-corrun': 'Vaelith Corrun' };

        // Act
        const label = formatReferenceValue(value, titles);

        // Assert
        expect(label).toBe('Vaelith Corrun');
    });

    it('should fall back to a readable slug when the reference title is unknown', () => {
        // Arrange
        const value = 'npcs:mother-ilsabeth';

        // Act
        const label = formatReferenceValue(value, {});

        // Assert
        expect(label).toBe('Mother Ilsabeth');
    });

    it('should leave a malformed reference value untouched', () => {
        // Arrange
        const value = 'not-a-reference';

        // Act
        const label = formatReferenceValue(value, {});

        // Assert
        expect(label).toBe('not-a-reference');
    });
});
