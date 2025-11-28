import { ParserState } from './state';
import { List, ListItem, Node, Paragraph, Text } from '../ast/types';
import { BlockParser } from './block';

export class DefinitionListParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    public parse(): List | null {
        const line = this.state.peekLine();
        if (!line) return null;

        // Definition list:
        // Term
        //    Definition

        // The term is a single line (usually).
        // The definition is indented relative to the term.
        // There must be no blank line between term and definition? 
        // RST: "Definition lists: The term is a one-line phrase, and the definition is one or more paragraphs or body elements, indented relative to the term. Blank lines are not allowed between term and definition."

        // We need to check if the NEXT line is indented.
        const nextLine = this.state.peekLine(1);
        if (!nextLine) return null;

        const currentIndent = this.state.getIndentation(line);
        const nextIndent = this.state.getIndentation(nextLine);

        if (nextIndent <= currentIndent || nextLine.trim() === '') {
            return null; // Not a definition list (or at least not the start of one)
        }

        // Also, the term line should not be a bullet list or directive or section.
        // This is hard to guarantee without checking everything else.
        // But since DefinitionListParser is called from BlockParser, we can assume other parsers failed?
        // BlockParser order matters.
        // If we put DefinitionListParser AFTER ListParser and DirectiveParser, we are safer.
        // But "Term" could look like a paragraph.
        // The distinguishing feature is the indented next line.

        const items: ListItem[] = [];

        while (this.state.hasMoreLines()) {
            const termLine = this.state.peekLine();
            if (!termLine) break;

            if (termLine.trim() === '') {
                this.state.consumeLine();
                continue;
            }

            // Check if it's a term
            // A term must be followed by an indented block.
            const defLine = this.state.peekLine(1);
            if (!defLine) break;

            const termIndent = this.state.getIndentation(termLine);
            const defIndent = this.state.getIndentation(defLine);

            if (defIndent <= termIndent || defLine.trim() === '') {
                // Not a definition item.
                // If we are already parsing a list, this ends the list.
                break;
            }

            // Parse Term
            this.state.consumeLine(); // Consume term
            const termNode: Text = { type: 'text', value: termLine.trim() };

            // Parse Definition
            // We need to capture the indented block.
            const defLines: string[] = [];
            while (this.state.hasMoreLines()) {
                const l = this.state.peekLine();
                if (!l) break;

                if (l.trim() === '') {
                    defLines.push('');
                    this.state.consumeLine();
                    continue;
                }

                if (this.state.getIndentation(l) >= defIndent) {
                    defLines.push(l.substring(defIndent)); // Dedent
                    this.state.consumeLine();
                } else {
                    break;
                }
            }

            // Recursively parse definition body
            const bodyText = defLines.join('\n');
            const subState = new ParserState(bodyText);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();

            // Construct Definition Item
            // In HTML, DL -> DT (term) + DD (definition).
            // In our AST, we can use a specific structure or generic List/ListItem.
            // Let's use a generic structure but maybe with a specific type?
            // The user didn't specify AST for definition lists.
            // Let's use a 'definition_list' type if possible, or just 'list' with a flag?
            // Let's stick to the existing AST types if possible, or extend them.
            // Existing AST has `List` and `ListItem`.
            // Let's extend `ListItem` to have `term`? Or just put term as first child?
            // RST AST usually has `definition_list` -> `definition_list_item` -> `term`, `definition`.

            // Let's assume we can add `term` to ListItem or use a custom node.
            // For now, let's represent it as:
            // ListItem
            //   - Term (Paragraph/Text)
            //   - Definition (Block)

            const itemChildren: Node[] = [
                { type: 'term', children: [termNode] },
                { type: 'definition', children: subDoc.children }
            ];

            items.push({
                type: 'definition_list_item',
                children: itemChildren
            });
        }

        return {
            type: 'definition_list',
            ordered: false,
            children: items
        };
    }
}
