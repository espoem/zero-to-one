/**
 * Shared Variant A — Editorial Paper design tokens and SVG header/canvas helpers
 * used across tools/svg-theme/ and diagram generation scripts.
 */

export const EDITORIAL_TOKENS = {
  bgPaper: '#faf8f5',
  bgSurface: '#ffffff',
  bgSubtle: '#f5f1e8',
  inkPrimary: '#1c1917',
  inkBody: '#44403c',
  inkMuted: '#57534e',
  inkCaption: '#78716c',
  ruleStrong: '#d6d0c4',
  ruleHairline: '#e7e2d8',
  tealInk: '#0f766e',
  tealDark: '#065f46',
  tealTint: '#f0fdf9',
  tealBorder: '#99f6e4',
  amberInk: '#b45309',
  amberDark: '#92400e',
  amberTint: '#fffbeb',
  amberBorder: '#fde68a',
  dangerInk: '#dc2626',
  dangerDark: '#991b1b',
  dangerText: '#7f1d1d',
  dangerTint: '#fef2f2',
} as const;

export const EDITORIAL_FONTS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export function editorialArrowDefs(): string {
  return `<defs>
    <marker id="ed-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M1,2 L9,5 L1,8" fill="none" stroke="${EDITORIAL_TOKENS.inkPrimary}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="ed-arr-teal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M1,2 L9,5 L1,8" fill="none" stroke="${EDITORIAL_TOKENS.tealInk}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="ed-arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M1,2 L9,5 L1,8" fill="none" stroke="${EDITORIAL_TOKENS.amberInk}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="ed-arr-danger" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M1,2 L9,5 L1,8" fill="none" stroke="${EDITORIAL_TOKENS.dangerInk}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <style>
    .ed-serif { font-family: ${EDITORIAL_FONTS.serif}; }
    .ed-sans { font-family: ${EDITORIAL_FONTS.sans}; }
    .ed-mono { font-family: ${EDITORIAL_FONTS.mono}; }
  </style>`;
}

export function editorialCanvas(width: number, height: number): string {
  return `<rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="${EDITORIAL_TOKENS.bgPaper}" stroke="${EDITORIAL_TOKENS.ruleHairline}" stroke-width="1"/>`;
}

export function editorialHeader(
  width: number,
  kicker: string,
  title: string,
  subtitle?: string,
): string {
  const right = width - 32;
  const sub = subtitle
    ? `\n  <text x="32" y="88" class="ed-sans" font-size="11.5" fill="${EDITORIAL_TOKENS.inkMuted}">${subtitle}</text>`
    : '';
  return `<text x="32" y="32" class="ed-mono" font-size="10.5" fill="${EDITORIAL_TOKENS.inkCaption}" letter-spacing="1.4">${kicker}</text>
  <text x="32" y="56" class="ed-serif" font-size="19" font-weight="700" fill="${EDITORIAL_TOKENS.inkPrimary}">${title}</text>
  <line x1="32" y1="68" x2="${right}" y2="68" stroke="${EDITORIAL_TOKENS.inkPrimary}" stroke-width="1.2"/>${sub}`;
}

export const EDITORIAL_MOTION_NOTE =
  'Calm stroke/state highlights only (no pulse/blink/dash-flow); every CSS animation declares @media (prefers-reduced-motion: reduce).';

/** Generates non-colliding sequential stroke-highlight keyframes over `steps` stages. */
export function editorialStepStyle(
  steps: number,
  durationSeconds = steps * 1.6,
  accent = EDITORIAL_TOKENS.tealInk,
): string {
  const span = 100 / steps;
  const rules: string[] = [];
  for (let i = 0; i < steps; i++) {
    const start = (i * span).toFixed(1);
    const peak = (i * span + 2).toFixed(1);
    const hold = ((i + 1) * span - 2).toFixed(1);
    const end = ((i + 1) * span).toFixed(1);
    rules.push(
      `.ed-step-${i + 1} { animation: ed-seq-${i + 1} ${durationSeconds}s infinite; }\n` +
        `    @keyframes ed-seq-${i + 1} {\n` +
        `      0%, ${start}%, ${end}%, 100% { stroke-width: 1.2; }\n` +
        `      ${peak}%, ${hold}% { stroke: ${accent}; stroke-width: 2.5; }\n` +
        `    }`,
    );
  }
  return `${rules.join('\n    ')}\n    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;
}
