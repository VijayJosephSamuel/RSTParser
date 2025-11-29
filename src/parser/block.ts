import { ParserState } from './state';
import { TableDirectiveParser } from './table-directive';
import { GridTableParser } from './grid-table';
import { InlineParser } from './inline';
import { DirectiveParser } from './directives';
import { ListParser } from './list';
import { DefinitionListParser } from './definition-list';
import { TabsParser } from './tabs';
import { AdmonitionParser } from './admonition';
import { ContainerParser } from './container';
import { ImageParser } from './image';
import { CardParser } from './card';
import { HeadingParser } from './heading';
import { ButtonParser } from './button';
import { CodeBlockParser } from './code-block';
import { DropdownParser } from './dropdown';
import { GridParser } from './grid';
import { Node, Document, Section, Paragraph } from '../ast/types';

export class BlockParser {
    private state: ParserState;
    private inlineParser: InlineParser;
    private directiveParser: DirectiveParser;
    private listParser: ListParser;
    private tableDirectiveParser: TableDirectiveParser;
    private gridTableParser: GridTableParser;
    private definitionListParser: DefinitionListParser;
    private tabsParser: TabsParser;
    private admonitionParser: AdmonitionParser;
    private containerParser: ContainerParser;
    private imageParser: ImageParser;
    private cardParser: CardParser;
    private headingParser: HeadingParser;
    private buttonParser: ButtonParser;
    private codeBlockParser: CodeBlockParser;
    private dropdownParser: DropdownParser;
    private gridParser: GridParser;

    constructor(state: ParserState) {
        this.state = state;
        this.inlineParser = new InlineParser();
        this.directiveParser = new DirectiveParser(state, this);
        this.listParser = new ListParser(state, this);
        this.tableDirectiveParser = new TableDirectiveParser(state, this);
        this.gridTableParser = new GridTableParser(state, this);
        this.definitionListParser = new DefinitionListParser(state, this);
        this.tabsParser = new TabsParser(state, this);
        this.admonitionParser = new AdmonitionParser(state, this);
        this.containerParser = new ContainerParser(state, this);
        this.imageParser = new ImageParser(state, this);
        this.cardParser = new CardParser(state, this);
        this.headingParser = new HeadingParser(state);
        this.buttonParser = new ButtonParser(state);
        this.codeBlockParser = new CodeBlockParser(state);
        this.dropdownParser = new DropdownParser(state, this);
        this.gridParser = new GridParser(state, this);
    }

    public parse(): Document {
        const document: Document = {
            type: 'document',
            children: [],
        };

        while (this.state.hasMoreLines()) {
            const block = this.parseBlock();
            if (block) {
                document.children.push(block);
            }
        }

        return document;
    }

    public parseBlock(): Node | null {
        const line = this.state.peekLine();
        if (line === null) return null;

        // Skip empty lines
        if (line.trim() === '') {
            this.state.consumeLine();
            return null;
        }

        // Check for Headings first (they have specific structure)
        const heading = this.headingParser.parse();
        if (heading) {
            return heading;
        }

        // Check for Buttons
        const button = this.buttonParser.parse();
        if (button) {
            return button;
        }

        // Check for Code Blocks
        const codeBlock = this.codeBlockParser.parse();
        if (codeBlock) {
            return codeBlock;
        }

        // Check for Grids
        const grid = this.gridParser.parse();
        if (grid) {
            return grid;
        }

        // Check for Dropdowns
        const dropdown = this.dropdownParser.parse();
        if (dropdown) {
            return dropdown;
        }

        // Check for Cards
        const card = this.cardParser.parse();
        if (card) {
            return card;
        }

        // Check for Images and Figures
        const image = this.imageParser.parse();
        if (image) {
            return image;
        }

        // Check for Containers first (generic containers before specific directives)
        const container = this.containerParser.parse();
        if (container) {
            return container;
        }

        // Check for Admonitions first (note, warning, etc.)
        const admonition = this.admonitionParser.parse();
        if (admonition) {
            return admonition;
        }

        // Check for Tabs Directive
        const tabs = this.tabsParser.parse();
        if (tabs) {
            return tabs;
        }

        // Check for Directive
        const directive = this.directiveParser.parse();
        if (directive) {
            return directive;
        }

        // Check for Table Directive (list-table, flat-table, csv-table)
        const tableDirective = this.tableDirectiveParser.parse();
        if (tableDirective) {
            return tableDirective;
        }

        // Check for Grid Table first
        const gridTable = this.gridTableParser.parse();
        if (gridTable) {
            return gridTable;
        }
        // Check for List
        const list = this.listParser.parse();
        if (list) {
            return list;
        }

        // Check for Definition List
        const defList = this.definitionListParser.parse();
        if (defList) {
            return defList;
        }

        // Check for Section (Title followed by underline)
        const nextLine = this.state.peekLine(1);
        if (nextLine && this.isSectionUnderline(nextLine) && nextLine.trim().length >= line.trim().length) {
            return this.parseSection();
        }

        // Default to Paragraph (may return null if no content)
        return this.parseParagraph();
    }

    private isSectionUnderline(line: string): boolean {
        const trimmed = line.trim();
        if (trimmed.length < 2) return false;
        const char = trimmed[0];
        // Common RST underline characters
        const validChars = new Set(['=', '-', '`', ':', "'", '"', '~', '^', '_', '*', '+', '#', '<', '>']);
        if (!validChars.has(char)) return false;

        // Check if the whole line consists of the same character
        for (let i = 1; i < trimmed.length; i++) {
            if (trimmed[i] !== char) return false;
        }
        return true;
    }

    private parseSection(): Section {
        const titleLine = this.state.consumeLine()!;
        const underlineLine = this.state.consumeLine()!;

        const title = titleLine.trim();
        let level = 1;
        if (underlineLine.trim().startsWith('-')) level = 2;

        return {
            type: 'section',
            title: title,
            level: level,
            children: [],
        };
    }

    private parseParagraph(): Paragraph | null {
        const lines: string[] = [];
        while (this.state.hasMoreLines()) {
            const line = this.state.peekLine();
            if (line === null || line.trim() === '') {
                break;
            }

            // Check if we hit a section start (lookahead)
            const nextLine = this.state.peekLine(1);
            if (nextLine && this.isSectionUnderline(nextLine)) {
                break;
            }

            // Check if we hit a directive (lookahead)
            // Directives start with ".. "
            if (line.trim().startsWith('.. ')) {
                // It might be a comment or a directive.
                // For now, assume directive if it matches the pattern in DirectiveParser.
                // But DirectiveParser consumes the line.
                // If we are in a paragraph, we should break if we see a directive?
                // Yes, a directive starts a new block.
                break;
            }

            // Check if we hit a list item (lookahead)
            // We need to check if the line matches a bullet pattern.
            // But we can't easily access ListParser's matchBullet from here without exposing it or duplicating logic.
            // Let's duplicate the regex for now or expose a static method.
            // Unordered: * + - • ‣ ⁃ followed by space
            // Ordered: 1. a. A. I. i. #. followed by space
            const trimmed = line.trim();
            if (trimmed.match(/^([*+\-•‣⁃])\s+/) || trimmed.match(/^([0-9]+|[a-zA-Z]|[#])\.\s+/)) {
                break;
            }

            lines.push(this.state.consumeLine()!.trim());
        }

        // Don't create empty paragraphs
        if (lines.length === 0) {
            return null;
        }

        const text = lines.join(' ');
        return {
            type: 'paragraph',
            children: this.inlineParser.parse(text),
        };
    }
}
