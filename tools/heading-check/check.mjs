#!/usr/bin/env node
// Validates that every Markdown file has unique headings within the file.
// Duplicate headings break anchor links (#heading, #heading-1) and create ambiguous navigation.
// Exit code 1 on any duplicate heading found.
import { readdir, readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP = new Set([
  'node_modules',
  '.git',
  'styled-system',
  'dist',
  'build',
  '.mise',
  '.venv',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'research',
  'briefs',
]);

async function* walk(dir) {
  try {
    const s = statSync(dir);
    if (!s.isDirectory()) {
      if (dir.endsWith('.md')) yield dir;
      return;
    }
  } catch {
    return;
  }

  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

export function checkHeadings(content, filePath = '') {
  // Mask out fenced code blocks
  const masked = content.replace(/(```|~~~)[\s\S]*?\1/g, (m) =>
    m
      .split('\n')
      .map(() => '')
      .join('\n'),
  );
  const lines = masked.split('\n');
  const headings = new Map();
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const text = m[2].trim();
      const lineNum = i + 1;
      if (headings.has(text)) {
        headings.get(text).push(lineNum);
      } else {
        headings.set(text, [lineNum]);
      }
    }
  }

  for (const [text, lineNums] of headings.entries()) {
    if (lineNums.length > 1) {
      errors.push({
        filePath,
        text,
        lineNums,
        message: `Duplicate heading "${text}" on lines ${lineNums.join(', ')}`,
      });
    }
  }

  return errors;
}

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('.');

const cwd = process.cwd();
let totalFiles = 0;
let totalErrors = 0;

for (const root of roots) {
  for await (const file of walk(root)) {
    totalFiles++;
    const content = await readFile(file, 'utf8');
    const rel = relative(cwd, file);
    const errors = checkHeadings(content, rel);
    if (errors.length > 0) {
      totalErrors += errors.length;
      for (const err of errors) {
        console.error(`FAIL ${err.filePath}: ${err.message}`);
      }
    }
  }
}

if (totalErrors > 0) {
  console.error(`\nheading-check: ${totalErrors} duplicate heading(s) in ${totalFiles} file(s).`);
  process.exit(1);
} else {
  console.log(`heading-check: 0 duplicate headings across ${totalFiles} file(s)`);
  process.exit(0);
}
