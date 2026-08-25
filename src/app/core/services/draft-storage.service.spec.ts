import { TestBed } from '@angular/core/testing';

import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import { DraftStorageService } from './draft-storage.service';

describe('DraftStorageService', () => {
    let service: DraftStorageService;

    beforeEach(() => {
        // Arrange
        localStorage.clear();
        TestBed.configureTestingModule({});
        service = TestBed.inject(DraftStorageService);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('should write and read an entry', () => {
        // Arrange
        const entry = buildEntry();

        // Act
        service.write(entry);
        const stored = service.read(entry.id);

        // Assert
        expect(stored?.title).toBe(entry.title);
    });

    it('should return null for an unknown id', () => {
        // Arrange
        const id = 'npcs:nobody';

        // Act
        const stored = service.read(id);

        // Assert
        expect(stored === null).toBe(true);
    });

    it('should return null when the stored payload is corrupt', () => {
        // Arrange
        localStorage.setItem('naxxar-campaign:entry:npcs:broken', '{not json');

        // Act
        const stored = service.read('npcs:broken');

        // Assert
        expect(stored === null).toBe(true);
    });

    it('should remove a stored entry', () => {
        // Arrange
        const entry = buildEntry();
        service.write(entry);

        // Act
        service.remove(entry.id);

        // Assert
        expect(service.read(entry.id) === null).toBe(true);
    });

    it('should list only codex draft ids', () => {
        // Arrange
        service.write(buildEntry());
        localStorage.setItem('unrelated-key', 'value');

        // Act
        const ids = service.listIds();

        // Assert
        expect(ids).toEqual(['npcs:vaelith-corrun']);
    });

    it('should overlay draft metadata onto a summary without the body', () => {
        // Arrange
        service.write(buildEntry({ status: 'Missing' }));
        const summary = buildSummary();

        // Act
        const overlaid = service.applySummaryOverlay(summary);

        // Assert
        expect(overlaid.status).toBe('Missing');
        expect('body' in overlaid).toBe(false);
    });

    it('should return the summary unchanged when no draft exists', () => {
        // Arrange
        const summary = buildSummary();

        // Act
        const overlaid = service.applySummaryOverlay(summary);

        // Assert
        expect(overlaid === summary).toBe(true);
    });
});
