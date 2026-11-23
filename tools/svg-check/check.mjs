#!/usr/bin/env node
/**
 * tools/svg-check/check.mjs
 *
 * Static SVG validator for zero-to-one assets:
 * - Root <svg> ... </svg> wrapper present
 * - Valid 4-number viewBox with positive width and height
 * - No NaN, undefined, or Infinity numeric coordinates/dimensions
 * - No negative width or height on <rect>/<svg>
 * - All internal url(#id) references resolve to an id="..." in the same SVG
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.pi',
  '.scratch',
  'dist',
  'build',
  'target',
  '.venv',
]);

function collectSvgs(target, out = []) {
  const st = statSync(target);
  if (st.isFile()) {
    if (target.endsWith('.svg')) out.push(target);
    return out;
  }
  for (const ent of readdirSync(target, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(target, ent.name);
    if (ent.isDirectory()) collectSvgs(full, out);
    else if (ent.name.endsWith('.svg')) out.push(full);
  }
  return out;
}

function validateSvg(file, root) {
  const issues = [];
  const rel = relative(root, file) || file;
  const raw = readFileSync(file, 'utf8');

  if (!/<svg\b[\s\S]*<\/svg>\s*$/m.test(raw)) {
    issues.push(`${rel}: missing balanced <svg>...</svg> root`);
  }

  const vbMatch = raw.match(
    /viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/,
  );
  if (!vbMatch) {
    issues.push(`${rel}: missing or invalid 4-number viewBox`);
  } else {
    const [, , , w, h] = vbMatch.map(Number);
    if (!(w > 0 && h > 0)) {
      issues.push(`${rel}: viewBox width/height must be positive (${vbMatch[0]})`);
    }
  }

  if (
    /\b(?:x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|d|points|viewBox)=["'][^"']*(?:NaN|undefined|Infinity)[^"']*["']/i.test(
      raw,
    )
  ) {
    issues.push(`${rel}: contains NaN/undefined/Infinity in geometry attribute`);
  }

  for (const rm of raw.matchAll(/<(?:rect|svg)\b([^>]*)>/g)) {
    const attrs = rm[1];
    for (const k of ['width', 'height']) {
      const m = attrs.match(new RegExp(`\\b${k}=["'](-[\\d.]+)["']`));
      if (m) {
        issues.push(`${rel}: negative ${k}=${m[1]} on element`);
      }
    }
  }

  const ids = new Set();
  for (const im of raw.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(im[1]);
  for (const um of raw.matchAll(/url\(#([^)"'\s]+)\)/g)) {
    if (!ids.has(um[1])) {
      issues.push(`${rel}: dangling url(#${um[1]}) reference`);
    }
  }

  return issues;
}

const args = process.argv.slice(2);
const targets = args.length ? args : ['.'];
const root = process.cwd();
const files = targets.flatMap((t) => collectSvgs(t));

const allIssues = [];
for (const f of files.sort()) {
  allIssues.push(...validateSvg(f, root));
}

if (allIssues.length > 0) {
  for (const msg of allIssues) console.error(msg);
  console.error(`svg-check: ${allIssues.length} issue(s) across ${files.length} SVG files.`);
  process.exit(1);
}

console.log(`svg-check: ${files.length} SVG files passed.`);
