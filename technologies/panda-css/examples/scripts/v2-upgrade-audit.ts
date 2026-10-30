// Module 12: a static audit for Panda 0.x/1.x -> 2.x upgrades. It does not replace
// `panda doctor`; it finds the v1 idioms that v2 ignores SILENTLY or rejects.
// Usage: node examples/scripts/v2-upgrade-audit.ts <project-dir>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface Finding {
  rule: string
  file: string
  line: number
  severity: 'error' | 'silent' | 'warn'
  fix: string
}

const rules: { rule: string; re: RegExp; severity: Finding['severity']; fix: string; configOnly?: boolean }[] = [
  { rule: 'containerSizes', re: /\bcontainerSizes\s*:/, severity: 'silent', fix: 'Rename theme.containerSizes to theme.containers' },
  { rule: 'createStyleContext', re: /\bcreateStyleContext\b/, severity: 'error', fix: 'Use createSlotRecipeContext / createRecipeContext' },
  { rule: 'defineParts', re: /\bdefineParts\b/, severity: 'error', fix: "Use '& [data-part=\"x\"]' selectors or defineSlotRecipe" },
  { rule: 'root-hooks', re: /^\s*hooks\s*:\s*\{/m, severity: 'error', fix: 'Move into plugins: [{ name, hooks }]', configOnly: true },
  { rule: 'emitPackage', re: /\bemitPackage\s*:/, severity: 'silent', fix: 'Remove; publish with panda lib' },
  { rule: 'panda-ship', re: /\bpanda (ship|emit-pkg)\b/, severity: 'error', fix: 'Use panda lib (or panda buildinfo --outfile)' },
  { rule: 'template-literal', re: /(?<![`\w])css`/, severity: 'error', fix: 'Template-literal syntax was removed: use objects' },
  { rule: 'syntax-option', re: /\bsyntax\s*:\s*['"]template-literal['"]/, severity: 'error', fix: 'Remove the syntax option' },
  { rule: 'removed-options', re: /\b(eject|emitTokensOnly|lightningcss|browserslist|gitignore)\s*:/, severity: 'silent', fix: 'Option removed in v2 (ignored without a diagnostic)', configOnly: true },
  { rule: 'cpu-prof', re: /--cpu-prof\b|--silent\b/, severity: 'warn', fix: 'Use --profile / --log-level silent' },
  { rule: 'array-condition', re: /:\s*\[\s*['"]@media[^\]]*['"]\s*,\s*['"]&/, severity: 'warn', fix: "Use { '@media …': { '&…': '@slot' } }", configOnly: true },
  { rule: 'require-panda', re: /require\(['"]@pandacss\/dev['"]\)/, severity: 'error', fix: '@pandacss/dev is ESM-only: use import' },
  { rule: 'default-import-of-styles', re: /^import \w+ from ['"]\.{1,2}\/[^'"]*(tokens|styles|theme)[^'"]*['"]/m, severity: 'silent', fix: 'Default imports are not followed by extraction: use named imports' },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('styled-system') || name.startsWith('dist') || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(m?[jt]sx?|json)$/.test(name)) out.push(p)
  }
  return out
}

export function audit(dir: string): Finding[] {
  const findings: Finding[] = []
  const files = walk(dir)
  for (const file of files) {
    // Blank out comments (keeping line numbers) so prose about removed APIs is not flagged.
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, ' '))
    const isConfig = /panda\.config\.[mc]?[jt]s$/.test(file)
    for (const r of rules) {
      if (r.configOnly && !isConfig) continue
      const re = new RegExp(r.re.source, r.re.flags.includes('g') ? r.re.flags : r.re.flags + 'g')
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length
        findings.push({ rule: r.rule, file: relative(dir, file), line, severity: r.severity, fix: r.fix })
      }
    }
    if (isConfig && /presets\s*:/.test(text) && !/preset-base/.test(text)) {
      findings.push({ rule: 'preset-base-missing', file: relative(dir, file), line: 1, severity: 'silent', fix: "Add '@pandacss/preset-base' to presets (no longer implicit)" })
    }
  }
  return findings
}

if (import.meta.main) {
  const dir = process.argv[2] ?? '.'
  const findings = audit(dir)
  for (const f of findings) console.log(`${f.severity.padEnd(6)} ${f.rule.padEnd(26)} ${f.file}:${f.line}  ${f.fix}`)
  process.exitCode = findings.some((f) => f.severity !== 'warn') ? 1 : 0
}
