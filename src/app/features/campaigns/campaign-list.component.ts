import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { CampaignRole, ICampaignSummary } from '@core/models';
import { GuestModeService } from '@core/guest/guest-mode.service';
import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending, selectCampaigns, selectUser } from '@store/auth/auth.selectors';

@Component({
    selector: 'cdx-campaign-list',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
    templateUrl: './campaign-list.component.html',
    styleUrl: './campaign-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignListComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly guestMode = inject(GuestModeService);

    protected readonly guest = this.guestMode.isGuest;
    protected readonly user = toSignal(this.store.select(selectUser), { initialValue: null });
    protected readonly campaigns = toSignal(this.store.select(selectCampaigns), { initialValue: [] });
    protected readonly pending = toSignal(this.store.select(selectAuthPending), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectAuthError), { initialValue: null });
    protected readonly nameControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
    });

    ngOnInit(): void {
        this.store.dispatch(AuthActions.loadCampaigns.request({}));
    }

    protected open(campaign: ICampaignSummary): void {
        void this.router.navigate(['/campaigns', campaign.slug, 'npcs']);
    }

    protected create(): void {
        const name = this.nameControl.value.trim();
        if (this.nameControl.invalid || name.length < 2) {
            this.nameControl.markAsTouched();
            return;
        }

        this.store.dispatch(AuthActions.createCampaign.request({ name }));
    }

    protected roleLabel(role: CampaignRole): string {
        return role === 'dm' ? 'Dungeon Master' : 'Player';
    }

    protected signOut(): void {
        this.store.dispatch(AuthActions.logout.request({}));
    }
}
