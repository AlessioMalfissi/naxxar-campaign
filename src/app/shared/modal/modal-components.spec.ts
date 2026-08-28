import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { MatChipInputEvent } from '@angular/material/chips';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EntryVisibility } from '@core/models';
import { ConfirmModalComponent } from './confirm-modal.component';
import { CreateEntryModalComponent } from './create-entry-modal.component';
import { IConfirmModalData, ICreateEntryModalData, ICreateEntryResult, IPromptModalData } from './i-modal';
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

const CREATE_ENTRY_DATA: ICreateEntryModalData = {
    title: 'New entry in NPCs',
    statuses: ['Alive', 'Dead'],
    fields: [{ key: 'race', label: 'Race', kind: 'text' }],
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

describe('CreateEntryModalComponent', () => {
    let fixture: ComponentFixture<CreateEntryModalComponent>;
    let component: CreateEntryModalComponent;
    let dialogRef: { close: jest.Mock };

    beforeEach(async () => {
        // Arrange
        dialogRef = { close: jest.fn() };
        await TestBed.configureTestingModule({
            imports: [CreateEntryModalComponent, NoopAnimationsModule],
            providers: [
                { provide: DIALOG_DATA, useValue: CREATE_ENTRY_DATA },
                { provide: DialogRef, useValue: dialogRef }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(CreateEntryModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should default the status to the first option', () => {
        // Assert
        expect(component['statusControl'].value).toBe('Alive');
    });

    it('should add and remove tags', () => {
        // Arrange
        const inputEvent = { value: 'merchant', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent;

        // Act
        component['addTag'](inputEvent);

        // Assert
        expect(component['tags']()).toEqual(['merchant']);

        // Act
        component['removeTag']('merchant');

        // Assert
        expect(component['tags']()).toEqual([]);
    });

    it('should ignore blank or duplicate tags', () => {
        // Arrange
        const blank = { value: '   ', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent;
        const merchant = { value: 'merchant', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent;

        // Act
        component['addTag'](blank);
        component['addTag'](merchant);
        component['addTag'](merchant);

        // Assert
        expect(component['tags']()).toEqual(['merchant']);
    });

    it('should include a pending tag left in the input when confirming', () => {
        // Arrange
        component['titleControl'].setValue('Grum the Broker');
        component['addTag']({ value: 'merchant', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent);
        const tagInput = fixture.nativeElement.querySelector('input[placeholder="Add a tag…"]') as HTMLInputElement;
        tagInput.value = 'ally';
        fixture.detectChanges();

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(
            expect.objectContaining({ tags: ['merchant', 'ally'] })
        );
    });

    it('should ignore a blank or duplicate pending tag when confirming', () => {
        // Arrange
        component['titleControl'].setValue('Grum the Broker');
        component['addTag']({ value: 'merchant', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent);
        const tagInput = fixture.nativeElement.querySelector('input[placeholder="Add a tag…"]') as HTMLInputElement;
        tagInput.value = 'merchant';
        fixture.detectChanges();

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ tags: ['merchant'] }));
    });

    it('should close with the entered title, status, tags, visibility and fields', () => {
        // Arrange
        component['titleControl'].setValue('Grum the Broker');
        component['statusControl'].setValue('Dead');
        component['visibilityControl'].setValue(EntryVisibility.Revealed);
        component['fieldsGroup'].controls['race'].setValue('Dwarf');
        component['addTag']({ value: 'merchant', chipInput: { clear: jest.fn() } } as unknown as MatChipInputEvent);
        fixture.detectChanges();

        // Act
        component['confirm']();

        // Assert
        const expected: ICreateEntryResult = {
            title: 'Grum the Broker',
            status: 'Dead',
            tags: ['merchant'],
            visibility: EntryVisibility.Revealed,
            fields: { race: 'Dwarf' }
        };
        expect(dialogRef.close).toHaveBeenCalledWith(expected);
    });

    it('should keep the modal open and show the error when the title is too short', () => {
        // Arrange
        component['titleControl'].setValue('G');
        fixture.detectChanges();

        // Act
        component['confirm']();
        fixture.detectChanges();

        // Assert
        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(component['titleControl'].touched).toBe(true);
    });

    it('should close with null when cancelled', () => {
        // Act
        component['cancel']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
});

describe('CreateEntryModalComponent in edit mode', () => {
    let fixture: ComponentFixture<CreateEntryModalComponent>;
    let component: CreateEntryModalComponent;
    let dialogRef: { close: jest.Mock };

    const EDIT_ENTRY_DATA: ICreateEntryModalData = {
        title: 'Edit Grum the Broker',
        statuses: ['Alive', 'Dead'],
        fields: [{ key: 'race', label: 'Race', kind: 'text' }],
        confirmLabel: 'Save changes',
        values: {
            title: 'Grum the Broker',
            status: 'Dead',
            tags: ['merchant'],
            visibility: EntryVisibility.Revealed,
            fields: { race: 'Dwarf' }
        }
    };

    beforeEach(async () => {
        // Arrange
        dialogRef = { close: jest.fn() };
        await TestBed.configureTestingModule({
            imports: [CreateEntryModalComponent, NoopAnimationsModule],
            providers: [
                { provide: DIALOG_DATA, useValue: EDIT_ENTRY_DATA },
                { provide: DialogRef, useValue: dialogRef }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(CreateEntryModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should prefill the form with the supplied values', () => {
        // Assert
        expect(component['titleControl'].value).toBe('Grum the Broker');
        expect(component['statusControl'].value).toBe('Dead');
        expect(component['visibilityControl'].value).toBe(EntryVisibility.Revealed);
        expect(component['tags']()).toEqual(['merchant']);
        expect(component['fieldsGroup'].controls['race'].value).toBe('Dwarf');
    });

    it('should close with the edited values', () => {
        // Arrange
        component['fieldsGroup'].controls['race'].setValue('Half-orc');

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith({
            title: 'Grum the Broker',
            status: 'Dead',
            tags: ['merchant'],
            visibility: EntryVisibility.Revealed,
            fields: { race: 'Half-orc' }
        });
    });
});
