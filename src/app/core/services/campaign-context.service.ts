import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { CampaignRole, ICampaignSummary } from '../models';
import { selectCampaigns } from '@store/auth/auth.selectors';

// The active campaign slug is set by the campaign shell after the route guard has confirmed
// membership. API services read it at call time, because services are injected before the shell
// runs and must follow every campaign switch.
@Injectable({ providedIn: 'root' })
export class CampaignContextService {
    private readonly store = inject(Store);

    readonly slug = signal<string | null>(null);

    private readonly campaigns = toSignal(this.store.select(selectCampaigns), { initialValue: [] });

    readonly campaign = computed<ICampaignSummary | null>(
        () => this.campaigns().find((campaign) => campaign.slug === this.slug()) ?? null
    );

    readonly role = computed<CampaignRole | null>(() => this.campaign()?.role ?? null);

    setSlug(slug: string | null): void {
        this.slug.set(slug);
    }

    clear(): void {
        this.slug.set(null);
    }

    baseUrl(): string {
        const slug = this.slug();
        if (slug === null) {
            throw new Error('No active campaign.');
        }

        return `/api/campaigns/${encodeURIComponent(slug)}`;
    }
}
