import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending } from '@store/auth/auth.selectors';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
    let fixture: ComponentFixture<LoginComponent>;
    let component: LoginComponent;
    let store: MockStore;

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [LoginComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} })]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectAuthPending, false);
        store.overrideSelector(selectAuthError, null);

        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should mark the field as touched and not dispatch when the password is blank', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['submit']();

        // Assert
        expect(component['passwordControl'].touched).toBe(true);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should dispatch a login request with the entered password', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['passwordControl'].setValue('campaign-secret');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.login.request({ password: 'campaign-secret' }));
    });

    it('should surface the auth error from the store', () => {
        // Arrange
        store.overrideSelector(selectAuthError, 'Incorrect password.');
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(component['error']()).toBe('Incorrect password.');
    });

    it('should reflect the pending state from the store', () => {
        // Arrange
        store.overrideSelector(selectAuthPending, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(component['pending']()).toBe(true);
    });
});
