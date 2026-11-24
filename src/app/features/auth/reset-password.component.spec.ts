import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending } from '@store/auth/auth.selectors';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
    let fixture: ComponentFixture<ResetPasswordComponent>;
    let component: ResetPasswordComponent;
    let store: MockStore;

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [ResetPasswordComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ token: 'reset-token' }) } }
                },
                provideRouter([])
            ]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectAuthPending, false);
        store.overrideSelector(selectAuthError, null);

        fixture = TestBed.createComponent(ResetPasswordComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should dispatch the token and the new password', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['passwordControl'].setValue('new-secret');
        component['confirmControl'].setValue('new-secret');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.resetPassword.request({ token: 'reset-token', password: 'new-secret' })
        );
    });

    it('should refuse mismatched passwords', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['passwordControl'].setValue('new-secret');
        component['confirmControl'].setValue('other-secret');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['mismatch']()).toBe(true);
    });

    it('should refuse a password shorter than eight characters', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['passwordControl'].setValue('short');
        component['confirmControl'].setValue('short');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should show the server error for an expired link', () => {
        // Arrange
        store.overrideSelector(selectAuthError, 'This reset link is invalid or has expired.');
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const error: HTMLElement = fixture.nativeElement.querySelector('.cdx-auth-error');
        expect(error.textContent).toContain('This reset link is invalid or has expired.');
    });

    it('should disable the submit button while the reset is pending', () => {
        // Arrange
        store.overrideSelector(selectAuthPending, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cdx-auth-submit');
        expect(button.disabled).toBe(true);
    });
});
