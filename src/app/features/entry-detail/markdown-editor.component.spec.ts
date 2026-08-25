import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkdownCommand } from '@core/services/markdown-command.service';
import { MarkdownEditorComponent } from './markdown-editor.component';

describe('MarkdownEditorComponent', () => {
    let fixture: ComponentFixture<MarkdownEditorComponent>;
    let component: MarkdownEditorComponent;

    const textarea = (): HTMLTextAreaElement =>
        fixture.nativeElement.querySelector('.cdx-editor-input') as HTMLTextAreaElement;

    const select = (start: number, end: number): void => {
        textarea().setSelectionRange(start, end);
    };

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [MarkdownEditorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(MarkdownEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('value', 'Speaks softly.');
        fixture.componentRef.setInput('showEditor', true);
        fixture.detectChanges();
    });

    it('should emit the typed value on input', () => {
        // Arrange
        const emitted: string[] = [];
        component.valueChanged.subscribe((value) => emitted.push(value));
        textarea().value = 'Counts twice.';

        // Act
        textarea().dispatchEvent(new Event('input'));
        fixture.detectChanges();

        // Assert
        expect(emitted).toEqual(['Counts twice.']);
    });

    it('should wrap the selection when a command is applied', () => {
        // Arrange
        const emitted: string[] = [];
        component.valueChanged.subscribe((value) => emitted.push(value));
        select(0, 6);

        // Act
        component.applyCommand('bold');
        fixture.detectChanges();

        // Assert
        expect(textarea().value).toBe('**Speaks** softly.');
        expect(emitted[0]).toBe('**Speaks** softly.');
    });

    it('should ignore commands while read only', () => {
        // Arrange
        fixture.componentRef.setInput('readOnly', true);
        fixture.detectChanges();

        // Act
        component.applyCommand('bold');

        // Assert
        expect(textarea().value).toBe('Speaks softly.');
    });

    it('should announce the formatting under the caret when it moves', () => {
        // Arrange
        const emitted: MarkdownCommand[][] = [];
        component.activeCommandsChanged.subscribe((commands) => emitted.push(commands));
        textarea().value = '**Speaks**';
        select(2, 8);

        // Act
        textarea().dispatchEvent(new Event('keyup'));
        fixture.detectChanges();

        // Assert
        expect(emitted[0]).toEqual(['bold']);
    });

    it('should report the formatting under the caret', () => {
        // Arrange
        textarea().value = '**Speaks** softly.';
        select(2, 8);

        // Act
        const active = component.activeCommands();

        // Assert
        expect(active.includes('bold')).toBe(true);
        expect(active.includes('italic')).toBe(false);
    });

    it('should report no active commands without a textarea', () => {
        // Arrange
        fixture.componentRef.setInput('showEditor', false);
        fixture.detectChanges();

        // Act
        const active = component.activeCommands();

        // Assert
        expect(active.length).toBe(0);
    });

    it('should apply a shortcut and swallow the keystroke', () => {
        // Arrange
        select(0, 6);
        const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true });
        const preventSpy = jest.spyOn(event, 'preventDefault');

        // Act
        fixture.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        // Assert
        expect(preventSpy).toHaveBeenCalled();
        expect(textarea().value).toBe('**Speaks** softly.');
    });

    it('should ignore a keystroke without a modifier', () => {
        // Arrange
        const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true });

        // Act
        fixture.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        // Assert
        expect(textarea().value).toBe('Speaks softly.');
    });

    it('should ignore an unmapped modifier combination', () => {
        // Arrange
        const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true, bubbles: true });

        // Act
        fixture.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        // Assert
        expect(textarea().value).toBe('Speaks softly.');
    });

    it('should emit the entry id when a preview link is activated', () => {
        // Arrange
        fixture.componentRef.setInput('showPreview', true);
        fixture.componentRef.setInput(
            'html',
            '<a href="#" data-entry-id="npcs:mother-ilsabeth">Mother Ilsabeth</a>'
        );
        fixture.detectChanges();
        const emitted: string[] = [];
        component.entryLinkActivated.subscribe((id) => emitted.push(id));
        const link = fixture.nativeElement.querySelector('[data-entry-id]') as HTMLElement;

        // Act
        link.click();
        fixture.detectChanges();

        // Assert
        expect(emitted).toEqual(['npcs:mother-ilsabeth']);
    });

    it('should ignore preview clicks that are not entry links', () => {
        // Arrange
        fixture.componentRef.setInput('showPreview', true);
        fixture.componentRef.setInput('html', '<p class="cdx-plain">Plain text</p>');
        fixture.detectChanges();
        const emitted: string[] = [];
        component.entryLinkActivated.subscribe((id) => emitted.push(id));
        const paragraph = fixture.nativeElement.querySelector('.cdx-plain') as HTMLElement;

        // Act
        paragraph.click();
        fixture.detectChanges();

        // Assert
        expect(emitted.length).toBe(0);
    });
});
