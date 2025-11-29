import { parse } from './src/index';

const input = `.. grid:: 1

   .. grid-item-card:: Card 1
      :class-card: generic-card

      Content 1`;

console.log("Input:");
input.split('\n').forEach((line, i) => {
    console.log(`  ${i}: "${line}"`);
});

console.log("\nParsed:");
const result = parse(input);
console.log(JSON.stringify(result, null, 2));



