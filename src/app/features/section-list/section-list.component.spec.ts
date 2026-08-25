import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject } from 'rxjs';

import { CodexSection } from '@core/models';
import { DataTableComponent } from '@shared/datatable/data-table.component';
import { IDataTableColumn, IDataTableRow } from '@shared/datatable/i-data-table';
import { buildSummary } from '@testing/entry.fixtures';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectFilters,
    selectIndexLoading,
    selectSectionEntries,
    selectSectionTags
} from '@store/codex/codex.selectors';
import { SectionListComponent } from './section-list.component';

@Component({ selector: 'cdx-data-table', standalone: true, template: '' })
class DataTableMockComponent {
    readonly columns = input<IDataTableColumn[]>([]);
    readonly rows = input<IDataTableRow[]>([]);
    readonly loading = input<boolean>(false);
    readonly emptyMessage = input<string>('');
    readonly rowActivated = output<string>();
}

describe('SectionListComponent', () => {
    let fixture: ComponentFixture<SectionListComponent>;
    let component: SectionListComponent;
    let store: MockStore;
    let paramMap$: BehaviorSubject<ParamMap>;
    let router: { navigate: jest.Mock };

    beforeEach(async () => {
        // Arrange
        paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ section: CodexSection.Npcs }));
        router = { navigate: jest.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [SectionListComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
                { provide: Router, useValue: router }
            ]
        })
            .overrideComponent(SectionListComponent, {
                remove: { imports: [DataTableComponent] },
                add: { imports: [DataTableMockComponent] }
            })
            .compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectSectionEntries, [buildSummary()]);
        store.overrideSelector(selectSectionTags, ['ally', 'silver-ledger']);
        store.overrideSelector(selectFilters, { status: null, tags: [], query: '' });
        store.overrideSelector(selectIndexLoading, false);

        fixture = TestBed.createComponent(SectionListComponent);
        component = fixture.componentInstance;
    });

    it('should announce the opened section from the route', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        paramMap$.next(convertToParamMap({ section: CodexSection.Places }));
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.sectionOpened({ section: CodexSection.Places }));
    });

    it('should ignore a route without a section', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        dispatchSpy.mockClear();

        // Act
        paramMap$.next(convertToParamMap({}));
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should build the columns from the section definition', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const keys = component['columns']().map((column) => column.key);

        // Assert
        expect(keys).toEqual(['title', 'status', 'race', 'role', 'tags', 'updated']);
    });

    it('should build a row per entry with its section fields', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const rows = component['rows']();

        // Assert
        expect(rows.length).toBe(1);
        expect(rows[0].cells['title']).toBe('Vaelith Corrun');
        expect(rows[0].cells['race']).toBe('Half-elf');
        expect(rows[0].chip).toBe('Alive');
    });

    it('should fall back to a dash for a missing field', () => {
        // Arrange
        store.overrideSelector(selectSectionEntries, [buildSummary({ fields: {} })]);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(component['rows']()[0].cells['race']).toBe('—');
    });

    it('should switch the list view', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['setView']('cards');
        fixture.detectChanges();

        // Assert
        expect(component['view']()).toBe('cards');
    });

    it('should apply and clear a status filter', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleStatus']('Alive');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.filtersChanged({ status: 'Alive', tags: [], query: '' })
        );
    });

    it('should clear a status filter that is already applied', () => {
        // Arrange
        store.overrideSelector(selectFilters, { status: 'Alive', tags: [], query: '' });
        store.refreshState();
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleStatus']('Alive');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.filtersChanged({ status: null, tags: [], query: '' })
        );
    });

    it('should add and remove a tag filter', () => {
        // Arrange
        store.overrideSelector(selectFilters, { status: null, tags: ['ally'], query: '' });
        store.refreshState();
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleTag']('ally');
        component['toggleTag']('silver-ledger');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.filtersChanged({ status: null, tags: [], query: '' })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.filtersChanged({ status: null, tags: ['ally', 'silver-ledger'], query: '' })
        );
    });

    it('should navigate to the activated entry', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['openEntry']('npcs:vaelith-corrun');

        // Assert
        expect(router.navigate).toHaveBeenCalledWith(['/campaign', 'npcs', 'vaelith-corrun']);
    });

    it('should ignore an activation for an unknown id', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['openEntry']('npcs:nobody');

        // Assert
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should navigate when a card is opened', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['openSummary'](buildSummary());

        // Assert
        expect(router.navigate).toHaveBeenCalledWith(['/campaign', 'npcs', 'vaelith-corrun']);
    });
});
