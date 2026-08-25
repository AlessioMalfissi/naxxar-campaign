import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { debounceTime, map, startWith } from 'rxjs';

import { ICodexEntrySummary } from '@core/models';
import * as CodexActions from '@store/codex/codex.actions';
import { selectPlayerMode, selectVisibleEntries } from '@store/codex/codex.selectors';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

@Component({
    selector: 'cdx-codex-header',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatTooltipModule
    ],
    templateUrl: './codex-header.component.html',
    styleUrl: './codex-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodexHeaderComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);

    protected readonly campaignName = signal<string>('Naxxar campaign');
    protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
    protected readonly playerMode = toSignal(this.store.select(selectPlayerMode), { initialValue: false });

    private readonly entries = toSignal(this.store.select(selectVisibleEntries), { initialValue: [] });
    private readonly query = toSignal(
        this.searchControl.valueChanges.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            startWith(''),
            map((value) => value.trim().toLowerCase())
        ),
        { initialValue: '' }
    );

    protected readonly results = computed<ICodexEntrySummary[]>(() => {
        const query = this.query();
        if (query.length < MIN_QUERY_LENGTH) {
            return [];
        }

        return this.entries()
            .filter(
                (entry) =>
                    entry.title.toLowerCase().includes(query) ||
                    entry.excerpt.toLowerCase().includes(query) ||
                    entry.tags.some((tag) => tag.toLowerCase().includes(query))
            )
            .slice(0, MAX_RESULTS);
    });

    protected toggleSidebar(): void {
        this.store.dispatch(CodexActions.sidebarToggled());
    }

    protected togglePlayerMode(): void {
        this.store.dispatch(CodexActions.playerModeToggled());
    }

    protected openResult(entry: ICodexEntrySummary): void {
        this.searchControl.setValue('');
        void this.router.navigate(['/campaign', entry.section, entry.slug]);
    }

    protected displayEmpty(): string {
        return '';
    }
}
