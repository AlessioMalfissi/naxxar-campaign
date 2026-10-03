import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ICombatCondition } from '@core/models';
import { IConditionModalData } from './i-modal';

@Component({
    selector: 'cdx-condition-modal',
    standalone: true,
    imports: [ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatInputModule],
    templateUrl: './condition-modal.component.html',
    styleUrl: './modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConditionModalComponent {
    protected readonly data = inject<IConditionModalData>(DIALOG_DATA);
    protected readonly form = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        rounds: new FormControl<number | null>(null, { validators: [Validators.min(1)] })
    });

    private readonly dialogRef = inject<DialogRef<ICombatCondition | null>>(DialogRef);
    private readonly query = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });

    protected readonly suggestions = computed<string[]>(() => {
        const query = this.query().trim().toLowerCase();
        return this.data.suggestions.filter((suggestion) => suggestion.toLowerCase().includes(query));
    });

    protected confirm(): void {
        const name = this.form.controls.name.value.trim();
        if (this.form.invalid || name === '') {
            this.form.markAllAsTouched();
            return;
        }

        const rounds = this.form.controls.rounds.value;
        this.dialogRef.close({ name, rounds: rounds == null ? null : Math.floor(rounds) });
    }

    protected cancel(): void {
        this.dialogRef.close(null);
    }
}
