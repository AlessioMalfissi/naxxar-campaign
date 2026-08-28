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
                provideRouter([]),
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

    it('should mark the inventory link active when on the inventory route', () => {
        // Arrange
        const router = TestBed.inject(Router);
        jest.spyOn(router, 'url', 'get').mockReturnValue('/campaign/inventory');

        // Act
        const active = component['isInventoryActive']();

        // Assert
        expect(active).toBe(true);
    });

    it('should mark the inventory link inactive on other routes', () => {
        // Arrange
        const router = TestBed.inject(Router);
        jest.spyOn(router, 'url', 'get').mockReturnValue('/campaign/npcs');

        // Act
        const active = component['isInventoryActive']();

        // Assert
        expect(active).toBe(false);
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

    it('should mark the open entry as active', () => {
        // Arrange
        const router = TestBed.inject(Router);
        jest.spyOn(router, 'url', 'get').mockReturnValue('/campaign/npcs/vaelith-corrun');

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
});
