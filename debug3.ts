import { ParserState } from './src/parser/state';

const bodyText = `* - ..
  - Head 1
  - Head 2

* - Row 1
  - Data 1.1
  - Data 1.2

* - Row 2
  - Data 2.1
  - Data 2.2`;

console.log("Body text:");
console.log(bodyText);
console.log("\n=== Line by line ===");

const lines = bodyText.split('\n');
lines.forEach((line, i) => {
    console.log(`Line ${i}: "${line}" (length: ${line.length}, trim: "${line.trim()}", indent: ${line.match(/^\s*/)?.[0].length})`);
});

const state = new ParserState(bodyText);
console.log("\n=== ParserState check ===");
for (let i = 0; i < 15 && state.peekLine(i) !== null; i++) {
    const line = state.peekLine(i);
    console.log(`Peek ${i}: "${line}" (starts with '* -': ${line?.trim().startsWith('* -')})`);
}
