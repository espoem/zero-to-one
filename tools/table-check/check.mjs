#!/usr/bin/env node
// Validates every Markdown table in .md files under the given roots.
// Verifies that pipes inside cells are escaped and table column counts are consistent.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'styled-system', 'dist', 'build', '.mise']);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('.');

let totalTables = 0;
let failedRows = 0;

for (const root of roots) {
  for await (const file of walk(root)) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');

    let inCode = false;
    let inTable = false;
    let headerCols = 0;
    let tableStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const stripped = lines[i].trim();

      if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
        inCode = !inCode;
        inTable = false;
        continue;
      }
      if (inCode) continue;

      if (stripped.startsWith('|') && stripped.endsWith('|')) {
        // Strip escaped pipes before counting column delimiters
        const clean = stripped.replaceAll('\\|', 'ESCAPED_PIPE');
        const cells = clean.split('|').slice(1, -1);
        const colCount = cells.length;

        if (!inTable) {
          inTable = true;
          totalTables++;
          tableStartLine = lineNum;
          headerCols = colCount;
        } else {
          // Check if separator row like |---|---|
          const isSeparator = cells.every((c) => /^:?-+:?$/.test(c.trim()));
          if (colCount !== headerCols) {
            failedRows++;
            console.error(
              `FAIL ${relative(process.cwd(), file)}:${lineNum} [table started L${tableStartLine}]: row has ${colCount} cols, expected ${headerCols}\n  ${stripped}`
            );
          }
        }
      } else {
        inTable = false;
      }
    }
  }
}

if (failedRows > 0) {
  console.error(`\ntable-check: ${totalTables} table(s), ${failedRows} failing row(s)`);
  process.exit(1);
} else {
  console.log(`table-check: ${totalTables} table(s), 0 failing`);
}
