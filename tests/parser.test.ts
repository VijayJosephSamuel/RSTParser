import { parse } from '../src/index';
import { Document, Section, Paragraph, Directive, Table, TableRow, TableCell, Tabs, Tab, LiteralBlock, Admonition, Container, Image, Figure, Card, Heading } from '../src/ast/types';

describe('RST Parser', () => {
    test('parses simple paragraph', () => {
        const input = 'Hello world';
        const result = parse(input);
        expect(result.type).toBe('document');
        expect(result.children).toHaveLength(1);
        expect(result.children[0].type).toBe('paragraph');
        expect((result.children[0] as Paragraph).children[0].value).toBe('Hello world');
    });

    test('parses multiple paragraphs', () => {
        const input = `
Para 1

Para 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        expect((result.children[0] as Paragraph).children[0].value).toBe('Para 1');
        expect((result.children[1] as Paragraph).children[0].value).toBe('Para 2');
    });

    test('parses section', () => {
        const input = `
Title
=====

Content
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        expect(result.children[0].type).toBe('heading');
        expect((result.children[0] as Heading).title).toBe('Title');
        expect((result.children[0] as Heading).level).toBe(3);
        expect(result.children[1].type).toBe('paragraph');
    });

    test('parses nested directives', () => {
        const input = `
.. directive:: arg1
   :option: value

   Body content
   
   .. nested::
      Nested body
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const directive = result.children[0] as Directive;
        expect(directive.type).toBe('directive');
        expect(directive.name).toBe('directive');
        expect(directive.args).toEqual(['arg1']);
        expect(directive.options).toEqual({ option: 'value' });

        expect(directive.body).toHaveLength(2); // Paragraph + Nested Directive
        expect(directive.body[0].type).toBe('paragraph');

        const nested = directive.body[1] as Directive;
        expect(nested.type).toBe('directive');
        expect(nested.name).toBe('nested');
        expect(nested.body).toHaveLength(1);
        expect((nested.body[0] as Paragraph).children[0].value).toBe('Nested body');
    });

    test('parses deep nesting', () => {
        const input = `
.. level1::

   .. level2::
   
      .. level3::
         
         Deep content
`;
        const result = parse(input);
        const l1 = result.children[0] as Directive;
        const l2 = l1.body[0] as Directive;
        const l3 = l2.body[0] as Directive;

        expect(l1.name).toBe('level1');
        expect(l2.name).toBe('level2');
        expect(l3.name).toBe('level3');
        expect((l3.body[0] as Paragraph).children[0].value).toBe('Deep content');
    });

    test('parses unordered list', () => {
        const input = `
- Item 1
- Item 2
  Continued content
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const list = result.children[0] as any;
        expect(list.type).toBe('list');
        expect(list.ordered).toBe(false);
        expect(list.children).toHaveLength(2);
        expect(list.children[0].children[0].children[0].value).toBe('Item 1');
        expect(list.children[1].children[0].children[0].value).toBe('Item 2 Continued content');
    });

    test('parses ordered list', () => {
        const input = `
1. Step 1
2. Step 2
`;
        const result = parse(input);
        expect(result.children[0].type).toBe('list');
        expect((result.children[0] as any).ordered).toBe(true);
    });

    test('parses nested lists', () => {
        const input = `
- Item 1
  - Subitem 1
  - Subitem 2
- Item 2
`;
        const result = parse(input);
        const list = result.children[0] as any;
        expect(list.children[0].children[1].type).toBe('list'); // Nested list
        expect(list.children[0].children[1].children).toHaveLength(2);
    });

    test('parses definition list', () => {
        const input = `
Term 1
   Definition 1
Term 2
   Definition 2
   Continued def
`;
        const result = parse(input);
        expect(result.children[0].type).toBe('definition_list');
        const dl = result.children[0] as any;
        expect(dl.children).toHaveLength(2);
        expect(dl.children[0].children[0].children[0].value).toBe('Term 1');
        expect(dl.children[0].children[1].children[0].children[0].value).toBe('Definition 1');
    });

    test('parses mixed complex nesting', () => {
        const input = `
- List Item 1
  
  .. directive:: arg
     :opt: val
     
     Directive Body Paragraph
     
     - Nested List Item A
     - Nested List Item B
       
       1. Deep Ordered 1
       2. Deep Ordered 2
          
          .. nested-directive::
             Deepest content

- List Item 2
`;
        const result = parse(input);
        const list = result.children[0] as any;
        expect(list.type).toBe('list');
        expect(list.children).toHaveLength(2);

        // Check Directive inside List Item 1
        const item1Body = list.children[0].children;
        // item1Body[0] is the text "List Item 1" (parsed as paragraph or text depending on implementation)
        // Actually, my ListParser puts the first line text in a paragraph?
        // Let's check the structure.
        // ListParser:
        //   firstLineContent -> pushed to contentLines
        //   subParser.parse() -> returns Document
        //   ListItem.children = subDoc.children

        // So "List Item 1" should be a Paragraph.
        expect(item1Body[0].type).toBe('paragraph');
        expect(item1Body[0].children[0].value).toBe('List Item 1');

        // Next should be the Directive
        const directive = item1Body[1] as Directive;
        expect(directive.type).toBe('directive');
        expect(directive.name).toBe('directive');

        // Check Directive Body
        expect(directive.body[0].type).toBe('paragraph');
        expect((directive.body[0] as Paragraph).children[0].value).toBe('Directive Body Paragraph');

        // Check Nested List in Directive
        const nestedList = directive.body[1] as any;
        expect(nestedList.type).toBe('list');
        expect(nestedList.children).toHaveLength(2);

        // Check Deep Ordered List
        const deepList = nestedList.children[1].children[1] as any;
        expect(deepList.type).toBe('list');
        expect(deepList.ordered).toBe(true);

        // Check Deepest Directive
        const deepItem2 = deepList.children[1];
        const deepestDirective = deepItem2.children[1] as Directive;
        expect(deepestDirective.type).toBe('directive');
        expect(deepestDirective.name).toBe('nested-directive');
        expect((deepestDirective.body[0] as Paragraph).children[0].value).toBe('Deepest content');
    });
});

describe('RST Tables', () => {
    const getCellValue = (table: Table, rowIndex: number, cellIndex: number) => {
        const cell = table.rows[rowIndex]?.cells[cellIndex] as TableCell;
        if (!cell || cell.children.length === 0) return '';
        const child = cell.children[0];
        if (child.type === 'text') {
            return child.value;
        }
        if (child.type === 'paragraph' && child.children?.[0]?.type === 'text') {
            return child.children[0].value;
        }
        return '';
    };

    test('parses simple list-table', () => {
        const input = `
.. list-table:: Simple Table
* - a
  - b
* - c
  - d
`;
        const result = parse(input);
        expect(result.children[0].type).toBe('table');
        
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(2);
        expect(table.rows[0].cells).toHaveLength(2);
        
        const getCellValue = (rowIndex: number, cellIndex: number) => {
            return (table.rows[rowIndex]?.cells[cellIndex] as TableCell)?.children[0]?.children?.[0]?.value;
        };
        
        expect(getCellValue(0, 0)).toBe('a');
        expect(getCellValue(0, 1)).toBe('b');
        expect(getCellValue(1, 0)).toBe('c');
        expect(getCellValue(1, 1)).toBe('d');
    });

    test('parses list-table with options', () => {
        const input = `
.. list-table:: Table with Options
  :header-rows: 1
  :stub-columns: 1
  :class: longtable
* - ..
  - head1
  - head2
* - stub1
  - col11
  - col12
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.header_rows).toBe(1);
        expect(table.stub_columns).toBe(1);
        expect(table.options).toEqual({
            'header-rows': '1',
            'stub-columns': '1',
            'class': 'longtable'
        });
        expect(table.rows).toHaveLength(2);
        expect(getCellValue(table, 0, 0)).toBe('');
        expect(getCellValue(table, 0, 1)).toBe('head1');
        expect(getCellValue(table, 1, 0)).toBe('stub1');
    });

    test('parses flat-table with spans', () => {
        const input = `
.. flat-table:: Table with Spans
  :header-rows: 1
* - :cspan:\`2\` Header
* - cell1
  - cell2
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(2);
        expect(table.rows[0].cells).toHaveLength(1);
        expect((table.rows[0].cells[0] as TableCell).cspan).toBe(2);
        expect(getCellValue(table, 0, 0)).toBe('Header');
        expect(table.rows[1].cells).toHaveLength(2);
    });

    test('parses csv-table', () => {
        const input = `
.. csv-table:: CSV Table
  :header: Col1,Col2,Col3
Cell 1,Cell 12,Cell 13
Cell 21,Cell 22,Cell 23
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(3); // header + 2 data rows
        expect(table.rows[0].cells).toHaveLength(3);
        expect(getCellValue(table, 0, 0)).toBe('Col1');
        expect(getCellValue(table, 1, 0)).toBe('Cell 1');
        expect(getCellValue(table, 2, 0)).toBe('Cell 21');
    });

    test('parses grid table', () => {
        const input = `
+-----------------------+-----------------------+
| Column heading 1      |     Column heading 2  |
+-----------------------+-----------------------+
| Cell 1                |     Cell 1            |
+-----------------------+-----------------------+
| Cell 2                |     Cell 2            |
+-----------------------+-----------------------+
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(3);
        expect(table.rows[0].cells).toHaveLength(2);
        expect(getCellValue(table, 0, 0)).toBe('Column heading 1');
        expect(getCellValue(table, 0, 1)).toBe('Column heading 2');
        expect(getCellValue(table, 1, 0)).toBe('Cell 1');
    });

    test('parses table with nested content', () => {
        const input = `
.. list-table:: Nested Table
* - stub
  - 
    .. list-table::
      * - nested1
        - nested2
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(1);
        
        // First cell should have nested table
        const nestedCell = table.rows[0].cells[1] as TableCell;
        expect(nestedCell.children[0]?.type).toBe('table');
        
        const nestedTable = nestedCell.children[0] as Table;
        expect(nestedTable.rows).toHaveLength(1);
        expect((nestedTable.rows[0].cells[0] as TableCell).children[0]?.children?.[0]?.value).toBe('nested1');
    });

    test('parses table with multi-line cells', () => {
        const input = `
.. list-table:: Multi-line Table
* - Row 1, column1
  - Row 1, column2
  - | Row 1, column 3
    | Another row
    | A third row
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        expect(table.rows).toHaveLength(1);
        
        // Check multi-line cell content
        const multiLineCell = table.rows[0].cells[2] as TableCell;
        const cellText = multiLineCell.children[0]?.children?.[0]?.value || '';
        expect(cellText).toContain('Row 1, column 3');
        expect(cellText).toContain('Another row');
        expect(cellText).toContain('A third row');
    });

    test('parses deeply nested tables (3 levels)', () => {
        const input = `
.. list-table:: Level 1
* - 
    .. list-table:: Level 2
    * - 
        .. list-table:: Level 3
        * - deepest cell
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        
        // Navigate to deepest table
        const level2Cell = table.rows[0].cells[0] as TableCell;
        expect(level2Cell.children[0]?.type).toBe('table');
        
        const level2Table = level2Cell.children[0] as Table;
        const level3Cell = level2Table?.rows[0]?.cells[0] as TableCell;
        expect(level3Cell?.children[0]?.type).toBe('table');
        
        const level3Table = level3Cell?.children[0] as Table;
        expect(level3Table?.rows).toHaveLength(1);
        expect((level3Table?.rows[0]?.cells[0] as TableCell)?.children[0]?.children?.[0]?.value).toBe('deepest cell');
    });

    test('parses table with lists in cells', () => {
        const input = `
.. list-table:: Table with Lists
  :header-rows: 1
* - Header1
  - Header2
* - Row 1, column1
  - 
    * Row1, column2, point 1
    * Row1, column2, point 2
`;
        const result = parse(input);
        const table = result.children[0] as Table;
        
        // Check that lists in cells are parsed correctly
        const listCell1 = table.rows[1].cells[1] as TableCell;
        expect(listCell1.children[0]?.type).toBe('list');
    });
});

describe('RST Tabs', () => {
    test('parses basic tabs', () => {
        const input = `
.. tabs::

   .. tab:: Tab 1

      Content for tab 1

   .. tab:: Tab 2

      Content for tab 2
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(2);
        
        expect(tabs.children[0].type).toBe('tab');
        expect(tabs.children[0].title).toBe('Tab 1');
        expect(tabs.children[0].children[0]?.type).toBe('paragraph');
        
        expect(tabs.children[1].type).toBe('tab');
        expect(tabs.children[1].title).toBe('Tab 2');
    });

    test('parses tabs with rich content', () => {
        const input = `
.. tabs::

   .. tab:: PM7325

      The PM7325 device integrates most of the wireless product's power management.

      #. Two high frequency SMPS
      #. Nineteen low-dropout (LDO) linear regulator

   .. tab:: PM7325B

      The PM7325B interface PMIC supplements the master core PMICs.
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(2);
        
        // First tab should have paragraph and list
        const tab1 = tabs.children[0] as Tab;
        expect(tab1.title).toBe('PM7325');
        expect(tab1.children.length).toBeGreaterThanOrEqual(2);
        expect(tab1.children[0].type).toBe('paragraph');
        expect(tab1.children[1].type).toBe('list');
    });

    test('parses nested tabs', () => {
        const input = `
.. tabs::

   .. tab:: Stars

      .. tabs::

         .. tab:: The Sun

            The closest star to us.

         .. tab:: Proxima Centauri

            The second closest star to us.

   .. tab:: Moons

      .. tabs::

         .. tab:: The Moon

            Orbits the Earth
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(2);
        
        // First tab (Stars) should contain nested tabs
        const starsTab = tabs.children[0] as Tab;
        expect(starsTab.title).toBe('Stars');
        expect(starsTab.children[0]?.type).toBe('tabs');
        
        const nestedTabs = starsTab.children[0] as Tabs;
        expect(nestedTabs.children).toHaveLength(2);
        expect(nestedTabs.children[0].title).toBe('The Sun');
        expect(nestedTabs.children[1].title).toBe('Proxima Centauri');
    });

    test('parses group tabs', () => {
        const input = `
.. tabs::

   .. group-tab:: Linux

      Linux tab content - tab set 1

   .. group-tab:: Mac OSX

      Mac OSX tab content - tab set 1

   .. group-tab:: Windows

      Windows tab content - tab set 1
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(3);
        
        // Check group property is set
        expect(tabs.children[0].title).toBe('Linux');
        expect(tabs.children[0].group).toBe('Linux');
        
        expect(tabs.children[1].title).toBe('Mac OSX');
        expect(tabs.children[1].group).toBe('Mac OSX');
        
        expect(tabs.children[2].title).toBe('Windows');
        expect(tabs.children[2].group).toBe('Windows');
    });

    test('parses code tabs', () => {
        const input = `
.. tabs::

   .. code-tab:: c

      int main(const int argc, const char **argv) {
          return 0;
      }

   .. code-tab:: py

      def main():
          return

   .. code-tab:: java

      class Main {
          public static void main(String[] args) {
          }
      }
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(3);
        
        // Check C tab
        const cTab = tabs.children[0] as Tab;
        expect(cTab.title).toBe('C');
        expect(cTab.language).toBe('c');
        expect(cTab.children[0]?.type).toBe('literal_block');
        expect((cTab.children[0] as LiteralBlock).language).toBe('c');
        expect((cTab.children[0] as LiteralBlock).value).toContain('int main');
        
        // Check Python tab
        const pyTab = tabs.children[1] as Tab;
        expect(pyTab.title).toBe('Python');
        expect(pyTab.language).toBe('py');
        expect((pyTab.children[0] as LiteralBlock).value).toContain('def main');
        
        // Check Java tab
        const javaTab = tabs.children[2] as Tab;
        expect(javaTab.title).toBe('Java');
        expect(javaTab.language).toBe('java');
    });

    test('parses code tabs with custom titles', () => {
        const input = `
.. tabs::

   .. code-tab:: r R

      main <- function() {
          return(0)
      }
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.children).toHaveLength(1);
        
        const rTab = tabs.children[0] as Tab;
        expect(rTab.language).toBe('r');
        expect(rTab.title).toBe('R');
        expect((rTab.children[0] as LiteralBlock).value).toContain('main <- function');
    });

    test('parses multiple tab sets on same page', () => {
        const input = `
.. tabs::

   .. tab:: First Set Tab 1

      Content 1

   .. tab:: First Set Tab 2

      Content 2

.. tabs::

   .. tab:: Second Set Tab 1

      Content A

   .. tab:: Second Set Tab 2

      Content B
`;
        const result = parse(input);
        
        expect(result.children).toHaveLength(2);
        
        const firstTabs = result.children[0] as Tabs;
        expect(firstTabs.type).toBe('tabs');
        expect(firstTabs.children).toHaveLength(2);
        expect(firstTabs.children[0].title).toBe('First Set Tab 1');
        
        const secondTabs = result.children[1] as Tabs;
        expect(secondTabs.type).toBe('tabs');
        expect(secondTabs.children).toHaveLength(2);
        expect(secondTabs.children[0].title).toBe('Second Set Tab 1');
    });

    test('parses tabs with empty content', () => {
        const input = `
.. tabs::

   .. tab:: Empty Tab

   .. tab:: Tab with Content

      Some content here
`;
        const result = parse(input);
        const tabs = result.children[0] as Tabs;
        
        expect(tabs.children).toHaveLength(2);
        expect(tabs.children[0].title).toBe('Empty Tab');
        expect(tabs.children[0].children).toHaveLength(0);
        
        expect(tabs.children[1].title).toBe('Tab with Content');
        expect(tabs.children[1].children.length).toBeGreaterThan(0);
    });


    test('nested table and tab', () => {
        const getCellValue = (table: Table, rowIndex: number, cellIndex: number) => {
            const cell = table.rows[rowIndex]?.cells[cellIndex] as TableCell;
            if (!cell || cell.children.length === 0) return '';
            const child = cell.children[0];
            if (child.type === 'text') {
                return child.value;
            }
            if (child.type === 'paragraph' && child.children?.[0]?.type === 'text') {
                return child.children[0].value;
            }
            return '';
        };

        const input = `
.. tabs::

   .. tab:: Overview

      This is a paragraph inside the **Overview** tab.

      .. list-table::
         :header-rows: 1
         :widths: 20 80

         * - **Section**
           - **Content**
         * - Introduction
           - This is a nested paragraph inside the main table cell.
         * - Nested Table
           - Below is information about a nested table.

   .. tab:: Details

      A descriptive paragraph for the **Details** tab.

      .. list-table::
         :header-rows: 1
         :widths: 30 70

         * - **Category**
           - **Information**
         * - Config
           - The config section with details.
         * - NestedInfo
           - More information here.

   .. tab:: Nested Tabs

      This tab contains nested tabs with tables inside them.

      .. tabs::

         .. tab:: Inner Tab 1

            A table in a nested tab:

            .. list-table::
               :header-rows: 1
               :widths: 30 70

               * - **Item**
                 - **Value**
               * - Alpha
                 - First value
               * - Beta
                 - Second value

         .. tab:: Inner Tab 2

            Another table in a different nested tab:

            .. list-table::
               :header-rows: 1
               :widths: 25 75

               * - **ID**
                 - **Description**
               * - One
                 - First description
               * - Two
                 - Second description

   .. tab:: Summary

      Summary paragraph: this tab wraps up the entire nested RST demonstration.

      .. list-table::
         :header-rows: 1
         :widths: 25 75

         * - **Field**
           - **Summary Data**
         * - Depth
           - This demonstrates list tables inside tab blocks.
         * - Structure
           - Cleanly organized RST with paragraphs and tables.

`;
        const result = parse(input);
        
        // Verify tabs structure
        expect(result.children).toHaveLength(1);
        const tabs = result.children[0] as Tabs;
        expect(tabs.type).toBe('tabs');
        expect(tabs.children).toHaveLength(4);
        
        // ===== TAB 1: Overview =====
        const overviewTab = tabs.children[0] as Tab;
        expect(overviewTab.type).toBe('tab');
        expect(overviewTab.title).toBe('Overview');
        
        // Overview tab should have paragraph and main table
        expect(overviewTab.children[0].type).toBe('paragraph');
        
        // Find the main table
        let mainTable1: Table | undefined;
        for (const child of overviewTab.children) {
            if (child.type === 'table') {
                mainTable1 = child as Table;
                break;
            }
        }
        expect(mainTable1).toBeDefined();
        expect(mainTable1!.type).toBe('table');
        expect(mainTable1!.header_rows).toBe(1);
        expect(mainTable1!.rows).toHaveLength(3); // header + 2 data rows
        
        // Check table contents
        expect(getCellValue(mainTable1!, 1, 0)).toContain('Introduction');
        expect(getCellValue(mainTable1!, 1, 1)).toContain('nested paragraph');
        expect(getCellValue(mainTable1!, 2, 0)).toContain('Nested Table');
        expect(getCellValue(mainTable1!, 2, 1)).toContain('nested table');
        
        // ===== TAB 2: Details =====
        const detailsTab = tabs.children[1] as Tab;
        expect(detailsTab.type).toBe('tab');
        expect(detailsTab.title).toBe('Details');
        
        // Details tab should have paragraph
        expect(detailsTab.children[0].type).toBe('paragraph');
        
        // Find the main table
        let mainTable2: Table | undefined;
        for (const child of detailsTab.children) {
            if (child.type === 'table') {
                mainTable2 = child as Table;
                break;
            }
        }
        expect(mainTable2).toBeDefined();
        expect(mainTable2!.type).toBe('table');
        expect(mainTable2!.header_rows).toBe(1);
        expect(mainTable2!.rows).toHaveLength(3); // header + 2 data rows
        
        // Check table contents
        expect(getCellValue(mainTable2!, 1, 0)).toContain('Config');
        expect(getCellValue(mainTable2!, 2, 0)).toContain('NestedInfo');

        // ===== TAB 3: Nested Tabs =====
        const nestedTabsParent = tabs.children[2] as Tab;
        expect(nestedTabsParent.type).toBe('tab');
        expect(nestedTabsParent.title).toBe('Nested Tabs');
        expect(nestedTabsParent.children[0].type).toBe('paragraph');
        
        // Find nested tabs structure
        let nestedTabs: Tabs | undefined;
        for (const child of nestedTabsParent.children) {
            if (child.type === 'tabs') {
                nestedTabs = child as Tabs;
                break;
            }
        }
        expect(nestedTabs).toBeDefined();
        expect(nestedTabs!.type).toBe('tabs');
        expect(nestedTabs!.children).toHaveLength(2);
        
        // Inner Tab 1 - with table
        const innerTab1 = nestedTabs!.children[0] as Tab;
        expect(innerTab1.type).toBe('tab');
        expect(innerTab1.title).toBe('Inner Tab 1');
        
        let innerTable1: Table | undefined;
        for (const child of innerTab1.children) {
            if (child.type === 'table') {
                innerTable1 = child as Table;
                break;
            }
        }
        expect(innerTable1).toBeDefined();
        expect(innerTable1!.header_rows).toBe(1);
        expect(innerTable1!.rows).toHaveLength(3);
        expect(getCellValue(innerTable1!, 1, 0)).toContain('Alpha');
        expect(getCellValue(innerTable1!, 1, 1)).toContain('First value');
        expect(getCellValue(innerTable1!, 2, 0)).toContain('Beta');
        
        // Inner Tab 2 - with different table
        const innerTab2 = nestedTabs!.children[1] as Tab;
        expect(innerTab2.type).toBe('tab');
        expect(innerTab2.title).toBe('Inner Tab 2');
        
        let innerTable2: Table | undefined;
        for (const child of innerTab2.children) {
            if (child.type === 'table') {
                innerTable2 = child as Table;
                break;
            }
        }
        expect(innerTable2).toBeDefined();
        expect(innerTable2!.header_rows).toBe(1);
        expect(innerTable2!.rows).toHaveLength(3);
        expect(getCellValue(innerTable2!, 1, 0)).toContain('One');
        expect(getCellValue(innerTable2!, 1, 1)).toContain('First description');
        expect(getCellValue(innerTable2!, 2, 0)).toContain('Two');
        
        // ===== TAB 4: Summary =====
        const summaryTab = tabs.children[3] as Tab;
        expect(summaryTab.type).toBe('tab');
        expect(summaryTab.title).toBe('Summary');
        
        // Summary tab should have paragraph
        expect(summaryTab.children[0].type).toBe('paragraph');
        
        // Find the summary table
        let summaryTable: Table | undefined;
        for (const child of summaryTab.children) {
            if (child.type === 'table') {
                summaryTable = child as Table;
                break;
            }
        }
        expect(summaryTable).toBeDefined();
        expect(summaryTable!.type).toBe('table');
        expect(summaryTable!.header_rows).toBe(1);
        expect(summaryTable!.rows).toHaveLength(3); // header + 2 data rows
        
        // Check table contents
        expect(getCellValue(summaryTable!, 0, 0)).toContain('Field');
        expect(getCellValue(summaryTable!, 1, 0)).toContain('Depth');
        expect(getCellValue(summaryTable!, 2, 0)).toContain('Structure');
    });
});

describe('RST Admonitions', () => {
    test('parses note admonition', () => {
        const input = `
.. note:: This serves as a note admonition.

   This serves as the second line of the first paragraph.

   - The note contains all indented body elements
   - following it.
   - It includes this bullet list.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('note');
        expect(admonition.children.length).toBeGreaterThan(0);
        
        // Check that first child is a paragraph
        expect(admonition.children[0].type).toBe('paragraph');
        
        // Check that list is included
        const listFound = admonition.children.some(child => child.type === 'list');
        expect(listFound).toBe(true);
    });

    test('parses attention admonition', () => {
        const input = `
.. attention:: This is an attention admonition.

   Pay close attention to this important message.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('attention');
        expect(admonition.children.length).toBeGreaterThan(0);
    });

    test('parses caution admonition', () => {
        const input = `
.. caution:: This is a caution admonition.

   Be careful with this information.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('caution');
    });

    test('parses danger admonition', () => {
        const input = `
.. danger:: This is a danger admonition.

   This action could cause harm.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('danger');
    });

    test('parses error admonition', () => {
        const input = `
.. error:: This is an error admonition.

   An error has occurred.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('error');
    });

    test('parses hint admonition', () => {
        const input = `
.. hint:: This is a hint admonition.

   Here is a helpful hint.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('hint');
    });

    test('parses important admonition', () => {
        const input = `
.. important:: This is an important admonition.

   This information is important.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('important');
    });

    test('parses tip admonition', () => {
        const input = `
.. tip:: This is a tip admonition.

   Here is a useful tip.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('tip');
    });

    test('parses warning admonition', () => {
        const input = `
.. warning:: This is a warning.

   Be warned about this potential issue.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('warning');
    });

    test('parses admonition with options', () => {
        const input = `
.. note:: This is a note with options.
   :class: noteinline

   This note has a class option.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('note');
        expect(admonition.options).toBeDefined();
        expect(admonition.options!['class']).toBe('noteinline');
    });

    test('parses multiple admonitions in sequence', () => {
        const input = `
.. note:: First note.

   Note content.

.. warning:: A warning.

   Warning content.

.. tip:: A tip.

   Tip content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(3);
        expect((result.children[0] as Admonition).kind).toBe('note');
        expect((result.children[1] as Admonition).kind).toBe('warning');
        expect((result.children[2] as Admonition).kind).toBe('tip');
    });

    test('parses admonition with complex body content', () => {
        const input = `
.. note:: Complex Note

   This is a paragraph in the note.

   .. list-table::
      :header-rows: 1

      * - Header 1
        - Header 2
      * - Row 1 Col 1
        - Row 1 Col 2

   Another paragraph after the table.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        expect(admonition.kind).toBe('note');
        
        // Check for table in body
        const tableFound = admonition.children.some(child => child.type === 'table');
        expect(tableFound).toBe(true);
        
        // Check for paragraphs
        const paragraphCount = admonition.children.filter(child => child.type === 'paragraph').length;
        expect(paragraphCount).toBeGreaterThanOrEqual(1);
    });

    test('parses 2-level nested admonitions', () => {
        const input = `
.. note:: Level 1 Note

   This is level 1 content.

   .. warning:: Level 2 Warning

      This is level 2 content inside level 1 note.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const level1 = result.children[0] as Admonition;
        expect(level1.type).toBe('admonition');
        expect(level1.kind).toBe('note');
        
        // Find level 2 admonition
        const level2Admonition = level1.children.find(child => child.type === 'admonition') as Admonition;
        expect(level2Admonition).toBeDefined();
        expect(level2Admonition.kind).toBe('warning');
    });

    test('parses 3-level nested admonitions', () => {
        const input = `
.. note:: Level 1

   Content level 1.

   .. warning:: Level 2

      Content level 2.

      .. tip:: Level 3

         Content level 3.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const level1 = result.children[0] as Admonition;
        expect(level1.kind).toBe('note');
        
        const level2 = level1.children.find(child => child.type === 'admonition') as Admonition;
        expect(level2).toBeDefined();
        expect(level2.kind).toBe('warning');
        
        const level3 = level2.children.find(child => child.type === 'admonition') as Admonition;
        expect(level3).toBeDefined();
        expect(level3.kind).toBe('tip');
    });

    test('parses 4-level nested admonitions', () => {
        const input = `
.. note:: Level 1

   Level 1 text.

   .. warning:: Level 2

      Level 2 text.

      .. danger:: Level 3

         Level 3 text.

         .. important:: Level 4

            Level 4 text.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        let current = result.children[0] as Admonition;
        expect(current.kind).toBe('note');
        
        for (let i = 2; i <= 4; i++) {
            const next = current.children.find(child => child.type === 'admonition') as Admonition;
            expect(next).toBeDefined();
            current = next;
        }
        
        expect(current.kind).toBe('important');
    });

    test('parses 5-level nested admonitions', () => {
        const input = `
.. note:: Level 1

   Level 1 content.

   .. warning:: Level 2

      Level 2 content.

      .. danger:: Level 3

         Level 3 content.

         .. important:: Level 4

            Level 4 content.

            .. tip:: Level 5

               Level 5 content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const levels: Admonition[] = [];
        let current = result.children[0] as Admonition;
        levels.push(current);
        
        for (let i = 1; i < 5; i++) {
            const next = current.children.find(child => child.type === 'admonition') as Admonition;
            expect(next).toBeDefined();
            levels.push(next);
            current = next;
        }
        
        const expectedKinds = ['note', 'warning', 'danger', 'important', 'tip'];
        levels.forEach((level, index) => {
            expect(level.kind).toBe(expectedKinds[index]);
        });
    });

    test('parses admonition with nested list-table 3 levels', () => {
        const input = `
.. note:: Note with Table

   .. list-table:: Level 1 Table
      :header-rows: 1

      * - Header A
        - Header B
      * - Level 1 Row 1
        - L1R1 Col 2

   .. warning:: Warning with nested table

      .. list-table:: Level 2 Table
         :header-rows: 1

         * - Header X
           - Header Y
         * - Level 2 Row 1
           - L2R1 Col 2

      .. tip:: Tip with deeply nested table

         .. list-table:: Level 3 Table
            :header-rows: 1

            * - A
              - B
            * - Data 1
              - Data 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const admonition1 = result.children[0] as Admonition;
        expect(admonition1.kind).toBe('note');
        
        // Find table in level 1
        const table1 = admonition1.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        expect(table1.header_rows).toBe(1);
        
        // Find warning in level 1
        const warning = admonition1.children.find(child => child.type === 'admonition') as Admonition;
        expect(warning).toBeDefined();
        expect(warning.kind).toBe('warning');
        
        // Find table in warning
        const table2 = warning.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
        
        // Find tip in warning
        const tip = warning.children.find(child => child.type === 'admonition') as Admonition;
        expect(tip).toBeDefined();
        expect(tip.kind).toBe('tip');
        
        // Find table in tip
        const table3 = tip.children.find(child => child.type === 'table') as Table;
        expect(table3).toBeDefined();
    });

    test('parses complex 5-level nested structure with mixed tables and admonitions', () => {
        const input = `
.. note:: Level 1 Note

   Level 1 paragraph.

   .. list-table:: L1 Table
      :header-rows: 1
      :widths: 20 80

      * - Col1
        - Col2
      * - Data1
        - Data2

   .. warning:: Level 2 Warning

      Level 2 paragraph.

      .. list-table:: L2 Table
         :header-rows: 1

         * - A
           - B
         * - 1
           - 2

      .. danger:: Level 3 Danger

         Level 3 paragraph.

         .. flat-table:: L3 Table
            :header-rows: 1

            * - - Header1
              - Header2
            * - - Cell1
              - Cell2

         .. important:: Level 4 Important

            Level 4 paragraph.

            .. list-table:: L4 Table
               :header-rows: 1

               * - X
                 - Y
               * - Row1
                 - Row2

            .. tip:: Level 5 Tip

               Level 5 paragraph.

               .. list-table:: L5 Table
                  :header-rows: 1

                  * - Final
                    - Table
                  * - Data
                    - Here
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        // Level 1
        const level1 = result.children[0] as Admonition;
        expect(level1.kind).toBe('note');
        const table1 = level1.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        expect(table1.header_rows).toBe(1);
        
        // Level 2
        const level2 = level1.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(level2).toBeDefined();
        const table2 = level2.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
        
        // Level 3
        const level3 = level2.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'danger') as Admonition;
        expect(level3).toBeDefined();
        const table3 = level3.children.find(child => child.type === 'table') as Table;
        expect(table3).toBeDefined();
        
        // Level 4
        const level4 = level3.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'important') as Admonition;
        expect(level4).toBeDefined();
        const table4 = level4.children.find(child => child.type === 'table') as Table;
        expect(table4).toBeDefined();
        
        // Level 5
        const level5 = level4.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'tip') as Admonition;
        expect(level5).toBeDefined();
        const table5 = level5.children.find(child => child.type === 'table') as Table;
        expect(table5).toBeDefined();
    });

    test('parses admonition with content and nested lists 3 levels', () => {
        const input = `
.. note:: Note with List

   - Item 1
   - Item 2

   .. warning:: Warning with nested list

      - Warning Item 1
      - Warning Item 2
        - Nested Warning Item

      .. tip:: Tip with list

         - Tip Item 1
         - Tip Item 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const note = result.children[0] as Admonition;
        expect(note.kind).toBe('note');
        
        const list1 = note.children.find(child => child.type === 'list');
        expect(list1).toBeDefined();
        
        const warning = note.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(warning).toBeDefined();
        
        
        const list2 = warning.children.find(child => child.type === 'list');
        expect(list2).toBeDefined();
        
        const tip = warning.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'tip') as Admonition;
        expect(tip).toBeDefined();
        
        const list3 = tip.children.find(child => child.type === 'list');
        expect(list3).toBeDefined();
    });
});

describe('RST Containers', () => {
    test('parses simple container with single class', () => {
        const input = `
.. container:: tagrightalign

   This paragraph is right aligned with a custom class.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['tagrightalign']);
        expect(container.children.length).toBeGreaterThan(0);
        expect(container.children[0].type).toBe('paragraph');
    });

    test('parses container with multiple classes', () => {
        const input = `
.. container:: class1 class2 class3

   This container has multiple classes.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['class1', 'class2', 'class3']);
    });

    test('parses shortdesc container', () => {
        const input = `
.. container:: shortdesc

   This paragraph is in a div tag with class shortdesc.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['shortdesc']);
    });

    test('parses systemoutput container', () => {
        const input = `
.. container:: systemoutput

   This paragraph is in a monospaced font.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['systemoutput']);
    });

    test('parses screenoutput container with code block', () => {
        const input = `
.. container:: screenoutput

   .. code::

      Text line 1 here
      Text line 2 here
      Text line 3 here
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['screenoutput']);
        
        // Find code block in container
        const codeBlock = container.children.find(child => child.type === 'directive');
        expect(codeBlock).toBeDefined();
    });

    test('parses text-decoration-underline container', () => {
        const input = `
.. container:: text-decoration-underline

   This text is underlined.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toEqual(['text-decoration-underline']);
    });

    test('parses container with options', () => {
        const input = `
.. container:: custom-class
   :id: mycontainer

   Container with options.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.options).toBeDefined();
        expect(container.options!['id']).toBe('mycontainer');
    });

    test('parses multiple containers in sequence', () => {
        const input = `
.. container:: shortdesc

   First container description.

.. container:: systemoutput

   System output container.

.. container:: text-decoration-underline

   Underlined text container.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(3);
        expect((result.children[0] as Container).classes).toEqual(['shortdesc']);
        expect((result.children[1] as Container).classes).toEqual(['systemoutput']);
        expect((result.children[2] as Container).classes).toEqual(['text-decoration-underline']);
    });

    test('parses container with complex content (lists)', () => {
        const input = `
.. container:: custom-container

   - Item 1
   - Item 2
   - Item 3
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        
        const list = container.children.find(child => child.type === 'list');
        expect(list).toBeDefined();
    });

    test('parses container with complex content (tables)', () => {
        const input = `
.. container:: table-container

   .. list-table::
      :header-rows: 1

      * - Header 1
        - Header 2
      * - Row 1 Col 1
        - Row 1 Col 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        
        const table = container.children.find(child => child.type === 'table') as Table;
        expect(table).toBeDefined();
        expect(table.header_rows).toBe(1);
    });

    test('parses 2-level nested containers', () => {
        const input = `
.. container:: outer-container

   Outer content.

   .. container:: inner-container

      Inner content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outer = result.children[0] as Container;
        expect(outer.classes).toEqual(['outer-container']);
        
        const inner = outer.children.find(child => child.type === 'container') as Container;
        expect(inner).toBeDefined();
        expect(inner.classes).toEqual(['inner-container']);
    });

    test('parses 3-level nested containers', () => {
        const input = `
.. container:: level1

   Level 1 content.

   .. container:: level2

      Level 2 content.

      .. container:: level3

         Level 3 content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const level1 = result.children[0] as Container;
        expect(level1.classes).toEqual(['level1']);
        
        const level2 = level1.children.find(child => child.type === 'container') as Container;
        expect(level2).toBeDefined();
        expect(level2.classes).toEqual(['level2']);
        
        const level3 = level2.children.find(child => child.type === 'container') as Container;
        expect(level3).toBeDefined();
        expect(level3.classes).toEqual(['level3']);
    });

    test('parses container with nested admonition', () => {
        const input = `
.. container:: container-with-note

   This container has a note.

   .. note:: Important note inside container

      This is important information inside the container.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const container = result.children[0] as Container;
        expect(container.classes).toEqual(['container-with-note']);
        
        const admonition = container.children.find(child => child.type === 'admonition') as Admonition;
        expect(admonition).toBeDefined();
        expect(admonition.kind).toBe('note');
    });

    test('parses complex 5-level nested structure with containers, tables, and admonitions', () => {
        const input = `
.. container:: level1-container

   Level 1 paragraph.

   .. container:: level2-container

      Level 2 paragraph.

      .. list-table::
         :header-rows: 1

         * - L2 Header
           - Value
         * - Data
           - Content

      .. note:: Level 2 Note

         Note in level 2.

         .. container:: level3-container

            Level 3 paragraph.

            .. warning:: Level 3 Warning

               Warning in level 3.

               .. container:: level4-container

                  Level 4 paragraph.

                  .. list-table::
                     :header-rows: 1

                     * - L4 Header
                       - Data
                     * - Row 1
                       - Value 1

                  .. container:: level5-container

                     Level 5 paragraph - deepest level.

                     .. tip:: Level 5 Tip

                        Final tip at level 5.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        // Level 1
        const level1 = result.children[0] as Container;
        expect(level1.classes).toEqual(['level1-container']);
        
        // Level 2
        const level2 = level1.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'level2-container') as Container;
        expect(level2).toBeDefined();
        
        // Table in level 2
        const table1 = level2.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        
        // Note in level 2
        const note = level2.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'note') as Admonition;
        expect(note).toBeDefined();
        
        // Level 3
        const level3 = note.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'level3-container') as Container;
        expect(level3).toBeDefined();
        
        // Warning in level 3
        const warning = level3.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(warning).toBeDefined();
        
        // Level 4
        const level4 = warning.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'level4-container') as Container;
        expect(level4).toBeDefined();
        
        // Table in level 4
        const table2 = level4.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
        
        // Level 5
        const level5 = level4.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'level5-container') as Container;
        expect(level5).toBeDefined();
        
        // Tip in level 5
        const tip = level5.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'tip') as Admonition;
        expect(tip).toBeDefined();
    });

    test('parses container with multiple paragraphs', () => {
        const input = `
.. container:: multi-paragraph

   First paragraph here.

   Second paragraph here.

   Third paragraph here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const container = result.children[0] as Container;
        
        const paragraphs = container.children.filter(child => child.type === 'paragraph');
        expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });

    test('parses container with nested tabs and tables', () => {
        const input = `
.. container:: container-with-tabs

   This container has tabs inside.

   .. tabs::

      .. tab:: Tab 1

         .. list-table::
            :header-rows: 1

            * - Header A
              - Header B
            * - Row1 Col1
              - Row1 Col2

      .. tab:: Tab 2

         .. list-table::
            :header-rows: 1

            * - Header X
              - Header Y
            * - Row2 Col1
              - Row2 Col2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const container = result.children[0] as Container;
        expect(container.classes).toEqual(['container-with-tabs']);
        
        const tabs = container.children.find(child => child.type === 'tabs') as Tabs;
        expect(tabs).toBeDefined();
        expect(tabs.children).toHaveLength(2);
        
        // Verify tables inside tabs
        const tab1 = tabs.children[0] as Tab;
        const table1 = tab1.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        expect(table1.header_rows).toBe(1);
    });

    test('parses nested containers with alternating content types', () => {
        const input = `
.. container:: outer

   Outer paragraph.

   .. note:: Note in outer

      Note content.

   .. container:: middle

      Middle paragraph.

      .. warning:: Warning in middle

         Warning content.

      .. list-table::
         :header-rows: 1

         * - Col1
           - Col2
         * - Data1
           - Data2

      .. container:: inner

         Inner paragraph.

         .. tip:: Tip in inner

            Tip content.

         - List item 1
         - List item 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outer = result.children[0] as Container;
        expect(outer.classes).toEqual(['outer']);
        
        // Check note in outer
        const noteInOuter = outer.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'note') as Admonition;
        expect(noteInOuter).toBeDefined();
        
        // Find middle container
        const middle = outer.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'middle') as Container;
        expect(middle).toBeDefined();
        
        // Check warning in middle
        const warningInMiddle = middle.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(warningInMiddle).toBeDefined();
        
        // Check table in middle
        const table = middle.children.find(child => child.type === 'table') as Table;
        expect(table).toBeDefined();
        
        // Find inner container
        const inner = middle.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'inner') as Container;
        expect(inner).toBeDefined();
        
        // Check tip in inner
        const tipInInner = inner.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'tip') as Admonition;
        expect(tipInInner).toBeDefined();
        
        // Check list in inner
        const list = inner.children.find(child => child.type === 'list');
        expect(list).toBeDefined();
    });

    test('parses 4-level containers with tables at each level', () => {
        const input = `
.. container:: L1

   Level 1 content.

   .. list-table::
      :header-rows: 1

      * - L1 Header
        - Value
      * - L1 Data
        - L1 Value

   .. container:: L2

      Level 2 content.

      .. list-table::
         :header-rows: 1

         * - L2 Header
           - Value
         * - L2 Data
           - L2 Value

      .. container:: L3

         Level 3 content.

         .. list-table::
            :header-rows: 1

            * - L3 Header
              - Value
            * - L3 Data
              - L3 Value

         .. container:: L4

            Level 4 content.

            .. list-table::
               :header-rows: 1

               * - L4 Header
                 - Value
               * - L4 Data
                 - L4 Value
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const level1 = result.children[0] as Container;
        const table1 = level1.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        expect(table1.rows).toHaveLength(2);
        
        const level2 = level1.children.find(child => child.type === 'container') as Container;
        const table2 = level2.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
        
        const level3 = level2.children.find(child => child.type === 'container') as Container;
        const table3 = level3.children.find(child => child.type === 'table') as Table;
        expect(table3).toBeDefined();
        
        const level4 = level3.children.find(child => child.type === 'container') as Container;
        const table4 = level4.children.find(child => child.type === 'table') as Table;
        expect(table4).toBeDefined();
    });

    test('parses containers with nested lists and admonitions at multiple levels', () => {
        const input = `
.. container:: list-container

   - Item 1
   - Item 2

   .. note:: Note with nested list

      - Nested Item 1
      - Nested Item 2

      .. container:: inner-list-container

         - Inner Item 1
         - Inner Item 2

         .. warning:: Warning with list

            - Warning Item 1
            - Warning Item 2

            .. container:: deep-container

               - Deep Item 1
               - Deep Item 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outer = result.children[0] as Container;
        const outerList = outer.children.find(child => child.type === 'list');
        expect(outerList).toBeDefined();
        
        const note = outer.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'note') as Admonition;
        expect(note).toBeDefined();
        
        const noteList = note.children.find(child => child.type === 'list');
        expect(noteList).toBeDefined();
        
        const inner = note.children.find(child => child.type === 'container') as Container;
        expect(inner).toBeDefined();
        
        const innerList = inner.children.find(child => child.type === 'list');
        expect(innerList).toBeDefined();
        
        const warning = inner.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(warning).toBeDefined();
        
        const warningList = warning.children.find(child => child.type === 'list');
        expect(warningList).toBeDefined();
        
        const deep = warning.children.find(child => child.type === 'container') as Container;
        expect(deep).toBeDefined();
        
        const deepList = deep.children.find(child => child.type === 'list');
        expect(deepList).toBeDefined();
    });

    test('parses 5-level deeply nested containers with mixed admonitions and tables', () => {
        const input = `
.. container:: Level1 outer-style

   Level 1 content with **emphasis**.

   .. list-table::
      :header-rows: 1
      :widths: 30 70

      * - Level1 Col
        - Description
      * - Item1
        - Level 1 data

   .. attention:: Level 1 Attention

      Attention at level 1.

      .. container:: Level2 middle-style

         Level 2 content.

         .. list-table::
            :header-rows: 1

            * - Level2 Col
              - Description
            * - Item2
              - Level 2 data

         .. caution:: Level 2 Caution

            Caution at level 2.

            .. container:: Level3 inner-style

               Level 3 content.

               .. list-table::
                  :header-rows: 1

                  * - Level3 Col
                    - Description
                  * - Item3
                    - Level 3 data

               .. danger:: Level 3 Danger

                  Danger at level 3.

                  .. container:: Level4 deep-style

                     Level 4 content.

                     .. list-table::
                        :header-rows: 1

                        * - Level4 Col
                          - Description
                        * - Item4
                          - Level 4 data

                     .. important:: Level 4 Important

                        Important at level 4.

                        .. container:: Level5 deepest-style

                           Level 5 - deepest content.

                           .. list-table::
                              :header-rows: 1

                              * - Level5 Col
                                - Description
                              * - Item5
                                - Level 5 data

                           .. hint:: Level 5 Hint

                              Final hint at level 5.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        // Level 1
        const level1 = result.children[0] as Container;
        expect(level1.classes).toContain('Level1');
        const table1 = level1.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        const attn = level1.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'attention') as Admonition;
        expect(attn).toBeDefined();
        
        // Level 2
        const level2 = attn.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'Level2') as Container;
        expect(level2).toBeDefined();
        const table2 = level2.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
        const caution = level2.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'caution') as Admonition;
        expect(caution).toBeDefined();
        
        // Level 3
        const level3 = caution.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'Level3') as Container;
        expect(level3).toBeDefined();
        const table3 = level3.children.find(child => child.type === 'table') as Table;
        expect(table3).toBeDefined();
        const danger = level3.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'danger') as Admonition;
        expect(danger).toBeDefined();
        
        // Level 4
        const level4 = danger.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'Level4') as Container;
        expect(level4).toBeDefined();
        const table4 = level4.children.find(child => child.type === 'table') as Table;
        expect(table4).toBeDefined();
        const important = level4.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'important') as Admonition;
        expect(important).toBeDefined();
        
        // Level 5
        const level5 = important.children.find(child => child.type === 'container' && (child as Container).classes[0] === 'Level5') as Container;
        expect(level5).toBeDefined();
        const table5 = level5.children.find(child => child.type === 'table') as Table;
        expect(table5).toBeDefined();
        const hint = level5.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'hint') as Admonition;
        expect(hint).toBeDefined();
    });

    test('parses container with multiple classes and nested structures', () => {
        const input = `
.. container:: outer-class secondary-class

   Outer paragraph.

   .. note:: Note in container

      Note with nested container.

      .. container:: inner-class special-style

         Inner content.

         .. list-table::
            :header-rows: 1

            * - Header
              - Value
            * - Data
              - Content
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outer = result.children[0] as Container;
        expect(outer.classes).toContain('outer-class');
        expect(outer.classes).toContain('secondary-class');
        expect(outer.classes).toHaveLength(2);
        
        const note = outer.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'note') as Admonition;
        expect(note).toBeDefined();
        
        const inner = note.children.find(child => child.type === 'container') as Container;
        expect(inner).toBeDefined();
        expect(inner.classes).toContain('inner-class');
        expect(inner.classes).toContain('special-style');
        
        const table = inner.children.find(child => child.type === 'table') as Table;
        expect(table).toBeDefined();
    });

    test('parses containers with flat-table directives nested', () => {
        const input = `
.. container:: flat-table-container

   This container has flat tables.

   .. container:: level2

      .. flat-table::
         :header-rows: 1

         * - - Header A
           - Header B
         * - - Cell A1
           - Cell B1

      .. container:: level3

         .. flat-table::
            :header-rows: 1

            * - - Header X
              - Header Y
            * - - Cell X1
              - Cell Y1
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outer = result.children[0] as Container;
        const level2 = outer.children.find(child => child.type === 'container') as Container;
        expect(level2).toBeDefined();
        
        const table1 = level2.children.find(child => child.type === 'table') as Table;
        expect(table1).toBeDefined();
        
        const level3 = level2.children.find(child => child.type === 'container') as Container;
        expect(level3).toBeDefined();
        
        const table2 = level3.children.find(child => child.type === 'table') as Table;
        expect(table2).toBeDefined();
    });

    test('parses container with tabs containing admonitions and tables', () => {
        const input = `
.. container:: main-container

   .. tabs::

      .. tab:: Overview

         Overview content.

         .. note:: Note in Overview

            Note content in overview.

      .. tab:: Details

         Details content.

         .. list-table::
            :header-rows: 1

            * - Detail
              - Value
            * - Row1
              - Data1

         .. warning:: Warning in Details

            Warning content in details.

      .. tab:: Advanced

         Advanced content.

         .. container:: nested-in-tab

            Container inside tab.

            .. tip:: Tip inside container in tab

               Tip content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const container = result.children[0] as Container;
        const tabs = container.children.find(child => child.type === 'tabs') as Tabs;
        expect(tabs).toBeDefined();
        expect(tabs.children).toHaveLength(3);
        
        // Check Overview tab
        const overviewTab = tabs.children[0] as Tab;
        const noteInOverview = overviewTab.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'note') as Admonition;
        expect(noteInOverview).toBeDefined();
        
        // Check Details tab
        const detailsTab = tabs.children[1] as Tab;
        const table = detailsTab.children.find(child => child.type === 'table') as Table;
        expect(table).toBeDefined();
        const warningInDetails = detailsTab.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'warning') as Admonition;
        expect(warningInDetails).toBeDefined();
        
        // Check Advanced tab
        const advancedTab = tabs.children[2] as Tab;
        const nestedContainer = advancedTab.children.find(child => child.type === 'container') as Container;
        expect(nestedContainer).toBeDefined();
        const tipInContainer = nestedContainer.children.find(child => child.type === 'admonition' && (child as Admonition).kind === 'tip') as Admonition;
        expect(tipInContainer).toBeDefined();
    });
});

describe('RST Images and Figures', () => {
    test('parses simple image', () => {
        const input = `
.. image:: ../media/largepng.png
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.type).toBe('image');
        expect(image.uri).toBe('../media/largepng.png');
    });

    test('parses image with alt text', () => {
        const input = `
.. image:: ../media/image.png
   :alt: Alternative text for image
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.type).toBe('image');
        expect(image.alt).toBe('Alternative text for image');
    });

    test('parses image with width percentage', () => {
        const input = `
.. image:: ../media/image.png
   :width: 25%
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.width).toBe('25%');
    });

    test('parses image with width in pixels', () => {
        const input = `
.. image:: ../media/image.png
   :width: 200px
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.width).toBe('200px');
    });

    test('parses image with height', () => {
        const input = `
.. image:: ../media/image.png
   :height: 250px
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.height).toBe('250px');
    });

    test('parses image with scale', () => {
        const input = `
.. image:: ../media/image.png
   :scale: 150%
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.scale).toBe('150%');
    });

    test('parses image with left align', () => {
        const input = `
.. image:: ../media/image.png
   :align: left
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.align).toBe('left');
    });

    test('parses image with center align', () => {
        const input = `
.. image:: ../media/image.png
   :align: center
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.align).toBe('center');
    });

    test('parses image with right align', () => {
        const input = `
.. image:: ../media/image.png
   :align: right
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.align).toBe('right');
    });

    test('parses image with multiple options', () => {
        const input = `
.. image:: ../media/image.png
   :alt: Test image
   :width: 300px
   :height: 200px
   :scale: 75%
   :align: center
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const image = result.children[0] as Image;
        expect(image.alt).toBe('Test image');
        expect(image.width).toBe('300px');
        expect(image.height).toBe('200px');
        expect(image.scale).toBe('75%');
        expect(image.align).toBe('center');
    });

    test('parses simple figure', () => {
        const input = `
.. figure:: ../media/largepng.png
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.type).toBe('figure');
        expect(figure.uri).toBe('../media/largepng.png');
    });

    test('parses figure with caption only', () => {
        const input = `
.. figure:: ../media/largepng.png

   This is the caption of the figure.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.type).toBe('figure');
        expect(figure.caption).toBe('This is the caption of the figure.');
        expect(figure.legend).toBeUndefined();
    });

    test('parses figure with caption and legend', () => {
        const input = `
.. figure:: ../media/largepng.png

   This is the caption of the figure.

   This is the legend.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.type).toBe('figure');
        expect(figure.caption).toBe('This is the caption of the figure.');
        expect(figure.legend).toBe('This is the legend.');
    });

    test('parses figure with alt text', () => {
        const input = `
.. figure:: ../media/largepng.png
   :alt: Figure alternative text

   Figure caption.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.alt).toBe('Figure alternative text');
    });

    test('parses figure with height and left alignment', () => {
        const input = `
.. figure:: ../media/largepng.png
   :height: 200px
   :align: left

   Left aligned figure.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.height).toBe('200px');
        expect(figure.align).toBe('left');
        expect(figure.caption).toBe('Left aligned figure.');
    });

    test('parses figure with height and center alignment', () => {
        const input = `
.. figure:: ../media/largepng.png
   :height: 200px
   :align: center

   Center aligned figure.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.height).toBe('200px');
        expect(figure.align).toBe('center');
    });

    test('parses figure with height and right alignment', () => {
        const input = `
.. figure:: ../media/largepng.png
   :height: 200px
   :align: right

   Right aligned figure.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        const figure = result.children[0] as Figure;
        expect(figure.height).toBe('200px');
        expect(figure.align).toBe('right');
    });

    test('parses multiple images and figures in sequence', () => {
        const input = `
.. image:: ../media/image1.png

.. figure:: ../media/figure1.png

   Figure 1 caption.

.. image:: ../media/image2.png

.. figure:: ../media/figure2.png

   Figure 2 caption.

   Figure 2 legend.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(4);
        
        expect((result.children[0] as Image).type).toBe('image');
        expect((result.children[1] as Figure).type).toBe('figure');
        expect((result.children[1] as Figure).caption).toBe('Figure 1 caption.');
        
        expect((result.children[2] as Image).type).toBe('image');
        expect((result.children[3] as Figure).type).toBe('figure');
        expect((result.children[3] as Figure).caption).toBe('Figure 2 caption.');
        expect((result.children[3] as Figure).legend).toBe('Figure 2 legend.');
    });

    test('parses figure with width and all options', () => {
        const input = `
.. figure:: ../media/image.png
   :alt: Comprehensive figure
   :width: 400px
   :height: 300px
   :scale: 80%
   :align: center

   This is a comprehensive figure caption.

   This is the figure legend with detailed information.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const figure = result.children[0] as Figure;
        expect(figure.uri).toBe('../media/image.png');
        expect(figure.alt).toBe('Comprehensive figure');
        expect(figure.width).toBe('400px');
        expect(figure.height).toBe('300px');
        expect(figure.scale).toBe('80%');
        expect(figure.align).toBe('center');
        expect(figure.caption).toBe('This is a comprehensive figure caption.');
        expect(figure.legend).toBe('This is the figure legend with detailed information.');
    });

    test('parses container with images', () => {
        const input = `
.. container:: image-container

   This container has images.

   .. image:: ../media/image1.png
      :width: 50%

   .. figure:: ../media/figure1.png
      :align: center

      Figure in container.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        
        const image = container.children.find(child => child.type === 'image') as Image;
        expect(image).toBeDefined();
        expect(image.width).toBe('50%');
        
        const figure = container.children.find(child => child.type === 'figure') as Figure;
        expect(figure).toBeDefined();
        expect(figure.align).toBe('center');
    });

    test('parses admonition with images', () => {
        const input = `
.. note:: Note with images

   This note contains an image.

   .. image:: ../media/image.png
      :alt: Note image
      :width: 200px

   And a figure:

   .. figure:: ../media/figure.png
      :align: center

      Figure in note.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const admonition = result.children[0] as Admonition;
        expect(admonition.type).toBe('admonition');
        
        const image = admonition.children.find(child => child.type === 'image') as Image;
        expect(image).toBeDefined();
        expect(image.alt).toBe('Note image');
        
        const figure = admonition.children.find(child => child.type === 'figure') as Figure;
        expect(figure).toBeDefined();
        expect(figure.caption).toBe('Figure in note.');
    });

    test('parses images inside nested containers and admonitions', () => {
        const input = `
.. container:: outer

   .. note:: Outer note

      .. container:: inner

         .. figure:: ../media/image.png
            :width: 100px
            :align: center

            Nested figure in container in admonition.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outerContainer = result.children[0] as Container;
        const note = outerContainer.children.find(child => child.type === 'admonition') as Admonition;
        const innerContainer = note.children.find(child => child.type === 'container') as Container;
        const figure = innerContainer.children.find(child => child.type === 'figure') as Figure;
        
        expect(figure).toBeDefined();
        expect(figure.uri).toBe('../media/image.png');
        expect(figure.width).toBe('100px');
        expect(figure.align).toBe('center');
        expect(figure.caption).toBe('Nested figure in container in admonition.');
    });

    test('parses multiple images with different dimensions', () => {
        const input = `
.. image:: ../media/small.png
   :width: 100px

.. image:: ../media/medium.png
   :width: 50%

.. image:: ../media/large.png
   :width: 800px

.. figure:: ../media/figure.png
   :height: 400px
   :scale: 120%

   Figure with custom dimensions.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(4);
        
        const img1 = result.children[0] as Image;
        expect(img1.width).toBe('100px');
        
        const img2 = result.children[1] as Image;
        expect(img2.width).toBe('50%');
        
        const img3 = result.children[2] as Image;
        expect(img3.width).toBe('800px');
        
        const fig = result.children[3] as Figure;
        expect(fig.height).toBe('400px');
        expect(fig.scale).toBe('120%');
    });
});

describe('RST Headings', () => {
    test('parses heading level 1 with overline and underline', () => {
        const input = `
#######
Level 1
#######

Some text here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(1);
        expect(heading.title).toBe('Level 1');
    });

    test('parses heading level 2 with overline and underline', () => {
        const input = `
*******
Level 2
*******

Content goes here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(2);
        expect(heading.title).toBe('Level 2');
    });

    test('parses heading level 3 with underline only', () => {
        const input = `
Level 3
=======

Content here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(3);
        expect(heading.title).toBe('Level 3');
    });

    test('parses heading level 4 with underline only', () => {
        const input = `
Level 4
-------

Paragraph here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(4);
        expect(heading.title).toBe('Level 4');
    });

    test('parses heading level 5 with underline only', () => {
        const input = `
Level 5
^^^^^^^

Text content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(5);
        expect(heading.title).toBe('Level 5');
    });

    test('parses heading level 6 with underline only', () => {
        const input = `
Level 6
"""""""

Final paragraph.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(6);
        expect(heading.title).toBe('Level 6');
    });

    test('parses multiple headings with mixed levels', () => {
        const input = `
#######
Title
#######

Introduction text.

Section One
===========

Section one content.

Subsection
----------

Subsection content.
`;
        const result = parse(input);
        
        const headings = result.children.filter((child: any) => child.type === 'heading');
        expect(headings).toHaveLength(3);
        
        expect((headings[0] as Heading).level).toBe(1);
        expect((headings[0] as Heading).title).toBe('Title');
        
        expect((headings[1] as Heading).level).toBe(3);
        expect((headings[1] as Heading).title).toBe('Section One');
        
        expect((headings[2] as Heading).level).toBe(4);
        expect((headings[2] as Heading).title).toBe('Subsection');
    });

    test('parses heading with longer underline than title', () => {
        const input = `
Short
===========

Content follows.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(3);
        expect(heading.title).toBe('Short');
    });

    test('parses heading with exact length underline', () => {
        const input = `
Exact
=====

Text.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(3);
        expect(heading.title).toBe('Exact');
    });

    test('parses heading with special characters in title', () => {
        const input = `
Getting Started & Installation
===============================

Setup instructions.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(3);
        expect(heading.title).toBe('Getting Started & Installation');
    });

    test('parses heading level 1 with centered content', () => {
        const input = `
#####################
Welcome to Our Guide
#####################

Guide content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(1);
        expect(heading.title).toBe('Welcome to Our Guide');
    });

    test('parses heading without blank line after (still consumes)', () => {
        const input = `
Title
=====
Next paragraph starts here.
`;
        const result = parse(input);
        
        const heading = result.children[0] as Heading;
        expect(heading.type).toBe('heading');
        expect(heading.level).toBe(3);
        expect(heading.title).toBe('Title');
    });

    test('parses consecutive headings with different levels', () => {
        const input = `
#######
Main
#######

*******
Sub
*******

Details
=======

Content.
`;
        const result = parse(input);
        
        const headings = result.children.filter((child: any) => child.type === 'heading');
        expect(headings).toHaveLength(3);
        
        expect((headings[0] as Heading).level).toBe(1);
        expect((headings[1] as Heading).level).toBe(2);
        expect((headings[2] as Heading).level).toBe(3);
    });

    test('parses heading in RST document structure', () => {
        const input = `
#####################
Page Title
#####################

Introduction paragraph.

*******************
Section Heading
*******************

Section content.

Subsection Title
================

Subsection content with details.

Minor Heading
-------------

Minor section content.
`;
        const result = parse(input);
        
        const headings = result.children.filter((child: any) => child.type === 'heading');
        expect(headings.length).toBeGreaterThanOrEqual(4);
        
        expect((headings[0] as Heading).level).toBe(1);
        expect((headings[1] as Heading).level).toBe(2);
        expect((headings[2] as Heading).level).toBe(3);
        expect((headings[3] as Heading).level).toBe(4);
    });

    test('parses heading with all 6 levels', () => {
        const input = `
#######
H1
#######

*******
H2
*******

H3
==

H4
--

H5
^^

H6
""
`;
        const result = parse(input);
        
        const headings = result.children.filter((child: any) => child.type === 'heading');
        expect(headings).toHaveLength(6);
        
        for (let i = 1; i <= 6; i++) {
            expect((headings[i - 1] as Heading).level).toBe(i as 1 | 2 | 3 | 4 | 5 | 6);
            expect((headings[i - 1] as Heading).title).toBe(`H${i}`);
        }
    });
});

describe('RST Cards', () => {
    test('parses simple card without title', () => {
        const input = `
.. card::

   This is a simple card content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBeUndefined();
        expect(card.children).toHaveLength(1);
        expect((card.children[0] as Paragraph).type).toBe('paragraph');
    });

    test('parses card with title', () => {
        const input = `
.. card:: Card title

   Select the card to go to Example.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Card title');
        expect(card.children).toHaveLength(1);
    });

    test('parses card with link option', () => {
        const input = `
.. card:: Card with link
   :link: https://example.com

   Card content with a link.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Card with link');
        expect(card.options).toBeDefined();
        expect(card.options!.link).toBe('https://example.com');
    });

    test('parses card with class-card option', () => {
        const input = `
.. card:: Styled card
   :class-card: topic-card topic-card-8

   Card with custom classes.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Styled card');
        expect(card.options).toBeDefined();
        expect(card.options!['class-card']).toBe('topic-card topic-card-8');
    });

    test('parses card with multiple options', () => {
        const input = `
.. card:: Full featured card
   :class-card: topic-card topic-card-8
   :link: https://example.com

   Card content here.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Full featured card');
        expect(card.options).toBeDefined();
        expect(card.options!['class-card']).toBe('topic-card topic-card-8');
        expect(card.options!.link).toBe('https://example.com');
    });

    test('parses card with multiline content', () => {
        const input = `
.. card:: Multiline card

   First paragraph of card content.

   Second paragraph with more details.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Multiline card');
        expect(card.children).toHaveLength(2); // Two paragraphs
        expect((card.children[0] as Paragraph).type).toBe('paragraph');
        expect((card.children[1] as Paragraph).type).toBe('paragraph');
    });

    test('parses card with nested container', () => {
        const input = `
.. card:: Card with container

   .. container:: header-container

      Container content inside card.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.children).toHaveLength(1);
        
        const container = card.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toContain('header-container');
    });

    test('parses multiple cards in sequence', () => {
        const input = `
.. card:: Card 1

   First card content.

.. card:: Card 2

   Second card content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(2);
        
        const card1 = result.children[0] as Card;
        expect(card1.type).toBe('card');
        expect(card1.title).toBe('Card 1');
        
        const card2 = result.children[1] as Card;
        expect(card2.type).toBe('card');
        expect(card2.title).toBe('Card 2');
    });

    test('parses card with inline link in content', () => {
        const input = `
.. card:: Product card

   Learn more about our \`Product <https://example.com>\`_.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Product card');
        expect(card.children).toHaveLength(1);
    });

    test('parses card inside container', () => {
        const input = `
.. container:: variant-card

   .. card:: Nested card
      :class-card: topic-card

      Nested card content.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const container = result.children[0] as Container;
        expect(container.type).toBe('container');
        expect(container.classes).toContain('variant-card');
        
        const card = container.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.title).toBe('Nested card');
        expect(card.options!['class-card']).toBe('topic-card');
    });

    test('parses card with nested image', () => {
        const input = `
.. card:: Card with image

   .. image:: /path/to/image.png
      :alt: Card image
      :width: 200px

   Card content below image.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.children).toHaveLength(2); // Image + paragraph
        
        const image = card.children[0] as Image;
        expect(image.type).toBe('image');
        expect(image.uri).toBe('/path/to/image.png');
        expect(image.alt).toBe('Card image');
        expect(image.width).toBe('200px');
    });

    test('parses card with list content', () => {
        const input = `
.. card:: Card with list

   List items in card:

   * Item 1
   * Item 2
   * Item 3
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        // Should have paragraph + list
        expect(card.children.length).toBeGreaterThan(1);
        
        const listNode = card.children.find((child: any) => child.type === 'list');
        expect(listNode).toBeDefined();
        expect((listNode as any).children.length).toBe(3);
    });

    test('parses card with table content', () => {
        const input = `
.. card:: Card with table

   .. list-table::
      :header-rows: 1

      * - Column 1
        - Column 2
      * - Value 1
        - Value 2
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const card = result.children[0] as Card;
        expect(card.type).toBe('card');
        
        const table = card.children.find((child: any) => child.type === 'table');
        expect(table).toBeDefined();
    });

    test('parses complex product variant card', () => {
        const input = `
.. container:: variant-card

   .. card::
      :class-card: topic-card topic-card-8
      :link: https://variant-platform/windows

      .. container:: header-container

         Header content

      .. container:: topic-container

         QCS6490 with Windows (QCS6490.WIN)

      .. container:: topic-container-subtitle

         QCS6490.WIN is a product-specific software platform.
`;
        const result = parse(input);
        expect(result.children).toHaveLength(1);
        
        const outerContainer = result.children[0] as Container;
        expect(outerContainer.type).toBe('container');
        expect(outerContainer.classes).toContain('variant-card');
        
        const card = outerContainer.children[0] as Card;
        expect(card.type).toBe('card');
        expect(card.options!['class-card']).toBe('topic-card topic-card-8');
        expect(card.options!.link).toBe('https://variant-platform/windows');
        
        // Check for nested containers
        const containers = card.children.filter((child: any) => child.type === 'container');
        expect(containers.length).toBe(3);
    });
});


