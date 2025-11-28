import { ParserState } from './state';
import { Directive, Node } from '../ast/types';
import { BlockParser } from './block';

export class DirectiveParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    public parse(): Directive | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+([a-zA-Z0-9-_]+)::(.*)$/);
        if (!match) return null;
        
        // Skip table directives - they are handled by TableDirectiveParser
        const directiveName = match[1];
        if (directiveName === 'list-table' || directiveName === 'flat-table' || directiveName === 'csv-table') {
            return null;
        }
        if (!match) return null;

        this.state.consumeLine(); // Consume the directive line
        const name = match[1];
        const argsString = match[2].trim();
        const args = argsString ? argsString.split(/\s+/) : [];

        const options: Record<string, string> = {};

        // Parse options
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;

            // Check for option:  :key: value
            const optionMatch = nextLine.match(/^\s+:([a-zA-Z0-9-_]+):\s*(.*)$/);
            if (optionMatch) {
                options[optionMatch[1]] = optionMatch[2].trim();
                this.state.consumeLine();
            } else {
                // Stop if not an option (could be body or empty line)
                // Note: Empty lines between options are allowed in some RST variants, but strictly options come right after.
                // We'll assume options are contiguous for now or separated by empty lines but indented? 
                // Standard RST: options block is contiguous.
                break;
            }
        }

        // Parse Body
        // The body must be indented relative to the directive start.
        // We need to capture all lines that are indented, and then recursively parse them.

        // First, skip empty lines to find the start of the body
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine && nextLine.trim() === '') {
                this.state.consumeLine();
            } else {
                break;
            }
        }

        const bodyLines: string[] = [];
        const directiveIndentation = this.state.getIndentation(line);

        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine === null) break;

            // If empty line, just add it (it's part of the body if the body continues)
            // But we need to be careful about the end of the block.
            // If the next non-empty line is NOT indented, then the block ends.
            if (nextLine.trim() === '') {
                bodyLines.push(nextLine);
                this.state.consumeLine();
                continue;
            }

            const currentIndentation = this.state.getIndentation(nextLine);
            if (currentIndentation > directiveIndentation) {
                bodyLines.push(nextLine);
                this.state.consumeLine();
            } else {
                // End of directive body
                break;
            }
        }

        // Remove common indentation from body lines
        const cleanedBodyLines = this.dedent(bodyLines);

        // Recursively parse the body
        // We need a new ParserState for the body content
        // And a new BlockParser (or reuse the logic, but simpler to create new instance for the sub-document)
        // Wait, creating a new BlockParser with a new State is the cleanest way to handle recursion.

        let bodyNodes: Node[] = [];
        if (cleanedBodyLines.length > 0) {
            const bodyText = cleanedBodyLines.join('\n');
            const subState = new ParserState(bodyText);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();
            bodyNodes = subDoc.children;
        }

        return {
            type: 'directive',
            name: name,
            args: args,
            options: options,
            body: bodyNodes,
        };
    }

    private dedent(lines: string[]): string[] {
        if (lines.length === 0) return [];

        // Find minimum indentation of non-empty lines
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim() !== '') {
                const indent = line.match(/^(\s*)/)![1].length;
                if (indent < minIndent) minIndent = indent;
            }
        }

        if (minIndent === Infinity) return lines; // All lines empty

        return lines.map(line => {
            if (line.trim() === '') return '';
            return line.substring(minIndent);
        });
    }
}
