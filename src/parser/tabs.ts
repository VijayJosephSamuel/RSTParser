import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Tabs, Tab, LiteralBlock } from '../ast/types';

/**
 * Parses tabs directives including:
 * - .. tabs:: - Container for tabs
 * - .. tab:: Title - Regular tab
 * - .. group-tab:: Title - Grouped tab (syncs across page)
 * - .. code-tab:: language [Title] - Code tab with syntax highlighting
 */
export class TabsParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Parses a tabs directive if the current line matches .. tabs::
     * Returns a Tabs node or null.
     */
    public parse(): Tabs | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const match = line.match(/^\s*\.\.\s+tabs::(.*)$/);
        if (!match) return null;

        this.state.consumeLine();
        const directiveIndent = this.state.getIndentation(line);

        // Skip empty lines
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine && nextLine.trim() === '') {
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Collect all body lines
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

        // Parse tabs from body
        const tabs = this.parseTabsFromBody(bodyLines);

        return {
            type: 'tabs',
            children: tabs
        };
    }

    /**
     * Parses individual tab directives from the body lines
     */
    private parseTabsFromBody(lines: string[]): Tab[] {
        const tabs: Tab[] = [];
        const dedentedLines = this.dedent(lines);
        
        let i = 0;
        while (i < dedentedLines.length) {
            const line = dedentedLines[i];
            
            // Skip empty lines
            if (line.trim() === '') {
                i++;
                continue;
            }

            // Check for tab directive
            const tabMatch = line.match(/^\s*\.\.\s+(tab|group-tab|code-tab)::(.*)$/);
            if (tabMatch) {
                const tabType = tabMatch[1];
                const tabArgs = tabMatch[2].trim();
                const tabIndent = this.getIndentation(line);
                
                i++; // Move past the tab directive line

                // Collect tab body lines
                const tabBodyLines: string[] = [];
                while (i < dedentedLines.length) {
                    const bodyLine = dedentedLines[i];
                    
                    if (bodyLine.trim() === '') {
                        tabBodyLines.push(bodyLine);
                        i++;
                        continue;
                    }

                    const bodyIndent = this.getIndentation(bodyLine);
                    
                    // Check if this is a new tab directive at the same or lower level
                    const newTabMatch = bodyLine.match(/^\s*\.\.\s+(tab|group-tab|code-tab)::(.*)$/);
                    if (newTabMatch && bodyIndent <= tabIndent) {
                        break;
                    }

                    if (bodyIndent > tabIndent) {
                        tabBodyLines.push(bodyLine);
                        i++;
                    } else {
                        break;
                    }
                }

                // Create the tab
                const tab = this.createTab(tabType, tabArgs, tabBodyLines);
                tabs.push(tab);
            } else {
                i++;
            }
        }

        return tabs;
    }

    /**
     * Creates a Tab node from the parsed information
     */
    private createTab(tabType: string, args: string, bodyLines: string[]): Tab {
        const dedentedBody = this.dedent(bodyLines);
        const bodyText = dedentedBody.join('\n');

        let title = args;
        let group: string | undefined;
        let language: string | undefined;
        let children: Node[] = [];

        if (tabType === 'group-tab') {
            title = args;
            group = args; // Group name is the same as title for group-tab
        } else if (tabType === 'code-tab') {
            // code-tab format: .. code-tab:: language [Title]
            const parts = args.split(/\s+/);
            language = parts[0];
            title = parts.slice(1).join(' ') || this.getLanguageDisplayName(language);
        }

        if (tabType === 'code-tab') {
            // For code-tab, the body is a code block
            children = [{
                type: 'literal_block',
                language: language,
                value: bodyText.trim()
            } as LiteralBlock];
        } else if (bodyText.trim()) {
            // Parse body as regular content
            const subState = new ParserState(bodyText);
            const subParser = new BlockParser(subState);
            const subDoc = subParser.parse();
            children = subDoc.children;
        }

        const tab: Tab = {
            type: 'tab',
            title,
            children
        };

        if (group) {
            tab.group = group;
        }

        if (language) {
            tab.language = language;
        }

        return tab;
    }

    /**
     * Gets a display name for a programming language
     */
    private getLanguageDisplayName(lang: string): string {
        const displayNames: Record<string, string> = {
            'c': 'C',
            'c++': 'C++',
            'cpp': 'C++',
            'py': 'Python',
            'python': 'Python',
            'java': 'Java',
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'ts': 'TypeScript',
            'typescript': 'TypeScript',
            'julia': 'Julia',
            'fortran': 'Fortran',
            'r': 'R',
            'ruby': 'Ruby',
            'go': 'Go',
            'rust': 'Rust',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'scala': 'Scala',
            'bash': 'Bash',
            'sh': 'Shell',
            'shell': 'Shell',
            'sql': 'SQL',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'yaml': 'YAML',
            'xml': 'XML'
        };
        return displayNames[lang.toLowerCase()] || lang;
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
