#!/usr/bin/env node
// Detects (and with --fix, removes) hard-wrapped prose in Markdown: a paragraph, list item or
// blockquote paragraph split across several source lines. Each paragraph must be one source line.
// Soft line breaks render as spaces, so joining lines does not change rendered output. Lines that
// end with an explicit hard break (two trailing spaces or a backslash) are left alone, as are
// fenced code, $$ math blocks, tables, headings, HTML lines, link reference definitions and
// thematic breaks. Exit code 1 if anything is wrapped (and --fix was not given).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP = new Set([
  'node_modules',
  '.git',
  'styled-system',
  'dist',
  'build',
  '.mise',
  'research',
  'briefs',
]);
const FIX = process.argv.includes('--fix');
const roots = process.argv.slice(2).filter((a) => a !== '--fix');
if (roots.length === 0) roots.push('.');

async function* walk(dir) {
  if (dir.endsWith('.md')) {
    yield dir;
    return;
  }
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

const FENCE = /^(\s*)(`{3,}|~{3,})/; // any indent: fences nested in list items count too
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(?=\S)/;
const QUOTE = /^(\s*(?:>\s?)+)/;

function blockStart(body) {
  const t = body.trim();
  return (
    t === '' ||
    /^#{1,6}(\s|$)/.test(t) ||
    t.startsWith('|') ||
    t.startsWith('<') ||
    t.startsWith('$$') ||
    /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.test(t) ||
    /^(`{3,}|~{3,})/.test(t) ||
    /^([-*_])(\s*\1){2,}\s*$/.test(t) ||
    /^\[[^\]]+\]:\s/.test(t) ||
    LIST.test(body) ||
    /^(=+|-+)\s*$/.test(t)
  );
}
const hardBreak = (line) => / {2,}$/.test(line) || line.endsWith('\\');

export function unwrap(src) {
  const lines = src.split('\n');
  const out = [];
  let fence = null,
    math = false,
    joins = 0,
    firstLine = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const f = line.replace(QUOTE, '').match(FENCE); // fences may sit inside blockquotes
    if (fence) {
      out.push(line);
      if (f && f[2][0] === fence[0] && f[2].length >= fence.length && line.trim() === f[2])
        fence = null;
      continue;
    }
    if (f) {
      fence = f[2];
      out.push(line);
      continue;
    }
    // Display math: opens on a line starting with $$ that has no closing $$, closes on the next line containing $$.
    if (math) {
      if (line.includes('$$')) math = false;
      out.push(line);
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      if ((line.match(/\$\$/g) || []).length === 1) math = true;
      out.push(line);
      continue;
    }
    const q = (line.match(QUOTE) || [''])[0];
    const body = line.slice(q.length);
    const isProse =
      body.trim() !== '' &&
      !/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.test(body.trim()) &&
      (!blockStart(body) || LIST.test(body)) &&
      !body.trim().startsWith('|') &&
      !body.trim().startsWith('<');
    if (isProse) {
      // absorb following continuation lines
      while (i + 1 < lines.length && !hardBreak(line)) {
        const next = lines[i + 1];
        if (FENCE.test(next.replace(QUOTE, ''))) break;
        const nq = (next.match(QUOTE) || [''])[0];
        if (nq.replace(/\s/g, '') !== q.replace(/\s/g, '')) break;
        const nbody = next.slice(nq.length);
        if (blockStart(nbody)) break;
        // Keep the next line's trailing hard break (two spaces or backslash) so the loop stops after it.
        line = line.replace(/\s+$/, '') + ' ' + nbody.replace(/^\s+/, '');
        joins++;
        firstLine.push(i + 1);
        i++;
      }
    }
    out.push(line);
  }
  return { text: out.join('\n'), joins, firstLine };
}

let files = 0,
  total = 0;
const cwd = process.cwd();
for (const root of roots) {
  for await (const file of walk(root)) {
    const src = await readFile(file, 'utf8');
    const { text, joins } = unwrap(src);
    if (!joins) continue;
    files++;
    total += joins;
    if (FIX) await writeFile(file, text);
    else
      console.log(
        `WRAPPED ${relative(cwd, file)}: line(s) ${unwrap(src).firstLine.join(', ')} continue the previous line`,
      );
  }
}
console.log(`wrap-check: ${total} wrapped line(s) in ${files} file(s)${FIX ? ' (fixed)' : ''}`);
process.exit(total && !FIX ? 1 : 0);
