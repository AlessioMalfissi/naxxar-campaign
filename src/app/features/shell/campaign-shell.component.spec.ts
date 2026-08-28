import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { CodexSection } from '@core/models';
import * as CodexActions from '@store/codex/codex.actions';
import { selectActiveSection, selectSidebarCollapsed } from '@store/codex/codex.selectors';
import * as InventoryActions from '@store/inventory/inventory.actions';
import { CampaignShellComponent } from './campaign-shell.component';
import { CodexHeaderComponent } from './codex-header.component';
import { CodexSidebarComponent } from './codex-sidebar.component';

@Component({ selector: 'cdx-codex-header', standalone: true, template: '' })
class CodexHeaderMockComponent {}

@Component({ selector: 'cdx-codex-sidebar', standalone: true, template: '' })
class CodexSidebarMockComponent {}

describe('CampaignShellComponent', () => {
    let fixture: ComponentFixture<CampaignShellComponent>;
    let store: MockStore;
    let isMatchedSpy: jest.SpyInstance;

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [CampaignShellComponent, NoopAnimationsModule],
            providers: [provideRouter([]), provideMockStore({ initialState: {} })]
        })
            .overrideComponent(CampaignShellComponent, {
                remove: { imports: [CodexHeaderComponent, CodexSidebarComponent] },
                add: { imports: [CodexHeaderMockComponent, CodexSidebarMockComponent] }
            })
            .compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectActiveSection, CodexSection.Npcs);
        store.overrideSelector(selectSidebarCollapsed, false);

        // BreakpointObserver is also used internally by Angular Material (HighContrastModeDetector),
        // so the real service is spied on rather than swapped for a bare mock.
        isMatchedSpy = jest.spyOn(TestBed.inject(BreakpointObserver), 'isMatched').mockReturnValue(false);

        fixture = TestBed.createComponent(CampaignShellComponent);
    });

    it('should request the index on init', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.loadIndex.request({}));
    });

    it('should request the inventory items on init', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(InventoryActions.loadItems.request({}));
    });

    it('should start the sidebar collapsed on tablet and phone viewports', () => {
        // Arrange
        isMatchedSpy.mockReturnValue(true);
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(isMatchedSpy).toHaveBeenCalledWith('(max-width: 1023px)');
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.sidebarCollapsedSet({ collapsed: true }));
    });

    it('should leave the sidebar as-is on desktop viewports', () => {
        // Arrange
        isMatchedSpy.mockReturnValue(false);
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalledWith(CodexActions.sidebarCollapsedSet({ collapsed: true }));
    });

    it('should flag the collapsed sidebar on the layout', () => {
        // Arrange
        store.overrideSelector(selectSidebarCollapsed, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('cdx-codex-sidebar.cdx-sidebar-collapsed') !== null).toBe(true);
    });
});
