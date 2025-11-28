import { ParserState } from './state';
import { List, ListItem, Node } from '../ast/types';
import { BlockParser } from './block';

export class ListParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    public parse(): List | null {
        const line = this.state.peekLine();
        if (!line) return null;

        // Check for list start
        const bulletMatch = this.matchBullet(line);
        if (!bulletMatch) return null;

        const isOrdered = bulletMatch.isOrdered;
        const bulletChar = bulletMatch.bullet;
        const indentation = this.state.getIndentation(line);

        const listItems: ListItem[] = [];

        while (this.state.hasMoreLines()) {
            const currentLine = this.state.peekLine();
            if (!currentLine) break;

            // Check if it's a new list item of the same type
            const match = this.matchBullet(currentLine);
            if (match && match.isOrdered === isOrdered && this.state.getIndentation(currentLine) === indentation) {
                // If it's an ordered list, we might want to check if the enumerator follows sequence, 
                // but RST is flexible (auto-enumerator #.).
                // For unordered, check if bullet matches (usually required to be consistent in a block).
                // RST requires consistent bullets for the same list.
                if (!isOrdered && match.bullet !== bulletChar) {
                    break; // Different bullet type starts a new list or block
                }

                listItems.push(this.parseListItem(indentation));
            } else {
                break; // End of list
            }
        }

        return {
            type: 'list',
            ordered: isOrdered,
            children: listItems,
        };
    }

    private matchBullet(line: string): { isOrdered: boolean, bullet: string } | null {
        const trimmed = line.trim();

        // Unordered: * + - • ‣ ⁃ followed by space
        const unorderedMatch = trimmed.match(/^([*+\-•‣⁃])\s+/);
        if (unorderedMatch) {
            return { isOrdered: false, bullet: unorderedMatch[1] };
        }

        // Ordered: 1. a. A. I. i. #. followed by space
        // Also (1) or 1) but doc only showed 1. #. a.
        // Let's stick to the doc: "enumerated character followed by a period"
        const orderedMatch = trimmed.match(/^([0-9]+|[a-zA-Z]|[#])\.\s+/);
        if (orderedMatch) {
            return { isOrdered: true, bullet: orderedMatch[1] };
        }

        return null;
    }

    private parseListItem(listIndentation: number): ListItem {
        const line = this.state.consumeLine()!; // Consume the bullet line
        const contentLines: string[] = [];

        // The first line content (after bullet)
        // We need to handle the text after the bullet.
        // The indentation for the body is determined by the first non-whitespace char after bullet?
        // Or just strictly indented relative to the bullet?
        // RST: "Start each list character at the beginning of the line."
        // "Add a space between the end character of a list and the text in the list."
        // "Add a blank line before and after a list and regular text." (We handle blank lines in BlockParser)

        // We need to capture the text on the same line as bullet, and subsequent indented lines.

        // Extract text from first line
        // We know it matched, so we can strip the bullet.
        // But we need to be careful about the indentation of the *content*.
        // Example:
        // - Item 1
        //   Continued

        // The content indentation is the column where "Item 1" starts.
        // But wait, "Item 1" might be empty? No, usually not.

        // Let's treat the first line text as part of the body.
        // But for recursive parsing, we need to pass a clean block of text.
        // This is tricky because the first line has the bullet.

        // Strategy:
        // 1. Construct a virtual block of text where the first line is replaced by spaces + text?
        //    Or just extract the text and treat it as the first paragraph?
        //    But what if it contains a directive?
        //    "- .. image:: foo.png" -> valid? Yes.

        // Better Strategy:
        // Calculate the "content indentation".
        // For the first line, it's where the text starts.
        // For subsequent lines, they must be indented to at least that level (or just > listIndentation?)
        // RST says: "The text of a list item must be indented relative to the bullet."

        // Calculate content indentation carefully
        const originalIndent = this.state.getIndentation(line);
        const trimmed = line.trim();
        let bulletPart = '';

        const orderedMatch = trimmed.match(/^([0-9]+|[a-zA-Z]|[#])\.\s+/);
        const unorderedMatch = trimmed.match(/^([*+\-•‣⁃])\s+/);

        if (orderedMatch) {
            bulletPart = orderedMatch[0];
        } else if (unorderedMatch) {
            bulletPart = unorderedMatch[0];
        } else {
            // Should not happen if matchBullet passed
            throw new Error('Invalid list item: ' + line);
        }

        const contentIndent = originalIndent + bulletPart.length;

        // First line content (stripped of bullet)
        // We replace the bullet with spaces to preserve relative indentation for the first line?
        // No, we should dedent everything to 0 relative to contentIndent.

        const firstLineContent = line.substring(contentIndent);
        contentLines.push(firstLineContent);

        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine === null) break;

            if (nextLine.trim() === '') {
                contentLines.push('');
                this.state.consumeLine();
                continue;
            }

            const nextIndent = this.state.getIndentation(nextLine);
            if (nextIndent >= contentIndent) {
                // It's part of the item
                // We need to remove the indentation
                contentLines.push(nextLine.substring(contentIndent)); // Approximate dedent
                this.state.consumeLine();
            } else {
                // End of item
                break;
            }
        }

        // Recursively parse the content
        const bodyText = contentLines.join('\n');
        const subState = new ParserState(bodyText);
        // We need a new BlockParser. 
        // Note: We are creating a circular dependency if we import BlockParser in ListParser and vice versa.
        // But we passed BlockParser instance in constructor? 
        // No, we need a *new* BlockParser for the sub-state.
        // We can instantiate it.
        const subParser = new BlockParser(subState);
        const subDoc = subParser.parse();

        return {
            type: 'list_item',
            children: subDoc.children,
        };
    }
}
