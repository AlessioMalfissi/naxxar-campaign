import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, ReplaySubject, throwError, take, toArray } from 'rxjs';

import { ApiError } from '@core/errors/api-error';
import { ICampaignMember, ICreatedInvite, IInvitePreview } from '@core/models';
import { CampaignMembersApiService } from '@core/services/campaign-members-api.service';
import * as AuthActions from '@store/auth/auth.actions';
import * as CampaignMembersActions from './campaign-members.actions';
import { CampaignMembersEffects } from './campaign-members.effects';

const NAXXAR = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' as const };
const MEMBER: ICampaignMember = {
    userId: 'user-1',
    displayName: 'Dungeon Master',
    role: 'dm',
    joinedAt: '2026-01-01T00:00:00.000Z',
    email: 'dm@naxxar.local'
};
const INVITE: ICreatedInvite = {
    url: 'https://example.test/invite/token',
    expiresAt: '2026-01-08T00:00:00.000Z'
};
const PREVIEW: IInvitePreview = {
    campaignName: 'Naxxar',
    campaignSlug: 'naxxar',
    expiresAt: '2026-01-08T00:00:00.000Z'
};

describe('CampaignMembersEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: CampaignMembersEffects;
    let store: MockStore;
    let api: jest.Mocked<
        Pick<
            CampaignMembersApiService,
            'loadMembers' | 'loadInvites' | 'createInvite' | 'loadInvitePreview' | 'acceptInvite'
        >
    >;
    let router: { navigateByUrl: jest.Mock };

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.pipe(take(1)).subscribe((action) => resolve(action)));

    const dispatchedMany = <T>(source: Observable<T>, count: number): Promise<T[]> =>
        new Promise<T[]>((resolve) => source.pipe(take(count), toArray()).subscribe(resolve));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        api = {
            loadMembers: jest.fn(),
            loadInvites: jest.fn(),
            createInvite: jest.fn(),
            loadInvitePreview: jest.fn(),
            acceptInvite: jest.fn()
        };
        router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

        TestBed.configureTestingModule({
            providers: [
                CampaignMembersEffects,
                provideMockActions(() => actions$),
                provideMockStore({ initialState: {} }),
                { provide: CampaignMembersApiService, useValue: api },
                { provide: Router, useValue: router }
            ]
        });

        store = TestBed.inject(MockStore);
        effects = TestBed.inject(CampaignMembersEffects);
    });

    it('should load the roster for the campaign', async () => {
        // Arrange
        api.loadMembers.mockReturnValue(of([MEMBER]));
        actions$.next(CampaignMembersActions.loadMembers.request({ campaignSlug: 'naxxar' }));

        // Act
        const result = await dispatched(effects.loadMembers$);

        // Assert
        expect(api.loadMembers).toHaveBeenCalledWith('naxxar');
        expect(result).toEqual(CampaignMembersActions.loadMembers.success({ members: [MEMBER] }));
    });

    it('should carry the HTTP status when loading the roster fails', async () => {
        // Arrange
        api.loadMembers.mockReturnValue(throwError(() => new ApiError(403, 'Only members can see the roster.')));
        actions$.next(CampaignMembersActions.loadMembers.request({ campaignSlug: 'naxxar' }));

        // Act
        const result = await dispatched(effects.loadMembers$);

        // Assert
        expect(result).toEqual(
            CampaignMembersActions.loadMembers.failure({
                error: 'Only members can see the roster.',
                status: 403
            })
        );
    });

    it('should load the invites for the campaign', async () => {
        // Arrange
        api.loadInvites.mockReturnValue(of([]));
        actions$.next(CampaignMembersActions.loadInvites.request({ campaignSlug: 'naxxar' }));

        // Act
        const result = await dispatched(effects.loadInvites$);

        // Assert
        expect(api.loadInvites).toHaveBeenCalledWith('naxxar');
        expect(result).toEqual(CampaignMembersActions.loadInvites.success({ invites: [] }));
    });

    it('should create an invite and refresh the invite list', async () => {
        // Arrange
        api.createInvite.mockReturnValue(of(INVITE));
        actions$.next(CampaignMembersActions.createInvite.request({ campaignSlug: 'naxxar' }));

        // Act
        const results = await dispatchedMany(effects.createInvite$, 2);

        // Assert
        expect(api.createInvite).toHaveBeenCalledWith('naxxar');
        expect(results).toEqual([
            CampaignMembersActions.createInvite.success({ invite: INVITE }),
            CampaignMembersActions.loadInvites.request({ campaignSlug: 'naxxar' })
        ]);
    });

    it('should load and fail an invite preview with its status', async () => {
        // Arrange
        api.loadInvitePreview
            .mockReturnValueOnce(of(PREVIEW))
            .mockReturnValueOnce(throwError(() => new ApiError(410, 'This invite has expired.')));
        actions$.next(CampaignMembersActions.loadInvitePreview.request({ token: 'token' }));

        // Act
        const success = await dispatched(effects.loadInvitePreview$);

        // Assert
        expect(api.loadInvitePreview).toHaveBeenCalledWith('token');
        expect(success).toEqual(CampaignMembersActions.loadInvitePreview.success({ preview: PREVIEW }));

        // Arrange
        api.loadInvitePreview.mockReturnValue(throwError(() => new ApiError(410, 'This invite has expired.')));
        actions$.next(CampaignMembersActions.loadInvitePreview.request({ token: 'expired' }));

        // Act
        const failure = await dispatched(effects.loadInvitePreview$);

        // Assert
        expect(failure).toEqual(
            CampaignMembersActions.loadInvitePreview.failure({
                error: 'This invite has expired.',
                status: 410
            })
        );
    });

    it('should accept an invite after the campaign list refreshes and then navigate', async () => {
        // Arrange
        api.acceptInvite.mockReturnValue(of({ campaign: NAXXAR }));
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const resultPromise = dispatched(effects.acceptInvite$);
        actions$.next(CampaignMembersActions.acceptInvite.request({ token: 'token' }));

        // Act
        actions$.next(AuthActions.loadCampaigns.success({ campaigns: [NAXXAR] }));
        const result = await resultPromise;

        // Assert
        expect(api.acceptInvite).toHaveBeenCalledWith('token');
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.loadCampaigns.request({}));
        expect(result).toEqual(CampaignMembersActions.acceptInvite.success({ campaign: NAXXAR }));
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns/naxxar/npcs');
    });

    it('should fail the invite acceptance when the campaign list cannot refresh', async () => {
        // Arrange
        api.acceptInvite.mockReturnValue(of({ campaign: NAXXAR }));
        const resultPromise = dispatched(effects.acceptInvite$);
        actions$.next(CampaignMembersActions.acceptInvite.request({ token: 'token' }));

        // Act
        actions$.next(AuthActions.loadCampaigns.failure({ error: "Couldn't load your campaigns.", status: 500 }));
        const result = await resultPromise;

        // Assert
        expect(result).toEqual(
            CampaignMembersActions.acceptInvite.failure({
                error: "Couldn't load your campaigns.",
                status: 500
            })
        );
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should clear the roster when the campaign or account changes', async () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        actions$.next(AuthActions.campaignActivated({ slug: 'other' }));
        await dispatched(effects.clearOnCampaignChange$);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CampaignMembersActions.membersCleared());
    });
});
