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
 * - Purposeful-motion discipline: CSS animations require prefers-reduced-motion; no pulsing/blinking/marching-ants keyframes
 * - Editorial Paper palette conformance (no legacy #0f172a banners or #0b1020 canvases)
 */

import { spawnSync } from 'node:child_process';
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

  const hasCssAnim = /@keyframes\b|\banimation(?:-name|-duration)?\s*:/i.test(raw);
  if (hasCssAnim && !/prefers-reduced-motion/i.test(raw)) {
    issues.push(`${rel}: CSS animation must declare @media (prefers-reduced-motion: reduce)`);
  }

  const bannedKfMatch = raw.match(
    /@keyframes\s+((?:[a-z0-9_-]*(?:pulse|glow|blink|throb|shake|bounce)[a-z0-9_-]*)|(?:[a-z0-9_-]*-)?dash(?:-[a-z0-9_-]*)?)(?=\s*\{)/i,
  );
  if (bannedKfMatch) {
    issues.push(
      `${rel}: contains forbidden decorative/noisy keyframe @keyframes ${bannedKfMatch[1]}`,
    );
  }

  if (/fill=["']#0b1020["']|\bfill:\s*#0b1020\b|#0b1220\b/i.test(raw)) {
    issues.push(`${rel}: contains legacy dark #0b1020/#0b1220 canvas background`);
  }

  if (/<rect\b[^>]*fill=["']#0f172a["']/i.test(raw)) {
    issues.push(`${rel}: contains legacy dark #0f172a banner rectangle`);
  }

  return issues;
}

function validateXmlBatch(files, root) {
  const issues = [];
  const pyScript = [
    'import sys, xml.etree.ElementTree as ET',
    'for f in sys.argv[1:]:',
    '    try:',
    '        ET.parse(f)',
    '    except ET.ParseError as e:',
    '        print(f"{f}: invalid XML ({e})")',
  ].join('\n');

  const res = spawnSync('python3', ['-c', pyScript, ...files], { encoding: 'utf8' });
  if (!res.error && (res.status === 0 || res.stdout)) {
    for (const line of (res.stdout || '').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const sep = trimmed.indexOf(': invalid XML');
      if (sep !== -1) {
        const rel = relative(root, trimmed.slice(0, sep)) || trimmed.slice(0, sep);
        issues.push(`${rel}${trimmed.slice(sep)}`);
      } else {
        issues.push(trimmed);
      }
    }
    if (res.status !== 0 && issues.length === 0) {
      issues.push(`svg-check: python3 XML parser failed: ${(res.stderr || '').trim()}`);
    }
    return issues;
  }

  // Fallback check if python3 is unavailable
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    if (/\bfont-family="[^"]*"[^"]*"/.test(raw)) {
      const rel = relative(root, f) || f;
      issues.push(`${rel}: unescaped nested double quote in font-family attribute`);
    }
  }
  return issues;
}

const args = process.argv.slice(2);
const targets = args.length ? args : ['.'];
const root = process.cwd();
const files = targets.flatMap((t) => collectSvgs(t)).sort();

const allIssues = [...validateXmlBatch(files, root)];
for (const f of files) {
  allIssues.push(...validateSvg(f, root));
}

if (allIssues.length > 0) {
  for (const msg of allIssues) console.error(msg);
  console.error(`svg-check: ${allIssues.length} issue(s) across ${files.length} SVG files.`);
  process.exit(1);
}

console.log(`svg-check: ${files.length} SVG files passed.`);
