import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { CampaignContextService } from '@core/services/campaign-context.service';
import { buildSummary } from '@testing/entry.fixtures';
import * as AuthActions from '@store/auth/auth.actions';
import { selectActiveCampaign, selectActiveRole, selectCampaigns, selectUser } from '@store/auth/auth.selectors';
import * as CodexActions from '@store/codex/codex.actions';
import { selectDmPreview, selectHelpOpen, selectPlayerMode, selectVisibleEntries } from '@store/codex/codex.selectors';
import { CodexHeaderComponent } from './codex-header.component';

describe('CodexHeaderComponent', () => {
    let fixture: ComponentFixture<CodexHeaderComponent>;
    let component: CodexHeaderComponent;
    let store: MockStore;
    let router: { navigate: jest.Mock; navigateByUrl: jest.Mock };

    const typeQuery = (value: string): void => {
        component['searchControl'].setValue(value);
        jest.advanceTimersByTime(250);
        fixture.detectChanges();
    };

    beforeEach(async () => {
        // Arrange
        jest.useFakeTimers();
        router = { navigate: jest.fn().mockResolvedValue(true), navigateByUrl: jest.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [CodexHeaderComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), { provide: Router, useValue: router }]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectUser, {
            id: 'user-1',
            email: 'dm@naxxar.local',
            displayName: 'Dungeon Master'
        });
        store.overrideSelector(selectCampaigns, [{ id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' }]);
        store.overrideSelector(selectActiveCampaign, {
            id: 'campaign-1',
            slug: 'naxxar',
            name: 'Naxxar',
            role: 'dm'
        });
        store.overrideSelector(selectActiveRole, 'dm');
        store.overrideSelector(selectDmPreview, false);
        store.overrideSelector(selectPlayerMode, false);
        store.overrideSelector(selectHelpOpen, false);
        store.overrideSelector(selectVisibleEntries, [
            buildSummary(),
            buildSummary({
                id: 'places:ashfall-city',
                slug: 'ashfall-city',
                title: 'Ashfall city',
                tags: ['capital'],
                excerpt: 'Ash on every roof.'
            })
        ]);
        TestBed.inject(CampaignContextService).setSlug('naxxar');

        fixture = TestBed.createComponent(CodexHeaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should keep the results empty below the minimum query length', () => {
        // Arrange
        const query = 'v';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']().length).toBe(0);
    });

    it('should match on title, excerpt and tags', () => {
        // Arrange
        const query = 'ashfall';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']().length).toBe(1);
        expect(component['results']()[0].id).toBe('places:ashfall-city');
    });

    it('should match on a tag', () => {
        // Arrange
        const query = 'capital';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']()[0].id).toBe('places:ashfall-city');
    });

    it('should clear the field and navigate when a result is opened', () => {
        // Arrange
        const entry = buildSummary();

        // Act
        component['openResult'](entry);

        // Assert
        expect(component['searchControl'].value).toBe('');
        expect(router.navigate).toHaveBeenCalledWith(['/campaigns', 'naxxar', 'npcs', 'vaelith-corrun']);
    });

    it('should dispatch the sidebar toggle', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleSidebar']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.sidebarToggled());
    });

    it('should dispatch the help toggle when the help button is clicked', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cdx-header-help');

        // Act
        button.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpToggled());
    });

    it('should mark the help button as pressed while help is open', () => {
        // Arrange
        store.overrideSelector(selectHelpOpen, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cdx-header-help');
        expect(button.classList.contains('cdx-header-help-active')).toBe(true);
        expect(button.getAttribute('aria-pressed') === 'true').toBe(true);
    });

    it('should disable the help tooltip while help is open', () => {
        // Arrange
        store.overrideSelector(selectHelpOpen, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const tooltip = fixture.debugElement.query(By.css('.cdx-header-help')).injector.get(MatTooltip);
        expect(tooltip.disabled).toBe(true);
    });

    it('should dispatch the DM preview toggle', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleDmPreview']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.dmPreviewToggled());
    });

    it('should dispatch a logout request on sign out', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['signOut']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout.request({}));
    });

    it('should navigate to the members page of the active campaign', () => {
        // Act
        component['openMembers']();

        // Assert
        expect(router.navigate).toHaveBeenCalledWith(['/campaigns', 'naxxar', 'members']);
    });

    it('should switch campaigns from the campaign menu', () => {
        // Act
        component['onCampaignSelected']('other-campaign');

        // Assert
        expect(router.navigate).toHaveBeenCalledWith(['/campaigns', 'other-campaign', 'npcs']);
    });

    it('should go to the campaign list from the campaign menu', () => {
        // Act
        component['onCampaignSelected']('__all-campaigns__');

        // Assert
        expect(router.navigateByUrl).toHaveBeenCalledWith('/campaigns');
    });

    it('should show a read-only player badge for players', () => {
        // Arrange
        store.overrideSelector(selectActiveRole, 'player');
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const badge: HTMLElement = fixture.nativeElement.querySelector('.cdx-header-badge');
        expect(badge.textContent).toContain('Player view');
    });

    it('should show a super admin badge when the account is a super admin', () => {
        // Arrange
        store.overrideSelector(selectUser, {
            id: 'user-1',
            email: 'admin@naxxar.local',
            displayName: 'Super Admin',
            isSuperAdmin: true
        });
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        const badge: HTMLElement = fixture.nativeElement.querySelector('.cdx-header-badge');
        expect(badge.textContent).toContain('Super admin');
    });

    it('should keep the autocomplete field blank when a result is picked', () => {
        // Arrange
        const display = component['displayEmpty']();

        // Act
        const isBlank = display === '';

        // Assert
        expect(isBlank).toBe(true);
    });
});
