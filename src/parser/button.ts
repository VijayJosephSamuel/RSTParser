import { ParserState } from './state';
import { ButtonLink, ButtonRef } from '../ast/types';

/**
 * Parses button directives for RST
 * 
 * Two button types supported:
 * 
 * 1. button-link: Creates a stylized button with an external link
 *    .. button-link:: https://example.com
 *       :class: link-button
 *       Button text content
 * 
 * 2. button-ref: Creates a stylized button with an internal reference
 *    .. button-ref:: example-section
 *       :class: ref-button
 *       Button text content
 * 
 * Features:
 * - Optional :class: option for styling (link-button, ref-button, button-bg-fill, etc.)
 * - Text content can include inline formatting like :octicon:`arrow-right;1em;`
 * - Supports solid background styling with button-bg-fill class
 */
export class ButtonParser {
    private state: ParserState;

    constructor(state: ParserState) {
        this.state = state;
    }

    /**
     * Attempts to parse a button directive
     * Returns ButtonLink, ButtonRef, or null
     */
    public parse(): ButtonLink | ButtonRef | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const buttonLinkMatch = line.match(/^\s*\.\.\s+button-link::\s*(.+)$/);
        const buttonRefMatch = line.match(/^\s*\.\.\s+button-ref::\s*(.+)$/);

        if (!buttonLinkMatch && !buttonRefMatch) return null;

        const isButtonLink = !!buttonLinkMatch;
        const match = buttonLinkMatch || buttonRefMatch;
        const targetValue = match![1].trim(); // URL for button-link, ref for button-ref

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Parse options
        const options: Record<string, string> = {};
        let buttonClass: string | undefined;

        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;

            const optionMatch = nextLine.match(/^\s+:([a-zA-Z0-9-_]+):\s*(.*)$/);
            if (optionMatch) {
                const optionName = optionMatch[1];
                const optionValue = optionMatch[2].trim();
                options[optionName] = optionValue;

                if (optionName === 'class') {
                    buttonClass = optionValue;
                }

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

        // Collect body lines (button text content)
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

        // Dedent and join body lines to get button text
        const cleanedBodyLines = this.dedent(bodyLines);
        const buttonText = cleanedBodyLines.join(' ').trim();

        if (isButtonLink) {
            const button: ButtonLink = {
                type: 'button-link',
                url: targetValue,
                text: buttonText
            };

            if (buttonClass) {
                button.class = buttonClass;
            }

            if (Object.keys(options).length > 0) {
                button.options = options;
            }

            return button;
        } else {
            const button: ButtonRef = {
                type: 'button-ref',
                ref: targetValue,
                text: buttonText
            };

            if (buttonClass) {
                button.class = buttonClass;
            }

            if (Object.keys(options).length > 0) {
                button.options = options;
            }

            return button;
        }
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
