import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ConditionModalComponent } from './condition-modal.component';
import { IConditionModalData } from './i-modal';

const CONDITION_DATA: IConditionModalData = {
    title: 'Add condition to Goblin 1',
    suggestions: ['Blinded', 'Prone', 'Poisoned']
};

describe('ConditionModalComponent', () => {
    let fixture: ComponentFixture<ConditionModalComponent>;
    let component: ConditionModalComponent;
    let dialogRef: { close: jest.Mock };

    beforeEach(async () => {
        // Arrange
        dialogRef = { close: jest.fn() };
        await TestBed.configureTestingModule({
            imports: [ConditionModalComponent, NoopAnimationsModule],
            providers: [
                { provide: DIALOG_DATA, useValue: CONDITION_DATA },
                { provide: DialogRef, useValue: dialogRef }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(ConditionModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render the supplied title', () => {
        // Arrange
        const title = fixture.nativeElement.querySelector('.cdx-modal-title') as HTMLElement;

        // Act
        const text = title.textContent ?? '';

        // Assert
        expect(text.includes('Add condition to Goblin 1')).toBe(true);
    });

    it('should suggest every condition before anything is typed', () => {
        // Act
        const suggestions = component['suggestions']();

        // Assert
        expect(suggestions).toEqual(['Blinded', 'Prone', 'Poisoned']);
    });

    it('should narrow the suggestions to what was typed', () => {
        // Arrange
        const nameControl = component['form'].controls.name;

        // Act
        nameControl.setValue('  PO ');
        const suggestions = component['suggestions']();

        // Assert
        expect(suggestions).toEqual(['Poisoned']);
    });

    it('should close with a trimmed name and whole-round duration', () => {
        // Arrange
        component['form'].setValue({ name: ' Poisoned ', rounds: 3.6 });

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith({ name: 'Poisoned', rounds: 3 });
    });

    it('should close with no duration when rounds is left blank', () => {
        // Arrange
        component['form'].setValue({ name: 'Hexed', rounds: null });

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith({ name: 'Hexed', rounds: null });
    });

    it('should not close without a name', () => {
        // Arrange
        component['form'].setValue({ name: '   ', rounds: null });

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(component['form'].controls.name.touched).toBe(true);
    });

    it('should not close with a duration below one round', () => {
        // Arrange
        component['form'].setValue({ name: 'Prone', rounds: 0 });

        // Act
        component['confirm']();

        // Assert
        expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close with null when cancelled', () => {
        // Arrange
        const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;

        // Act
        buttons[0].click();

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith(null);
    });

    it('should confirm when the form is submitted', () => {
        // Arrange
        component['form'].setValue({ name: 'Prone', rounds: null });
        const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

        // Act
        form.dispatchEvent(new Event('submit'));

        // Assert
        expect(dialogRef.close).toHaveBeenCalledWith({ name: 'Prone', rounds: null });
    });
});
