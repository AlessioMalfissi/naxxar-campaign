import { CodexSection } from './codex-section.enum';
import { findSectionDefinition } from './i-section-definition';

describe('sectionDefinitions', () => {
    it('should give player entries a free-text gender field after race', () => {
        // Arrange
        const definition = findSectionDefinition(CodexSection.Players);

        // Act
        const keys = definition.fields.map((field) => field.key);
        const gender = definition.fields.find((field) => field.key === 'gender');

        // Assert
        expect(gender).toEqual({ key: 'gender', label: 'Gender', kind: 'text' });
        expect(keys.indexOf('gender') === keys.indexOf('race') + 1).toBe(true);
    });

    it('should not add a gender field to other sections', () => {
        // Arrange
        const others = Object.values(CodexSection).filter((section) => section !== CodexSection.Players);

        // Act
        const withGender = others.filter((section) =>
            findSectionDefinition(section).fields.some((field) => field.key === 'gender')
        );

        // Assert
        expect(withGender.length).toBe(0);
    });

    it('should throw for an unknown section', () => {
        // Act
        const find = (): unknown => findSectionDefinition('unknown' as CodexSection);

        // Assert
        expect(find).toThrow('Unknown codex section: unknown');
    });
});
