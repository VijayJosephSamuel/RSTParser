import { parse } from './src/index';
import * as fs from 'fs';

const sample = `
Documentation
==============

Introduction
------------

This document demonstrates various RST elements including admonitions.

.. note:: Important Note
   
   This is a note admonition. It serves as an important notice that you should be aware of.

.. warning:: Be Careful
   
   This is a warning admonition. Pay attention to this potential issue.

Tips and Hints
--------------

.. tip:: Helpful Tip
   
   Here is a useful tip to improve your workflow.

.. hint:: Quick Hint
   
   A small hint to help you along the way.

Critical Information
--------------------

.. danger:: Dangerous Operation
   
   This operation could cause data loss or system damage.

.. error:: Error Condition
   
   An error has occurred that needs immediate attention.

.. attention:: Attention Required
   
   This requires your immediate attention.

.. important:: Important
   
   This information is important for successful completion.

.. caution:: Caution
   
   Exercise caution when proceeding with this action.

Complex Example
---------------

.. note:: Complex Note with Table
   
   This note contains structured data:

   .. list-table::
      :header-rows: 1

      * - Type
        - Description
      * - note
        - General information
      * - warning
        - Important warning
`;

console.log('Parsing sample RST with admonitions...');
const ast = parse(sample);
console.log(JSON.stringify(ast, null, 2));

