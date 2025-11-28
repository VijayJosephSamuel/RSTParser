import { Node, Text } from '../ast/types';

export class InlineParser {
    public parse(text: string): Node[] {
        // TODO: Implement full inline parsing (bold, italic, etc.)
        // For now, just return a single text node
        const textNode: Text = {
            type: 'text',
            value: text,
        };
        return [textNode];
    }
}
