import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CodexSection, ICodexEntry } from '@core/models';
import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import { CodexApiService } from './codex-api.service';
import { DraftStorageService } from './draft-storage.service';

describe('CodexApiService', () => {
    let service: CodexApiService;
    let httpMock: HttpTestingController;
    let draftStorage: DraftStorageService;

    beforeEach(() => {
        // Arrange
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(CodexApiService);
        httpMock = TestBed.inject(HttpTestingController);
        draftStorage = TestBed.inject(DraftStorageService);
    });

    afterEach(() => {
        httpMock.verify();
        localStorage.clear();
    });

    it('should map the index payload onto summaries', () => {
        // Arrange
        let entries: ReturnType<typeof buildSummary>[] = [];
        service.loadIndex().subscribe((result) => (entries = result));

        // Act
        httpMock
            .expectOne('assets/codex/index.json')
            .flush({ generatedAt: '2026-08-25T00:00:00.000Z', entries: [buildSummary()] });

        // Assert
        expect(entries.length).toBe(1);
        expect(entries[0].id).toBe('npcs:vaelith-corrun');
    });

    it('should overlay stored drafts onto the index', () => {
        // Arrange
        draftStorage.write(buildEntry({ status: 'Dead' }));
        let entries: ReturnType<typeof buildSummary>[] = [];
        service.loadIndex().subscribe((result) => (entries = result));

        // Act
        httpMock
            .expectOne('assets/codex/index.json')
            .flush({ generatedAt: '2026-08-25T00:00:00.000Z', entries: [buildSummary()] });

        // Assert
        expect(entries[0].status).toBe('Dead');
    });

    it('should fetch the markdown file and strip its front matter', () => {
        // Arrange
        const summary = buildSummary();
        let entry: ICodexEntry | null = null;
        service.loadEntry(summary).subscribe((result) => (entry = result));

        // Act
        httpMock
            .expectOne(summary.path)
            .flush(['---', 'title: Vaelith Corrun', '---', '# Who he is', '', 'Counts twice.'].join('\n'));

        // Assert
        expect(entry!.body.startsWith('# Who he is')).toBe(true);
    });

    it('should read from the draft instead of the network when one exists', () => {
        // Arrange
        draftStorage.write(buildEntry({ body: '# Edited locally' }));
        const summary = buildSummary();
        let entry: ICodexEntry | null = null;

        // Act
        service.loadEntry(summary).subscribe((result) => (entry = result));

        // Assert
        expect(entry!.body).toBe('# Edited locally');
        httpMock.expectNone(summary.path);
    });

    it('should stamp the save time and persist the entry', () => {
        // Arrange
        const entry = buildEntry();
        let saved: ICodexEntry | null = null;

        // Act
        service.saveEntry(entry).subscribe((result) => (saved = result));

        // Assert
        expect(saved!.updatedAt === entry.updatedAt).toBe(false);
        expect(draftStorage.read(entry.id)?.body).toBe(entry.body);
    });

    it('should surface a failure when persistence throws', () => {
        // Arrange
        jest.spyOn(draftStorage, 'write').mockImplementation(() => {
            throw new Error('quota exceeded');
        });
        let error: Error | null = null;

        // Act
        service.saveEntry(buildEntry()).subscribe({ error: (thrown: Error) => (error = thrown) });

        // Assert
        expect(error!.message).toBe("Couldn't save the entry to local storage.");
    });

    it('should create an entry with a seeded body', () => {
        // Arrange
        let created: ICodexEntry | null = null;
        service.createEntry(CodexSection.Places, 'emberfall-road', 'Emberfall road', 'Visited')
            .subscribe((result) => (created = result));

        // Act
        httpMock
            .expectOne('assets/codex/index.json')
            .flush({ generatedAt: '2026-08-25T00:00:00.000Z', entries: [] });

        // Assert
        expect(created!.id).toBe('places:emberfall-road');
        expect(created!.body).toBe('# Emberfall road\n\n');
    });

    it('should reject a duplicate slug in the same section', () => {
        // Arrange
        let error: Error | null = null;
        service.createEntry(CodexSection.Npcs, 'vaelith-corrun', 'Vaelith Corrun', 'Alive')
            .subscribe({ error: (thrown: Error) => (error = thrown) });

        // Act
        httpMock
            .expectOne('assets/codex/index.json')
            .flush({ generatedAt: '2026-08-25T00:00:00.000Z', entries: [buildSummary()] });

        // Assert
        expect(error!.message).toBe('That name is already taken in this section.');
    });

    it('should drop the stored draft when an entry is deleted', () => {
        // Arrange
        const entry = buildEntry();
        draftStorage.write(entry);
        let deletedId = '';

        // Act
        service.deleteEntry(entry.id).subscribe((result) => (deletedId = result));

        // Assert
        expect(deletedId).toBe(entry.id);
        expect(draftStorage.read(entry.id) === null).toBe(true);
    });
});
