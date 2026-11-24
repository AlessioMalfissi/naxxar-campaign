import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../errors/api-error';
import { CampaignMembersApiService } from './campaign-members-api.service';

const MEMBER = {
    userId: 'user-1',
    displayName: 'Dungeon Master',
    role: 'dm' as const,
    joinedAt: '2026-01-01T00:00:00.000Z',
    email: 'dm@naxxar.local'
};
const INVITE = {
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
    usedAt: null,
    status: 'active' as const
};

describe('CampaignMembersApiService', () => {
    let service: CampaignMembersApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(CampaignMembersApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should load the roster', () => {
        // Arrange
        let members: unknown = null;
        service.loadMembers('naxxar').subscribe((result) => (members = result));

        // Act
        httpMock.expectOne('/api/campaigns/naxxar/members').flush({ members: [MEMBER] });

        // Assert
        expect(members).toEqual([MEMBER]);
    });

    it('should load the invites', () => {
        // Arrange
        let invites: unknown = null;
        service.loadInvites('naxxar').subscribe((result) => (invites = result));

        // Act
        httpMock.expectOne('/api/campaigns/naxxar/invites').flush({ invites: [INVITE] });

        // Assert
        expect(invites).toEqual([INVITE]);
    });

    it('should create an invite and unwrap the URL', () => {
        // Arrange
        let invite: unknown = null;
        service.createInvite('naxxar').subscribe((result) => (invite = result));

        // Act
        const request = httpMock.expectOne('/api/campaigns/naxxar/invites');
        expect(request.request.method).toBe('POST');
        request.flush({ invite: { url: 'https://example.test/invite/token', expiresAt: '2026-01-08T00:00:00.000Z' } });

        // Assert
        expect(invite).toEqual({ url: 'https://example.test/invite/token', expiresAt: '2026-01-08T00:00:00.000Z' });
    });

    it('should load an invite preview by token', () => {
        // Arrange
        let preview: unknown = null;
        service.loadInvitePreview('token/with space').subscribe((result) => (preview = result));

        // Act
        httpMock
            .expectOne('/api/invites/token%2Fwith%20space')
            .flush({ campaignName: 'Naxxar', campaignSlug: 'naxxar', expiresAt: '2026-01-08T00:00:00.000Z' });

        // Assert
        expect(preview).toEqual({
            campaignName: 'Naxxar',
            campaignSlug: 'naxxar',
            expiresAt: '2026-01-08T00:00:00.000Z'
        });
    });

    it('should accept an invite by token', () => {
        // Arrange
        let campaign: unknown = null;
        service.acceptInvite('token').subscribe((result) => (campaign = result.campaign));

        // Act
        const request = httpMock.expectOne('/api/invites/token/accept');
        expect(request.request.method).toBe('POST');
        request.flush({ campaign: { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'player' } });

        // Assert
        expect(campaign).toEqual({ id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'player' });
    });

    it('should keep the status of an expired preview', () => {
        // Arrange
        let error: ApiError | null = null;

        // Act
        service.loadInvitePreview('expired').subscribe({ error: (thrown: ApiError) => (error = thrown) });
        httpMock
            .expectOne('/api/invites/expired')
            .flush({ error: 'This invite has expired.' }, { status: 410, statusText: 'Gone' });

        // Assert
        expect(error!.status).toBe(410);
        expect(error!.message).toBe('This invite has expired.');
    });
});
