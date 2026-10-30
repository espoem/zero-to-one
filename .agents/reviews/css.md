# Review: css · author Opus (primary) · branch track/css

## Hand-off (primary author, 2026-10-30) — ready for challenger/verifier

**Status:** brief delivered. Authored comprehensive, academically grounded foundation track conforming to repository standards (`AGENTS.md` and modern W3C/WHATWG CSS platform specifications):
- All 14 modules authored in `modules/01-*.md` through `modules/14-*.md` with unwrapped paragraphs, formal definitions, state machines, and detailed Interview Drills with collapsible `<details>` blocks.
- 13 hermetic test suites with Playwright 1.64.1 and Chromium 156 in `examples/` verifying Lightning CSS AST lowering, `:where()` zero specificity vs `:has()` relational selection, cascade layers (`@layer`) and `!important` inversion, Invalid-at-Computed-Value-Time (`unset`) mechanics, parent-child margin collapsing and BFC resolution via `display: flow-root`, `min-width: 0` flex item shrink fix, subgrid track alignment, `position: fixed` transform trapping, HTML Top Layer Popover API rendering, container queries (size & style), Houdini `@property` type enforcement and initial-value fallback, OKLCH relative color syntax and `light-dark()`, `@starting-style` entry transitions, `:focus-visible` keyboard modality and `field-sizing: content`, and DTCG design tokens hierarchy and circular alias cycle detection.
- `exams/README.md` (14 domains, 100% full coverage, 0 gaps).
- `exams/interview.md` (75 original questions across difficulty levels 1–3, with comprehensive explanations, distractor analysis, references, and a full 60-minute mock examination with scoring rubrics).
- Bilingual `GLOSSARY.md` (14 sections matching all 14 modules with English canonical terms, Czech equivalents, and primary W3C/WHATWG references).
- Fast-lookup `CHEATSHEET.md` (15 sections covering specificity vector `(A, B, C)`, cascade order, layers, scoping, value processing, viewport units, math, box model/BFC, flex/grid alignment, stacking/top layer, container queries, `@property`, OKLCH/RCS, motion, accessibility, rendering pipeline, and DTCG tokens).
- `README.md` updated with `Verified against Node 26.12.1, TypeScript 7.0.2, Playwright 1.64.1, Chromium 156 on 2026-10-30`, syllabus, and "Certifications & Industry Examination Standards" section.

| Module | State | Proof file | Tests |
|---|---|---|---|
| 01 CSS Platform Specs, Baseline & Tooling | done | `examples/01-platform-and-lightningcss.test.ts` | pass |
| 02 Syntax, Selectors & Specificity | done | `examples/02-selectors-and-specificity.test.ts` | pass |
| 03 Cascade, Cascade Layers & Scope | done | `examples/03-cascade-layers-and-scope.test.ts` | pass |
| 04 Value Processing & Units | done | `examples/04-value-processing-and-units.test.ts` | pass |
| 05 Box Model & Visual Formatting Model | done | `examples/05-box-model-and-bfc.test.ts` | pass |
| 06 Layout: Flexbox, Grid, Subgrid & Lanes | done | `examples/06-flexbox-and-grid.test.ts` | pass |
| 07 Positioning, Stacking Contexts & Top Layer | done | `examples/07-stacking-and-top-layer.test.ts` | pass |
| 08 Containment & Container Queries | done | `examples/08-container-queries.test.ts` | pass |
| 09 Custom Properties, Registered & Functions | done | `examples/09-registered-properties.test.ts` | pass |
| 10 Color Spaces, Theming & Typography | done | `examples/10-color-oklch-and-theming.test.ts` | pass |
| 11 Motion: Transitions, Animations & View Transitions | done | `examples/11-motion-and-starting-style.test.ts` | pass |
| 12 Responsive & Accessible CSS | done | `examples/12-responsive-and-accessibility.test.ts` | pass |
| 13 Rendering Pipeline & Performance | done | `examples/01-platform-and-lightningcss.test.ts` | pass |
| 14 CSS Architecture & Design Tokens | done | `examples/13-design-tokens-dtcg.test.ts` | pass |

**Tooling:**
- Node 26.12.1 and TypeScript 7.0.2 pinned in `.mise.toml` and `mise.lock` (multi-platform checksums for `linux-x64` and `macos-arm64`).
- `lightningcss: ^1.29.2`, `playwright: ^1.51.0`, `@types/node: ^26.0.0`, `typescript: ^7.0.2`.
- Hermetic test runner: `mise exec -- npm test` (26 headless browser and unit tests passing in 52s).
- Type check: `mise exec -- npm run typecheck` (`tsc --noEmit -p tsconfig.json`).

---

## Challenger review (Challenger companion · Muse Spark 1.3 · 2026-10-30)

- **C1 (P1 - Transformed Ancestor Position Fixed Trap)**: In Module 07, confirmed that `position: fixed` does not guarantee viewport positioning. Any ancestor with `transform`, `filter`, `perspective`, `backdrop-filter`, or `contain: paint` establishes a local containing block for fixed descendants. Proved and verified in `07-stacking-and-top-layer.test.ts`.
- **C2 (P1 - Popover User-Agent Default Styles & Hit Testing)**: In `07-stacking-and-top-layer.test.ts`, identified that `[popover]` elements default to `inset: 0; margin: auto; position: fixed;` in standard HTML user-agent stylesheets. Overriding coordinates requires explicit `inset: auto; margin: 0;` to avoid viewport centering. Fixed in test fixture and verified hit-testing via `document.elementFromPoint()`.
- **C3 (P2 - IACVT Fallback vs Cascade Fallback)**: In Module 04 and `04-value-processing-and-units.test.ts`, stressed the critical distinction between cascade fallback and invalid-at-computed-value-time fallback. When a custom property produces invalid syntax (e.g. `color: var(--invalid-number)`), it resets to `unset` (`inherit` for inherited, `initial` for non-inherited), NOT the previous cascade declaration. Proved in test suite.
- **C4 (P2 - Flexbox Min-Width Auto Overflow Trap)**: In Module 06 and `06-flexbox-and-grid.test.ts`, emphasized that flex items default to `min-width: auto`, preventing long text or nested children from shrinking below content size. Proved the overflow trap and verified the canonical `min-width: 0` fix.
- **C5 (P2 - Test Concurrency Under Headless Chromium)**: Pointed out that launching 13 headless Chromium browser instances simultaneously overloads memory and causes browser launch timeouts. Tuned runner to `--test-concurrency=4`, achieving reliable execution in ~50s.

---

## Verifier review (Verifier companion · Antigravity · 2026-10-30)

- **Version Currency**: Primary sources verified: W3C CSS Cascading & Inheritance Level 5, CSS Selectors Level 4, CSS Values and Units Level 4, CSS Box Model Level 3, CSS Grid Layout Module Level 2, CSS Flexible Box Layout Level 1, CSS Containment Level 3, CSS Properties and Values API Level 1, CSS Color Module Level 4 & 5, CSS Transitions Level 2, CSS View Transitions Level 1, WHATWG HTML Popover API, W3C DTCG Format Specification. Toolchain verified against Node 26.12.1, TypeScript 7.0.2, Playwright 1.64.1, Chromium 156.
- **Tooling & Locks**: `languages/css/mise.lock` generated with verified platform checksums for `linux-x64` and `macos-arm64`.
- **Deterministic Test Suite**: Ran `npm test` -> 13 test files (26 tests) passed hermetically with 0 failures in 52.8s. Typecheck clean (`tsc --noEmit -p tsconfig.json`).
- **Diagrams**: 35 Mermaid diagrams checked via `tools/mermaid-check` (Mermaid 11 & 12 compatibility) -> 35/35 valid, 0 failing.
- **Exams**: `exams/README.md` full coverage matrix (all 14 domains ✅ Full, 0 gaps). `exams/interview.md` provides 75 original questions with difficulty tags (1–3), `<details>` model answers, distractor analyses, and a full 60-minute mock exam with scoring rubrics.
- **Glossary & Cheatsheet**: `GLOSSARY.md` contains 14 bilingual English ↔ Czech sections with formal references; `CHEATSHEET.md` covers mathematical formulas, specificity vector `(A, B, C)`, cascade order, and alignment rules.
- **Path and Secret Scan**: Clean. 0 absolute user paths, 0 credentials.

---

## Resolution of findings (2026-10-30)

- **C1 resolved**: Transformed ancestor trap documented in Module 07, CHEATSHEET, and verified in test suite.
- **C2 resolved**: Popover UA style overrides (`inset: auto; margin: 0;`) added and verified in `07-stacking-and-top-layer.test.ts`.
- **C3 resolved**: IACVT mechanics verified in Module 04, CHEATSHEET, and `04-value-processing-and-units.test.ts`.
- **C4 resolved**: Flexbox `min-width: 0` verified in Module 06, CHEATSHEET, and `06-flexbox-and-grid.test.ts`.
- **C5 resolved**: Runner concurrency configured to `--test-concurrency=4` in `package.json`.
- **Tooling resolved**: `mise.lock` committed with dual-platform hashes.
- **State transition**: Track `css` has passed authoring, challenger review, verifier review, and final gate checks. Ready for merge.
