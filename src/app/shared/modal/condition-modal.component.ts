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

const MAX_DESCRIPTION_LENGTH = 500;

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
    protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
    protected readonly form = new FormGroup({
        name: new FormControl<string>(this.data.condition?.name ?? '', {
            nonNullable: true,
            validators: [Validators.required]
        }),
        rounds: new FormControl<number | null>(this.data.condition?.rounds ?? null, {
            validators: [Validators.min(1)]
        }),
        description: new FormControl<string>(this.data.condition?.description ?? '', {
            nonNullable: true,
            validators: [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]
        })
    });

    private readonly dialogRef = inject<DialogRef<ICombatCondition | null>>(DialogRef);
    private readonly query = toSignal(this.form.controls.name.valueChanges, {
        initialValue: this.form.controls.name.value
    });

    // A suggestion that matches the name exactly adds nothing, so a pre-filled edit opens without a panel.
    protected readonly suggestions = computed<string[]>(() => {
        const query = this.query().trim().toLowerCase();
        return this.data.suggestions.filter((suggestion) => {
            const candidate = suggestion.toLowerCase();
            return candidate !== query && candidate.includes(query);
        });
    });

    protected confirm(): void {
        const name = this.form.controls.name.value.trim();
        if (this.form.invalid || name === '') {
            this.form.markAllAsTouched();
            return;
        }

        const rounds = this.form.controls.rounds.value;
        const description = this.form.controls.description.value.trim();
        const condition: ICombatCondition = { name, rounds: rounds == null ? null : Math.floor(rounds) };
        this.dialogRef.close(description === '' ? condition : { ...condition, description });
    }

    protected cancel(): void {
        this.dialogRef.close(null);
    }
}
