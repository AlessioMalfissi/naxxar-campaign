import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { debounceTime, map, startWith } from 'rxjs';

import { ICodexEntrySummary } from '@core/models';
import { CampaignContextService } from '@core/services/campaign-context.service';
import * as AuthActions from '@store/auth/auth.actions';
import {
    selectActiveCampaign,
    selectActiveRole,
    selectCampaigns,
    selectUser
} from '@store/auth/auth.selectors';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectDmPreview,
    selectHelpOpen,
    selectPlayerMode,
    selectVisibleEntries
} from '@store/codex/codex.selectors';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;
export const ALL_CAMPAIGNS_OPTION = '__all-campaigns__';

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
        MatSelectModule,
        MatTooltipModule
    ],
    templateUrl: './codex-header.component.html',
    styleUrl: './codex-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodexHeaderComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly campaignContext = inject(CampaignContextService);

    protected readonly allCampaignsOption = ALL_CAMPAIGNS_OPTION;
    protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
    protected readonly campaigns = toSignal(this.store.select(selectCampaigns), { initialValue: [] });
    protected readonly activeCampaign = toSignal(this.store.select(selectActiveCampaign), { initialValue: null });
    protected readonly user = toSignal(this.store.select(selectUser), { initialValue: null });
    protected readonly role = toSignal(this.store.select(selectActiveRole), { initialValue: null });
    protected readonly dmPreview = toSignal(this.store.select(selectDmPreview), { initialValue: false });
    protected readonly playerMode = toSignal(this.store.select(selectPlayerMode), { initialValue: false });
    protected readonly helpOpen = toSignal(this.store.select(selectHelpOpen), { initialValue: false });

    protected readonly campaignName = computed(() => this.activeCampaign()?.name ?? 'Campaign');
    protected readonly activeSlug = computed(() => this.activeCampaign()?.slug ?? null);
    protected readonly isDm = computed(() => this.role() === 'dm');
    protected readonly initials = computed(() => {
        const name = this.user()?.displayName.trim() ?? '';
        if (name === '') {
            return '?';
        }

        return name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
    });

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

    protected toggleHelp(): void {
        this.store.dispatch(CodexActions.helpToggled());
    }

    protected toggleDmPreview(): void {
        this.store.dispatch(CodexActions.dmPreviewToggled());
    }

    protected signOut(): void {
        this.store.dispatch(AuthActions.logout.request({}));
    }

    protected onCampaignSelected(slug: string): void {
        if (slug === ALL_CAMPAIGNS_OPTION) {
            void this.router.navigateByUrl('/campaigns');
            return;
        }

        if (slug !== this.activeSlug()) {
            void this.router.navigate(['/campaigns', slug, 'npcs']);
        }
    }

    protected openMembers(): void {
        const slug = this.activeSlug();
        if (slug !== null) {
            void this.router.navigate(['/campaigns', slug, 'members']);
        }
    }

    protected openAllCampaigns(): void {
        void this.router.navigateByUrl('/campaigns');
    }

    protected openResult(entry: ICodexEntrySummary): void {
        const slug = this.campaignContext.slug();
        if (slug === null) {
            return;
        }

        this.searchControl.setValue('');
        void this.router.navigate(['/campaigns', slug, entry.section, entry.slug]);
    }

    protected displayEmpty(): string {
        return '';
    }
}
