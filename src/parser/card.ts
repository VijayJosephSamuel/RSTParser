import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Card } from '../ast/types';

/**
 * Parses card directives
 * 
 * A card is a flexible and extendable content container that contains 
 * content and actions about a single subject.
 * 
 * Basic syntax:
 * .. card:: Card title
 *    Card content goes here
 * 
 * With options:
 * .. card:: Card title
 *    :class-card: topic-card topic-card-8
 *    :link: https://example.com
 * 
 *    Card content
 */
export class CardParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Parses a card directive if the current line matches .. card::
     * Returns a Card node or null.
     */
    public parse(): Card | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+card::(.*)$/);
        if (!match) return null;

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Parse the title from the arguments (optional)
        const title = match[1].trim() || undefined;

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

        const card: Card = {
            type: 'card',
            children: children
        };

        // Add optional title
        if (title) {
            card.title = title;
        }

        // Add options if present
        if (Object.keys(options).length > 0) {
            card.options = options;
        }

        return card;
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
