import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Container } from '../ast/types';

/**
 * Parses container directives
 * Containers are generic block-level container elements that can be extended
 * with optional arguments to create custom layouts or apply specific styles.
 * 
 * Examples:
 * - .. container:: tagrightalign
 * - .. container:: shortdesc
 * - .. container:: systemoutput
 * - .. container:: screenoutput
 * - .. container:: text-decoration-underline
 * - .. container:: class1 class2 class3 (multiple classes)
 */
export class ContainerParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Parses a container directive if the current line matches .. container::
     * Returns a Container node or null.
     */
    public parse(): Container | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+container::(.*)$/);
        if (!match) return null;

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Parse the classes from the arguments
        const classesArg = match[1].trim();
        const classes = classesArg ? classesArg.split(/\s+/) : [];

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

        const container: Container = {
            type: 'container',
            classes: classes,
            children: children
        };

        if (Object.keys(options).length > 0) {
            container.options = options;
        }

        return container;
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
