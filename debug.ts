import { parse } from './src/index';

const input = `.. flat-table:: Dummy Data Table
   :header-rows: 1
   :stub-columns: 1

   * - ..
     - Head 1
     - Head 2

   * - Row 1
     - Data 1.1
     - Data 1.2

   * - Row 2
     - Data 2.1
     - Data 2.2`;

const result = parse(input);
console.log(JSON.stringify(result, null, 2));



