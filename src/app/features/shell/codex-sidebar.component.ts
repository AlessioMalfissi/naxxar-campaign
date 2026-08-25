import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';

import { CodexSection, findSectionDefinition, ICodexEntrySummary, SECTION_DEFINITIONS } from '@core/models';
import { ModalService } from '@shared/modal/modal.service';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectActiveSection,
    selectRecentEntries,
    selectSectionCounts,
    selectSidebarCollapsed
} from '@store/codex/codex.selectors';

const EMPTY_COUNTS: Record<string, number> = {};

@Component({
    selector: 'cdx-codex-sidebar',
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './codex-sidebar.component.html',
    styleUrl: './codex-sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodexSidebarComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly modalService = inject(ModalService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly sections = SECTION_DEFINITIONS;
    protected readonly counts = toSignal(this.store.select(selectSectionCounts), { initialValue: EMPTY_COUNTS });
    protected readonly activeSection = toSignal(this.store.select(selectActiveSection), {
        initialValue: CodexSection.Npcs
    });
    protected readonly collapsed = toSignal(this.store.select(selectSidebarCollapsed), { initialValue: false });
    protected readonly recentEntries = toSignal(this.store.select(selectRecentEntries), { initialValue: [] });

    protected readonly activeSectionLabel = computed<string>(() => findSectionDefinition(this.activeSection()).label);

    protected countFor(section: CodexSection): number {
        return this.counts()[section] ?? 0;
    }

    protected isActiveEntry(entry: ICodexEntrySummary): boolean {
        return this.router.url.endsWith(`/${entry.slug}`);
    }

    protected createEntry(): void {
        const section = this.activeSection();
        const definition = findSectionDefinition(section);

        this.modalService
            .prompt({
                title: `New entry in ${definition.label}`,
                label: 'Title',
                placeholder: 'Vaelith Corrun',
                confirmLabel: 'Create entry'
            })
            .pipe(
                filter((title): title is string => title !== null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((title) => {
                this.store.dispatch(
                    CodexActions.createEntry.request({ section, title, status: definition.statuses[0] })
                );
            });
    }
}
