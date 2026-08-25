import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { IConfirmModalData } from './i-modal';

@Component({
    selector: 'cdx-confirm-modal',
    standalone: true,
    imports: [MatButtonModule],
    templateUrl: './confirm-modal.component.html',
    styleUrl: './modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmModalComponent {
    protected readonly data = inject<IConfirmModalData>(DIALOG_DATA);
    private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

    protected close(confirmed: boolean): void {
        this.dialogRef.close(confirmed);
    }
}
