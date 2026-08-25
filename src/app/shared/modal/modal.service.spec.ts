import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EntryVisibility } from '@core/models';
import { ConfirmModalComponent } from './confirm-modal.component';
import { CreateEntryModalComponent } from './create-entry-modal.component';
import { IConfirmModalData, ICreateEntryModalData, ICreateEntryResult, IPromptModalData } from './i-modal';
import { ModalService } from './modal.service';
import { PromptModalComponent } from './prompt-modal.component';

describe('ModalService', () => {
    let service: ModalService;
    let dialog: { open: jest.Mock };

    beforeEach(() => {
        // Arrange
        dialog = { open: jest.fn() };
        TestBed.configureTestingModule({
            providers: [{ provide: Dialog, useValue: dialog }]
        });
        service = TestBed.inject(ModalService);
    });

    it('should open the confirm modal with the supplied copy', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(true) });

        // Act
        service.confirm({ title: 'Delete Vaelith Corrun?', confirmLabel: 'Delete', danger: true }).subscribe();

        // Assert
        const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: IConfirmModalData }];
        expect(component === ConfirmModalComponent).toBe(true);
        expect(config.data.title).toBe('Delete Vaelith Corrun?');
        expect(config.data.danger).toBe(true);
    });

    it('should fall back to default confirm copy', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(true) });

        // Act
        service.confirm({}).subscribe();

        // Assert
        const [, config] = dialog.open.mock.calls[0] as [unknown, { data: IConfirmModalData }];
        expect(config.data.title).toBe('Are you sure?');
        expect(config.data.cancelLabel).toBe('Cancel');
        expect(config.data.danger).toBe(false);
    });

    it('should report a dismissed confirm modal as false', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(undefined) });
        let confirmed = true;

        // Act
        service.confirm({}).subscribe((result) => (confirmed = result));

        // Assert
        expect(confirmed).toBe(false);
    });

    it('should open the prompt modal and return the typed value', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of('Grum the Broker') });
        let value: string | null = null;

        // Act
        service.prompt({ title: 'New entry', label: 'Title' }).subscribe((result) => (value = result));

        // Assert
        const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: IPromptModalData }];
        expect(component === PromptModalComponent).toBe(true);
        expect(config.data.confirmLabel).toBe('Create');
        expect(value!).toBe('Grum the Broker');
    });

    it('should report a dismissed prompt modal as null', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(undefined) });
        let value: string | null = 'unset';

        // Act
        service.prompt({}).subscribe((result) => (value = result));

        // Assert
        expect(value === null).toBe(true);
    });

    it('should open the create entry modal with the supplied statuses and fields', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(null) });

        // Act
        service
            .createEntry({ title: 'New entry in NPCs', statuses: ['Alive', 'Dead'], fields: [] })
            .subscribe();

        // Assert
        const [component, config] = dialog.open.mock.calls[0] as [unknown, { data: ICreateEntryModalData }];
        expect(component === CreateEntryModalComponent).toBe(true);
        expect(config.data.title).toBe('New entry in NPCs');
        expect(config.data.statuses).toEqual(['Alive', 'Dead']);
        expect(config.data.confirmLabel).toBe('Create entry');
    });

    it('should report the create entry result', () => {
        // Arrange
        const created: ICreateEntryResult = {
            title: 'Grum the Broker',
            status: 'Alive',
            tags: ['merchant'],
            visibility: EntryVisibility.Dm,
            fields: {}
        };
        dialog.open.mockReturnValue({ closed: of(created) });
        let value: ICreateEntryResult | null = null;

        // Act
        service.createEntry({}).subscribe((result) => (value = result));

        // Assert
        expect(value!).toEqual(created);
    });

    it('should report a dismissed create entry modal as null', () => {
        // Arrange
        dialog.open.mockReturnValue({ closed: of(undefined) });
        let value: ICreateEntryResult | null = { title: 'unset' } as ICreateEntryResult;

        // Act
        service.createEntry({}).subscribe((result) => (value = result));

        // Assert
        expect(value === null).toBe(true);
    });
});
