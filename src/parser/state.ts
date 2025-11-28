export class ParserState {
    private lines: string[];
    private currentLineIndex: number;

    constructor(input: string) {
        this.lines = input.split(/\r?\n/);
        this.currentLineIndex = 0;
    }

    public hasMoreLines(): boolean {
        return this.currentLineIndex < this.lines.length;
    }

    public peekLine(offset: number = 0): string | null {
        if (this.currentLineIndex + offset >= this.lines.length) {
            return null;
        }
        return this.lines[this.currentLineIndex + offset];
    }

    public consumeLine(): string | null {
        if (!this.hasMoreLines()) {
            return null;
        }
        const line = this.lines[this.currentLineIndex];
        this.currentLineIndex++;
        return line;
    }

    public getIndentation(line: string): number {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    public getCurrentLineIndex(): number {
        return this.currentLineIndex;
    }
}
