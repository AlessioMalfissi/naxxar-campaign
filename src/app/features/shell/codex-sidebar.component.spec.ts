import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { CodexSection, EntryVisibility } from '@core/models';
import { ModalService } from '@shared/modal/modal.service';
import { buildSummary } from '@testing/entry.fixtures';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectActiveSection,
    selectRecentEntries,
    selectSectionCounts,
    selectSidebarCollapsed
} from '@store/codex/codex.selectors';
import { selectInventoryItemCount } from '@store/inventory/inventory.selectors';
import { CodexSidebarComponent } from './codex-sidebar.component';

@Component({ selector: 'cdx-route-stub', standalone: true, template: '' })
class RouteStubComponent {}

describe('CodexSidebarComponent', () => {
    let fixture: ComponentFixture<CodexSidebarComponent>;
    let component: CodexSidebarComponent;
    let store: MockStore;
    let modalService: { createEntry: jest.Mock; confirm: jest.Mock };

    beforeEach(async () => {
        // Arrange
        modalService = {
            createEntry: jest.fn().mockReturnValue(
                of({
                    title: 'Grum the Broker',
                    status: 'Alive',
                    tags: ['merchant'],
                    visibility: EntryVisibility.Dm,
                    fields: {}
                })
            ),
            confirm: jest.fn()
        };

        await TestBed.configureTestingModule({
            imports: [CodexSidebarComponent, NoopAnimationsModule],
            providers: [
                provideRouter([{ path: '**', component: RouteStubComponent }]),
                provideMockStore({ initialState: {} }),
                { provide: ModalService, useValue: modalService }
            ]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectActiveSection, CodexSection.Npcs);
        store.overrideSelector(selectSidebarCollapsed, false);
        store.overrideSelector(selectSectionCounts, { npcs: 3 });
        store.overrideSelector(selectRecentEntries, [buildSummary()]);
        store.overrideSelector(selectInventoryItemCount, 2);

        fixture = TestBed.createComponent(CodexSidebarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should render a nav item per section plus the inventory link, with its count', () => {
        // Arrange
        const items = fixture.nativeElement.querySelectorAll('.cdx-sidebar-item') as NodeListOf<HTMLElement>;

        // Act
        const activeItem = fixture.nativeElement.querySelector('.cdx-sidebar-item-active') as HTMLElement;

        // Assert
        expect(items.length).toBe(6);
        expect((activeItem.textContent ?? '').includes('3')).toBe(true);
    });

    it('should render the inventory link with its item count', () => {
        // Arrange
        const links = fixture.nativeElement.querySelectorAll('.cdx-sidebar-item') as NodeListOf<HTMLElement>;
        const inventoryLink = [...links].find((link) => (link.textContent ?? '').includes('Inventory'));

        // Assert
        expect(inventoryLink !== undefined).toBe(true);
        expect((inventoryLink?.textContent ?? '').includes('2')).toBe(true);
    });

    it('should mark the inventory link active when on the inventory route', async () => {
        // Arrange
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/campaign/inventory');

        // Act
        const active = component['isInventoryActive']();

        // Assert
        expect(active).toBe(true);
    });

    it('should mark the inventory link inactive on other routes', async () => {
        // Arrange
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/campaign/npcs');

        // Act
        const active = component['isInventoryActive']();

        // Assert
        expect(active).toBe(false);
    });

    it('should mark the last-opened section active while its own route is showing', async () => {
        // Arrange
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/campaign/npcs');

        // Act
        const active = component['isSectionActive'](CodexSection.Npcs);

        // Assert
        expect(active).toBe(true);
    });

    it('should not leave a stale section highlighted once the inventory route is showing', async () => {
        // Arrange - store still remembers npcs as the last section opened before navigating away
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/campaign/inventory');

        // Act
        const active = component['isSectionActive'](CodexSection.Npcs);

        // Assert
        expect(active).toBe(false);
    });

    it('should render no section as active while on the inventory route', async () => {
        // Arrange - the store still remembers npcs as the last section opened before navigating
        // away, exactly like a user clicking from a section into Inventory without the store
        // ever being told the section changed.
        const router = TestBed.inject(Router);

        // Act
        await router.navigateByUrl('/campaign/inventory');
        fixture.detectChanges();
        const activeSectionItems = fixture.nativeElement.querySelectorAll(
            '[aria-label="Codex sections"] .cdx-sidebar-item-active'
        ) as NodeListOf<HTMLElement>;
        const activeInventoryItems = fixture.nativeElement.querySelectorAll(
            '[aria-label="Party"] .cdx-sidebar-item-active'
        ) as NodeListOf<HTMLElement>;

        // Assert
        expect(activeSectionItems.length).toBe(0);
        expect(activeInventoryItems.length).toBe(1);
    });

    it('should report zero for a section without entries', () => {
        // Arrange
        const section = CodexSection.Places;

        // Act
        const count = component['countFor'](section);

        // Assert
        expect(count).toBe(0);
    });

    it('should render the recent entries of the active section', () => {
        // Arrange
        const recent = fixture.nativeElement.querySelectorAll('.cdx-sidebar-recent') as NodeListOf<HTMLElement>;

        // Act
        const label = recent[0].textContent ?? '';

        // Assert
        expect(recent.length).toBe(1);
        expect(label.includes('Vaelith Corrun')).toBe(true);
    });

    it('should mark the open entry as active', async () => {
        // Arrange
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/campaign/npcs/vaelith-corrun');

        // Act
        const active = component['isActiveEntry'](buildSummary());

        // Assert
        expect(active).toBe(true);
    });

    it('should hide the labels and counts when collapsed', () => {
        // Arrange
        store.overrideSelector(selectSidebarCollapsed, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-sidebar-label') === null).toBe(true);
        expect(fixture.nativeElement.querySelector('[aria-label="New entry"]') !== null).toBe(true);
    });

    it('should dispatch a create request with the details entered in the modal', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const newEntryButton = fixture.nativeElement.querySelector('.cdx-sidebar-new') as HTMLButtonElement;

        // Act
        newEntryButton.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.createEntry.request({
                section: CodexSection.Npcs,
                title: 'Grum the Broker',
                status: 'Alive',
                tags: ['merchant'],
                visibility: EntryVisibility.Dm,
                fields: {}
            })
        );
    });

    it('should not dispatch when the modal is dismissed', () => {
        // Arrange
        modalService.createEntry.mockReturnValue(of(null));
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['createEntry']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should render a backdrop only while the sidebar is expanded', () => {
        // Arrange - expanded by default (selectSidebarCollapsed is false in this suite's setup)

        // Act
        const backdrop = fixture.nativeElement.querySelector('.cdx-sidebar-backdrop');

        // Assert
        expect(backdrop !== null).toBe(true);
    });

    it('should hide the backdrop when collapsed', () => {
        // Arrange
        store.overrideSelector(selectSidebarCollapsed, true);
        store.refreshState();

        // Act
        fixture.detectChanges();
        const backdrop = fixture.nativeElement.querySelector('.cdx-sidebar-backdrop');

        // Assert
        expect(backdrop === null).toBe(true);
    });

    it('should toggle the sidebar closed when the backdrop is clicked', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const backdrop = fixture.nativeElement.querySelector('.cdx-sidebar-backdrop') as HTMLElement;

        // Act
        backdrop.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.sidebarToggled());
    });
});
