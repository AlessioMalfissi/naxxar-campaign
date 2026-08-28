import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map } from 'rxjs';

import {
    CodexSection,
    EntryVisibility,
    findSectionDefinition,
    ICodexEntry,
    SaveStatus,
    SectionFieldKind,
    ViewMode
} from '@core/models';
import { MarkdownExportService } from '@core/services/markdown-export.service';
import { MarkdownCommand } from '@core/services/markdown-command.service';
import { MarkdownRendererService } from '@core/services/markdown-renderer.service';
import { buildEntryId, formatReferenceValue, parseEntryId } from '@core/utils/entry-id.util';
import { ICreateEntryResult } from '@shared/modal/i-modal';
import { ModalService } from '@shared/modal/modal.service';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectEntryLoading,
    selectEntryTitles,
    selectOpenEntry,
    selectPlayerMode,
    selectReferencingEntries
} from '@store/codex/codex.selectors';
import * as EditorActions from '@store/editor/editor.actions';
import {
    selectDraftBody,
    selectIsDirty,
    selectLastSavedAt,
    selectLastSavedBy,
    selectSaveStatus,
    selectShowEditor,
    selectShowPreview,
    selectViewMode
} from '@store/editor/editor.selectors';

const EMPTY_TITLES: Record<string, string> = {};
import { MarkdownEditorComponent } from './markdown-editor.component';
import { MarkdownToolbarComponent } from './markdown-toolbar.component';

@Component({
    selector: 'cdx-entry-detail',
    standalone: true,
    imports: [
        MatButtonModule,
        MatChipsModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        MarkdownEditorComponent,
        MarkdownToolbarComponent
    ],
    templateUrl: './entry-detail.component.html',
    styleUrl: './entry-detail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryDetailComponent {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly renderer = inject(MarkdownRendererService);
    private readonly exportService = inject(MarkdownExportService);
    private readonly modalService = inject(ModalService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly saveStatuses = SaveStatus;
    protected readonly viewModes = ViewMode;

    protected readonly entry = toSignal(this.store.select(selectOpenEntry), { initialValue: null });
    protected readonly draftBody = toSignal(this.store.select(selectDraftBody), { initialValue: '' });
    protected readonly saveStatus = toSignal(this.store.select(selectSaveStatus), {
        initialValue: SaveStatus.Idle
    });
    protected readonly viewMode = toSignal(this.store.select(selectViewMode), { initialValue: ViewMode.Edit });
    protected readonly showEditor = toSignal(this.store.select(selectShowEditor), { initialValue: true });
    protected readonly showPreview = toSignal(this.store.select(selectShowPreview), { initialValue: false });
    protected readonly isDirty = toSignal(this.store.select(selectIsDirty), { initialValue: false });
    protected readonly playerMode = toSignal(this.store.select(selectPlayerMode), { initialValue: false });
    protected readonly loading = toSignal(this.store.select(selectEntryLoading), { initialValue: false });
    protected readonly lastSavedAt = toSignal(this.store.select(selectLastSavedAt), { initialValue: null });
    protected readonly lastSavedBy = toSignal(this.store.select(selectLastSavedBy), { initialValue: null });
    protected readonly referencingEntries = toSignal(this.store.select(selectReferencingEntries), {
        initialValue: []
    });

    private readonly titles = toSignal(this.store.select(selectEntryTitles), { initialValue: EMPTY_TITLES });
    private readonly editor = viewChild(MarkdownEditorComponent);

    protected readonly sectionLabel = computed<string>(() => {
        const entry = this.entry();
        return entry === null ? '' : findSectionDefinition(entry.section).label;
    });

    protected readonly statusOptions = computed<string[]>(() => {
        const entry = this.entry();
        return entry === null ? [] : findSectionDefinition(entry.section).statuses;
    });

    protected readonly fields = computed(() => {
        const entry = this.entry();
        if (entry === null) {
            return [];
        }

        return findSectionDefinition(entry.section)
            .fields.map((field) => ({
                label: field.label,
                value: this.displayFieldValue(field.kind, entry.fields[field.key] ?? '')
            }))
            .filter((field) => field.value !== '');
    });

    protected readonly renderedHtml = computed<string>(() =>
        this.renderer.render(this.draftBody(), {
            titles: this.titles(),
            showDmBlocks: !this.playerMode()
        })
    );

    protected readonly activeCommands = signal<MarkdownCommand[]>([]);

    constructor() {
        this.route.paramMap
            .pipe(
                map((params) => {
                    const section = params.get('section') as CodexSection | null;
                    const slug = params.get('slug');
                    return section === null || slug === null ? null : buildEntryId(section, slug);
                }),
                filter((id): id is string => id !== null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((id) => this.store.dispatch(CodexActions.loadEntry.request({ id })));
    }

    protected onBodyChanged(body: string): void {
        this.store.dispatch(EditorActions.bodyChanged({ body }));
    }

    protected onCommand(command: MarkdownCommand): void {
        this.editor()?.applyCommand(command);
    }

    protected onActiveCommands(commands: MarkdownCommand[]): void {
        this.activeCommands.set(commands);
    }

    protected onViewMode(viewMode: ViewMode): void {
        this.store.dispatch(EditorActions.viewModeChanged({ viewMode }));
    }

    protected onEntryLink(entryId: string): void {
        const reference = parseEntryId(entryId);
        if (reference === null) {
            return;
        }

        void this.router.navigate(['/campaign', reference.section, reference.slug]);
    }

    protected save(): void {
        this.store.dispatch(EditorActions.saveRequested());
    }

    protected cancel(): void {
        if (!this.isDirty()) {
            return;
        }

        this.modalService
            .confirm({
                title: 'Discard changes?',
                message: 'Your unsaved edits to this entry will be lost.',
                confirmLabel: 'Discard',
                danger: true
            })
            .pipe(
                filter((confirmed) => confirmed),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => this.store.dispatch(EditorActions.changesDiscarded()));
    }

    protected onStatusChanged(status: string): void {
        const entry = this.entry();
        if (entry === null || status === entry.status) {
            return;
        }

        this.store.dispatch(CodexActions.saveEntry.request({ entry: { ...entry, status, body: this.draftBody() } }));
    }

    protected editEntry(): void {
        const entry = this.entry();
        if (entry === null) {
            return;
        }

        const definition = findSectionDefinition(entry.section);

        this.modalService
            .editEntry({
                title: `Edit ${entry.title}`,
                statuses: definition.statuses,
                fields: definition.fields,
                confirmLabel: 'Save changes',
                values: {
                    title: entry.title,
                    status: entry.status,
                    tags: entry.tags,
                    visibility: entry.visibility,
                    fields: entry.fields
                }
            })
            .pipe(
                filter((result): result is ICreateEntryResult => result !== null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((result) => {
                this.store.dispatch(
                    CodexActions.saveEntry.request({
                        entry: {
                            ...entry,
                            title: result.title,
                            status: result.status,
                            tags: result.tags,
                            visibility: result.visibility,
                            fields: result.fields,
                            body: this.draftBody()
                        }
                    })
                );
            });
    }

    protected toggleFavourite(): void {
        const entry = this.entry();
        if (entry === null) {
            return;
        }

        this.store.dispatch(CodexActions.favouriteToggled({ id: entry.id }));
    }

    protected exportMarkdown(): void {
        const entry = this.entry();
        if (entry === null) {
            return;
        }

        this.exportService.download({ ...entry, body: this.draftBody() } as ICodexEntry);
    }

    protected deleteEntry(): void {
        const entry = this.entry();
        if (entry === null) {
            return;
        }

        this.modalService
            .confirm({
                title: `Delete ${entry.title}?`,
                message: 'The entry is removed from the codex. Exported markdown files are not affected.',
                confirmLabel: 'Delete',
                danger: true
            })
            .pipe(
                filter((confirmed) => confirmed),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                this.store.dispatch(CodexActions.deleteEntry.request({ id: entry.id }));
                void this.router.navigate(['/campaign', entry.section]);
            });
    }

    protected isDmOnly(): boolean {
        return this.entry()?.visibility === EntryVisibility.Dm;
    }

    protected savedLabel(): string {
        const savedAt = this.lastSavedAt();
        if (savedAt === null) {
            return '';
        }

        return `Saved ${this.relativeTime(savedAt)} · edited by ${this.lastSavedBy() ?? 'DM'}`;
    }

    private displayFieldValue(kind: SectionFieldKind, value: string): string {
        if (kind !== 'reference' || value === '') {
            return value;
        }

        return formatReferenceValue(value, this.titles());
    }

    private relativeTime(isoDate: string): string {
        const minutes = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);

        if (minutes < 1) {
            return 'just now';
        }
        if (minutes < 60) {
            return `${minutes} min ago`;
        }
        if (minutes < 1440) {
            return `${Math.round(minutes / 60)} h ago`;
        }

        return `${Math.round(minutes / 1440)} days ago`;
    }
}
