import { ParserState } from './state';
import { BlockParser } from './block';
import { ListTableParser } from './list-table';
import { CsvTableParser } from './csv-table';
import { Node, Table, TableRow, TableCell, Text } from '../ast/types';

/**
 * Parses table directives like .. list-table::, .. flat-table::, .. csv-table::
 * Extracts options and body, then uses specific parsers for each table type.
 */
export class TableDirectiveParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    public parse(): Table | null {
        const line = this.state.peekLine();
        if (!line) return null;
        
        const match = line.match(/^\s*\.\.\s+(list-table|flat-table|csv-table)::(.*)$/);
        if (!match) return null;
        
        const name = match[1];
        this.state.consumeLine();
        
        // Parse options
        const options: Record<string, string> = {};
        while (this.state.hasMoreLines()) {
            const optLine = this.state.peekLine();
            if (!optLine) break;
            
            const optMatch = optLine.match(/^\s+:([^\s:]+):\s*(.*)$/);
            if (optMatch) {
                options[optMatch[1]] = optMatch[2].trim();
                this.state.consumeLine();
            } else {
                break;
            }
        }
        
        // Skip empty lines to find the start of the body
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine !== null && nextLine.trim() === '') {
                this.state.consumeLine();
            } else {
                break;
            }
        }
        
        // Check if there's any body content before proceeding
        if (!this.state.hasMoreLines()) {
            return null;
        }
        
        // Collect raw body lines
        const bodyLines: string[] = [];
        
        // Find the first non-empty line to determine body indentation
        let firstNonEmptyLineIndex = 0;
        while (firstNonEmptyLineIndex < 100 && this.state.peekLine(firstNonEmptyLineIndex)?.trim() === '') {
            firstNonEmptyLineIndex++;
        }
        
        const firstBodyLine = this.state.peekLine(firstNonEmptyLineIndex);
        const bodyIndent = firstBodyLine ? this.state.getIndentation(firstBodyLine) : 0;
        
        while (this.state.hasMoreLines()) {
            const bodyLine = this.state.peekLine();
            if (!bodyLine) break;
            
            if (bodyLine.trim() === '') {
                bodyLines.push(bodyLine);
                this.state.consumeLine();
                continue;
            }
            
            const currentIndent = this.state.getIndentation(bodyLine);
            if (currentIndent >= bodyIndent) {
                bodyLines.push(bodyLine);
                this.state.consumeLine();
            } else {
                break;
            }
        }
        
        const dedented = this.dedent(bodyLines);
        const bodyText = dedented.join('\n');
        
        if (bodyText.trim() === '') return null;
        
        const subState = new ParserState(bodyText);
        let table: Table | null = null;
        
        const headerRows = parseInt(options['header-rows'] || '0');
        const stubColumns = parseInt(options['stub-columns'] || '0');
        
        if (name === 'list-table' || name === 'flat-table') {
            const listParser = new ListTableParser(subState, this.blockParser);
            table = listParser.parse(headerRows, stubColumns, options);
        } else if (name === 'csv-table') {
            const csvParser = new CsvTableParser(subState, this.blockParser);
            table = csvParser.parse(options.header || null, options, headerRows, stubColumns);
        }
        
        if (table) {
            table.options = options;
        }
        
        return table;
    }

    private dedent(lines: string[]): string[] {
        if (lines.length === 0) return [];
        
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim() !== '') {
                const match = line.match(/^(\s*)/);
                const indentLen = match ? match[1].length : 0;
                if (indentLen < minIndent) minIndent = indentLen;
            }
        }
        
        if (minIndent === Infinity || minIndent === 0) return lines;
        
        return lines.map(line => {
            if (line.trim() === '') return line;
            return line.substring(minIndent);
        });
    }
}
