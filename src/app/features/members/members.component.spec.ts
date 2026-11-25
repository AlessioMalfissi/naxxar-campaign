import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { CampaignRole, ICampaignMember, ICampaignSummary } from '@core/models';
import { CampaignContextService } from '@core/services/campaign-context.service';
import { DataTableComponent } from '@shared/datatable/data-table.component';
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
import { MembersComponent } from './members.component';

const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const DM: ICampaignMember = {
    userId: 'user-1',
    displayName: 'Dungeon Master',
    role: 'dm',
    joinedAt: '2026-01-01T00:00:00.000Z',
    email: 'dm@naxxar.local'
};
const PLAYER: ICampaignMember = {
    userId: 'user-2',
    displayName: 'Player One',
    role: 'player',
    joinedAt: '2026-02-01T00:00:00.000Z'
};

describe('MembersComponent', () => {
    let fixture: ComponentFixture<MembersComponent>;
    let component: MembersComponent;
    let store: MockStore;
    let dispatchSpy: jest.SpyInstance;

    const create = async (
        role: CampaignRole = 'dm',
        extra: {
            createdInviteUrl?: string | null;
            createdInviteExpiresAt?: string | null;
            error?: string | null;
        } = {}
    ): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [MembersComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ campaignSlug: 'naxxar' }) } }
                },
                { provide: CampaignContextService, useValue: { slug: () => null } }
            ]
        })
            .overrideComponent(MembersComponent, {
                remove: { imports: [DataTableComponent] },
                add: { imports: [DataTableMockComponent] }
            })
            .compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectActiveCampaign, { ...NAXXAR, role });
        store.overrideSelector(selectActiveRole, role);
        store.overrideSelector(selectMembers, [DM, PLAYER]);
        store.overrideSelector(selectInvites, []);
        store.overrideSelector(selectCampaignMembersLoading, false);
        store.overrideSelector(selectCampaignMembersError, extra.error ?? null);
        store.overrideSelector(selectCreatedInviteUrl, extra.createdInviteUrl ?? null);
        store.overrideSelector(selectCreatedInviteExpiresAt, extra.createdInviteExpiresAt ?? null);

        dispatchSpy = jest.spyOn(store, 'dispatch');

        fixture = TestBed.createComponent(MembersComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    it('should load the roster on init and the invites for a DM', async () => {
        // Act
        await create('dm');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.loadMembers.request({ campaignSlug: 'naxxar' })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.loadInvites.request({ campaignSlug: 'naxxar' })
        );
    });

    it('should not load invites for a player', async () => {
        // Act
        await create('player');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.loadMembers.request({ campaignSlug: 'naxxar' })
        );
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            CampaignMembersActions.loadInvites.request({ campaignSlug: 'naxxar' })
        );
    });

    it('should show email addresses to a DM', async () => {
        // Act
        await create('dm');

        // Assert
        expect(component['columns']().map((column) => column.key)).toEqual(['name', 'status', 'joined', 'email']);
        expect(component['rows']()[0].cells['email']).toBe('dm@naxxar.local');
    });

    it('should hide email addresses from a player', async () => {
        // Act
        await create('player');

        // Assert
        expect(component['columns']().some((column) => column.key === 'email')).toBe(false);
        expect(component['rows']().length).toBe(2);
        expect(component['rows']()[1].chip).toBe('Player');
    });

    it('should create an invite and clear the previous link', async () => {
        // Arrange
        await create('dm', { createdInviteUrl: 'https://example.test/invite/old' });
        dispatchSpy.mockClear();

        // Act
        component['createInvite']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.createInvite.request({ campaignSlug: 'naxxar' })
        );
        expect(component['copyState']()).toBeNull();
    });

    it('should show the new invite link with its expiry', async () => {
        // Act
        await create('dm', {
            createdInviteUrl: 'https://example.test/invite/token',
            createdInviteExpiresAt: '2026-01-08T00:00:00.000Z'
        });

        // Assert
        const input: HTMLInputElement = fixture.nativeElement.querySelector('.cdx-members-created-input');
        expect(input.value).toBe('https://example.test/invite/token');
        expect(fixture.nativeElement.textContent).toContain('Expires');
    });

    it('should copy the invite link to the clipboard', async () => {
        // Arrange
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        await create('dm', { createdInviteUrl: 'https://example.test/invite/token' });

        // Act
        await component['copyInviteUrl']();

        // Assert
        expect(writeText).toHaveBeenCalledWith('https://example.test/invite/token');
        expect(component['copyState']()).toBe('Copied to the clipboard.');
    });

    it('should fall back to selecting the link when the clipboard is unavailable', async () => {
        // Arrange
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        await create('dm', { createdInviteUrl: 'https://example.test/invite/token' });

        // Act
        await component['copyInviteUrl']();

        // Assert
        expect(component['copyState']()).toBe('Select the link above and copy it.');
    });

    it('should show the members error', async () => {
        // Act
        await create('dm', { error: "Couldn't load the campaign members." });

        // Assert
        const error: HTMLElement = fixture.nativeElement.querySelector('.cdx-members-error');
        expect(error.textContent).toContain("Couldn't load the campaign members.");
    });
});

@Component({ selector: 'cdx-data-table', standalone: true, template: '' })
class DataTableMockComponent {
    @Input() columns: unknown[] = [];
    @Input() rows: unknown[] = [];
    @Input() emptyMessage = '';
}
