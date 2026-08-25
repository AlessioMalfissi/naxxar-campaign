import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { IPromptModalData } from './i-modal';

@Component({
    selector: 'cdx-prompt-modal',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
    templateUrl: './prompt-modal.component.html',
    styleUrl: './modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromptModalComponent {
    protected readonly data = inject<IPromptModalData>(DIALOG_DATA);
    protected readonly control = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)]
    });

    private readonly dialogRef = inject<DialogRef<string | null>>(DialogRef);

    protected confirm(): void {
        if (this.control.invalid) {
            this.control.markAsTouched();
            return;
        }

        this.dialogRef.close(this.control.value.trim());
    }

    protected cancel(): void {
        this.dialogRef.close(null);
    }
}
