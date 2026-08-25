import { EntryVisibility, SectionFieldKind } from '@core/models';

export interface IConfirmModalData {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
}

export interface IPromptModalData {
    title: string;
    label: string;
    placeholder: string;
    confirmLabel: string;
}

export interface ICreateEntryFieldConfig {
    key: string;
    label: string;
    kind: SectionFieldKind;
}

export interface ICreateEntryModalData {
    title: string;
    statuses: string[];
    fields: ICreateEntryFieldConfig[];
    confirmLabel: string;
}

export interface ICreateEntryResult {
    title: string;
    status: string;
    tags: string[];
    visibility: EntryVisibility;
    fields: Record<string, string>;
}
