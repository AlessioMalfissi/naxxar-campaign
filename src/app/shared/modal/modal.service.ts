import { Dialog } from '@angular/cdk/dialog';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ICombatCondition } from '@core/models';
import { ConditionModalComponent } from './condition-modal.component';
import { ConfirmModalComponent } from './confirm-modal.component';
import { CreateEntryModalComponent } from './create-entry-modal.component';
import {
    IConditionModalData,
    IConfirmModalData,
    ICreateEntryModalData,
    ICreateEntryResult,
    IPromptModalData
} from './i-modal';
import { PromptModalComponent } from './prompt-modal.component';

@Injectable({ providedIn: 'root' })
export class ModalService {
    private readonly dialog = inject(Dialog);

    confirm(data: Partial<IConfirmModalData>): Observable<boolean> {
        const reference = this.dialog.open<boolean, IConfirmModalData, ConfirmModalComponent>(ConfirmModalComponent, {
            data: {
                title: data.title ?? 'Are you sure?',
                message: data.message ?? '',
                confirmLabel: data.confirmLabel ?? 'Confirm',
                cancelLabel: data.cancelLabel ?? 'Cancel',
                danger: data.danger ?? false
            }
        });

        return reference.closed.pipe(map((result) => result === true));
    }

    prompt(data: Partial<IPromptModalData>): Observable<string | null> {
        const reference = this.dialog.open<string | null, IPromptModalData, PromptModalComponent>(
            PromptModalComponent,
            {
                data: {
                    title: data.title ?? 'Name',
                    label: data.label ?? 'Name',
                    placeholder: data.placeholder ?? '',
                    confirmLabel: data.confirmLabel ?? 'Create'
                }
            }
        );

        return reference.closed.pipe(map((result) => result ?? null));
    }

    createEntry(data: Partial<ICreateEntryModalData>): Observable<ICreateEntryResult | null> {
        const reference = this.dialog.open<ICreateEntryResult | null, ICreateEntryModalData, CreateEntryModalComponent>(
            CreateEntryModalComponent,
            {
                data: {
                    title: data.title ?? 'New entry',
                    statuses: data.statuses ?? [],
                    fields: data.fields ?? [],
                    confirmLabel: data.confirmLabel ?? 'Create entry',
                    values: data.values
                }
            }
        );

        return reference.closed.pipe(map((result) => result ?? null));
    }

    editEntry(data: Partial<ICreateEntryModalData>): Observable<ICreateEntryResult | null> {
        const reference = this.dialog.open<ICreateEntryResult | null, ICreateEntryModalData, CreateEntryModalComponent>(
            CreateEntryModalComponent,
            {
                data: {
                    title: data.title ?? 'Edit entry',
                    statuses: data.statuses ?? [],
                    fields: data.fields ?? [],
                    confirmLabel: data.confirmLabel ?? 'Save changes',
                    values: data.values
                }
            }
        );

        return reference.closed.pipe(map((result) => result ?? null));
    }

    addCondition(data: Partial<IConditionModalData>): Observable<ICombatCondition | null> {
        const reference = this.dialog.open<ICombatCondition | null, IConditionModalData, ConditionModalComponent>(
            ConditionModalComponent,
            {
                data: {
                    title: data.title ?? 'Add condition',
                    suggestions: data.suggestions ?? []
                }
            }
        );

        return reference.closed.pipe(map((result) => result ?? null));
    }
}
