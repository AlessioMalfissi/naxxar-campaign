import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';

import { CodexSection, SECTION_DEFINITIONS } from '@core/models';
import { CampaignContextService } from '@core/services/campaign-context.service';
import { HelpOverlayComponent } from '@features/help/help-overlay.component';
import * as AuthActions from '@store/auth/auth.actions';
import * as CodexActions from '@store/codex/codex.actions';
import * as CombatActions from '@store/combat/combat.actions';
import { selectActiveSection, selectHelpOpen, selectSidebarCollapsed } from '@store/codex/codex.selectors';
import * as InventoryActions from '@store/inventory/inventory.actions';
import * as PursesActions from '@store/purses/purses.actions';
import { CodexHeaderComponent } from './codex-header.component';
import { CodexSidebarComponent } from './codex-sidebar.component';

// Keep in sync with the tablet-and-below breakpoint used in this component's and the
// sidebar's stylesheets (`@media (width <= 1023px)`).
export const TABLET_AND_BELOW_QUERY = '(max-width: 1023px)';

@Component({
    selector: 'cdx-campaign-shell',
    standalone: true,
    imports: [RouterOutlet, MatTabsModule, CodexHeaderComponent, CodexSidebarComponent, HelpOverlayComponent],
    templateUrl: './campaign-shell.component.html',
    styleUrl: './campaign-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignShellComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly campaignContext = inject(CampaignContextService);
    private readonly breakpointObserver = inject(BreakpointObserver);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly sections = SECTION_DEFINITIONS;
    protected readonly activeSection = toSignal(this.store.select(selectActiveSection), {
        initialValue: CodexSection.Npcs
    });
    protected readonly sidebarCollapsed = toSignal(this.store.select(selectSidebarCollapsed), {
        initialValue: false
    });
    protected readonly helpOpen = toSignal(this.store.select(selectHelpOpen), { initialValue: false });

    ngOnInit(): void {
        const slug = this.route.snapshot.paramMap.get('campaignSlug');
        if (slug === null) {
            void this.router.navigateByUrl('/campaigns');
            return;
        }

        // Set the context before dispatching the loads: API services read the slug when the
        // effects call them.
        this.campaignContext.setSlug(slug);
        this.store.dispatch(AuthActions.campaignActivated({ slug }));
        this.store.dispatch(CodexActions.loadIndex.request({}));
        this.store.dispatch(InventoryActions.loadItems.request({}));
        this.store.dispatch(PursesActions.loadPurses.request({}));
        this.store.dispatch(CombatActions.loadEncounter.request({}));

        // Start collapsed to the icon rail on tablet and phone, where the full-width sidebar
        // would crowd out the content - the user can still expand it manually afterwards.
        if (this.breakpointObserver.isMatched(TABLET_AND_BELOW_QUERY)) {
            this.store.dispatch(CodexActions.sidebarCollapsedSet({ collapsed: true }));
        }

        this.destroyRef.onDestroy(() => {
            this.campaignContext.clear();
        });
    }
}
