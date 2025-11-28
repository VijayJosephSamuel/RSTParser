import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Table, TableRow, TableCell, Text } from '../ast/types';

/**
 * Very simple grid table parser.
 * Supports tables where rows are lines starting with '|' and separators start with '+'.
 * Example:
 * +---+---+
 * | a | b |
 * +---+---+
 * | c | d |
 * +---+---+
 */
export class GridTableParser {
    private state: ParserState;
    private blockParser: BlockParser | null = null;

    constructor(state: ParserState, blockParser?: BlockParser) {
        this.state = state;
        this.blockParser = blockParser || null;
    }

    /**
     * Parses a grid table if the current line looks like a grid table separator.
     * Returns a Table node or null.
     */
    public parse(): Table | null {
        const line = this.state.peekLine();
        if (!line) return null;
        const trimmed = line.trim();
        // Grid tables must start with a '+' separator line (e.g., +---+---+)
        // Lines starting with '|' alone could be RST line blocks, not grid tables
        if (!trimmed.startsWith('+')) {
            return null;
        }
        // Verify it's a proper grid table separator (contains dashes)
        if (!trimmed.match(/^\+[-=+]+\+$/)) {
            return null;
        }
        const rows: TableRow[] = [];
        // Consume lines until a line that is not part of the grid table.
        while (this.state.hasMoreLines()) {
            const current = this.state.peekLine();
            if (!current) break;
            const trimmed = current.trim();
            if (trimmed.startsWith('+')) {
                // separator line – just consume it and continue.
                this.state.consumeLine();
                continue;
            }
            if (trimmed.startsWith('|')) {
                // content line – parse cells.
                this.state.consumeLine();
                // Remove leading and trailing '|', then split.
                const inner = trimmed.slice(1, -1);
                const cellTexts = inner.split('|').map(c => c.trim());
                const cells: TableCell[] = cellTexts.map(text => {
                    if (text === '..' || text === '') {
                        return { type: 'table_cell', children: [] };
                    }
                    
                    let children: Node[] = [{ type: 'text', value: text }];
                    if (this.blockParser) {
                        const subState = new ParserState(text);
                        const subParser = new BlockParser(subState);
                        const subDoc = subParser.parse();
                        children = subDoc.children;
                    }
                    
                    return {
                        type: 'table_cell',
                        children
                    } as TableCell;
                });
                rows.push({ type: 'table_row', cells });
                continue;
            }
            // If line is empty, break (end of table).
            if (trimmed === '') {
                break;
            }
            // Any other line ends the table.
            break;
        }
        if (rows.length === 0) return null;
        const table: Table = { type: 'table', rows };
        return table;
    }
}
