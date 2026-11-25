import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import * as AuthActions from '@store/auth/auth.actions';
import { GUEST_CAMPAIGN, GUEST_STORAGE_KEY, GUEST_USER } from './guest-data';
import { GuestModeService } from './guest-mode.service';

describe('GuestModeService', () => {
    let store: MockStore;
    let service: GuestModeService;

    const configure = (): void => {
        TestBed.configureTestingModule({ providers: [provideMockStore({ initialState: {} })] });
        store = TestBed.inject(MockStore);
        service = TestBed.inject(GuestModeService);
    };

    beforeEach(() => {
        // Arrange
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('should start outside guest mode', () => {
        // Act
        configure();

        // Assert
        expect(service.isGuest()).toBe(false);
    });

    it('should seed a read-only guest session and remember it for the tab', () => {
        // Arrange
        configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        service.enter();

        // Assert
        expect(service.isGuest()).toBe(true);
        expect(sessionStorage.getItem(GUEST_STORAGE_KEY)).toBe('true');
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.guestEntered({ user: GUEST_USER, campaigns: [GUEST_CAMPAIGN] })
        );
    });

    it('should not seed the session twice', () => {
        // Arrange
        configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        service.enter();
        dispatchSpy.mockClear();

        // Act
        service.enter();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should restore the auth state from a stored guest tab', () => {
        // Arrange
        sessionStorage.setItem(GUEST_STORAGE_KEY, 'true');
        configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        service.restore();

        // Assert
        expect(service.isGuest()).toBe(true);
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.guestEntered({ user: GUEST_USER, campaigns: [GUEST_CAMPAIGN] })
        );
    });

    it('should do nothing when restoring a normal tab', () => {
        // Arrange
        configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        service.restore();

        // Assert
        expect(service.isGuest()).toBe(false);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should leave guest mode and clear the tab flag', () => {
        // Arrange
        configure();
        service.enter();

        // Act
        service.leave();

        // Assert
        expect(service.isGuest()).toBe(false);
        expect(sessionStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    });
});
