import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CodexSection, EntryVisibility, ICodexEntry } from '@core/models';
import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import { CodexApiService } from './codex-api.service';

describe('CodexApiService', () => {
    let service: CodexApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(CodexApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should map the entries payload onto summaries', () => {
        // Arrange
        let entries: ReturnType<typeof buildSummary>[] = [];
        service.loadIndex().subscribe((result) => (entries = result));

        // Act
        httpMock.expectOne('/api/entries').flush([buildSummary()]);

        // Assert
        expect(entries.length).toBe(1);
        expect(entries[0].id).toBe('npcs:vaelith-corrun');
    });

    it('should send section, status, tags, query and visibility as query params', () => {
        // Arrange
        service
            .loadIndex({
                section: CodexSection.Npcs,
                status: 'Alive',
                tags: ['ally', 'silver-ledger'],
                query: ' broker ',
                visibility: EntryVisibility.Revealed
            })
            .subscribe();

        // Act
        const request = httpMock.expectOne(
            (req) => req.url === '/api/entries' && req.method === 'GET'
        );

        // Assert
        expect(request.request.params.get('section')).toBe('npcs');
        expect(request.request.params.get('status')).toBe('Alive');
        expect(request.request.params.get('tags')).toBe('ally,silver-ledger');
        expect(request.request.params.get('query')).toBe('broker');
        expect(request.request.params.get('visibility')).toBe('revealed');
        request.flush([]);
    });

    it('should fetch a single entry by section and slug', () => {
        // Arrange
        const summary = buildSummary();
        let entry: ICodexEntry | null = null;
        service.loadEntry(summary).subscribe((result) => (entry = result));

        // Act
        httpMock.expectOne('/api/entries/npcs/vaelith-corrun').flush(buildEntry());

        // Assert
        expect(entry!.body).toBe('# Who he is\n\nBroker of debts.');
    });

    it('should PUT the entry and stamp the returned save time', () => {
        // Arrange
        const entry = buildEntry();
        const saved = { ...entry, updatedAt: '2026-08-25T10:00:00.000Z' };
        let result: ICodexEntry | null = null;

        // Act
        service.saveEntry(entry).subscribe((response) => (result = response));
        const request = httpMock.expectOne('/api/entries/npcs/vaelith-corrun');
        expect(request.request.method).toBe('PUT');
        request.flush(saved);

        // Assert
        expect(result!.updatedAt).toBe('2026-08-25T10:00:00.000Z');
    });

    it('should surface the server error message when saving fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.saveEntry(buildEntry()).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/entries/npcs/vaelith-corrun')
            .flush({ error: 'Entry not found.' }, { status: 404, statusText: 'Not Found' });

        // Assert
        expect(error!.message).toBe('Entry not found.');
    });

    it('should fall back to a generic message when saving fails without a server message', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.saveEntry(buildEntry()).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/entries/npcs/vaelith-corrun').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe("Couldn't save the entry. Retry.");
    });

    it('should POST a new entry with the supplied tags, visibility and fields', () => {
        // Arrange
        let created: ICodexEntry | null = null;

        // Act
        service
            .createEntry(
                CodexSection.Npcs,
                'Grum the Broker',
                'Alive',
                ['merchant', 'ally'],
                EntryVisibility.Revealed,
                { race: 'Dwarf' }
            )
            .subscribe((result) => (created = result));

        const request = httpMock.expectOne('/api/entries');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            section: CodexSection.Npcs,
            title: 'Grum the Broker',
            status: 'Alive',
            tags: ['merchant', 'ally'],
            visibility: EntryVisibility.Revealed,
            fields: { race: 'Dwarf' }
        });
        request.flush({
            id: 'npcs:grum-the-broker',
            section: 'npcs',
            slug: 'grum-the-broker',
            path: 'assets/codex/npcs/grum-the-broker.md',
            title: 'Grum the Broker',
            status: 'Alive',
            tags: ['merchant', 'ally'],
            favourite: false,
            visibility: 'revealed',
            author: 'DM',
            updatedAt: '2026-08-25T00:00:00.000Z',
            fields: { race: 'Dwarf' },
            excerpt: '',
            body: '# Grum the Broker\n\n'
        });

        // Assert
        expect(created!.id).toBe('npcs:grum-the-broker');
        expect(created!.tags).toEqual(['merchant', 'ally']);
        expect(created!.visibility).toBe(EntryVisibility.Revealed);
        expect(created!.fields).toEqual({ race: 'Dwarf' });
    });

    it('should surface the duplicate-name error from the server', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service
            .createEntry(CodexSection.Npcs, 'Vaelith Corrun', 'Alive')
            .subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/entries')
            .flush({ error: 'That name is already taken in this section.' }, { status: 409, statusText: 'Conflict' });

        // Assert
        expect(error!.message).toBe('That name is already taken in this section.');
    });

    it('should DELETE the entry by section and slug', () => {
        // Arrange
        let deletedId = '';

        // Act
        service.deleteEntry('npcs:vaelith-corrun').subscribe((result) => (deletedId = result));
        const request = httpMock.expectOne('/api/entries/npcs/vaelith-corrun');
        expect(request.request.method).toBe('DELETE');
        request.flush(null);

        // Assert
        expect(deletedId).toBe('npcs:vaelith-corrun');
    });

    it('should fail fast for a malformed entry id', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.deleteEntry('not-a-valid-id').subscribe({ error: (thrown: Error) => (error = thrown) });

        // Assert
        expect(error!.message).toBe('Invalid entry id.');
    });
});
