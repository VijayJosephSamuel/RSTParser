import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Dropdown } from '../ast/types';

/**
 * Parses dropdown directives for RST
 * 
 * Dropdown directive creates a collapsible content container:
 * 
 * .. dropdown:: Title text
 * 
 *    Dropdown content goes here.
 *    Can include multiple paragraphs.
 * 
 *    - List items
 *    - More items
 * 
 * Features:
 * - Title is the directive argument (required)
 * - Content can include any block-level elements (paragraphs, lists, code blocks, etc.)
 * - Supports nested dropdowns
 * - Preserves all nested formatting and structure
 */
export class DropdownParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Attempts to parse a dropdown directive
     * Returns Dropdown or null
     */
    public parse(): Dropdown | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+dropdown::\s*(.+)$/);
        if (!match) return null;

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Extract title from directive argument
        const title = match[1].trim();

        // Parse options
        const options: Record<string, string> = {};
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;

            const optionMatch = nextLine.match(/^\s+:([a-zA-Z0-9-_]+):\s*(.*)$/);
            if (optionMatch) {
                const optionName = optionMatch[1];
                const optionValue = optionMatch[2].trim();
                options[optionName] = optionValue;
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Skip empty lines between options and body
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine && nextLine.trim() === '') {
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Collect body lines
        const bodyLines: string[] = [];
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine === null) break;

            if (nextLine.trim() === '') {
                bodyLines.push(nextLine);
                this.state.consumeLine();
                continue;
            }

            const currentIndent = this.state.getIndentation(nextLine);
            if (currentIndent > directiveIndent) {
                bodyLines.push(nextLine);
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Remove trailing empty lines
        while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
            bodyLines.pop();
        }

        // Parse the body
        let children: Node[] = [];
        if (bodyLines.length > 0) {
            const cleanedBodyLines = this.dedent(bodyLines);
            const bodyText = cleanedBodyLines.join('\n');

            const subState = new ParserState(bodyText);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();
            children = subDoc.children;
        }

        const dropdown: Dropdown = {
            type: 'dropdown',
            title: title,
            children: children
        };

        if (Object.keys(options).length > 0) {
            dropdown.options = options;
        }

        return dropdown;
    }

    private dedent(lines: string[]): string[] {
        if (lines.length === 0) return [];

        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim() !== '') {
                const indent = this.getIndentation(line);
                if (indent < minIndent) minIndent = indent;
            }
        }

        if (minIndent === Infinity || minIndent === 0) return lines;

        return lines.map(line => {
            if (line.trim() === '') return '';
            return line.substring(minIndent);
        });
    }

    private getIndentation(line: string): number {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }
}
