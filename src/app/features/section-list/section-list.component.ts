import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';

import { CodexSection, findSectionDefinition, ICodexEntrySummary } from '@core/models';
import { DataTableComponent } from '@shared/datatable/data-table.component';
import { IDataTableColumn, IDataTableRow } from '@shared/datatable/i-data-table';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectFilters,
    selectIndexLoading,
    selectSectionEntries,
    selectSectionTags
} from '@store/codex/codex.selectors';

type ListView = 'table' | 'cards';

@Component({
    selector: 'cdx-section-list',
    standalone: true,
    imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule, DataTableComponent],
    templateUrl: './section-list.component.html',
    styleUrl: './section-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionListComponent {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly view = signal<ListView>('table');
    protected readonly entries = toSignal(this.store.select(selectSectionEntries), { initialValue: [] });
    protected readonly tags = toSignal(this.store.select(selectSectionTags), { initialValue: [] });
    protected readonly filters = toSignal(this.store.select(selectFilters), {
        initialValue: { status: null, tags: [], query: '' }
    });
    protected readonly loading = toSignal(this.store.select(selectIndexLoading), { initialValue: false });
    protected readonly section = signal<CodexSection>(CodexSection.Npcs);

    protected readonly definition = computed(() => findSectionDefinition(this.section()));

    protected readonly columns = computed<IDataTableColumn[]>(() => [
        { key: 'title', label: 'Title', width: '28%' },
        { key: 'status', label: 'Status', width: '12%' },
        ...this.definition().listColumns.map((key) => ({
            key,
            label: this.definition().fields.find((field) => field.key === key)?.label ?? key
        })),
        { key: 'tags', label: 'Tags' },
        { key: 'updated', label: 'Updated', width: '14%' }
    ]);

    protected readonly rows = computed<IDataTableRow[]>(() =>
        this.entries().map((entry) => ({
            id: entry.id,
            chip: entry.status,
            tags: entry.tags,
            cells: {
                title: entry.title,
                updated: new Date(entry.updatedAt).toLocaleDateString(),
                ...this.definition().listColumns.reduce<Record<string, string>>(
                    (cells, key) => ({ ...cells, [key]: entry.fields[key] ?? '—' }),
                    {}
                )
            }
        }))
    );

    constructor() {
        this.route.paramMap
            .pipe(
                map((params) => params.get('section') as CodexSection | null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((section) => {
                if (section === null) {
                    return;
                }

                this.section.set(section);
                this.store.dispatch(CodexActions.sectionOpened({ section }));
            });
    }

    protected setView(view: ListView): void {
        this.view.set(view);
    }

    protected toggleStatus(status: string): void {
        const current = this.filters();
        this.store.dispatch(
            CodexActions.filtersChanged({
                ...current,
                status: current.status === status ? null : status
            })
        );
    }

    protected toggleTag(tag: string): void {
        const current = this.filters();
        this.store.dispatch(
            CodexActions.filtersChanged({
                ...current,
                tags: current.tags.includes(tag)
                    ? current.tags.filter((item) => item !== tag)
                    : [...current.tags, tag]
            })
        );
    }

    protected openEntry(id: string): void {
        const entry = this.entries().find((item) => item.id === id);
        if (entry === undefined) {
            return;
        }

        void this.router.navigate(['/campaign', entry.section, entry.slug]);
    }

    protected openSummary(entry: ICodexEntrySummary): void {
        this.openEntry(entry.id);
    }
}
