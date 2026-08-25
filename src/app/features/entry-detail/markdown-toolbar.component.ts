import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ViewMode } from '@core/models';
import { MarkdownCommand } from '@core/services/markdown-command.service';

interface IToolbarButton {
    command: MarkdownCommand;
    icon: string;
    label: string;
    shortcut: string;
}

@Component({
    selector: 'cdx-markdown-toolbar',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
    templateUrl: './markdown-toolbar.component.html',
    styleUrl: './markdown-toolbar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownToolbarComponent {
    readonly activeCommands = input<MarkdownCommand[]>([]);
    readonly viewMode = input<ViewMode>(ViewMode.Edit);

    readonly commandRequested = output<MarkdownCommand>();
    readonly viewModeRequested = output<ViewMode>();

    protected readonly viewModeOptions = ViewMode;

    protected readonly inlineButtons: readonly IToolbarButton[] = [
        { command: 'bold', icon: 'format_bold', label: 'Bold', shortcut: 'Ctrl+B' },
        { command: 'italic', icon: 'format_italic', label: 'Italic', shortcut: 'Ctrl+I' },
        { command: 'strikethrough', icon: 'strikethrough_s', label: 'Strikethrough', shortcut: 'Ctrl+Shift+X' }
    ];

    protected readonly blockButtons: readonly IToolbarButton[] = [
        { command: 'bulletList', icon: 'format_list_bulleted', label: 'Bulleted list', shortcut: 'Ctrl+Shift+8' },
        { command: 'numberedList', icon: 'format_list_numbered', label: 'Numbered list', shortcut: 'Ctrl+Shift+7' },
        { command: 'quote', icon: 'format_quote', label: 'Quote', shortcut: 'Ctrl+Shift+9' }
    ];

    protected readonly insertButtons: readonly IToolbarButton[] = [
        { command: 'link', icon: 'link', label: 'Link', shortcut: 'Ctrl+K' },
        { command: 'code', icon: 'code', label: 'Code', shortcut: 'Ctrl+E' },
        { command: 'table', icon: 'table_chart', label: 'Table', shortcut: '' },
        { command: 'image', icon: 'image', label: 'Image', shortcut: '' }
    ];

    protected isActive(command: MarkdownCommand): boolean {
        return this.activeCommands().includes(command);
    }

    protected requestCommand(command: MarkdownCommand): void {
        this.commandRequested.emit(command);
    }

    protected requestViewMode(mode: ViewMode): void {
        this.viewModeRequested.emit(mode);
    }

    protected tooltipFor(button: IToolbarButton): string {
        return button.shortcut === '' ? button.label : `${button.label} (${button.shortcut})`;
    }
}
