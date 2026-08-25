import { TestBed } from '@angular/core/testing';

import { buildEntry } from '@testing/entry.fixtures';
import { MarkdownExportService } from './markdown-export.service';

describe('MarkdownExportService', () => {
    let service: MarkdownExportService;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({});
        service = TestBed.inject(MarkdownExportService);
    });

    it('should serialise an entry with its front matter', () => {
        // Arrange
        const entry = buildEntry();

        // Act
        const markdown = service.toMarkdown(entry);

        // Assert
        expect(markdown.startsWith('---\ntitle: Vaelith Corrun')).toBe(true);
        expect(markdown.includes('  race: Half-elf')).toBe(true);
    });

    it('should trigger a download named after the slug', () => {
        // Arrange
        const entry = buildEntry();
        const anchor = document.createElement('a');
        const clickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => undefined);
        jest.spyOn(document, 'createElement').mockReturnValue(anchor);
        const createUrlSpy = jest.fn(() => 'blob:codex');
        const revokeUrlSpy = jest.fn();
        URL.createObjectURL = createUrlSpy as unknown as typeof URL.createObjectURL;
        URL.revokeObjectURL = revokeUrlSpy as unknown as typeof URL.revokeObjectURL;

        // Act
        service.download(entry);

        // Assert
        expect(anchor.download).toBe('vaelith-corrun.md');
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeUrlSpy).toHaveBeenCalledWith('blob:codex');
        jest.restoreAllMocks();
    });
});
