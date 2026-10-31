# Challenger Audit: technologies/panda-css
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `technologies/panda-css`
Date: 2026-10-31

---

# Adversarial Audit — `technologies/panda-css`

## P0 — Must fix before merge (load-bearing claims)

### P0-1 — Nested `@layer` declaration proof
`01-mental-model-and-v2-architecture.md §1.3` emits:
`@layer recipes { @layer base, slots, variants, compound_variants; }`
Ensure snapshots verify this or align emitted CSS in examples.

### P0-2 — `polyfill: true` selector syntax
Verify selector syntax for specificity polyfills (e.g. `:where(...)` or valid `:not(...)` constructs).

### P0-3 — `cssgen:done` observe-only proof
Verify whether `cssgen:done` in v2 can mutate emitted CSS or is observe-only.

### P0-4 — `lightningcss` & `browserslist` options
Verify removal/deprecation in v2.

### P0-5 — Container theme keys
Verify `theme.containers` and `theme.containerNames` in preset-base types.

### P0-6 — Config bundler attribution
Verify whether `@pandacss/config` uses Rolldown vs esbuild/tsup.

---

## P1 — Likely wrong / brittle

### P1-1 — Mermaid `;` in labels
`02-installation-and-build-integration.md §2.3`: replace raw `;` in `<br/>@layer ...;` with `#59;`.

### P1-2 — Token folding in `token()` vs `token.var()`
Clarify imports from `styled-system/tokens` in exam questions.

### P1-3 — Transparent fallback mechanics
`var(--undefined)` in CSS Custom Properties becomes guaranteed-invalid → `unset`.

---

## P2 / P3 — Rigor & Polish

- Cross-link exact module filenames in `languages/css`.
- Quote sequence-diagram participant aliases containing parentheses.
- Run `tools/mermaid-check` and `tools/table-check`.
