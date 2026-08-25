import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MarkdownCommand, MarkdownCommandService } from '@core/services/markdown-command.service';

const SHORTCUTS: ReadonlyArray<{ key: string; shift: boolean; alt: boolean; command: MarkdownCommand }> = [
    { key: 'b', shift: false, alt: false, command: 'bold' },
    { key: 'i', shift: false, alt: false, command: 'italic' },
    { key: 'x', shift: true, alt: false, command: 'strikethrough' },
    { key: 'k', shift: false, alt: false, command: 'link' },
    { key: 'e', shift: false, alt: false, command: 'code' },
    { key: '8', shift: true, alt: false, command: 'bulletList' },
    { key: '7', shift: true, alt: false, command: 'numberedList' },
    { key: '9', shift: true, alt: false, command: 'quote' },
    { key: '1', shift: false, alt: true, command: 'heading1' },
    { key: '2', shift: false, alt: true, command: 'heading2' },
    { key: '3', shift: false, alt: true, command: 'heading3' }
];

@Component({
    selector: 'cdx-markdown-editor',
    standalone: true,
    templateUrl: './markdown-editor.component.html',
    styleUrl: './markdown-editor.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(keydown)': 'onKeydown($event)'
    }
})
export class MarkdownEditorComponent {
    readonly value = input.required<string>();
    readonly html = input<string>('');
    readonly showEditor = input<boolean>(true);
    readonly showPreview = input<boolean>(false);
    readonly readOnly = input<boolean>(false);

    readonly valueChanged = output<string>();
    readonly entryLinkActivated = output<string>();
    readonly activeCommandsChanged = output<MarkdownCommand[]>();

    private readonly commandService = inject(MarkdownCommandService);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

    /**
     * The renderer escapes every character of the source before emitting its own markup, so the
     * result is trusted here to keep the data-entry-id hooks that Angular's sanitizer would strip.
     */
    protected readonly safeHtml = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.html()));

    applyCommand(command: MarkdownCommand): void {
        const element = this.textarea()?.nativeElement;
        if (element === undefined || this.readOnly()) {
            return;
        }

        const result = this.commandService.apply(command, element.value, {
            start: element.selectionStart,
            end: element.selectionEnd
        });

        element.value = result.value;
        element.setSelectionRange(result.selection.start, result.selection.end);
        element.focus();
        this.valueChanged.emit(result.value);
        this.reportActiveCommands();
    }

    activeCommands(): MarkdownCommand[] {
        const element = this.textarea()?.nativeElement;
        if (element === undefined) {
            return [];
        }

        const selection = { start: element.selectionStart, end: element.selectionEnd };
        return (['bold', 'italic', 'strikethrough', 'code'] as MarkdownCommand[]).filter((command) =>
            this.commandService.isActive(command, element.value, selection)
        );
    }

    protected onInput(event: Event): void {
        const target = event.target as HTMLTextAreaElement;
        this.valueChanged.emit(target.value);
        this.reportActiveCommands();
    }

    /** The caret carries no signal of its own, so its formatting is pushed out on every move. */
    protected onCaretMoved(): void {
        this.reportActiveCommands();
    }

    protected onPreviewClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const entryId = target.dataset['entryId'];

        if (entryId !== undefined) {
            event.preventDefault();
            this.entryLinkActivated.emit(entryId);
        }
    }

    protected onKeydown(event: KeyboardEvent): void {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }

        const match = SHORTCUTS.find(
            (shortcut) =>
                shortcut.key === event.key.toLowerCase() &&
                shortcut.shift === event.shiftKey &&
                shortcut.alt === event.altKey
        );

        if (match === undefined) {
            return;
        }

        event.preventDefault();
        this.applyCommand(match.command);
    }

    private reportActiveCommands(): void {
        this.activeCommandsChanged.emit(this.activeCommands());
    }
}
