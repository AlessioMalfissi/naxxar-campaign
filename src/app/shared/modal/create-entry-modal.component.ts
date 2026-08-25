import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';

import { EntryVisibility } from '@core/models';
import { ICreateEntryModalData, ICreateEntryResult } from './i-modal';

@Component({
    selector: 'cdx-create-entry-modal',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatChipsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatRadioModule,
        MatSelectModule
    ],
    templateUrl: './create-entry-modal.component.html',
    styleUrl: './modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateEntryModalComponent {
    protected readonly data = inject<ICreateEntryModalData>(DIALOG_DATA);
    protected readonly visibilities = EntryVisibility;
    protected readonly separatorKeys = [ENTER, COMMA];

    protected readonly titleControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)]
    });
    protected readonly statusControl = new FormControl<string>(this.data.statuses[0] ?? '', { nonNullable: true });
    protected readonly visibilityControl = new FormControl<EntryVisibility>(EntryVisibility.Dm, {
        nonNullable: true
    });
    protected readonly fieldsGroup = new FormRecord<FormControl<string>>(
        Object.fromEntries(this.data.fields.map((field) => [field.key, new FormControl('', { nonNullable: true })]))
    );

    protected readonly tags = signal<string[]>([]);

    private readonly tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');
    private readonly dialogRef = inject<DialogRef<ICreateEntryResult | null>>(DialogRef);

    protected addTag(event: MatChipInputEvent): void {
        const value = event.value.trim();
        if (value !== '' && !this.tags().includes(value)) {
            this.tags.update((tags) => [...tags, value]);
        }
        event.chipInput?.clear();
    }

    protected removeTag(tag: string): void {
        this.tags.update((tags) => tags.filter((existing) => existing !== tag));
    }

    protected confirm(): void {
        if (this.titleControl.invalid) {
            this.titleControl.markAsTouched();
            return;
        }

        this.flushPendingTag();

        this.dialogRef.close({
            title: this.titleControl.value.trim(),
            status: this.statusControl.value,
            tags: this.tags(),
            visibility: this.visibilityControl.value,
            fields: this.fieldsGroup.getRawValue()
        });
    }

    private flushPendingTag(): void {
        const input = this.tagInput()?.nativeElement;
        const value = input?.value.trim() ?? '';
        if (value !== '' && !this.tags().includes(value)) {
            this.tags.update((tags) => [...tags, value]);
        }
        if (input !== undefined) {
            input.value = '';
        }
    }

    protected cancel(): void {
        this.dialogRef.close(null);
    }
}
