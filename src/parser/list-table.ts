import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Table, TableRow, TableCell } from '../ast/types';

export class ListTableParser {
    private state: ParserState;
    private blockParser: BlockParser | null = null;

    constructor(state: ParserState, blockParser?: BlockParser) {
        this.state = state;
        this.blockParser = blockParser || null;
    }

    public parse(headerRows: number = 0, stubColumns: number = 0, options: Record<string, string> = {}): Table | null {
        const rows: TableRow[] = [];

        while (this.state.hasMoreLines()) {
            const line = this.state.peekLine();
            if (!line || !line.trim().startsWith('* -')) break;
            
            this.state.consumeLine(); // Consume the '* - content' line
            const rowIndent = this.state.getIndentation(line);
            
            // Parse the first cell from the '* - content' line
            const firstCellContent = line.substring(line.indexOf('- ') + 2);
            const firstCellIndent = line.indexOf('- ') + 2;
            
            // Collect continuation lines for the first cell
            const firstCellLines = [firstCellContent];
            this.collectCellContinuationLines(firstCellLines, firstCellIndent, rowIndent);
            
            const cells: TableCell[] = [this.parseCell(firstCellLines.join('\n'))];
            
            // Parse remaining cells in the row
            while (this.state.hasMoreLines()) {
                const cellLine = this.state.peekLine();
                if (!cellLine) break;
                
                const cellTrimmed = cellLine.trim();
                const cellIndent = this.state.getIndentation(cellLine);
                
                if (cellTrimmed.startsWith('* -') || cellTrimmed.startsWith('*-') || cellIndent < rowIndent) {
                    break; // Next row or end of table
                }
                
                // Check for cell marker: "- " or just "-" (for empty cells)
                if (cellTrimmed.startsWith('- ') || cellTrimmed === '-') {
                    this.state.consumeLine();
                    const dashPos = cellLine.indexOf('-');
                    const cellContent = cellTrimmed === '-' ? '' : cellLine.substring(dashPos + 2);
                    const cellContentIndent = dashPos + 2;
                    
                    // Collect continuation lines for this cell
                    const cellLines = [cellContent];
                    this.collectCellContinuationLines(cellLines, cellContentIndent, rowIndent);
                    
                    cells.push(this.parseCell(cellLines.join('\n')));
                } else {
                    break; // Not a cell line
                }
            }
            
            if (cells.length > 0) {
                rows.push({ type: 'table_row', cells });
            }
        }

        if (rows.length === 0) return null;

        return {
            type: 'table',
            rows,
            header_rows: headerRows,
            stub_columns: stubColumns,
            options
        };
    }

    private collectCellContinuationLines(cellLines: string[], cellContentIndent: number, rowIndent: number): void {
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;
            
            const nextTrimmed = nextLine.trim();
            const nextIndent = this.state.getIndentation(nextLine);
            
            // Check if this is a new row marker at the row level (not nested content)
            if ((nextTrimmed.startsWith('* -') || nextTrimmed.startsWith('*-')) && nextIndent <= rowIndent) {
                break;
            }
            
            // Check if this is a new cell marker at the same level
            // Cell markers are "- " or just "-" (for empty cells)
            if ((nextTrimmed.startsWith('- ') || nextTrimmed === '-') && nextIndent <= rowIndent + 2) {
                break;
            }
            
            // Check if we've dedented past the cell content level (but not for empty lines)
            if (nextTrimmed !== '' && nextIndent < cellContentIndent && nextIndent <= rowIndent) {
                break;
            }
            
            // This is a continuation line for the current cell
            this.state.consumeLine();
            
            // Dedent the line relative to the cell content indent
            if (nextTrimmed === '') {
                cellLines.push('');
            } else if (nextIndent >= cellContentIndent) {
                cellLines.push(nextLine.substring(cellContentIndent));
            } else {
                cellLines.push(nextLine.substring(nextIndent));
            }
        }
    }

    private parseCell(content: string): TableCell {
        let cspan = 1;
        let rspan = 1;
        let cleanContent = content.trim();

        const roleRegex = /^:([a-z-]+):`(\d+)`/;
        while (true) {
            const match = cleanContent.match(roleRegex);
            if (!match) break;
            const role = match[1];
            const val = parseInt(match[2]);
            if (role === 'cspan') cspan = val;
            if (role === 'rspan') rspan = val;
            cleanContent = cleanContent.slice(match[0].length).trim();
        }

        // Handle '..' as empty cell
        if (cleanContent === '..') {
            return {
                type: 'table_cell',
                children: [],
                cspan,
                rspan
            };
        }

        if (this.blockParser) {
            const subState = new ParserState(cleanContent);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();
            return {
                type: 'table_cell',
                children: subDoc.children,
                cspan,
                rspan
            };
        } else {
            return {
                type: 'table_cell',
                children: [{ type: 'text', value: cleanContent }],
                cspan,
                rspan
            };
        }
    }
}