import { ParserState } from './parser/state';
import { BlockParser } from './parser/block';
import { Document } from './ast/types';

export function parse(input: string): Document {
    const state = new ParserState(input);
    const parser = new BlockParser(state);
    return parser.parse();
}

// Export types
export * from './ast/types';
