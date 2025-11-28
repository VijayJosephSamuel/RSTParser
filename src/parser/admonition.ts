import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Admonition } from '../ast/types';

/**
 * Parses admonition directives including:
 * - .. note::
 * - .. attention::
 * - .. caution::
 * - .. danger::
 * - .. error::
 * - .. hint::
 * - .. important::
 * - .. tip::
 * - .. warning::
 */
export class AdmonitionParser {
    private state: ParserState;
    private blockParser: BlockParser;

    // List of valid admonition types
    private static readonly ADMONITION_TYPES = new Set([
        'note',
        'attention',
        'caution',
        'danger',
        'error',
        'hint',
        'important',
        'tip',
        'warning'
    ]);

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Parses an admonition directive if the current line matches .. admonition-type::
     * Returns an Admonition node or null.
     */
    public parse(): Admonition | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+([a-zA-Z-]+)::(.*)$/);
        if (!match) return null;

        const directiveName = match[1];
        if (!AdmonitionParser.ADMONITION_TYPES.has(directiveName)) {
            return null;
        }

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Parse options
        const options: Record<string, string> = {};
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;

            const optionMatch = nextLine.match(/^\s+:([a-zA-Z0-9-_]+):\s*(.*)$/);
            if (optionMatch) {
                options[optionMatch[1]] = optionMatch[2].trim();
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

        const admonition: Admonition = {
            type: 'admonition',
            kind: directiveName as 'note' | 'attention' | 'caution' | 'danger' | 'error' | 'hint' | 'important' | 'tip' | 'warning',
            children: children
        };

        if (Object.keys(options).length > 0) {
            admonition.options = options;
        }

        return admonition;
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
