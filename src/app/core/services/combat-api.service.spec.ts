import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IEncounter } from '@core/models';
import { buildEncounter } from '@testing/combat.fixtures';
import { CombatApiService } from './combat-api.service';

describe('CombatApiService', () => {
    let service: CombatApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(CombatApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should load the encounter', () => {
        // Arrange
        let encounter: IEncounter | null = null;
        service.loadEncounter().subscribe((result) => (encounter = result));

        // Act
        httpMock.expectOne('/api/combat').flush(buildEncounter({ round: 2 }));

        // Assert
        expect(encounter!.round).toBe(2);
    });

    it('should PUT the whole encounter', () => {
        // Arrange
        const encounter = buildEncounter({ round: 1, turnId: 'tessaly' });
        let saved: IEncounter | null = null;

        // Act
        service.saveEncounter(encounter).subscribe((result) => (saved = result));
        const request = httpMock.expectOne('/api/combat');
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual(encounter);
        request.flush(encounter);

        // Assert
        expect(saved!.turnId).toBe('tessaly');
    });

    it('should surface the server error message when saving fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.saveEncounter(buildEncounter()).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/combat')
            .flush({ error: 'Combatant ids must be unique.' }, { status: 400, statusText: 'Bad Request' });

        // Assert
        expect(error!.message).toBe('Combatant ids must be unique.');
    });

    it('should fall back to a generic message when saving fails without a server message', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.saveEncounter(buildEncounter()).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/combat').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe("Couldn't save the combat tracker. Retry.");
    });
});
