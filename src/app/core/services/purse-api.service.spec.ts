import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IPurse } from '@core/models';
import { buildPurse } from '@testing/purse.fixtures';
import { PurseApiService } from './purse-api.service';

describe('PurseApiService', () => {
    let service: PurseApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(PurseApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should list purses', () => {
        // Arrange
        let purses: IPurse[] = [];
        service.loadPurses().subscribe((result) => (purses = result));

        // Act
        httpMock.expectOne('/api/purses').flush([buildPurse()]);

        // Assert
        expect(purses.length).toBe(1);
        expect(purses[0].gold).toBe(120);
    });

    it('should PUT the gold amount for an owner', () => {
        // Arrange
        let updated: IPurse | null = null;

        // Act
        service.updateGold('party', 50).subscribe((result) => (updated = result));
        const request = httpMock.expectOne('/api/purses/party');
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual({ gold: 50 });
        request.flush(buildPurse({ gold: 50 }));

        // Assert
        expect(updated!.gold).toBe(50);
    });

    it('should URL-encode an owner id containing special characters', () => {
        // Act
        service.updateGold('players:tessaly-oakhand', 15).subscribe();
        const request = httpMock.expectOne('/api/purses/players%3Atessaly-oakhand');

        // Assert
        expect(request.request.method).toBe('PUT');
        request.flush(buildPurse({ owner: 'players:tessaly-oakhand', gold: 15 }));
    });

    it('should surface the server error message when updating fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.updateGold('party', -5).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/purses/party')
            .flush({ error: 'Gold must be a non-negative number.' }, { status: 400, statusText: 'Bad Request' });

        // Assert
        expect(error!.message).toBe('Gold must be a non-negative number.');
    });

    it('should fall back to a generic message when updating fails without a server message', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.updateGold('party', 50).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/purses/party').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe("Couldn't update gold. Retry.");
    });
});
