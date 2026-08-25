import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ConfirmModalComponent } from './confirm-modal.component';
import { IConfirmModalData, IPromptModalData } from './i-modal';
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
});
