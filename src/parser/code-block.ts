import { ParserState } from './state';
import { CodeBlock } from '../ast/types';

/**
 * Parses code block directives for RST
 * 
 * Three types supported:
 * 
 * 1. .. code::
 *    Plain code block without syntax highlighting
 * 
 * 2. .. code-block:: language
 *    Code block with language-specific syntax highlighting
 *    Examples: rst, python, javascript, bash, html, css, json, yaml, etc.
 * 
 * 3. .. parsed-literal::
 *    Code block that allows reStructuredText markup (bold, italic, links, etc.)
 * 
 * Features:
 * - Optional :linenos: to show line numbers
 * - Optional :emphasize-lines: to highlight specific lines (e.g., 1,3,5)
 * - Optional :number-lines: to start numbering from a specific line
 * - Preserves exact indentation and whitespace of code content
 * - Supports multiline code blocks with proper dedenting
 */
export class CodeBlockParser {
    private state: ParserState;

    constructor(state: ParserState) {
        this.state = state;
    }

    /**
     * Attempts to parse a code block directive
     * Returns CodeBlock or null
     */
    public parse(): CodeBlock | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const codeMatch = line.match(/^\s*\.\.\s+code::(.*)$/);
        const codeBlockMatch = line.match(/^\s*\.\.\s+code-block::\s*(.*)$/);
        const parsedLiteralMatch = line.match(/^\s*\.\.\s+parsed-literal::(.*)$/);

        if (!codeMatch && !codeBlockMatch && !parsedLiteralMatch) return null;

        const isParsedLiteral = !!parsedLiteralMatch;
        const isCodeBlock = !!codeBlockMatch;

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Extract language from code-block directive
        let language: string | undefined;
        if (codeBlockMatch) {
            const langArg = codeBlockMatch[1].trim();
            if (langArg) {
                language = langArg;
            }
        }

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

        // Collect code block lines
        const codeLines: string[] = [];
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine === null) break;

            if (nextLine.trim() === '') {
                codeLines.push(nextLine);
                this.state.consumeLine();
                continue;
            }

            const currentIndent = this.state.getIndentation(nextLine);
            if (currentIndent > directiveIndent) {
                codeLines.push(nextLine);
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Remove trailing empty lines
        while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
            codeLines.pop();
        }

        // Dedent the code lines while preserving relative indentation
        const cleanedCodeLines = this.dedent(codeLines);
        const content = cleanedCodeLines.join('\n');

        const codeBlock: CodeBlock = {
            type: 'code-block',
            content: content
        };

        // Add language if present
        if (language) {
            codeBlock.language = language;
        }

        // Mark as parsed-literal if applicable
        if (isParsedLiteral) {
            codeBlock.parsed = true;
        }

        // Add options if present
        if (Object.keys(options).length > 0) {
            codeBlock.options = options;
        }

        return codeBlock;
    }

    private dedent(lines: string[]): string[] {
        if (lines.length === 0) return [];

        // Find minimum indentation (ignoring empty lines)
        let minIndent = Infinity;
        for (const line of lines) {
            if (line.trim() !== '') {
                const indent = this.getIndentation(line);
                if (indent < minIndent) minIndent = indent;
            }
        }

        if (minIndent === Infinity || minIndent === 0) return lines;

        // Dedent all lines by the minimum amount
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
