#!/usr/bin/env node
// Validates every LaTeX / KaTeX math block and inline span in Markdown files under the given roots.
// Guarantees compatibility with GitHub Markdown math rendering. Exit code 1 on any failure.
import { readdir, readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import katex from 'katex';

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

function findLineAndCol(content, index) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

export function extractMath(content, options = {}) {
  const flavor = options.flavor || 'github';
  const formulas = [];
  const syntaxErrors = [];
  let clean = content;

  // 1. Match backtick-delimited inline math: $`...`$
  const backtickInlinePattern = /(?<!\\)\$`([^`\n]+?)`\$/g;
  const backtickMatches = [];
  let match;
  while ((match = backtickInlinePattern.exec(clean)) !== null) {
    const pos = findLineAndCol(content, match.index);
    backtickMatches.push({
      type: 'inline',
      raw: match[1].trim(),
      line: pos.line,
      col: pos.col,
      startIdx: match.index,
      endIdx: match.index + match[0].length,
    });
  }
  for (const b of backtickMatches) {
    formulas.push(b);
    const len = b.endIdx - b.startIdx;
    clean = clean.slice(0, b.startIdx) + ' '.repeat(len) + clean.slice(b.endIdx);
  }

  // 2. Check for ```math fenced code blocks
  const mathFencePattern = /```math\s*([\s\S]*?)```/g;
  const mathFences = [];
  while ((match = mathFencePattern.exec(clean)) !== null) {
    const pos = findLineAndCol(content, match.index);
    if (flavor === 'github') {
      syntaxErrors.push({
        line: pos.line,
        col: pos.col,
        type: 'syntax',
        raw: match[0],
        message:
          'GitHub does not render ```math code blocks as math; use $$...$$ on its own line instead',
      });
    } else if (flavor === 'gitlab') {
      formulas.push({
        type: 'display',
        raw: match[1].trim(),
        line: pos.line,
        col: pos.col,
      });
    }
    mathFences.push({ startIdx: match.index, endIdx: match.index + match[0].length });
  }
  for (const f of mathFences) {
    const len = f.endIdx - f.startIdx;
    clean = clean.slice(0, f.startIdx) + ' '.repeat(len) + clean.slice(f.endIdx);
  }

  // 3. Mask out all remaining fenced code blocks
  clean = clean.replace(/(```|~~~)[\s\S]*?\1/g, (m) => ' '.repeat(m.length));

  // 4. Mask out inline code `...`
  clean = clean.replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));

  // 5. Check for LaTeX-style \[...\] and \(...\) delimiters
  const bracketDisplayPattern = /\\\[([\s\S]*?)\\\]/g;
  while ((match = bracketDisplayPattern.exec(clean)) !== null) {
    const pos = findLineAndCol(content, match.index);
    syntaxErrors.push({
      line: pos.line,
      col: pos.col,
      type: 'syntax',
      raw: match[0],
      message:
        flavor === 'github'
          ? 'GitHub does not render \\[...\\] display math; use $$...$$ on its own line instead'
          : 'GitLab does not render \\[...\\] display math; use ```math blocks or $$...$$ instead',
    });
  }

  const parenInlinePattern = /\\\(([\s\S]*?)\\\)/g;
  while ((match = parenInlinePattern.exec(clean)) !== null) {
    const pos = findLineAndCol(content, match.index);
    syntaxErrors.push({
      line: pos.line,
      col: pos.col,
      type: 'syntax',
      raw: match[0],
      message:
        flavor === 'github'
          ? 'GitHub does not render \\(...\\) inline math; use $...$ or $`...`$ instead'
          : 'GitLab does not render \\(...\\) inline math; use $`...`$ or $...$ instead',
    });
  }

  // 6. Match display math $$...$$
  const displayPattern = /(?<!\\)\$\$([\s\S]*?)\$\$/g;
  const displayMatches = [];
  while ((match = displayPattern.exec(clean)) !== null) {
    const pos = findLineAndCol(content, match.index);
    displayMatches.push({
      type: 'display',
      raw: match[1].trim(),
      line: pos.line,
      col: pos.col,
      startIdx: match.index,
      endIdx: match.index + match[0].length,
    });
  }
  for (const d of displayMatches) {
    formulas.push(d);
    const len = d.endIdx - d.startIdx;
    clean = clean.slice(0, d.startIdx) + ' '.repeat(len) + clean.slice(d.endIdx);
  }

  // 7. Match inline math $...$ (supporting escaped \$ within formulas)
  const inlinePattern = /(?<!\\|\$)\$(?!\s|\d)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\$)/g;
  while ((match = inlinePattern.exec(clean)) !== null) {
    const rawFormula = match[1].trim();
    if (/^\d+([.,]\d+)?$/.test(rawFormula)) continue;
    const pos = findLineAndCol(content, match.index);
    formulas.push({
      type: 'inline',
      raw: rawFormula,
      line: pos.line,
      col: pos.col,
    });
  }

  return { formulas, syntaxErrors };
}

export function checkContent(content, filePath = '', options = {}) {
  const { formulas, syntaxErrors } = extractMath(content, options);
  const errors = [];

  for (const err of syntaxErrors) {
    errors.push({
      filePath,
      line: err.line,
      col: err.col,
      type: err.type,
      raw: err.raw,
      message: err.message,
    });
  }

  for (const f of formulas) {
    if (/\\operatorname\b/.test(f.raw)) {
      errors.push({
        filePath,
        line: f.line,
        col: f.col,
        type: 'forbidden-macro',
        raw: f.raw,
        message: 'The \\operatorname macro is forbidden; use \\mathrm{...} or \\text{...} instead.',
      });
    }

    if (/\\textunderscore\b/.test(f.raw)) {
      errors.push({
        filePath,
        line: f.line,
        col: f.col,
        type: 'forbidden-macro',
        raw: f.raw,
        message:
          'The \\textunderscore macro is unsupported in GitHub MathJax text mode; use hyphens (e.g. \\text{my-var}) instead.',
      });
    }

    if (/\\(?:llbracket|rrbracket)\b/.test(f.raw)) {
      errors.push({
        filePath,
        line: f.line,
        col: f.col,
        type: 'forbidden-macro',
        raw: f.raw,
        message:
          'The \\llbracket and \\rrbracket macros are unsupported in GitHub MathJax; use [\\![ and ]\\!] instead.',
      });
    }

    if (/\\(?:text|texttt|textsf|textbf|textit)\{[^{}]*\\?_[^{}]*\}/.test(f.raw)) {
      errors.push({
        filePath,
        line: f.line,
        col: f.col,
        type: 'text-underscore',
        raw: f.raw,
        message:
          'Underscores are forbidden in \\text{...} and \\texttt{...} (triggers "\'_\' allowed only in math mode" on GitHub); use hyphens or math mode instead.',
      });
    }

    try {
      katex.renderToString(f.raw, {
        displayMode: f.type === 'display',
        throwOnError: true,
      });
    } catch (err) {
      errors.push({
        filePath,
        line: f.line,
        col: f.col,
        type: f.type,
        raw: f.raw,
        message: err.message,
      });
    }
  }

  return { total: formulas.length, errors };
}

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rawArgs = process.argv.slice(2);
  let flavor = 'github';
  const roots = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--flavor=')) {
      flavor = arg.split('=')[1].toLowerCase();
    } else if (arg === '-f' || arg === '--flavor') {
      flavor = (rawArgs[++i] || 'github').toLowerCase();
    } else if (!arg.startsWith('-')) {
      roots.push(arg);
    }
  }

  if (roots.length === 0) roots.push('.');

  const cwd = process.cwd();
  let totalFormulas = 0;
  let totalErrors = 0;
  let totalFiles = 0;

  for (const root of roots) {
    for await (const file of walk(root)) {
      if (file.includes('/.agents/reviews/')) continue;
      totalFiles++;
      const content = await readFile(file, 'utf8');
      const rel = relative(cwd, file);
      const { total, errors } = checkContent(content, rel, { flavor });
      totalFormulas += total;
      if (errors.length > 0) {
        totalErrors += errors.length;
        for (const err of errors) {
          console.error(
            `FAIL ${err.filePath}:${err.line}:${err.col} [${err.type}] - ${err.message}`,
          );
          console.error(`  Formula: ${err.raw}`);
        }
      }
    }
  }

  if (totalErrors > 0) {
    console.error(
      `\nkatex-check: ${totalErrors} error(s) across ${totalFormulas} math expression(s) in ${totalFiles} file(s) (flavor: ${flavor}).`,
    );
    process.exit(1);
  } else {
    console.log(
      `katex-check: ${totalFormulas} math expression(s) across ${totalFiles} file(s), 0 failing`,
    );
    process.exit(0);
  }
}
