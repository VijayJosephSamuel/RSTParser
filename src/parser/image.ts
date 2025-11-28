import { ParserState } from './state';
import { BlockParser } from './block';
import { Node, Image, Figure } from '../ast/types';

/**
 * Parses image and figure directives
 * 
 * Image directive:
 * .. image:: /path/to/image.png
 *    :alt: Alternative text
 *    :width: 200px or 50%
 *    :height: 250px
 *    :scale: 150%
 *    :align: left|center|right
 * 
 * Figure directive (similar to image but can have caption and legend):
 * .. figure:: /path/to/image.png
 *    :alt: Alternative text
 *    :width: 200px or 50%
 *    :height: 250px
 *    :scale: 150%
 *    :align: left|center|right
 * 
 *    This is the caption of the figure.
 *    
 *    This is the legend.
 */
export class ImageParser {
    private state: ParserState;
    private blockParser: BlockParser;

    constructor(state: ParserState, blockParser: BlockParser) {
        this.state = state;
        this.blockParser = blockParser;
    }

    /**
     * Parses an image or figure directive
     * Returns an Image or Figure node or null
     */
    public parse(): Image | Figure | null {
        const line = this.state.peekLine();
        if (!line) return null;

        const imageMatch = line.match(/^\s*\.\.\s+image::(.+)$/);
        const figureMatch = line.match(/^\s*\.\.\s+figure::(.+)$/);

        if (!imageMatch && !figureMatch) return null;

        const isImage = !!imageMatch;
        const match = imageMatch || figureMatch;
        const uri = match![1].trim();

        this.state.consumeLine(); // Consume the directive line
        const directiveIndent = this.state.getIndentation(line);

        // Parse options
        const options: Record<string, string> = {};
        const extractedOptions: Record<string, string> = {};

        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (!nextLine) break;

            const optionMatch = nextLine.match(/^\s+:([a-zA-Z0-9-_]+):\s*(.*)$/);
            if (optionMatch) {
                const optionName = optionMatch[1];
                const optionValue = optionMatch[2].trim();
                options[optionName] = optionValue;
                extractedOptions[optionName] = optionValue;
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // For figures, collect caption and legend from body
        if (!isImage) {
            return this.parseFigure(uri, extractedOptions, directiveIndent);
        }

        // For images, just return the image node
        const image: Image = {
            type: 'image',
            uri: uri
        };

        // Add optional properties if present
        if (extractedOptions['alt']) image.alt = extractedOptions['alt'];
        if (extractedOptions['width']) image.width = extractedOptions['width'];
        if (extractedOptions['height']) image.height = extractedOptions['height'];
        if (extractedOptions['scale']) image.scale = extractedOptions['scale'];
        if (extractedOptions['align']) image.align = extractedOptions['align'] as 'left' | 'center' | 'right';

        if (Object.keys(options).length > 0) {
            image.options = options;
        }

        return image;
    }

    /**
     * Parses figure directive with caption and legend
     */
    private parseFigure(uri: string, options: Record<string, string>, directiveIndent: number): Figure | null {
        // Skip empty lines before caption/legend
        while (this.state.hasMoreLines()) {
            const nextLine = this.state.peekLine();
            if (nextLine && nextLine.trim() === '') {
                this.state.consumeLine();
            } else {
                break;
            }
        }

        // Collect body lines (caption and legend)
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

        // Parse caption and legend
        let caption: string | undefined;
        let legend: string | undefined;

        if (bodyLines.length > 0) {
            const cleanedLines = this.dedent(bodyLines);
            
            // Remove leading and trailing empty lines
            let contentStart = 0;
            while (contentStart < cleanedLines.length && cleanedLines[contentStart].trim() === '') {
                contentStart++;
            }
            let contentEnd = cleanedLines.length - 1;
            while (contentEnd >= contentStart && cleanedLines[contentEnd].trim() === '') {
                contentEnd--;
            }
            
            if (contentStart <= contentEnd) {
                const contentLines = cleanedLines.slice(contentStart, contentEnd + 1);
                
                // Split by blank line to separate caption and legend
                let captionLines: string[] = [];
                let legendLines: string[] = [];
                let foundBlank = false;

                for (const line of contentLines) {
                    if (line.trim() === '') {
                        foundBlank = true;
                    } else if (!foundBlank) {
                        captionLines.push(line);
                    } else {
                        legendLines.push(line);
                    }
                }

                // Join multiline captions properly
                caption = captionLines.map(l => l.trim()).filter(l => l).join(' ').trim();
                if (caption === '') caption = undefined;

                legend = legendLines.map(l => l.trim()).filter(l => l).join(' ').trim();
                if (legend === '') legend = undefined;
            }
        }

        const figure: Figure = {
            type: 'figure',
            uri: uri
        };

        // Add optional properties if present
        if (options['alt']) figure.alt = options['alt'];
        if (options['width']) figure.width = options['width'];
        if (options['height']) figure.height = options['height'];
        if (options['scale']) figure.scale = options['scale'];
        if (options['align']) figure.align = options['align'] as 'left' | 'center' | 'right';
        if (caption) figure.caption = caption;
        if (legend) figure.legend = legend;

        if (Object.keys(options).length > 0) {
            figure.options = options;
        }

        return figure;
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
