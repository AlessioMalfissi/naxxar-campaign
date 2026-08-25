import { TestBed } from '@angular/core/testing';

import { MarkdownRendererService } from './markdown-renderer.service';

describe('MarkdownRendererService', () => {
    let service: MarkdownRendererService;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({ providers: [MarkdownRendererService] });
        service = TestBed.inject(MarkdownRendererService);
    });

    it('should render headings, emphasis and lists', () => {
        // Arrange
        const markdown = '# Who he is\n\nBroker of **debts** and *memory*.\n\n- First\n- Second';

        // Act
        const html = service.render(markdown);

        // Assert
        expect(html.includes('<h1 class="codex-h1">Who he is</h1>')).toBe(true);
        expect(html.includes('<strong>debts</strong>')).toBe(true);
        expect(html.includes('<em>memory</em>')).toBe(true);
        expect(html.includes('<li>First</li>')).toBe(true);
    });

    it('should resolve entity links to titles', () => {
        // Arrange
        const markdown = 'Terrified of [[npcs:mother-ilsabeth]]';
        const titles = { 'npcs:mother-ilsabeth': 'Mother Ilsabeth' };

        // Act
        const html = service.render(markdown, { titles });

        // Assert
        expect(html.includes('data-entry-id="npcs:mother-ilsabeth"')).toBe(true);
        expect(html.includes('Mother Ilsabeth')).toBe(true);
    });

    it('should hide dm blocks when dm blocks are disabled', () => {
        // Arrange
        const markdown = 'Public line\n\n:::dm\nSecret line\n:::';

        // Act
        const html = service.render(markdown, { showDmBlocks: false });

        // Assert
        expect(html.includes('Public line')).toBe(true);
        expect(html.includes('Secret line')).toBe(false);
    });

    it('should escape raw html instead of rendering it', () => {
        // Arrange
        const markdown = 'Careful <script>alert(1)</script>';

        // Act
        const html = service.render(markdown);

        // Assert
        expect(html.includes('<script>')).toBe(false);
        expect(html.includes('&lt;script&gt;')).toBe(true);
    });

    it('should render pipe tables', () => {
        // Arrange
        const markdown = '| District | Standing |\n| --- | --- |\n| Cinderrow | Watched |';

        // Act
        const html = service.render(markdown);

        // Assert
        expect(html.includes('<table class="codex-table">')).toBe(true);
        expect(html.includes('<td>Cinderrow</td>')).toBe(true);
    });
});
