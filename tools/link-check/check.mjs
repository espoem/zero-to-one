#!/usr/bin/env node
// Checks every relative Markdown link and #anchor in .md files under the given roots.
// Anchors use GitHub's heading-slug algorithm (github-slugger): lower-case, strip punctuation
// except '-' and '_', spaces to '-', duplicate headings get -1, -2, ... suffixes.
// Links into tracks listed in PENDING (planned but not yet written) are reported as warnings.
// Exit code 1 if any link is broken.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, relative, normalize, resolve } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'styled-system', 'dist', 'build', '.mise', 'research', 'briefs']);
const PENDING = (process.env.LINK_CHECK_PENDING ?? '').split(',').filter(Boolean);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

export function slug(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

const anchorCache = new Map();
async function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set();
  const seen = new Map();
  let fence = null;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1]; else if (line.trim().startsWith(fence)) fence = null; continue; }
    if (fence) continue;
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (h) {
      // Strip emphasis markers only outside inline code: GitHub keeps underscores inside `code`.
      const text = h[1].split(/(`[^`]*`)/).map((part) =>
        part.startsWith('`') ? part.slice(1, -1) : part.replace(/\*\*|__/g, '').replace(/(^|\s)[*_]|[*_](\s|$)/g, '$1$2'),
      ).join('');
      const base = slug(text);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      set.add(n === 0 ? base : `${base}-${n}`);
    }
    for (const m of line.matchAll(/<a\s+(?:name|id)=["']([^"']+)["']/g)) set.add(m[1]);
  }
  anchorCache.set(file, set);
  return set;
}

async function exists(p) { try { return await stat(p); } catch { return null; } }

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('.');
const cwd = process.cwd();
let total = 0, broken = 0, pending = 0;
for (const root of roots) {
  for await (const file of walk(root)) {
    // Blank out fenced code and inline code but keep line breaks, so reported line numbers stay accurate.
    const blank = (s) => s.replace(/[^\n]/g, ' ');
    const text = (await readFile(file, 'utf8'))
      .replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, blank)
      .replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, blank);
    for (const m of text.matchAll(/\]\(([^()\s]+(?:\([^()\s]*\))?[^()\s]*)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      total++;
      const [path, frag] = target.split('#');
      const abs = path ? normalize(join(dirname(file), decodeURIComponent(path))) : file;
      const st = await exists(abs);
      let problem = null;
      if (!st) problem = 'missing target';
      else if (frag && st.isFile() && abs.endsWith('.md') && !(await anchors(abs)).has(decodeURIComponent(frag).toLowerCase())) problem = 'missing anchor';
      if (!problem) continue;
      const rel = relative(resolve(roots[0]), resolve(abs));
      if (problem === 'missing target' && PENDING.some((p) => rel.startsWith(p))) { pending++; continue; }
      broken++;
      const line = text.slice(0, m.index).split('\n').length;
      console.log(`BROKEN ${relative(cwd, file)}:${line} -> ${target} (${problem})`);
    }
  }
}
console.log(`link-check: ${total} link(s), ${broken} broken, ${pending} to pending tracks`);
process.exit(broken ? 1 : 0);
