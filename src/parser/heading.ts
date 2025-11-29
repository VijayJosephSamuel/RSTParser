import { ParserState } from './state';
import { Heading } from '../ast/types';

/**
 * Parses reStructuredText headings
 * 
 * RST supports 6 heading levels:
 * Level 1: # with overline and underline
 * Level 2: * with overline and underline
 * Level 3: = underline only
 * Level 4: - underline only
 * Level 5: ^ underline only
 * Level 6: " underline only
 * 
 * Rules:
 * - Underlines must be at least as long as the heading text
 * - Levels 1-2 require both overline and underline
 * - Levels 3-6 require only underline
 * - There must be a blank line before the next content
 * 
 * Examples:
 * #######
 * Level 1
 * #######
 * 
 * *******
 * Level 2
 * *******
 * 
 * Level 3
 * =======
 * 
 * Level 4
 * -------
 */
export class HeadingParser {
    private state: ParserState;

    constructor(state: ParserState) {
        this.state = state;
    }

    /**
     * Character mappings for each heading level
     * Maps character to heading level
     */
    private static readonly OVERLINE_CHARS: Record<string, number> = {
        '#': 1,
        '*': 2
    };

    private static readonly UNDERLINE_CHARS: Record<string, number> = {
        '=': 3,
        '-': 4,
        '^': 5,
        '"': 6,
        '#': 1,
        '*': 2
    };

    /**
     * Checks if a line is an underline for a heading
     */
    private isUnderline(line: string): { char: string; length: number } | null {
        const trimmed = line.trim();
        if (trimmed.length < 1) return null;

        const char = trimmed[0];
        if (!Object.prototype.hasOwnProperty.call(HeadingParser.UNDERLINE_CHARS, char)) {
            return null;
        }

        // Check if all characters are the same
        for (let i = 1; i < trimmed.length; i++) {
            if (trimmed[i] !== char) {
                return null;
            }
        }

        return { char, length: trimmed.length };
    }

    /**
     * Checks if a line is an overline for a heading
     */
    private isOverline(line: string): { char: string; level: number } | null {
        const result = this.isUnderline(line);
        if (!result) return null;

        const level = HeadingParser.OVERLINE_CHARS[result.char];
        if (level === undefined) return null;

        return { char: result.char, level };
    }

    /**
     * Attempts to parse a heading
     * Returns a Heading node or null
     */
    public parse(): Heading | null {
        const currentLine = this.state.peekLine();
        if (!currentLine) return null;

        const nextLine = this.state.peekLine(1);
        if (!nextLine) return null;

        // Check for level 1-2 headings with overline
        const overlineResult = this.isOverline(currentLine);
        if (overlineResult) {
            const titleLine = this.state.peekLine(1);
            const underlineLine = this.state.peekLine(2);

            if (!titleLine || !underlineLine) return null;

            const underlineResult = this.isUnderline(underlineLine);
            if (!underlineResult) return null;

            // Both lines must use the same character
            if (overlineResult.char !== underlineResult.char) return null;

            // Underline must be at least as long as the title
            const titleLength = titleLine.trim().length;
            if (underlineResult.length < titleLength) return null;

            // Consume all three lines
            this.state.consumeLine(); // overline
            this.state.consumeLine(); // title
            this.state.consumeLine(); // underline

            // Skip blank line after heading if present
            while (this.state.hasMoreLines()) {
                const nextLine = this.state.peekLine();
                if (nextLine && nextLine.trim() === '') {
                    this.state.consumeLine();
                } else {
                    break;
                }
            }

            return {
                type: 'heading',
                level: overlineResult.level as 1 | 2,
                title: titleLine.trim()
            };
        }

        // Check for level 3-6 headings (underline only)
        const underlineResult = this.isUnderline(nextLine);
        if (underlineResult) {
            // Underline must be at least as long as the heading
            const currentLength = currentLine.trim().length;
            if (underlineResult.length < currentLength) return null;

            // Get the level from the underline character
            const level = HeadingParser.UNDERLINE_CHARS[underlineResult.char];
            if (level === undefined || level < 3) return null; // Only 3-6 for underline-only

            // Consume both lines
            this.state.consumeLine(); // heading text
            this.state.consumeLine(); // underline

            // Skip blank line after heading if present
            while (this.state.hasMoreLines()) {
                const nextLine = this.state.peekLine();
                if (nextLine && nextLine.trim() === '') {
                    this.state.consumeLine();
                } else {
                    break;
                }
            }

            return {
                type: 'heading',
                level: level as 3 | 4 | 5 | 6,
                title: currentLine.trim()
            };
        }

        return null;
    }
}
