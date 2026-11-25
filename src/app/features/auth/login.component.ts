import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    signal,
    viewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';

import { GoogleSignInService } from '@core/services/google-sign-in.service';
import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending, selectConfig } from '@store/auth/auth.selectors';

@Component({
    selector: 'cdx-login',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly googleSignIn = inject(GoogleSignInService);

    protected readonly emailControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email]
    });
    protected readonly passwordControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required]
    });
    protected readonly pending = toSignal(this.store.select(selectAuthPending), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectAuthError), { initialValue: null });
    protected readonly resetNotice = this.route.snapshot.queryParamMap.get('reset') === '1';
    protected readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    protected readonly googleError = signal<string | null>(null);

    private readonly config = toSignal(this.store.select(selectConfig), {
        initialValue: { googleClientId: null }
    });
    protected readonly googleClientId = computed(() => this.config().googleClientId);
    private readonly googleButton = viewChild<ElementRef<HTMLElement>>('googleButton');
    private renderedClientId: string | null = null;

    constructor() {
        effect(() => {
            const clientId = this.googleClientId();
            const element = this.googleButton()?.nativeElement;
            if (clientId === null || element === undefined || this.renderedClientId === clientId) {
                return;
            }

            this.renderedClientId = clientId;
            void this.googleSignIn
                .renderButton(element, clientId, (credential) => {
                    this.store.dispatch(AuthActions.googleLogin.request({ credential }));
                })
                .catch(() => {
                    this.renderedClientId = null;
                    this.googleError.set('Google sign-in is unavailable. Use your email and password.');
                });
        });
    }

    protected submit(): void {
        this.emailControl.setValue(this.emailControl.value.trim());

        if (this.emailControl.invalid || this.passwordControl.invalid) {
            this.emailControl.markAsTouched();
            this.passwordControl.markAsTouched();
            return;
        }

        this.store.dispatch(
            AuthActions.login.request({
                email: this.emailControl.value,
                password: this.passwordControl.value
            })
        );
    }
}
