export interface IDataTableColumn {
    key: string;
    label: string;
    width?: string;
}

export interface IDataTableRow {
    id: string;
    cells: Record<string, string>;
    chip?: string;
    tags?: string[];
}
