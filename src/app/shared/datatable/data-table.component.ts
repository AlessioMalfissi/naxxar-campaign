import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IDataTableColumn, IDataTableRow } from './i-data-table';

@Component({
    selector: 'cdx-data-table',
    standalone: true,
    templateUrl: './data-table.component.html',
    styleUrl: './data-table.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent {
    readonly columns = input.required<IDataTableColumn[]>();
    readonly rows = input.required<IDataTableRow[]>();
    readonly selectedId = input<string | null>(null);
    readonly emptyMessage = input<string>('Nothing here yet.');

    readonly rowActivated = output<string>();

    protected onRowActivated(id: string): void {
        this.rowActivated.emit(id);
    }
}
