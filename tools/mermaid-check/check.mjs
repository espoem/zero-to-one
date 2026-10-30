#!/usr/bin/env node
// Validates every ```mermaid fenced block in Markdown files under the given roots.
// Each diagram must parse with both Mermaid 11 and Mermaid 12 so it renders on GitHub
// regardless of which major GitHub currently ships. Exit code 1 on any failure.
import { JSDOM } from 'jsdom';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const engines = [];
for (const [name, spec] of [['mermaid@12', 'mermaid'], ['mermaid@11', 'mermaid11']]) {
  const { default: m } = await import(spec);
  m.initialize({ startOnLoad: false, securityLevel: 'strict' });
  engines.push([name, m]);
}

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
const cwd = process.cwd();
let total = 0, failed = 0;
for (const root of roots) {
  for await (const file of walk(root)) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const open = lines[i].match(/^(\s*)(`{3,}|~{3,})\s*mermaid\s*$/);
      if (!open) continue;
      const fence = open[2];
      const start = i + 1;
      const body = [];
      for (i = i + 1; i < lines.length && !lines[i].trimStart().startsWith(fence); i++) body.push(lines[i]);
      const src = body.join('\n');
      total++;
      for (const [name, m] of engines) {
        try {
          await m.parse(src);
        } catch (err) {
          failed++;
          const msg = String(err?.message ?? err).split('\n').slice(0, 3).join(' | ');
          console.log(`FAIL ${relative(cwd, file)}:${start} [${name}] ${msg}`);
          break;
        }
      }
    }
  }
}
console.log(`mermaid-check: ${total} diagram(s), ${failed} failing`);
process.exit(failed ? 1 : 0);
