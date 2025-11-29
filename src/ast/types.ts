export interface Node {
    type: string;
    children?: Node[];
    [key: string]: any;
}

export interface Document extends Node {
    type: 'document';
    children: Node[];
}

export interface Section extends Node {
    type: 'section';
    title: string;
    level: number;
    children: Node[];
}

export interface Paragraph extends Node {
    type: 'paragraph';
    children: Node[]; // Inline nodes (text, strong, emphasis)
}

export interface Text extends Node {
    type: 'text';
    value: string;
}

export interface Directive extends Node {
    type: 'directive';
    name: string;
    args: string[];
    options: Record<string, string>;
    body: Node[];
}

export interface List extends Node {
    type: 'list' | 'definition_list';
    ordered: boolean;
    children: ListItem[];
}

export interface ListItem extends Node {
    type: 'list_item' | 'definition_list_item';
    children: Node[];
}

export interface LiteralBlock extends Node {
    type: 'literal_block';
    language?: string;
    value: string;
}

export interface Table extends Node {
    type: 'table';
    rows: TableRow[];
    header_rows?: number;
    stub_columns?: number;
    options?: Record<string, string>;
}

export interface TableRow extends Node {
    type: 'table_row';
    cells: TableCell[];
}

export interface TableCell extends Node {
    type: 'table_cell';
    children: Node[];
    cspan?: number;
    rspan?: number;
}

export interface Tabs extends Node {
    type: 'tabs';
    children: Tab[];
}

export interface Tab extends Node {
    type: 'tab';
    title: string;
    group?: string;  // For group-tab directive
    language?: string;  // For code-tab directive
    children: Node[];
}

export interface Admonition extends Node {
    type: 'admonition';
    kind: 'note' | 'attention' | 'caution' | 'danger' | 'error' | 'hint' | 'important' | 'tip' | 'warning';
    children: Node[];
    options?: Record<string, string>;
}

export interface Container extends Node {
    type: 'container';
    classes: string[]; // Can have multiple classes like 'tagrightalign text-decoration-underline'
    children: Node[];
    options?: Record<string, string>;
}

export interface Image extends Node {
    type: 'image';
    uri: string; // The image file path
    alt?: string; // Alternative text
    width?: string; // Width as percentage or pixel value
    height?: string; // Height as pixel value or percentage
    scale?: string; // Scaling factor
    align?: 'left' | 'center' | 'right'; // Alignment
    options?: Record<string, string>; // Other options
}

export interface Figure extends Node {
    type: 'figure';
    uri: string; // The image file path
    alt?: string; // Alternative text
    width?: string; // Width as percentage or pixel value
    height?: string; // Height as pixel value or percentage
    scale?: string; // Scaling factor
    align?: 'left' | 'center' | 'right'; // Alignment
    caption?: string; // Figure caption
    legend?: string; // Figure legend
    children?: Node[]; // Additional content
    options?: Record<string, string>; // Other options
}

export interface Card extends Node {
    type: 'card';
    title?: string; // Card title (optional, from directive argument)
    children: Node[]; // Card content
    options?: Record<string, string>; // Card options (class-card, link, etc.)
}

export interface Heading extends Node {
    type: 'heading';
    level: 1 | 2 | 3 | 4 | 5 | 6; // Heading level
    title: string; // Heading text
}
