import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ConfirmModalComponent } from './confirm-modal.component';
import { IConfirmModalData, IPromptModalData } from './i-modal';
import { PromptModalComponent } from './prompt-modal.component';

const CONFIRM_DATA: IConfirmModalData = {
    title: 'Discard changes?',
    message: 'Your unsaved edits will be lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    danger: true
};

const PROMPT_DATA: IPromptModalData = {
    title: 'New entry in NPCs',
    label: 'Title',
    placeholder: 'Vaelith Corrun',
    confirmLabel: 'Create entry'
};

describe('ConfirmModalComponent', () => {
    let fixture: ComponentFixture<ConfirmModalComponent>;
    let dialogRef: { close: jest.Mock };

    beforeEach(async () => {
        // Arrange
        dialogRef = { close: jest.fn() };
        await TestBed.configureTestingModule({
            imports: [ConfirmModalComponent, NoopAnimationsModule],
            providers: [
                { provide: DIALOG_DATA, useValue: CONFIRM_DATA },
                { provide: DialogRef, useValue: dialogRef }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(ConfirmModalComponent);
        fixture.detectChanges();
    });

    it('should render the supplied copy', () => {
        // Arrange
        const title = fixture.nativeElement.querySelector('.cdx-modal-title') as HTMLElement;

        // Act
        const text = title.textContent ?? '';

        // Assert
        expect(text.includes('Discard changes?')).toBe(true);
    });

    it('should close with true when confirmed', () => {
        // Arrange
        const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

        // Act
        buttons[1].click();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should close with false when cancelled', () => {
        // Arrange
        const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

        // Act
        buttons[0].click();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(false);
    });
});

describe('PromptModalComponent', () => {
    let fixture: ComponentFixture<PromptModalComponent>;
    let component: PromptModalComponent;
    let dialogRef: { close: jest.Mock };

    beforeEach(async () => {
        // Arrange
        dialogRef = { close: jest.fn() };
        await TestBed.configureTestingModule({
            imports: [PromptModalComponent, NoopAnimationsModule],
            providers: [
                { provide: DIALOG_DATA, useValue: PROMPT_DATA },
                { provide: DialogRef, useValue: dialogRef }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(PromptModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should close with the trimmed value when valid', () => {
        // Arrange
        component['control'].setValue('  Grum the Broker  ');
        fixture.detectChanges();

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith('Grum the Broker');
    });

    it('should keep the modal open and show the error when the value is too short', () => {
        // Arrange
        component['control'].setValue('G');
        fixture.detectChanges();

        // Act
        component['confirm']();
        fixture.detectChanges();

        // Assert
        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(component['control'].touched).toBe(true);
    });

    it('should close with null when cancelled', () => {
        // Arrange
        const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

        // Act
        buttons[0].click();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
});
