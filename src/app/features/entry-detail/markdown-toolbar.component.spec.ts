import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ViewMode } from '@core/models';
import { MarkdownCommand } from '@core/services/markdown-command.service';
import { MarkdownToolbarComponent } from './markdown-toolbar.component';

describe('MarkdownToolbarComponent', () => {
    let fixture: ComponentFixture<MarkdownToolbarComponent>;
    let component: MarkdownToolbarComponent;

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [MarkdownToolbarComponent, NoopAnimationsModule]
        }).compileComponents();
        fixture = TestBed.createComponent(MarkdownToolbarComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('activeCommands', []);
        fixture.componentRef.setInput('viewMode', ViewMode.Edit);
        fixture.detectChanges();
    });

    it('should emit the command when a toolbar button is pressed', () => {
        // Arrange
        const emitted: MarkdownCommand[] = [];
        component.commandRequested.subscribe((command) => emitted.push(command));
        const boldButton = fixture.nativeElement.querySelector('[aria-label="Bold"]') as HTMLElement;

        // Act
        boldButton.click();
        fixture.detectChanges();

        // Assert
        expect(emitted[0]).toBe('bold');
    });

    it('should mark an active command as pressed', () => {
        // Arrange
        fixture.componentRef.setInput('activeCommands', ['bold']);

        // Act
        fixture.detectChanges();
        const boldButton = fixture.nativeElement.querySelector('[aria-label="Bold"]') as HTMLElement;

        // Assert
        expect(boldButton.getAttribute('aria-pressed')).toBe('true');
        expect(boldButton.classList.contains('cdx-toolbar-active')).toBe(true);
    });

    it('should not mark an inactive command as pressed', () => {
        // Arrange
        const italicButton = fixture.nativeElement.querySelector('[aria-label="Italic"]') as HTMLElement;

        // Act
        fixture.detectChanges();

        // Assert
        expect(italicButton.classList.contains('cdx-toolbar-active')).toBe(false);
    });
});
