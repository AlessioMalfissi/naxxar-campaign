import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { ApiCallStatus, ICampaignSummary } from '@core/models';
import { GoogleSignInService } from '@core/services/google-sign-in.service';
import * as AuthActions from '@store/auth/auth.actions';
import {
    selectAuthChecked,
    selectAuthError,
    selectAuthErrorStatus,
    selectAuthPending,
    selectAuthenticated,
    selectCampaigns,
    selectConfig
} from '@store/auth/auth.selectors';
import * as CampaignMembersActions from '@store/campaign-members/campaign-members.actions';
import {
    selectCampaignMembersError,
    selectCampaignMembersErrorStatus,
    selectCampaignMembersLoading,
    selectCampaignMembersStatus,
    selectInvitePreview
} from '@store/campaign-members/campaign-members.selectors';
import { InviteAcceptComponent } from './invite-accept.component';

const PREVIEW = {
    campaignName: 'Naxxar',
    campaignSlug: 'naxxar',
    expiresAt: '2026-01-08T00:00:00.000Z'
};
const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'player' };

interface IOverrides {
    checked?: boolean;
    authenticated?: boolean;
    campaigns?: ICampaignSummary[];
    preview?: typeof PREVIEW | null;
    previewStatus?: ApiCallStatus;
    previewError?: string | null;
    previewErrorStatus?: number | null;
    accepting?: boolean;
    pending?: boolean;
    authError?: string | null;
    authErrorStatus?: number | null;
    googleClientId?: string | null;
}

describe('InviteAcceptComponent', () => {
    let fixture: ComponentFixture<InviteAcceptComponent>;
    let component: InviteAcceptComponent;
    let store: MockStore;
    let googleSignIn: { renderButton: jest.Mock };

    const apply = (overrides: IOverrides = {}): void => {
        store.overrideSelector(selectAuthChecked, overrides.checked ?? true);
        store.overrideSelector(selectAuthenticated, overrides.authenticated ?? false);
        store.overrideSelector(selectCampaigns, overrides.campaigns ?? []);
        store.overrideSelector(selectInvitePreview, overrides.preview === undefined ? PREVIEW : overrides.preview);
        store.overrideSelector(selectCampaignMembersStatus, overrides.previewStatus ?? ApiCallStatus.Success);
        store.overrideSelector(selectCampaignMembersError, overrides.previewError ?? null);
        store.overrideSelector(selectCampaignMembersErrorStatus, overrides.previewErrorStatus ?? null);
        store.overrideSelector(selectCampaignMembersLoading, overrides.accepting ?? false);
        store.overrideSelector(selectAuthPending, overrides.pending ?? false);
        store.overrideSelector(selectAuthError, overrides.authError ?? null);
        store.overrideSelector(selectAuthErrorStatus, overrides.authErrorStatus ?? null);
        store.overrideSelector(selectConfig, { googleClientId: overrides.googleClientId ?? null });
        store.refreshState();
    };

    const create = async (overrides: IOverrides = {}): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [InviteAcceptComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ token: 'invite-token' }) } }
                },
                { provide: GoogleSignInService, useValue: googleSignIn }
            ]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        apply(overrides);
        fixture = TestBed.createComponent(InviteAcceptComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    beforeEach(() => {
        googleSignIn = { renderButton: jest.fn().mockResolvedValue(undefined) };
    });

    it('should check the session and load the invite preview on init', async () => {
        // Arrange
        await create({ checked: false });

        // Assert
        expect(component['token']).toBe('invite-token');
        expect(component['preview']()).toEqual(PREVIEW);
    });

    it('should show the campaign name and expiry for a valid invite', async () => {
        // Arrange / Act
        await create();

        // Assert
        const title: HTMLElement = fixture.nativeElement.querySelector('.cdx-invite-title');
        expect(title.textContent).toContain('Naxxar');
    });

    it('should recognise a missing invite', async () => {
        // Arrange / Act
        await create({
            preview: null,
            previewStatus: ApiCallStatus.Failed,
            previewErrorStatus: 404
        });

        // Assert
        expect(component['invalidInvite']()).toBe(true);
        expect(component['expiredInvite']()).toBe(false);
        expect(fixture.nativeElement.textContent).toContain('Invite not found');
    });

    it('should recognise an expired invite and offer a retry', async () => {
        // Arrange
        await create({
            preview: null,
            previewStatus: ApiCallStatus.Failed,
            previewError: 'This invite has expired.',
            previewErrorStatus: 410
        });
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['retry']();

        // Assert
        expect(component['expiredInvite']()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('Invite no longer valid');
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.loadInvitePreview.request({ token: 'invite-token' })
        );
    });

    it('should treat an unknown failure as retryable', async () => {
        // Arrange / Act
        await create({
            preview: null,
            previewStatus: ApiCallStatus.Failed,
            previewErrorStatus: 500
        });

        // Assert
        expect(component['failedInvite']()).toBe(true);
    });

    it('should let an existing member open the campaign', async () => {
        // Arrange
        await create({ authenticated: true, campaigns: [NAXXAR] });
        const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');

        // Act
        component['openCampaign']();

        // Assert
        expect(component['isMember']()).toBe(true);
        expect(navigateSpy).toHaveBeenCalledWith(['/campaigns', 'naxxar', 'npcs']);
    });

    it('should let a signed-in non-member join the campaign', async () => {
        // Arrange
        await create({ authenticated: true, campaigns: [] });
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['join']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CampaignMembersActions.acceptInvite.request({ token: 'invite-token' })
        );
    });

    it('should register a new account through the invite', async () => {
        // Arrange
        await create();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['displayNameControl'].setValue(' Player One ');
        component['emailControl'].setValue(' player@example.com ');
        component['passwordControl'].setValue('secret123');
        component['confirmControl'].setValue('secret123');

        // Act
        component['submitRegistration']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.registerViaInvite.request({
                token: 'invite-token',
                displayName: 'Player One',
                email: 'player@example.com',
                password: 'secret123'
            })
        );
    });

    it('should refuse mismatched registration passwords', async () => {
        // Arrange
        await create();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['displayNameControl'].setValue('Player One');
        component['emailControl'].setValue('player@example.com');
        component['passwordControl'].setValue('secret123');
        component['confirmControl'].setValue('different');

        // Act
        component['submitRegistration']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['mismatch']()).toBe(true);
    });

    it('should explain when an account already exists for the email', async () => {
        // Arrange / Act
        await create({ authError: 'An account already exists.', authErrorStatus: 409 });

        // Assert
        expect(component['accountExists']()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('An account already exists for this email.');
    });

    it('should show the join error when accepting fails', async () => {
        // Arrange / Act
        await create({
            authenticated: true,
            previewStatus: ApiCallStatus.Failed,
            previewError: 'Only invited players can join.'
        });

        // Assert
        expect(component['acceptError']()).toBe('Only invited players can join.');
    });

    it('should show Google registration when the server configures it', async () => {
        // Arrange / Act
        await create({ googleClientId: 'client-id' });
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-invite-google')).not.toBeNull();
        expect(googleSignIn.renderButton).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            'client-id',
            expect.any(Function)
        );
    });

    it('should hide Google registration when the server has no client id', async () => {
        // Arrange / Act
        await create({ googleClientId: null });

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-invite-google')).toBeNull();
        expect(googleSignIn.renderButton).not.toHaveBeenCalled();
    });
});
