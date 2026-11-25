import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { GuestModeService } from '@core/guest/guest-mode.service';
import { GuestEntryComponent } from './guest-entry.component';

describe('GuestEntryComponent', () => {
    it('should enter guest mode and open the demo campaign', () => {
        // Arrange
        const guestMode = { enter: jest.fn() };
        const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };
        TestBed.configureTestingModule({
            imports: [GuestEntryComponent],
            providers: [
                { provide: GuestModeService, useValue: guestMode },
                { provide: Router, useValue: router }
            ]
        });

        // Act
        const fixture = TestBed.createComponent(GuestEntryComponent);
        fixture.detectChanges();

        // Assert
        expect(guestMode.enter).toHaveBeenCalled();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/demo/npcs', { replaceUrl: true });
    });
});
