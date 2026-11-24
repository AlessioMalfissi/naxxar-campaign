import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { ICampaignSummary, IUser } from '@core/models';
import * as AuthActions from '@store/auth/auth.actions';
import { selectAuthError, selectAuthPending, selectCampaigns, selectUser } from '@store/auth/auth.selectors';
import { CampaignListComponent } from './campaign-list.component';

const USER: IUser = { id: 'user-1', email: 'dm@naxxar.local', displayName: 'Dungeon Master' };
const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const OTHER: ICampaignSummary = { id: 'campaign-2', slug: 'other', name: 'Other', role: 'player' };

describe('CampaignListComponent', () => {
    let fixture: ComponentFixture<CampaignListComponent>;
    let component: CampaignListComponent;
    let store: MockStore;
    let dispatchSpy: jest.SpyInstance;

    const create = async (
        campaigns: ICampaignSummary[] = [NAXXAR, OTHER],
        pending = false,
        error: string | null = null
    ): Promise<void> => {
        await TestBed.configureTestingModule({
            imports: [CampaignListComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), provideRouter([])]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectUser, USER);
        store.overrideSelector(selectCampaigns, campaigns);
        store.overrideSelector(selectAuthPending, pending);
        store.overrideSelector(selectAuthError, error);

        dispatchSpy = jest.spyOn(store, 'dispatch');

        fixture = TestBed.createComponent(CampaignListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    it('should refresh the campaign list on init', async () => {
        // Act
        await create();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.loadCampaigns.request({}));
    });

    it('should render a card for each campaign with its role', async () => {
        // Arrange / Act
        await create();

        // Assert
        const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.cdx-campaign-card');
        expect(cards.length).toBe(2);
        expect(fixture.nativeElement.textContent).toContain('Dungeon Master');
        expect(fixture.nativeElement.textContent).toContain('Player');
    });

    it('should show the empty state when there are no campaigns', async () => {
        // Arrange / Act
        await create([]);

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-campaigns-empty')).not.toBeNull();
    });

    it('should show an error banner', async () => {
        // Arrange / Act
        await create([], false, "Couldn't load your campaigns.");

        // Assert
        const error: HTMLElement = fixture.nativeElement.querySelector('.cdx-campaigns-error');
        expect(error.textContent).toContain("Couldn't load your campaigns.");
    });

    it('should open a campaign', async () => {
        // Arrange
        await create();
        const navigateSpy = jest.spyOn(TestBed.inject(Router), 'navigate');

        // Act
        component['open'](OTHER);

        // Assert
        expect(navigateSpy).toHaveBeenCalledWith(['/campaigns', 'other', 'npcs']);
    });

    it('should create a campaign from the trimmed name', async () => {
        // Arrange
        await create();
        component['nameControl'].setValue('  Tomb of Annihilation  ');

        // Act
        component['create']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            AuthActions.createCampaign.request({ name: 'Tomb of Annihilation' })
        );
    });

    it('should refuse a campaign name shorter than two characters', async () => {
        // Arrange
        await create();
        component['nameControl'].setValue(' a ');

        // Act
        component['create']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['nameControl'].touched).toBe(true);
    });

    it('should disable the create button while a request is pending', async () => {
        // Arrange / Act
        await create([], true);

        // Assert
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cdx-campaign-create-button');
        expect(button.disabled).toBe(true);
    });

    it('should sign out', async () => {
        // Arrange
        await create();

        // Act
        component['signOut']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout.request({}));
    });
});
