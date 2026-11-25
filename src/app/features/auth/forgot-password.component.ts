import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';

import * as AuthActions from '@store/auth/auth.actions';

@Component({
    selector: 'cdx-forgot-password',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
    templateUrl: './forgot-password.component.html',
    styleUrl: './auth-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);

    protected readonly emailControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email]
    });
    protected readonly submitted = signal(false);
    protected readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    protected submit(): void {
        this.emailControl.setValue(this.emailControl.value.trim());

        if (this.emailControl.invalid) {
            this.emailControl.markAsTouched();
            return;
        }

        this.store.dispatch(AuthActions.forgotPassword.request({ email: this.emailControl.value }));
        // The API always answers 202, so the confirmation is shown without waiting and does not
        // reveal whether the address belongs to an account.
        this.submitted.set(true);
    }
}
