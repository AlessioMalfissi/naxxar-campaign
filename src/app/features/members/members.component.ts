import { DOCUMENT } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    OnInit,
    signal,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';

import { CampaignRole, InviteStatus } from '@core/models';
import { CampaignContextService } from '@core/services/campaign-context.service';
import { formatEuropeanDate, formatEuropeanDateTime } from '@core/utils/date-format.util';
import { DataTableComponent } from '@shared/datatable/data-table.component';
import { IDataTableColumn, IDataTableRow } from '@shared/datatable/i-data-table';
import { selectActiveCampaign, selectActiveRole } from '@store/auth/auth.selectors';
import * as CampaignMembersActions from '@store/campaign-members/campaign-members.actions';
import {
    selectCampaignMembersError,
    selectCampaignMembersLoading,
    selectCreatedInviteExpiresAt,
    selectCreatedInviteUrl,
    selectInvites,
    selectMembers
} from '@store/campaign-members/campaign-members.selectors';

@Component({
    selector: 'cdx-members',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, DataTableComponent],
    templateUrl: './members.component.html',
    styleUrl: './members.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly campaignContext = inject(CampaignContextService);
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly slug =
        this.route.snapshot.paramMap.get('campaignSlug') ?? this.campaignContext.slug() ?? '';
    protected readonly campaign = toSignal(this.store.select(selectActiveCampaign), { initialValue: null });
    protected readonly role = toSignal(this.store.select(selectActiveRole), { initialValue: null });
    protected readonly isDm = computed(() => this.role() === 'dm');
    protected readonly members = toSignal(this.store.select(selectMembers), { initialValue: [] });
    protected readonly invites = toSignal(this.store.select(selectInvites), { initialValue: [] });
    protected readonly loading = toSignal(this.store.select(selectCampaignMembersLoading), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectCampaignMembersError), { initialValue: null });
    protected readonly createdInviteUrl = toSignal(this.store.select(selectCreatedInviteUrl), {
        initialValue: null
    });
    protected readonly createdInviteExpiresAt = toSignal(this.store.select(selectCreatedInviteExpiresAt), {
        initialValue: null
    });
    protected readonly copyState = signal<string | null>(null);
    private readonly inviteUrlInput = viewChild<ElementRef<HTMLInputElement>>('inviteUrlInput');

    protected readonly columns = computed<IDataTableColumn[]>(() => {
        const columns: IDataTableColumn[] = [
            { key: 'name', label: 'Member', width: '32%' },
            { key: 'status', label: 'Role', width: '18%' },
            { key: 'joined', label: 'Joined', width: '20%' }
        ];

        return this.isDm() ? [...columns, { key: 'email', label: 'Email' }] : columns;
    });

    protected readonly rows = computed<IDataTableRow[]>(() =>
        this.members().map((member) => ({
            id: member.userId,
            chip: this.roleLabel(member.role),
            cells: {
                name: member.displayName,
                joined: formatEuropeanDate(member.joinedAt),
                email: member.email ?? ''
            }
        }))
    );

    protected readonly inviteColumns: IDataTableColumn[] = [
        { key: 'created', label: 'Created', width: '28%' },
        { key: 'expires', label: 'Expires', width: '28%' },
        { key: 'status', label: 'Status' }
    ];

    protected readonly inviteRows = computed<IDataTableRow[]>(() =>
        this.invites().map((invite, index) => ({
            id: `${invite.createdAt}-${index}`,
            chip: this.inviteStatusLabel(invite.status),
            cells: {
                created: formatEuropeanDateTime(invite.createdAt),
                expires: formatEuropeanDateTime(invite.expiresAt)
            }
        }))
    );

    ngOnInit(): void {
        if (this.slug === '') {
            return;
        }

        this.store.dispatch(CampaignMembersActions.loadMembers.request({ campaignSlug: this.slug }));
        this.store
            .select(selectActiveRole)
            .pipe(
                filter((role): role is CampaignRole => role !== null),
                take(1),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((role) => {
                if (role === 'dm') {
                    this.store.dispatch(CampaignMembersActions.loadInvites.request({ campaignSlug: this.slug }));
                }
            });
    }

    protected createInvite(): void {
        this.copyState.set(null);
        this.store.dispatch(CampaignMembersActions.createInvite.request({ campaignSlug: this.slug }));
    }

    protected async copyInviteUrl(): Promise<void> {
        const url = this.createdInviteUrl();
        if (url === null) {
            return;
        }

        const clipboard = this.document.defaultView?.navigator.clipboard;
        if (clipboard !== undefined) {
            try {
                await clipboard.writeText(url);
                this.copyState.set('Copied to the clipboard.');
                return;
            } catch {
                // Fall through to the selectable input below.
            }
        }

        this.inviteUrlInput()?.nativeElement.select();
        this.copyState.set('Select the link above and copy it.');
    }

    protected expiryLabel(expiresAt: string | null): string {
        return expiresAt === null ? '' : formatEuropeanDateTime(expiresAt);
    }

    protected roleLabel(role: CampaignRole): string {
        return role === 'dm' ? 'Dungeon Master' : 'Player';
    }

    protected inviteStatusLabel(status: InviteStatus): string {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
}
