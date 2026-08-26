import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';

import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending } from '@store/auth/auth.selectors';

@Component({
    selector: 'cdx-login',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly store = inject(Store);

    protected readonly passwordControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required]
    });
    protected readonly pending = toSignal(this.store.select(selectAuthPending), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectAuthError), { initialValue: null });

    protected submit(): void {
        if (this.passwordControl.invalid) {
            this.passwordControl.markAsTouched();
            return;
        }

        this.store.dispatch(AuthActions.login.request({ password: this.passwordControl.value }));
    }
}
