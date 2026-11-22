import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';

import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending } from '@store/auth/auth.selectors';

@Component({
    selector: 'cdx-reset-password',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
    templateUrl: './reset-password.component.html',
    styleUrl: './auth-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);

    protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
    protected readonly passwordControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)]
    });
    protected readonly confirmControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required]
    });
    protected readonly mismatch = signal(false);
    protected readonly pending = toSignal(this.store.select(selectAuthPending), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectAuthError), { initialValue: null });

    protected submit(): void {
        const password = this.passwordControl.value;
        const confirm = this.confirmControl.value;

        if (this.passwordControl.invalid || this.confirmControl.invalid || password !== confirm) {
            this.passwordControl.markAsTouched();
            this.confirmControl.markAsTouched();
            this.mismatch.set(password !== confirm);
            return;
        }

        this.mismatch.set(false);
        this.store.dispatch(AuthActions.resetPassword.request({ token: this.token, password }));
    }
}
