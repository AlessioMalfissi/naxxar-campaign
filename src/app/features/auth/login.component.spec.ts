import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { GoogleSignInService } from '@core/services/google-sign-in.service';
import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending, selectConfig } from '@store/auth/auth.selectors';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
    let fixture: ComponentFixture<LoginComponent>;
    let component: LoginComponent;
    let store: MockStore;
    let googleSignIn: { renderButton: jest.Mock };

    const configure = async (queryParams: Record<string, string> = {}): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [LoginComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
                provideRouter([]),
                { provide: GoogleSignInService, useValue: googleSignIn }
            ]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectAuthPending, false);
        store.overrideSelector(selectAuthError, null);
        store.overrideSelector(selectConfig, { googleClientId: null });

        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    beforeEach(() => {
        googleSignIn = { renderButton: jest.fn().mockResolvedValue(undefined) };
    });

    it('should dispatch the trimmed email and password on submit', async () => {
        // Arrange
        await configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['emailControl'].setValue(' dm@naxxar.local ');
        component['passwordControl'].setValue('secret');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.login.request({ email: 'dm@naxxar.local', password: 'secret' })
        );
    });

    it('should not submit an invalid form', async () => {
        // Arrange
        await configure();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['emailControl'].setValue('not-an-email');
        component['passwordControl'].setValue('');

        // Act
        component['submit']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['emailControl'].touched).toBe(true);
        expect(component['passwordControl'].touched).toBe(true);
    });

    it('should disable the submit button while a login is pending', async () => {
        // Arrange
        await configure();
        store.overrideSelector(selectAuthPending, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cdx-login-submit');
        expect(button.disabled).toBe(true);
        expect(button.textContent).toContain('Signing in');
    });

    it('should show the auth error', async () => {
        // Arrange
        await configure();
        store.overrideSelector(selectAuthError, 'Incorrect email or password.');
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const error: HTMLElement = fixture.nativeElement.querySelector('.cdx-login-error');
        expect(error.textContent).toContain('Incorrect email or password.');
    });

    it('should show the reset notice after a password change', async () => {
        // Arrange
        await configure({ reset: '1' });

        // Assert
        const notice: HTMLElement = fixture.nativeElement.querySelector('.cdx-login-notice');
        expect(notice.textContent).toContain('Your password has been changed.');
    });

    it('should render the Google button when a client id is configured', async () => {
        // Arrange
        await configure();
        store.overrideSelector(selectConfig, { googleClientId: 'client-id' });
        store.refreshState();

        // Act
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert
        expect(googleSignIn.renderButton).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            'client-id',
            expect.any(Function)
        );
    });

    it('should dispatch the Google credential', async () => {
        // Arrange
        await configure();
        store.overrideSelector(selectConfig, { googleClientId: 'client-id' });
        store.refreshState();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        fixture.detectChanges();
        await fixture.whenStable();

        // Act
        const callback = googleSignIn.renderButton.mock.calls[0][2] as (credential: string) => void;
        callback('credential');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.googleLogin.request({ credential: 'credential' }));
    });

    it('should explain when Google sign-in cannot load', async () => {
        // Arrange
        googleSignIn.renderButton.mockRejectedValue(new Error('nope'));
        await configure();
        store.overrideSelector(selectConfig, { googleClientId: 'client-id' });
        store.refreshState();

        // Act
        fixture.detectChanges();
        await fixture.whenStable();
        await Promise.resolve();
        fixture.detectChanges();

        // Assert
        const error: HTMLElement = fixture.nativeElement.querySelector('.cdx-login-error');
        expect(error.textContent).toContain('Google sign-in is unavailable.');
    });
});
