import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Table, TableRow, TableCell } from '../ast/types';

export class CsvTableParser {
    private state: ParserState;
    private blockParser: BlockParser | null = null;

    constructor(state: ParserState, blockParser?: BlockParser) {
        this.state = state;
        this.blockParser = blockParser || null;
    }

    public parse(headerStr: string | null, options: Record<string, string> = {}, headerRows = 0, stubColumns = 0): Table | null {
        const rows: TableRow[] = [];

        if (headerStr) {
            const headerCells = this.parseCsvLine(headerStr);
            rows.push({ type: 'table_row', cells: headerCells });
        }

        while (this.state.hasMoreLines()) {
            const line = this.state.consumeLine();
            if (!line || line.trim() === '') continue;

            const cells = this.parseCsvLine(line.trim());
            if (cells.length > 0) rows.push({ type: 'table_row', cells });
        }

        if (rows.length === 0) return null;

        return {
            type: 'table',
            rows,
            header_rows: headerRows || (headerStr ? 1 : 0),
            stub_columns: stubColumns,
            options
        };
    }

    private parseCsvLine(line: string): TableCell[] {
        // Basic CSV split, doesn't handle quoted fields with commas
        const rawCells = line.split(',').map(s => s.trim()).filter(s => s.length > 0);
        return rawCells.map(raw => this.parseCell(raw));
    }

    private parseCell(raw: string): TableCell {
        // Remove surrounding quotes
        if (raw.startsWith('"') && raw.endsWith('"')) {
            raw = raw.slice(1, -1);
        }

        let children: Node[] = [{ type: 'text', value: raw }];
        if (this.blockParser) {
            const subState = new ParserState(raw);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();
            children = subDoc.children;
        }

        return {
            type: 'table_cell',
            children,
            // No spans for CSV
        };
    }
}