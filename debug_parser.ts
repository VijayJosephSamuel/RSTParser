import { ParserState } from './src/parser/state';
import { ListTableParser } from './src/parser/list-table';

const bodyText = `* - ..
  - Head 1
  - Head 2

* - Row 1
  - Data 1.1
  - Data 1.2

* - Row 2
  - Data 2.1
  - Data 2.2`;

console.log("Body text split by lines:");
const lines = bodyText.split('\n');
console.log(`Total lines: ${lines.length}`);
lines.forEach((line, i) => {
    console.log(`${i}: "${line}"`);
});

const state = new ParserState(bodyText);
console.log(`\nParserState.hasMoreLines(): ${state.hasMoreLines()}`);
console.log(`Lines in state: ${bodyText.split('\n').length}`);

const parser = new ListTableParser(state);
const result = parser.parse(1, 1, {'header-rows': '1', 'stub-columns': '1'});
console.log("\n=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
