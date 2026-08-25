import { TestBed } from '@angular/core/testing';

import { MarkdownCommandService } from './markdown-command.service';

describe('MarkdownCommandService', () => {
    let service: MarkdownCommandService;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({ providers: [MarkdownCommandService] });
        service = TestBed.inject(MarkdownCommandService);
    });

    it('should wrap the selection in bold markers', () => {
        // Arrange
        const value = 'the silver ledger';

        // Act
        const result = service.apply('bold', value, { start: 4, end: 17 });

        // Assert
        expect(result.value).toBe('the **silver ledger**');
        expect(result.selection.start).toBe(6);
    });

    it('should insert a placeholder when the selection is collapsed', () => {
        // Arrange
        const value = '';

        // Act
        const result = service.apply('italic', value, { start: 0, end: 0 });

        // Assert
        expect(result.value).toBe('*italic text*');
        expect(result.selection.end).toBe(12);
    });

    it('should unwrap an already applied marker', () => {
        // Arrange
        const value = 'the **silver ledger**';

        // Act
        const result = service.apply('bold', value, { start: 6, end: 19 });

        // Assert
        expect(result.value).toBe('the silver ledger');
    });

    it('should report an active marker around the selection', () => {
        // Arrange
        const value = 'a ~~struck~~ line';

        // Act
        const active = service.isActive('strikethrough', value, { start: 4, end: 10 });

        // Assert
        expect(active).toBe(true);
    });

    it('should prefix every selected line for a bulleted list', () => {
        // Arrange
        const value = 'first\nsecond';

        // Act
        const result = service.apply('bulletList', value, { start: 0, end: 12 });

        // Assert
        expect(result.value).toBe('- first\n- second');
    });

    it('should number the selected lines for a numbered list', () => {
        // Arrange
        const value = 'first\nsecond';

        // Act
        const result = service.apply('numberedList', value, { start: 0, end: 12 });

        // Assert
        expect(result.value).toBe('1. first\n2. second');
    });

    it('should not read a bold pair as italic emphasis', () => {
        // Arrange
        const value = '**Speaks**';

        // Act
        const bold = service.isActive('bold', value, { start: 2, end: 8 });
        const italic = service.isActive('italic', value, { start: 2, end: 8 });

        // Assert
        expect(bold).toBe(true);
        expect(italic).toBe(false);
    });

    it('should still read a lone asterisk pair as italic emphasis', () => {
        // Arrange
        const value = 'He *speaks* softly.';

        // Act
        const italic = service.isActive('italic', value, { start: 4, end: 10 });

        // Assert
        expect(italic).toBe(true);
    });
});
