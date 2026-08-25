import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';

import { CodexSection, SECTION_DEFINITIONS } from '@core/models';
import * as CodexActions from '@store/codex/codex.actions';
import { selectActiveSection, selectSidebarCollapsed } from '@store/codex/codex.selectors';
import { CodexHeaderComponent } from './codex-header.component';
import { CodexSidebarComponent } from './codex-sidebar.component';

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

    protected readonly sections = SECTION_DEFINITIONS;
    protected readonly activeSection = toSignal(this.store.select(selectActiveSection), {
        initialValue: CodexSection.Npcs
    });
    protected readonly sidebarCollapsed = toSignal(this.store.select(selectSidebarCollapsed), {
        initialValue: false
    });

    ngOnInit(): void {
        this.store.dispatch(CodexActions.loadIndex.request({}));
    }
}
