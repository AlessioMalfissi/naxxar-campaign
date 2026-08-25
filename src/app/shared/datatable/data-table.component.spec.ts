import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTableComponent } from './data-table.component';
import { IDataTableColumn, IDataTableRow } from './i-data-table';

describe('DataTableComponent', () => {
    let fixture: ComponentFixture<DataTableComponent>;
    let component: DataTableComponent;

    const columns: IDataTableColumn[] = [
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status' }
    ];

    const rows: IDataTableRow[] = [
        { id: 'npcs:vaelith-corrun', chip: 'Alive', cells: { title: 'Vaelith Corrun' } }
    ];

    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('columns', columns);
        fixture.componentRef.setInput('rows', rows);
        fixture.detectChanges();
    });

    it('should render one row per entry', () => {
        // Arrange
        const element: HTMLElement = fixture.nativeElement;

        // Act
        const renderedRows = element.querySelectorAll('.cdx-data-table-row');

        // Assert
        expect(renderedRows.length).toBe(1);
    });

    it('should render the status as a chip', () => {
        // Arrange
        const element: HTMLElement = fixture.nativeElement;

        // Act
        const chip = element.querySelector('.cdx-data-table-chip');

        // Assert
        expect(chip?.textContent?.trim() === 'Alive').toBe(true);
    });

    it('should emit the row id when a row is activated', () => {
        // Arrange
        const emitted: string[] = [];
        component.rowActivated.subscribe((id) => emitted.push(id));
        const row = fixture.nativeElement.querySelector('.cdx-data-table-row') as HTMLElement;

        // Act
        row.click();
        fixture.detectChanges();

        // Assert
        expect(emitted[0]).toBe('npcs:vaelith-corrun');
    });

    it('should show the empty message when there are no rows', () => {
        // Arrange
        fixture.componentRef.setInput('rows', []);
        fixture.componentRef.setInput('emptyMessage', 'Start your first entry');

        // Act
        fixture.detectChanges();
        const empty = fixture.nativeElement.querySelector('.cdx-data-table-empty') as HTMLElement;

        // Assert
        expect(empty.textContent?.includes('Start your first entry')).toBe(true);
    });
});
