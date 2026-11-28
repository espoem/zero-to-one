#!/usr/bin/env bun
/**
 * tools/svg-theme/restyle.ts
 *
 * Transforms the 217 legacy SVGs in zero-to-one into Variant A (Editorial Paper):
 * - Strips distracting pulsing/blinking/glowing/marching-ant keyframes while preserving
 *   purposeful step, state, and bounded SMIL packet-flow animations.
 * - Replaces dark #0b1020 / #0b1220 canvases and #0f172a header banners with the
 *   headerless Editorial Paper frame (#faf8f5, Georgia serif title + 1.2px #1c1917 rule).
 * - Harmonizes cool Tailwind slate/blue/indigo/emerald palettes to Editorial Paper tokens
 *   while preserving contrast inside solid pills, badges, and dark swatches.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EDITORIAL_FONTS, EDITORIAL_TOKENS } from './tokens.ts';

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

const HAND_CRAFTED_PHASE6 = new Set([
  'architecture/ai-engineering/assets/rag-pipeline-animated.svg',
  'architecture/ai-engineering/assets/agent-harness-animated.svg',
  'architecture/ai-engineering/assets/ai-security-stack-animated.svg',
  'architecture/system-design/assets/27-backend-patterns-animated.svg',
  'algorithms/ml-foundations/assets/kv-cache-8-ways-animated.svg',
  'algorithms/ml-foundations/assets/nn-mlp-animated.svg',
  'algorithms/ml-foundations/assets/nn-cnn-animated.svg',
  'algorithms/ml-foundations/assets/nn-lstm-animated.svg',
  'algorithms/ml-foundations/assets/nn-transformer-animated.svg',
  'algorithms/ml-foundations/assets/nn-autoencoder-animated.svg',
  'algorithms/ml-foundations/assets/nn-gan-animated.svg',
  'algorithms/ml-foundations/assets/nn-diffusion-animated.svg',
  'algorithms/ml-foundations/assets/nn-gnn-animated.svg',
]);

const BANNED_KEYFRAME_RE =
  /^(?:[a-z0-9_-]*(?:pulse|glow|blink|throb|shake|bounce)[a-z0-9_-]*|(?:[a-z0-9_-]*-)?dash(?:-[a-z0-9_-]*)?)$/i;

const DARK_SOLID_HEX = new Set([
  '#0f172a',
  '#1e293b',
  '#111827',
  '#020617',
  '#1c1917',
  '#0f766e',
  '#065f46',
  '#059669',
  '#10b981',
  '#0d9488',
  '#2563eb',
  '#1d4ed8',
  '#3b82f6',
  '#0284c7',
  '#0369a1',
  '#1e40af',
  '#1e3a8a',
  '#7c3aed',
  '#6d28d9',
  '#4f46e5',
  '#4338ca',
  '#6366f1',
  '#d97706',
  '#b45309',
  '#92400e',
  '#ea580c',
  '#c2410c',
  '#dc2626',
  '#e11d48',
  '#be123c',
  '#991b1b',
  '#ef4444',
]);

const LIGHT_COLOR_MAP: Record<string, string> = {
  '#f8fafc': EDITORIAL_TOKENS.bgPaper,
  '#f1f5f9': EDITORIAL_TOKENS.bgSubtle,
  '#e2e8f0': EDITORIAL_TOKENS.ruleHairline,
  '#cbd5e1': EDITORIAL_TOKENS.ruleStrong,
  '#94a3b8': EDITORIAL_TOKENS.ruleStrong,
  '#64748b': EDITORIAL_TOKENS.inkMuted,
  '#475569': EDITORIAL_TOKENS.inkBody,
  '#334155': EDITORIAL_TOKENS.inkBody,
  '#1e293b': EDITORIAL_TOKENS.inkPrimary,
  '#0f172a': EDITORIAL_TOKENS.inkPrimary,
  '#111827': EDITORIAL_TOKENS.inkPrimary,
  '#020617': EDITORIAL_TOKENS.inkPrimary,
  '#eff6ff': EDITORIAL_TOKENS.tealTint,
  '#dbeafe': EDITORIAL_TOKENS.tealTint,
  '#e0f2fe': EDITORIAL_TOKENS.tealTint,
  '#ecfdf5': EDITORIAL_TOKENS.tealTint,
  '#d1fae5': EDITORIAL_TOKENS.tealTint,
  '#f0fdfa': EDITORIAL_TOKENS.tealTint,
  '#ccfbf1': EDITORIAL_TOKENS.tealTint,
  '#93c5fd': EDITORIAL_TOKENS.tealBorder,
  '#60a5fa': EDITORIAL_TOKENS.tealBorder,
  '#38bdf8': EDITORIAL_TOKENS.tealInk,
  '#34d399': EDITORIAL_TOKENS.tealBorder,
  '#6ee7b7': EDITORIAL_TOKENS.tealBorder,
  '#a7f3d0': EDITORIAL_TOKENS.tealTint,
  '#2563eb': EDITORIAL_TOKENS.tealInk,
  '#1d4ed8': EDITORIAL_TOKENS.tealDark,
  '#1e40af': EDITORIAL_TOKENS.tealDark,
  '#1e3a8a': EDITORIAL_TOKENS.tealDark,
  '#3b82f6': EDITORIAL_TOKENS.tealInk,
  '#0284c7': EDITORIAL_TOKENS.tealInk,
  '#0369a1': EDITORIAL_TOKENS.tealDark,
  '#059669': EDITORIAL_TOKENS.tealInk,
  '#10b981': EDITORIAL_TOKENS.tealInk,
  '#0d9488': EDITORIAL_TOKENS.tealInk,
  '#047857': EDITORIAL_TOKENS.tealDark,
  '#065f46': EDITORIAL_TOKENS.tealDark,
  '#064e3b': EDITORIAL_TOKENS.tealDark,
  '#f3e8ff': EDITORIAL_TOKENS.bgSubtle,
  '#f5f3ff': EDITORIAL_TOKENS.bgSubtle,
  '#ede9fe': EDITORIAL_TOKENS.bgSubtle,
  '#eef2ff': EDITORIAL_TOKENS.bgSubtle,
  '#e0e7ff': EDITORIAL_TOKENS.bgSubtle,
  '#c4b5fd': EDITORIAL_TOKENS.ruleStrong,
  '#d8b4fe': EDITORIAL_TOKENS.ruleStrong,
  '#7c3aed': EDITORIAL_TOKENS.tealInk,
  '#6d28d9': EDITORIAL_TOKENS.tealDark,
  '#5b21b6': EDITORIAL_TOKENS.tealDark,
  '#4c1d95': EDITORIAL_TOKENS.tealDark,
  '#4f46e5': EDITORIAL_TOKENS.tealInk,
  '#4338ca': EDITORIAL_TOKENS.tealDark,
  '#6366f1': EDITORIAL_TOKENS.tealInk,
  '#3730a3': EDITORIAL_TOKENS.tealDark,
  '#fffbeb': EDITORIAL_TOKENS.amberTint,
  '#fef3c7': EDITORIAL_TOKENS.amberTint,
  '#ffedd5': EDITORIAL_TOKENS.amberTint,
  '#fed7aa': EDITORIAL_TOKENS.amberBorder,
  '#fde68a': EDITORIAL_TOKENS.amberBorder,
  '#fcd34d': EDITORIAL_TOKENS.amberBorder,
  '#fbbf24': EDITORIAL_TOKENS.amberInk,
  '#f59e0b': EDITORIAL_TOKENS.amberInk,
  '#d97706': EDITORIAL_TOKENS.amberInk,
  '#b45309': EDITORIAL_TOKENS.amberInk,
  '#92400e': EDITORIAL_TOKENS.amberDark,
  '#78350f': EDITORIAL_TOKENS.amberDark,
  '#ea580c': EDITORIAL_TOKENS.amberInk,
  '#c2410c': EDITORIAL_TOKENS.amberDark,
  '#fff1f2': EDITORIAL_TOKENS.dangerTint,
  '#fee2e2': EDITORIAL_TOKENS.dangerTint,
  '#fef2f2': EDITORIAL_TOKENS.dangerTint,
  '#ffe4e6': EDITORIAL_TOKENS.dangerTint,
  '#fecaca': '#fecaca',
  '#fca5a5': EDITORIAL_TOKENS.dangerInk,
  '#f87171': EDITORIAL_TOKENS.dangerInk,
  '#ef4444': EDITORIAL_TOKENS.dangerInk,
  '#e11d48': EDITORIAL_TOKENS.dangerInk,
  '#be123c': EDITORIAL_TOKENS.dangerDark,
  '#991b1b': EDITORIAL_TOKENS.dangerDark,
  '#9f1239': EDITORIAL_TOKENS.dangerDark,
  '#881337': EDITORIAL_TOKENS.dangerText,
};

function collectSvgs(dir: string, root: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) collectSvgs(full, root, out);
    else if (ent.name.endsWith('.svg')) {
      const rel = relative(root, full).replace(/\\/g, '/');
      if (!HAND_CRAFTED_PHASE6.has(rel)) out.push(full);
    }
  }
  return out.sort();
}

function getAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`));
  return m?.[1];
}

function setAttr(tag: string, name: string, value: string): string {
  const safeVal = value.replace(/"/g, '&quot;');
  const re = new RegExp(`(\\b${name}=["'])([^"']*)(["'])`);
  if (re.test(tag)) return tag.replace(re, `${name}="${safeVal}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${safeVal}"$1`);
}

function getViewBoxWidth(svg: string): number {
  const m = svg.match(/viewBox=["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)\s*["']/);
  return m ? Number(m[1]) : 1200;
}

/**
 * Brace-balanced CSS cleaner: removes only distracting pulse/glow/blink/dash-flow
 * @keyframes blocks and animation declarations referencing them; adds prefers-reduced-motion
 * when CSS animations remain.
 */
function cleanStyleCss(css: string): string {
  // Normalize misnamed sequential step highlights before stripping pulse/dash chrome
  let normalized = css
    .replace(/\bpulse-step-/g, 'step-hl-')
    .replace(/\btrace-pulse-/g, 'trace-hl-');

  const removedNames = new Set<string>();
  const keptChunks: string[] = [];
  let i = 0;

  while (i < normalized.length) {
    const rest = normalized.slice(i);
    const kfMatch = rest.match(/^(\s*)@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/);
    if (kfMatch) {
      const startBrace = i + kfMatch[0].length - 1;
      let depth = 1;
      let j = startBrace + 1;
      while (j < normalized.length && depth > 0) {
        if (normalized[j] === '{') depth++;
        else if (normalized[j] === '}') depth--;
        j++;
      }
      const kfName = kfMatch[2];
      const kfBlock = normalized.slice(i, j);
      const isPureDashOffset =
        /\bstroke-dashoffset\b/i.test(kfBlock) &&
        !/\b(?:opacity|transform|stroke-width)\b/i.test(kfBlock);
      if (BANNED_KEYFRAME_RE.test(kfName) || isPureDashOffset) {
        removedNames.add(kfName);
      } else {
        keptChunks.push(kfBlock);
      }
      i = j;
      continue;
    }

    const mediaMatch = rest.match(/^(\s*)@media\b[^{]*\{/);
    if (mediaMatch) {
      const startBrace = i + mediaMatch[0].length - 1;
      let depth = 1;
      let j = startBrace + 1;
      while (j < normalized.length && depth > 0) {
        if (normalized[j] === '{') depth++;
        else if (normalized[j] === '}') depth--;
        j++;
      }
      keptChunks.push(normalized.slice(i, j));
      i = j;
      continue;
    }

    const nextAt = normalized.indexOf('@', i + 1);
    if (nextAt === -1) {
      keptChunks.push(normalized.slice(i));
      break;
    }
    keptChunks.push(normalized.slice(i, nextAt));
    i = nextAt;
  }

  let out = keptChunks.join('');

  if (removedNames.size > 0) {
    const namesAlt = [...removedNames]
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    out = out.replace(
      new RegExp(`animation(?:-name)?\\s*:[^;{}]*\\b(?:${namesAlt})\\b[^;{}]*;?`, 'gi'),
      '',
    );
    // Remove rules left completely empty (whitespace only inside braces)
    out = out.replace(/[^{}@]+\{\s*\}/g, '');
  }

  // Strip excessive empty lines left by deleted blocks
  out = out.replace(/\n{3,}/g, '\n\n');

  const hasRemainingAnim = /@keyframes\b|\banimation(?:-name|-duration)?\s*:/i.test(out);
  if (hasRemainingAnim && !/prefers-reduced-motion/i.test(out)) {
    out = `${out.trimEnd()}\n      @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }\n    `;
  }

  return out;
}

function mapColorToken(hex: string, role: 'fill' | 'stroke' | 'text' | 'any'): string {
  const lower = hex.toLowerCase();
  if (lower === '#ffffff') return '#ffffff';
  if (role === 'text') {
    if (lower === '#94a3b8' || lower === '#cbd5e1') return EDITORIAL_TOKENS.inkMuted;
    if (lower === '#e2e8f0' || lower === '#f1f5f9' || lower === '#f8fafc')
      return EDITORIAL_TOKENS.inkPrimary;
  }
  return LIGHT_COLOR_MAP[lower] ?? hex;
}

function mapStyleBlockColors(css: string): string {
  return css.replace(/([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/gi, (_m, prop: string, hex: string) => {
    const p = prop.toLowerCase();
    if (p === 'fill' || p === 'stroke' || p === 'color' || p === 'stop-color') {
      const mapped = LIGHT_COLOR_MAP[hex.toLowerCase()] ?? hex;
      return `${prop}: ${mapped}`;
    }
    return `${prop}: ${hex}`;
  });
}

function restyleDarkCssSvg(svg: string): string {
  const vbW = getViewBoxWidth(svg);
  const darkClassMap: Record<string, string> = {
    '.bg': `fill: ${EDITORIAL_TOKENS.bgPaper};`,
    '.panel': `fill: ${EDITORIAL_TOKENS.bgSurface}; stroke: ${EDITORIAL_TOKENS.ruleStrong}; stroke-width: 1.2; rx: 6;`,
    '.box-blue': `fill: ${EDITORIAL_TOKENS.bgSubtle}; stroke: ${EDITORIAL_TOKENS.inkPrimary}; stroke-width: 1.2; rx: 4;`,
    '.box-green': `fill: ${EDITORIAL_TOKENS.tealTint}; stroke: ${EDITORIAL_TOKENS.tealInk}; stroke-width: 1.3; rx: 4;`,
    '.box-amber': `fill: ${EDITORIAL_TOKENS.amberTint}; stroke: ${EDITORIAL_TOKENS.amberInk}; stroke-width: 1.3; rx: 4;`,
    '.box-purple': `fill: ${EDITORIAL_TOKENS.bgSubtle}; stroke: ${EDITORIAL_TOKENS.tealDark}; stroke-width: 1.2; rx: 4;`,
    '.box-red': `fill: ${EDITORIAL_TOKENS.dangerTint}; stroke: ${EDITORIAL_TOKENS.dangerInk}; stroke-width: 1.3; rx: 4;`,
    '.col-2021': `fill: ${EDITORIAL_TOKENS.dangerTint}; stroke: ${EDITORIAL_TOKENS.dangerInk}; stroke-width: 1.2; rx: 4;`,
    '.col-2026': `fill: ${EDITORIAL_TOKENS.tealTint}; stroke: ${EDITORIAL_TOKENS.tealInk}; stroke-width: 1.3; rx: 4;`,
    '.dim-box': `fill: ${EDITORIAL_TOKENS.bgSubtle}; stroke: ${EDITORIAL_TOKENS.inkPrimary}; stroke-width: 1.2; rx: 4;`,
    '.title': `font-family: ${EDITORIAL_FONTS.serif}; font-size: 18px; font-weight: 700; fill: ${EDITORIAL_TOKENS.inkPrimary};`,
    '.subtitle': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 12px; fill: ${EDITORIAL_TOKENS.inkMuted};`,
    '.hdr': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 13.5px; font-weight: 700; fill: ${EDITORIAL_TOKENS.inkPrimary};`,
    '.sec-hdr': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 13px; font-weight: 700; fill: ${EDITORIAL_TOKENS.inkPrimary};`,
    '.lbl': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 12px; font-weight: 700; fill: ${EDITORIAL_TOKENS.inkPrimary};`,
    '.dim-txt': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 12px; font-weight: 700; fill: ${EDITORIAL_TOKENS.tealInk};`,
    '.txt': `font-family: ${EDITORIAL_FONTS.sans}; font-size: 11px; fill: ${EDITORIAL_TOKENS.inkBody};`,
    '.code': `font-family: ${EDITORIAL_FONTS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.inkPrimary};`,
    '.code-green': `font-family: ${EDITORIAL_FONTS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.tealDark};`,
    '.code-new': `font-family: ${EDITORIAL_FONTS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.tealDark};`,
    '.code-amber': `font-family: ${EDITORIAL_TOKENS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.amberDark};`,
    '.code-red': `font-family: ${EDITORIAL_FONTS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.dangerDark};`,
    '.code-old': `font-family: ${EDITORIAL_FONTS.mono}; font-size: 9.8px; fill: ${EDITORIAL_TOKENS.dangerDark};`,
    '.arrow': `stroke: ${EDITORIAL_TOKENS.inkPrimary}; stroke-width: 1.5; fill: none; marker-end: url(#arr-blue);`,
    '.arrow-green': `stroke: ${EDITORIAL_TOKENS.tealInk}; stroke-width: 1.6; fill: none; marker-end: url(#arr-green);`,
    '.arrow-amber': `stroke: ${EDITORIAL_TOKENS.amberInk}; stroke-width: 1.6; stroke-dasharray: 5,4; fill: none; marker-end: url(#arr-amber);`,
  };

  let out = svg.replace(/<style>([\s\S]*?)<\/style>/i, (_m, css: string) => {
    let cleaned = cleanStyleCss(css);
    cleaned = cleaned.replace(/(\.[a-zA-Z0-9_-]+)\s*\{[^}]*\}/g, (rule, sel: string) => {
      return darkClassMap[sel] ? `${sel} { ${darkClassMap[sel]} }` : mapStyleBlockColors(rule);
    });
    return `<style>${cleaned}</style>`;
  });

  // Update marker path colors & inline attribute colors
  out = out
    .replace(
      /(<marker\b[^>]*id=["']arr-blue["'][\s\S]*?fill=["'])[^"']+["']/gi,
      `$1${EDITORIAL_TOKENS.inkPrimary}"`,
    )
    .replace(
      /(<marker\b[^>]*id=["']arr-green["'][\s\S]*?fill=["'])[^"']+["']/gi,
      `$1${EDITORIAL_TOKENS.tealInk}"`,
    )
    .replace(
      /(<marker\b[^>]*id=["']arr-amber["'][\s\S]*?fill=["'])[^"']+["']/gi,
      `$1${EDITORIAL_TOKENS.amberInk}"`,
    )
    .replace(/<rect\b([^>]*class=["']bg["'][^>]*)>/i, (_m, attrs: string) => {
      let tag = `<rect${attrs}>`;
      tag = setAttr(tag, 'rx', '4');
      tag = setAttr(tag, 'stroke', EDITORIAL_TOKENS.ruleHairline);
      tag = setAttr(tag, 'stroke-width', '1');
      return tag;
    });

  // Insert hairline rule under subtitle if not already present
  if (!/<line\b[^>]*stroke=["']#1c1917["']/.test(out)) {
    out = out.replace(
      /(<text\b[^>]*class=["']subtitle["'][^>]*>[\s\S]*?<\/text>)/i,
      `$1\n  <line x1="24" y1="60" x2="${vbW - 24}" y2="60" stroke="${EDITORIAL_TOKENS.inkPrimary}" stroke-width="1.2"/>`,
    );
  }

  // Convert any remaining inline hex colors on elements outside markers/rects with white text
  out = out.replace(
    /\b(fill|stroke)=["'](#[0-9a-fA-F]{6})["']/gi,
    (_m, attr: string, hex: string) => {
      const low = hex.toLowerCase();
      if (low === '#ffffff') return `${attr}="${hex}"`;
      if (low === '#0b1020') return `${attr}="${EDITORIAL_TOKENS.bgPaper}"`;
      if (low === '#121a30' || low === '#16223f') return `${attr}="${EDITORIAL_TOKENS.bgSurface}"`;
      if (low === '#2b3b66') return `${attr}="${EDITORIAL_TOKENS.ruleStrong}"`;
      return `${attr}="${LIGHT_COLOR_MAP[low] ?? hex}"`;
    },
  );

  return out;
}

function restyleDarkGradientSvg(svg: string): string {
  const vbW = getViewBoxWidth(svg);
  const darkGradientColorMap: Record<string, string> = {
    '#0b1220': EDITORIAL_TOKENS.bgPaper,
    '#131c31': EDITORIAL_TOKENS.bgPaper,
    '#111c33': EDITORIAL_TOKENS.bgPaper,
    '#24344d': EDITORIAL_TOKENS.ruleHairline,
    '#17233b': EDITORIAL_TOKENS.bgSurface,
    '#132038': EDITORIAL_TOKENS.bgSurface,
    '#1b3054': EDITORIAL_TOKENS.bgSubtle,
    '#1e3a5f': EDITORIAL_TOKENS.tealTint,
    '#17253f': EDITORIAL_TOKENS.bgSubtle,
    '#172a45': EDITORIAL_TOKENS.bgSubtle,
    '#101b2f': EDITORIAL_TOKENS.bgSubtle,
    '#1e293b': EDITORIAL_TOKENS.bgSubtle,
    '#0f172a': EDITORIAL_TOKENS.inkPrimary,
    '#2a3d5e': EDITORIAL_TOKENS.ruleStrong,
    '#334155': EDITORIAL_TOKENS.ruleStrong,
    '#475569': EDITORIAL_TOKENS.ruleStrong,
    '#64748b': EDITORIAL_TOKENS.inkMuted,
    '#94a3b8': EDITORIAL_TOKENS.inkMuted,
    '#a8a29e': EDITORIAL_TOKENS.inkMuted,
    '#cbd5e1': EDITORIAL_TOKENS.inkBody,
    '#e2e8f0': EDITORIAL_TOKENS.inkPrimary,
    '#f8fafc': EDITORIAL_TOKENS.inkPrimary,
    '#3b2314': EDITORIAL_TOKENS.amberTint,
    '#422006': EDITORIAL_TOKENS.amberTint,
    '#422a08': EDITORIAL_TOKENS.amberTint,
    '#1c1917': EDITORIAL_TOKENS.amberTint,
    '#78350f': EDITORIAL_TOKENS.amberInk,
    '#f59e0b': EDITORIAL_TOKENS.amberInk,
    '#fbbf24': EDITORIAL_TOKENS.amberInk,
    '#fcd34d': EDITORIAL_TOKENS.amberDark,
    '#fde68a': EDITORIAL_TOKENS.amberDark,
    '#fef3c7': EDITORIAL_TOKENS.amberDark,
    '#0f362c': EDITORIAL_TOKENS.tealTint,
    '#0d2621': EDITORIAL_TOKENS.tealTint,
    '#143832': EDITORIAL_TOKENS.tealTint,
    '#0f2920': EDITORIAL_TOKENS.tealTint,
    '#1b4332': EDITORIAL_TOKENS.tealTint,
    '#14532d': EDITORIAL_TOKENS.tealTint,
    '#059669': EDITORIAL_TOKENS.tealInk,
    '#34d399': EDITORIAL_TOKENS.tealInk,
    '#6ee7b7': EDITORIAL_TOKENS.tealDark,
    '#a7f3d0': EDITORIAL_TOKENS.tealDark,
    '#86efac': EDITORIAL_TOKENS.tealDark,
    '#dcfce7': EDITORIAL_TOKENS.tealDark,
    '#38bdf8': EDITORIAL_TOKENS.tealInk,
    '#bae6fd': EDITORIAL_TOKENS.tealDark,
    '#2e1d52': EDITORIAL_TOKENS.bgSubtle,
    '#3b0764': EDITORIAL_TOKENS.bgSubtle,
    '#1e1b3a': EDITORIAL_TOKENS.bgSubtle,
    '#4c1d95': EDITORIAL_TOKENS.tealDark,
    '#a78bfa': EDITORIAL_TOKENS.tealInk,
    '#c084fc': EDITORIAL_TOKENS.tealInk,
    '#c4b5fd': EDITORIAL_TOKENS.tealDark,
    '#d8b4fe': EDITORIAL_TOKENS.tealDark,
    '#f3e8ff': EDITORIAL_TOKENS.tealDark,
    '#45121d': EDITORIAL_TOKENS.dangerTint,
    '#3f1520': EDITORIAL_TOKENS.dangerTint,
    '#f87171': EDITORIAL_TOKENS.dangerInk,
    '#fca5a5': EDITORIAL_TOKENS.dangerDark,
    '#fecaca': EDITORIAL_TOKENS.dangerDark,
    '#7f1d1d': EDITORIAL_TOKENS.dangerDark,
  };

  let out = svg;

  // Replace root gradient background rect with Editorial Paper canvas rect
  out = out.replace(
    /<rect\b[^>]*x=["']0["'][^>]*y=["']0["'][^>]*fill=["']url\(#[^)]+\)["'][^>]*\/?>/i,
    () => {
      const vbHMatch = out.match(
        /viewBox=["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+[\d.]+[,\s]+([\d.]+)\s*["']/,
      );
      const vbH = vbHMatch ? vbHMatch[1] : '720';
      return `<rect x="0" y="0" width="${vbW}" height="${vbH}" rx="4" fill="${EDITORIAL_TOKENS.bgPaper}" stroke="${EDITORIAL_TOKENS.ruleHairline}" stroke-width="1"/>`;
    },
  );

  // Remove dark background <linearGradient> blocks referencing #0b1220
  out = out.replace(/<linearGradient\b[^>]*>[\s\S]*?#0b1220[\s\S]*?<\/linearGradient>\s*/gi, '');

  // Clean style CSS if any
  out = out.replace(
    /<style>([\s\S]*?)<\/style>/i,
    (_m, css: string) => `<style>${cleanStyleCss(css)}</style>`,
  );

  // Map dark hexes FIRST so header title/subtitle stay dark charcoal (never re-mapped to #fffbeb)
  out = out.replace(/<([a-zA-Z0-9]+)\b([^>]*)>/g, (tag, tagName: string) => {
    if (tagName === 'rect') {
      const rx = getAttr(tag, 'rx');
      let updated = tag;
      if (rx && Number(rx) >= 12) updated = setAttr(updated, 'rx', '6');
      return updated.replace(
        /\b(fill|stroke)=["'](#[0-9a-fA-F]{6})["']/gi,
        (_a, k: string, hex: string) => {
          const low = hex.toLowerCase();
          if (k === 'fill' && low === '#0f172a') return `fill="${EDITORIAL_TOKENS.bgSubtle}"`;
          return `${k}="${darkGradientColorMap[low] ?? hex}"`;
        },
      );
    }
    return tag.replace(
      /\b(fill|stroke|stop-color)=["'](#[0-9a-fA-F]{6})["']/gi,
      (_a, k: string, hex: string) => {
        const low = hex.toLowerCase();
        if (k === 'fill' && tagName === 'text' && low === '#ffffff')
          return `fill="${EDITORIAL_TOKENS.inkPrimary}"`;
        if (k === 'stroke' && (low === '#1c1917' || low === '#0f172a'))
          return `${k}="${EDITORIAL_TOKENS.inkPrimary}"`;
        return `${k}="${darkGradientColorMap[low] ?? hex}"`;
      },
    );
  });

  // Apply Georgia serif title + hairline rule AFTER color mapping
  let addedRule = false;
  out = out.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi, (m, attrs: string, body: string) => {
    const y = Number(getAttr(m, 'y') ?? 999);
    const fs = Number(getAttr(m, 'font-size') ?? 12);
    if (y <= 52 && fs >= 18) {
      let t = setAttr(m, 'fill', EDITORIAL_TOKENS.inkPrimary);
      t = setAttr(t, 'font-family', EDITORIAL_FONTS.serif);
      return t;
    }
    if (y > 48 && y <= 75 && fs <= 14) {
      let t = setAttr(m, 'fill', EDITORIAL_TOKENS.inkMuted);
      t = setAttr(t, 'font-family', EDITORIAL_FONTS.sans);
      if (!addedRule) {
        addedRule = true;
        return `${t}\n  <line x1="36" y1="${Math.round(y + 11)}" x2="${vbW - 36}" y2="${Math.round(y + 11)}" stroke="${EDITORIAL_TOKENS.inkPrimary}" stroke-width="1.2"/>`;
      }
      return t;
    }
    return `<text${attrs}>${body}</text>`;
  });

  return out;
}

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseTranslate(tag: string): [number, number] {
  const tr = getAttr(tag, 'transform');
  if (!tr) return [0, 0];
  const m = tr.match(/translate\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/);
  if (!m) return [0, 0];
  return [Number(m[1]) || 0, Number(m[2] ?? 0) || 0];
}

function parseDarkBoxes(svg: string, vbW: number): BoxRect[] {
  const boxes: BoxRect[] = [];
  const stack: Array<[number, number]> = [[0, 0]];
  for (const m of svg.matchAll(/<\/?g\b[^>]*>|<(?:rect|circle)\b[^>]*>/gi)) {
    const tok = m[0];
    if (/^<\/g/i.test(tok)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (/^<g\b/i.test(tok)) {
      const [topX, topY] = stack[stack.length - 1];
      const [dx, dy] = parseTranslate(tok);
      stack.push([topX + dx, topY + dy]);
      continue;
    }
    const [ox, oy] = stack[stack.length - 1];
    const fill = (getAttr(tok, 'fill') ?? '').toLowerCase();
    if (!DARK_SOLID_HEX.has(fill)) continue;

    if (/^<circle\b/i.test(tok)) {
      const cx = (Number(getAttr(tok, 'cx') ?? 0) || 0) + ox;
      const cy = (Number(getAttr(tok, 'cy') ?? 0) || 0) + oy;
      const r = Number(getAttr(tok, 'r') ?? 0) || 0;
      if (r > 0) boxes.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
      continue;
    }

    const x = (Number(getAttr(tok, 'x') ?? 0) || 0) + ox;
    const y = (Number(getAttr(tok, 'y') ?? 0) || 0) + oy;
    const w = Number(getAttr(tok, 'width') ?? 0) || 0;
    const h = Number(getAttr(tok, 'height') ?? 0) || 0;
    if (w <= 0 || h <= 0) continue;
    // Skip any remaining full-width banner strip
    if (w >= vbW * 0.8 && y <= 60 && h <= 80) continue;
    boxes.push({ x, y, w, h });
  }
  return boxes;
}

function isInsideDarkBox(x: number, y: number, boxes: BoxRect[]): boolean {
  for (const b of boxes) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

function restyleLightSvg(svg: string): string {
  const vbW = getViewBoxWidth(svg);
  let out = svg;

  // 1. Clean style CSS & harmonize CSS colors
  out = out.replace(/<style>([\s\S]*?)<\/style>/i, (_m, css: string) => {
    const cleaned = cleanStyleCss(css);
    return `<style>${mapStyleBlockColors(cleaned)}</style>`;
  });

  // 2. Detect header banner height (top-level #0f172a banner at x="0" y="0")
  let bannerH = 0;
  for (const m of out.matchAll(/<rect\b[^>]*>/gi)) {
    const tag = m[0];
    const fill = (getAttr(tag, 'fill') ?? '').toLowerCase();
    const x = Number(getAttr(tag, 'x') ?? -1);
    const y = Number(getAttr(tag, 'y') ?? -1);
    const w = Number(getAttr(tag, 'width') ?? 0);
    const h = Number(getAttr(tag, 'height') ?? 0);
    if (fill === '#0f172a' && x === 0 && w >= vbW * 0.8 && y <= 55 && h <= 80) {
      bannerH = Math.max(bannerH, y + h);
    }
  }

  // 3. Remove #0f172a header banner rects & cap rects; replace outer #f8fafc/#ffffff canvas rect
  let insertedHeaderRule = false;
  out = out.replace(/<rect\b([^>]*)>/gi, (tag) => {
    const fill = (getAttr(tag, 'fill') ?? '').toLowerCase();
    const x = Number(getAttr(tag, 'x') ?? -1);
    const y = Number(getAttr(tag, 'y') ?? -1);
    const w = Number(getAttr(tag, 'width') ?? 0);
    const h = Number(getAttr(tag, 'height') ?? 0);

    if (
      x === 0 &&
      y === 0 &&
      w >= vbW * 0.9 &&
      h > 150 &&
      (fill === '#f8fafc' || fill === '#ffffff' || fill === '#faf8f5')
    ) {
      let t = setAttr(tag, 'fill', EDITORIAL_TOKENS.bgPaper);
      t = setAttr(t, 'rx', '4');
      t = setAttr(t, 'stroke', EDITORIAL_TOKENS.ruleHairline);
      t = setAttr(t, 'stroke-width', '1');
      return t;
    }

    if (bannerH > 0 && fill === '#0f172a' && x === 0 && w >= vbW * 0.8 && y <= 55 && h <= 80) {
      if (!insertedHeaderRule && y === 0) {
        insertedHeaderRule = true;
        return `<line x1="24" y1="${bannerH + 2}" x2="${vbW - 24}" y2="${bannerH + 2}" stroke="${EDITORIAL_TOKENS.inkPrimary}" stroke-width="1.2"/>`;
      }
      return '';
    }

    return tag;
  });

  // Collect dark pill/badge/circle coordinates in global SVG space
  const darkBoxes = parseDarkBoxes(out, vbW);

  // 4. Walk tags tracking <g transform="translate"> offsets so local <text> coordinates match darkBoxes cleanly
  const gStack: Array<[number, number]> = [[0, 0]];
  out = out.replace(/<\/?[a-zA-Z0-9]+\b[^>]*>/gi, (tag) => {
    if (/^<\/g\b/i.test(tag)) {
      if (gStack.length > 1) gStack.pop();
      return tag;
    }
    if (/^<g\b/i.test(tag)) {
      const [ox, oy] = gStack[gStack.length - 1];
      const [dx, dy] = parseTranslate(tag);
      gStack.push([ox + dx, oy + dy]);
      return tag.replace(
        /\b(fill|stroke)=["'](#[0-9a-fA-F]{6})["']/gi,
        (_m, attr: string, hex: string) => {
          const mapped = mapColorToken(hex, attr.toLowerCase() === 'stroke' ? 'stroke' : 'fill');
          return `${attr}="${mapped}"`;
        },
      );
    }

    const nameMatch = tag.match(/^<([a-zA-Z0-9]+)/);
    const name = nameMatch ? nameMatch[1].toLowerCase() : '';
    const [ox, oy] = gStack[gStack.length - 1];

    if (name === 'text') {
      const absX = (Number(getAttr(tag, 'x') ?? 0) || 0) + ox;
      const absY = (Number(getAttr(tag, 'y') ?? 999) || 999) + oy;
      const fill = (getAttr(tag, 'fill') ?? '').toLowerCase();
      const insideDark = isInsideDarkBox(absX, absY, darkBoxes);

      if (bannerH > 0 && absY <= bannerH && !insideDark) {
        if (fill === '#f8fafc' || fill === '#ffffff' || fill === '#f1f5f9' || fill === '#e2e8f0') {
          let t = setAttr(tag, 'fill', EDITORIAL_TOKENS.inkPrimary);
          t = setAttr(t, 'font-family', EDITORIAL_FONTS.serif);
          return t;
        }
        if (fill === '#94a3b8' || fill === '#cbd5e1' || fill === '#64748b') {
          let t = setAttr(tag, 'fill', EDITORIAL_TOKENS.inkMuted);
          t = setAttr(t, 'font-family', EDITORIAL_FONTS.sans);
          return t;
        }
      }

      if (insideDark) {
        if (fill === '#ffffff' || fill === '#f8fafc' || fill === '#f1f5f9' || fill === '#e2e8f0') {
          return setAttr(tag, 'fill', '#ffffff');
        }
        if (fill === '#fbbf24' || fill === '#fcd34d' || fill === '#fde68a')
          return setAttr(tag, 'fill', '#fde68a');
        if (fill === '#38bdf8' || fill === '#93c5fd') return setAttr(tag, 'fill', '#99f6e4');
      }
    }

    return tag.replace(
      /\b(fill|stroke|stop-color)=["'](#[0-9a-fA-F]{6})["']/gi,
      (_m, attr: string, hex: string) => {
        const mapped = mapColorToken(
          hex,
          attr === 'fill' && name === 'text'
            ? 'text'
            : attr.toLowerCase() === 'stroke'
              ? 'stroke'
              : 'fill',
        );
        return `${attr}="${mapped}"`;
      },
    );
  });

  return out;
}

function restyleSvg(raw: string): string {
  if (/#0b1020/i.test(raw)) return restyleDarkCssSvg(raw);
  if (/#0b1220/i.test(raw)) return restyleDarkGradientSvg(raw);
  return restyleLightSvg(raw);
}

const root = process.cwd();
const files = collectSvgs(root, root);
let updated = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = restyleSvg(before);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    updated++;
  }
}

console.log(`restyle.ts: processed ${files.length} legacy SVGs, updated ${updated} files.`);
