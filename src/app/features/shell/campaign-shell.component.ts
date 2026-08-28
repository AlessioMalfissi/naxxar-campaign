import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';

import { CodexSection, SECTION_DEFINITIONS } from '@core/models';
import * as CodexActions from '@store/codex/codex.actions';
import { selectActiveSection, selectSidebarCollapsed } from '@store/codex/codex.selectors';
import * as InventoryActions from '@store/inventory/inventory.actions';
import { CodexHeaderComponent } from './codex-header.component';
import { CodexSidebarComponent } from './codex-sidebar.component';

// Keep in sync with the tablet-and-below breakpoint used in this component's and the
// sidebar's stylesheets (`@media (width <= 1023px)`).
export const TABLET_AND_BELOW_QUERY = '(max-width: 1023px)';

@Component({
    selector: 'cdx-campaign-shell',
    standalone: true,
    imports: [RouterOutlet, MatTabsModule, CodexHeaderComponent, CodexSidebarComponent],
    templateUrl: './campaign-shell.component.html',
    styleUrl: './campaign-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignShellComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly breakpointObserver = inject(BreakpointObserver);

    protected readonly sections = SECTION_DEFINITIONS;
    protected readonly activeSection = toSignal(this.store.select(selectActiveSection), {
        initialValue: CodexSection.Npcs
    });
    protected readonly sidebarCollapsed = toSignal(this.store.select(selectSidebarCollapsed), {
        initialValue: false
    });

    ngOnInit(): void {
        this.store.dispatch(CodexActions.loadIndex.request({}));
        this.store.dispatch(InventoryActions.loadItems.request({}));

        // Start collapsed to the icon rail on tablet and phone, where the full-width sidebar
        // would crowd out the content - the user can still expand it manually afterwards.
        if (this.breakpointObserver.isMatched(TABLET_AND_BELOW_QUERY)) {
            this.store.dispatch(CodexActions.sidebarCollapsedSet({ collapsed: true }));
        }
    }
}
