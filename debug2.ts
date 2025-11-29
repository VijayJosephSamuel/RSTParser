import { ParserState } from './src/parser/state';

const input = `* - ..
  - Head 1
  - Head 2

* - Row 1
  - Data 1.1
  - Data 1.2

* - Row 2
  - Data 2.1
  - Data 2.2`;

const state = new ParserState(input);
console.log('Lines:');
input.split('\n').forEach((line, i) => {
    console.log(`  ${i}: "${line}"`);
});

console.log('\nParsing:');
let count = 0;
while (state.hasMoreLines() && count < 20) {
    const line = state.peekLine();
    console.log(`\nLine ${count}: "${line}"`);
    console.log(`  startsWith("* -"): ${line?.trim().startsWith('* -')}`);
    console.log(`  startsWith("*-"): ${line?.trim().startsWith('*-')}`);
    console.log(`  trimmed: "${line?.trim()}"`);
    state.consumeLine();
    count++;
}
