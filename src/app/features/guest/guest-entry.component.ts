import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { GUEST_CAMPAIGN_SLUG } from '@core/guest/guest-data';
import { GuestModeService } from '@core/guest/guest-mode.service';

@Component({
    selector: 'cdx-guest-entry',
    standalone: true,
    template: '<p class="cdx-guest-entry">Opening the demo…</p>',
    styles: `
        .cdx-guest-entry {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: var(--cdx-surface-0);
            color: var(--cdx-text-secondary);
            font-size: 13px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuestEntryComponent implements OnInit {
    private readonly guestMode = inject(GuestModeService);
    private readonly router = inject(Router);

    ngOnInit(): void {
        this.guestMode.enter();
        void this.router.navigateByUrl(`/campaigns/${GUEST_CAMPAIGN_SLUG}/npcs`, { replaceUrl: true });
    }
}
