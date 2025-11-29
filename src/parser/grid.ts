import { ParserState } from './state';
import { BlockParser } from './block';
import { Grid, GridItem, GridItemCard, Node } from '../ast/types';

export class GridParser {
    constructor(private state: ParserState, private blockParser: BlockParser) {}

    parse(): Grid | null {
        const line = this.state.peekLine();
        if (!line) return null;

        // Match: .. grid:: 1 2 3 4 or .. grid:: 2 or .. grid:: 1 1 2 2
        const match = /^\s*\.\.\s+grid::\s*(.+)$/.exec(line);
        if (!match) return null;

        this.state.consumeLine();
        const baseIndent = this.getIndentation(line);

        // Parse columns from argument (space-separated numbers)
        const columnArg = match[1].trim();
        const columns = columnArg.split(/\s+/).map(c => parseInt(c, 10)).filter(n => !isNaN(n));
        if (columns.length === 0) {
            columns.push(1); // Default to single column
        }

        // Parse options
        const options: Record<string, string> = {};
        let gutterValue: string | number[] | undefined;

        while (this.state.peekLine() !== null && /^\s+:[^:]+:/.test(this.state.peekLine()!)) {
            const optionLine = this.state.peekLine()!;
            const optionMatch = /^\s+:([^:]+):\s*(.*)$/.exec(optionLine);
            if (optionMatch) {
                const [, key, value] = optionMatch;
                if (key === 'gutter') {
                    // Parse gutter: can be single number or space-separated numbers
                    const gutterParts = value.trim().split(/\s+/);
                    if (gutterParts.length === 1) {
                        gutterValue = value.trim();
                    } else {
                        gutterValue = gutterParts.map(p => parseInt(p, 10)).filter(n => !isNaN(n));
                    }
                } else {
                    options[key] = value.trim();
                }
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Skip empty lines after options
        while (this.state.peekLine() !== null && this.state.peekLine()!.trim() === '') {
            this.state.consumeLine();
        }

        // Collect grid-item and grid-item-card children
        const children: Node[] = [];

        while (this.state.peekLine() !== null) {
            const current = this.state.peekLine()!;
            const currentIndent = this.getIndentation(current);

            // Skip blank lines
            if (!current.trim()) {
                this.state.consumeLine();
                continue;
            }

            // Check if we're at the same or lower indentation level (end of grid)
            if (currentIndent <= baseIndent) {
                break;
            }

            // Check for grid-item
            if (/^\s+\.\.\s+grid-item::/.test(current)) {
                const gridItem = this.parseGridItem(baseIndent, currentIndent);
                if (gridItem) {
                    children.push(gridItem);
                }
                continue;
            }

            // Check for grid-item-card
            if (/^\s+\.\.\s+grid-item-card::/.test(current)) {
                const gridItemCard = this.parseGridItemCard(baseIndent, currentIndent);
                if (gridItemCard) {
                    children.push(gridItemCard);
                }
                continue;
            }

            // Other content at grid level - stop parsing
            break;
        }

        const grid: Grid = {
            type: 'grid',
            columns,
            children: children as any,
            options: Object.keys(options).length > 0 ? options : undefined,
        };

        if (gutterValue !== undefined) {
            grid.gutter = gutterValue;
        }

        return grid;
    }

    private parseGridItem(parentIndent: number, itemStartIndent: number): GridItem | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = /^\s*\.\.\s+grid-item::/.exec(line);
        if (!match) return null;

        this.state.consumeLine();

        // Collect body content
        const bodyLines: string[] = [];

        while (this.state.peekLine() !== null) {
            const current = this.state.peekLine()!;
            const currentIndent = this.getIndentation(current);

            // If we're back at parent indent or lower and not empty, we're done
            if (currentIndent <= parentIndent && current.trim()) {
                break;
            }

            // If we're back at item start indent with a directive, we're done
            if (currentIndent === itemStartIndent && current.trim() && /^\s+\.\./.test(current)) {
                break;
            }

            if (current.trim()) {
                bodyLines.push(current);
            } else {
                bodyLines.push('');
            }

            this.state.consumeLine();
        }

        // Dedent body
        const dedented = this.dedent(bodyLines);

        // Parse nested content using BlockParser
        const tempState = new ParserState(dedented.join('\n'));
        const tempBlockParser = new BlockParser(tempState);
        const children = tempBlockParser.parse().children;

        return {
            type: 'grid-item',
            children,
        };
    }

    private parseGridItemCard(parentIndent: number, cardStartIndent: number): GridItemCard | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = /^\s*\.\.\s+grid-item-card::\s*(.*)$/.exec(line);
        if (!match) return null;

        const title = match[1].trim() || undefined;
        this.state.consumeLine();

        // Parse options
        const options: Record<string, string> = {};

        while (this.state.peekLine() !== null && /^\s+:[^:]+:/.test(this.state.peekLine()!)) {
            const optionLine = this.state.peekLine()!;
            const optionMatch = /^\s+:([^:]+):\s*(.*)$/.exec(optionLine);
            if (optionMatch) {
                const [, key, value] = optionMatch;
                options[key] = value.trim();
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Collect body content
        const bodyLines: string[] = [];

        while (this.state.peekLine() !== null) {
            const current = this.state.peekLine()!;
            const currentIndent = this.getIndentation(current);

            // If we're back at parent indent or lower and not empty, we're done
            if (currentIndent <= parentIndent && current.trim()) {
                break;
            }

            // If we're back at card start indent with a directive, we're done
            if (currentIndent === cardStartIndent && current.trim() && /^\s+\.\./.test(current)) {
                break;
            }

            if (current.trim()) {
                bodyLines.push(current);
            } else {
                bodyLines.push('');
            }

            this.state.consumeLine();
        }

        // Dedent body
        const dedented = this.dedent(bodyLines);

        // Parse nested content using BlockParser
        const tempState = new ParserState(dedented.join('\n'));
        const tempBlockParser = new BlockParser(tempState);
        const children = tempBlockParser.parse().children;

        return {
            type: 'grid-item-card',
            title,
            children,
            options: Object.keys(options).length > 0 ? options : undefined,
        };
    }

    private getIndentation(line: string): number {
        const match = /^(\s*)/.exec(line);
        return match ? match[1].length : 0;
    }

    private dedent(lines: string[]): string[] {
        if (lines.length === 0) return lines;

        // Find minimum indentation (excluding empty lines)
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim()) {
                const indent = this.getIndentation(line);
                minIndent = Math.min(minIndent, indent);
            }
        }

        if (minIndent === Infinity) {
            return lines;
        }

        // Remove the minimum indentation from all lines
        return lines.map(line => (line.trim() ? line.slice(minIndent) : line));
    }
}
