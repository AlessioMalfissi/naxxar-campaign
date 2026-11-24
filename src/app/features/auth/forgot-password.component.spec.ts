import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import * as AuthActions from '@store/auth/auth.actions';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
    let fixture: ComponentFixture<ForgotPasswordComponent>;
    let component: ForgotPasswordComponent;
    let store: MockStore;

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [ForgotPasswordComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/campaigns' }) } }
                },
                provideRouter([])
            ]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        fixture = TestBed.createComponent(ForgotPasswordComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should request a reset link with the trimmed email', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['emailControl'].setValue(' dm@naxxar.local ');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.forgotPassword.request({ email: 'dm@naxxar.local' })
        );
    });

    it('should show the neutral confirmation after submitting', () => {
        // Arrange
        component['emailControl'].setValue('dm@naxxar.local');

        // Act
        component['submit']();
        fixture.detectChanges();

        // Assert
        const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
        expect(status.textContent).toContain('If that email has an account');
    });

    it('should not submit an invalid email or show the confirmation', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['emailControl'].setValue('not-an-email');

        // Act
        component['submit']();
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['submitted']()).toBe(false);
        expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    });

    it('should return to sign in and keep the return URL', () => {
        // Act
        const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.cdx-auth-link');

        // Assert
        expect(link.getAttribute('href')).toContain('/login');
        expect(link.getAttribute('href')).toContain('returnUrl=%2Fcampaigns');
    });
});
