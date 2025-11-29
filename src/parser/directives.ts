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

        // First check if this is a comment or special RST form (.. ...)
        // This includes:
        // - Comments: .. followed by text (no ::)
        // - References: .. _label:
        // - Substitutions: .. |name|
        // - Other unknown directive-like forms
        if (line.trim().startsWith('.. ')) {
            // Check if it's a proper directive (with ::)
            const match = line.match(/^\s*\.\.\s+([a-zA-Z0-9-_]+)::(.*)$/);
            
            // If not a proper directive, treat as a comment/special form
            if (!match) {
                // Consume the comment line and any continuation lines
                this.consumeComment();
                return null; // Comments don't produce output nodes
            }
            
            // Skip table directives - they are handled by TableDirectiveParser
            const directiveName = match[1];
            if (directiveName === 'list-table' || directiveName === 'flat-table' || directiveName === 'csv-table') {
                return null;
            }
        } else {
            // Not a directive/comment at all
            return null;
        }

        // Handle proper directives with ::
        const match = line.match(/^\s*\.\.\s+([a-zA-Z0-9-_]+)::(.*)$/);
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

    private consumeComment(): void {
        const commentLine = this.state.peekLine();
        if (!commentLine || !commentLine.trim().startsWith('.. ')) {
            return;
        }

        this.state.consumeLine();
        
        // Continuation lines for comments must be indented more than the comment start
        const commentIndent = this.state.getIndentation(commentLine);
        
        // Consume any continuation lines that are more indented
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            // Note: peekLine can return empty string for empty lines, which is falsy
            // So check for null explicitly instead of using !nextLine
            if (nextLine === null) break;
            
            // Empty lines can be part of the comment block
            if (nextLine.trim() === '') {
                // Peek ahead to see if there's a continuation
                const lineAfter = this.state.peekLine(1);
                if (lineAfter !== null && this.state.getIndentation(lineAfter) > commentIndent) {
                    // It's a continuation, consume the empty line
                    this.state.consumeLine();
                    continue;
                } else {
                    // End of comment block
                    break;
                }
            }
            
            // Non-empty line: check if it's indented more than the comment
            const nextIndent = this.state.getIndentation(nextLine);
            if (nextIndent > commentIndent) {
                // This is a continuation line
                this.state.consumeLine();
            } else {
                // End of comment block
                break;
            }
        }
    }
}
