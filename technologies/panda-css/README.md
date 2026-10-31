# Panda CSS 2.x · Build-Time, Type-Safe Styling

> **Verified against** `@pandacss/dev` 2.4.0 (+ `@pandacss/preset-base`, `@pandacss/preset-panda`, `@pandacss/vite` 2.4.0, native `@pandacss/compiler` on linux-x64), TypeScript 7.0.2, Node 26.12.1, Vite 8.3.5, React 19.3.1, Solid 1.9.17, PostCSS 8.5.32, Playwright 1.64.1 pinned (tests executed with the preinstalled 1.63.0 / Chromium 153; see [Running the tests](#running-the-tests)) on **2026-10-29** (tests re-run 2026-10-30).

Panda CSS is a styling engine from the Chakra UI team: you write typed style objects, recipes and tokens in TypeScript; a Rust compiler built on Oxc reads your source without running it and emits one atomic, cascade-layered stylesheet plus a generated, typed `styled-system` package. This track teaches **Panda 2.x** (2.0.0 shipped 2026-09-29) from the mental model to compiler internals, shipping design systems and migrating from 0.x/1.x, with every claim backed by an executable test.

## Prerequisites

- JavaScript/TypeScript fluency. Typing JSX and polymorphic components is taught in [`languages/typescript`](../../languages/typescript/README.md).
- CSS fundamentals (cascade, `@layer`, specificity, custom properties, `@property`, container queries, design-token theory) are **owned by [`languages/css`](../../languages/css/README.md)**; this track links there instead of re-explaining them.
- React or Solid basics ([`react`](../react/README.md), [`solidjs`](../solidjs/README.md)); examples are given for both.

## Syllabus

Derived from the panda-css.com v2 documentation table of contents (Get started, Styling, Recipes, Theming, Design systems, Reference) and the v2 upgrade guide. Each module ends with an Interview Drill.

| # | Module | Covers | Executable proof |
|---|---|---|---|
| 01 | [Static CSS-in-JS Mental Model and the v2 Architecture](./modules/01-mental-model-and-v2-architecture.md) | Static extraction (formal), atoms, layered stylesheet, codegen vs cssgen, runtime `css()`, source transforms (measured), Rust crate tiers, RSC/SSR | snapshots, `runtime.test.ts`, vanilla transform build |
| 02 | [Installation and Build Integration](./modules/02-installation-and-build-integration.md) | ESM/Node ≥ 22, explicit presets, PostCSS / Vite / CLI, `prepare`, `--clean`, TS 7 CSS import, `doctor`/`check`/`debug`, CI gates, CLI Then vs now | `integration-postcss.test.ts`, `cli.test.ts`, no-preset-base config |
| 03 | [The Styling API and Conditions](./modules/03-styling-api-and-conditions.md) | Style-object grammar, utilities, conditions, responsive keys, `css`/`css.raw`/`cx` merge semantics, property-breadth order and v2 border tiers, `css` prop pattern, `@slot` conditions | `e2e-fixtures.test.ts`, array-condition config |
| 04 | [Patterns and Layout](./modules/04-patterns-and-layout.md) | Built-in and custom patterns, responsive props with `map`, `linkOverlay`, `theme.containers` container queries | pattern fixtures, container e2e, `containerSizes` negative |
| 05 | [Design Tokens and Semantic Tokens](./modules/05-design-tokens.md) | Token graph, references, opacity modifier, `token()` folding trap, `@property` vs v1 reset, strict modes, `removeUnusedTokens`, JSON spec, DTCG status | `05-*` snapshots, `type-tests.ts`, `--spec` test |
| 06 | [Color Mode and Theming](./modules/06-color-mode-and-theming.md) | `_dark`/`_osDark`, FOUC, multi-brand `themes`, static vs on-demand, theme contracts, compositions, theme-key replacement semantics | themes Playwright test |
| 07 | [Recipes (`cva`) and Config Recipes](./modules/07-recipes-and-config-recipes.md) | Recipe model, eager vs JIT emission, JSX tracking, `staticCss`, compound variants Then vs now, `smartCompoundVariants`, `colorPalette` | `runtime.test.ts`, recipe negatives, cascade e2e |
| 08 | [Slot Recipes and Recipe Contexts](./modules/08-slot-recipes-and-recipe-contexts.md) | `sva`/`defineSlotRecipe`, `createSlotRecipeContext`/`createRecipeContext`/`withRootProvider`, `createStyleContext`/`defineParts` removal, headless libraries | `recipe-context.test.ts` (React + Solid SSR) |
| 09 | [The JSX Factory and Style Props (React and Solid)](./modules/09-jsx-factory-and-style-props.md) | Style-prop extraction, factory options, React vs Solid idioms, `jsxStyleProps` type cost (measured) | `type-cost.test.ts`, both apps in e2e |
| 10 | [Compiler Internals and Static-Analysis Debugging](./modules/10-compiler-internals-and-debugging.md) | v2 pipeline stage by stage, import matching, literal-fold rules, diagnostics, v1 engine as history, plugins/hooks, debugging playbook | `compiler.test.ts`, negative fixtures |
| 11 | [Monorepos and Shipping a Design-System Library](./modules/11-monorepos-and-design-system-libraries.md) | Preset vs `panda lib` vs stylesheet, `designSystem`, build-info replay, `treeshakeDesignSystem`, include hygiene, task graphs | `monorepo.test.ts` (workspace package + app) |
| 12 | [Migration and Upgrades](./modules/12-migration-and-upgrades.md) | Runtime CSS-in-JS and Tailwind → Panda, 0.x/1.x → 2.x checklist, version history, v2 best-practices catalogue | `migration.test.ts` + upgrade audit script |

### Out of Scope
- Framework integrations other than React, Solid and Vite/PostCSS (Vue, Svelte, Astro, Angular, Qwik: identical compiler mechanics, framework-specific adapter wiring only; official documentation suffices).
- Panda MCP server and editor agent skills (`@pandacss/mcp`: development tooling around the product rather than the styling runtime).
- `@pandacss/preset-typography`, `positionTry()`, `viewTransition()` and `firstThatWorks()` helpers beyond mentions (thin utility wrappers over CSS features owned by [`languages/css`](../../languages/css/README.md)).
- General CSS cascade and layout theory (owned by [`languages/css`](../../languages/css/README.md)).

**Recommended order:** 01 → 12. Short paths: application developers 01–06 + 09; design-system authors 05–08, 10, 11; upgrading teams 02, 10, 12.

## Repository layout

```text
technologies/panda-css/
├── README.md · GLOSSARY.md · CHEATSHEET.md
├── modules/                    # 12 lessons
├── exams/                      # README (interview format, coverage matrix) + interview.md (60 Q + mock)
├── package.json                # ESM, exact pins, npm workspace for examples/monorepo/packages/*
├── tsconfig.json / tsconfig.solid.json
├── .mise.toml / mise.lock      # node 26
└── examples/
    ├── system/                 # the shared "acme" preset: tokens, semantic tokens, recipes, pattern
    ├── react/ · solid/         # the same app in React and Solid (Vite 8 + @pandacss/vite)
    ├── vanilla/                # all-static app proving source transforms remove the runtime
    ├── fixtures/               # positive + negative extraction fixtures, misconfig configs, CSS snapshots, v1 project
    ├── monorepo/               # packages/ds (panda lib) + apps/web (designSystem)
    ├── bench/jsx-style-props/  # type-cost benchmark (all vs minimal)
    ├── scripts/                # v2 upgrade audit
    └── tests/                  # node --test suites (+ Playwright)
```

## Running the tests

```bash
mise install            # node 26 (or any Node >= 22)
mise exec -- npm install             # runs `prepare` -> panda codegen for every example project
mise exec -- npx playwright install chromium   # browser for the e2e suites (Playwright is pinned to 1.64.1)
mise exec -- npm run typecheck       # tsc (React + Solid configs), including @ts-expect-error negative type tests
mise exec -- npm test                # node --test examples/tests/*.test.ts
mise exec -- npm run test:update-snapshots   # only when a CSS change is intended; review the diff
```

`npm test` runs, without network access:

| Suite | Proves |
|---|---|
| `css-snapshots.test.ts` | Each positive fixture compiles (one CLI run per file) to the committed CSS in `examples/fixtures/__snapshots__/` |
| `negative-extraction.test.ts` | Dynamic values, default/namespace imports, shadowing, unsupported helpers, JIT recipes, renamed wrappers, pattern-prop traps, and v1 → v2 misconfigurations produce **no** CSS (or the documented warning) |
| `runtime.test.ts` | Class strings from `css`, `cx`, `cva`, `sva` and config recipes |
| `recipe-context.test.ts` | Recipe contexts rendered by React and Solid on the server |
| `integration-postcss.test.ts` | The PostCSS plugin replaces only the layer-order root file |
| `cli.test.ts`, `compiler.test.ts` | `doctor`, `analyze`, `debug`, `codegen --check/--spec`, plugins and hooks, `--splitting`, `--profile` |
| `monorepo.test.ts` | `panda lib` artifacts, `designSystem` build-info replay, stale fallback, tree-shaking |
| `migration.test.ts` | The v2 upgrade audit on a v1-era project |
| `type-cost.test.ts` | `jsxStyleProps: 'minimal'` vs `'all'` type-check work |
| `e2e-computed-style.test.ts`, `e2e-fixtures.test.ts` | Playwright + Chromium computed styles: cascade layers, compound variants, dark mode, themes, container queries, breakpoints, property order, source transforms (React and Solid builds, with and without `transform: true`) |

**Playwright** is pinned as a devDependency (`playwright@1.64.1`, the stable release on 2026-10-30); `npx playwright install chromium` downloads the matching browser (Chrome for Testing 156). Browser binaries are tied to the Playwright build that downloaded them, so [`helpers/browser.ts`](./examples/tests/helpers/browser.ts) tries the pinned build first and then any other `playwright` resolvable from `NODE_PATH`, using the first one that launches Chromium, and prints which one it used (`# e2e using playwright …`). If none can launch, the e2e suites **skip with the reason** instead of failing. In the authoring sandbox `playwright install` was not allowed: the pinned 1.64.1 had no browser, so the suites ran on the preinstalled Playwright 1.63.0 with Chromium 153.0.8010.12. Results on Chrome 156 have not been observed here.

Last run (2026-10-29): `npm run typecheck` clean; `npm test` **118/118 passing**; Mermaid diagrams parse with Mermaid 11 and 12 (`tools/mermaid-check`).

## Certifications & Exams

**No official certification exists for Panda CSS** (verified 2026-10-29: neither Chakra Systems, the OpenJS Foundation nor any recognised third party offers one). Per AGENTS.md, the track prepares for the recognised substitute, the **senior frontend / design-system interview format**:

| Exam / format | Vendor | Guide | Version / date verified | Product version | Status | Format |
|---|---|---|---|---|---|---|
| Senior frontend technical interview (CSS-in-JS / build tooling) | Industry practice (no vendor) | [`exams/README.md`](./exams/README.md) | 2026-10-29 | Panda 2.4 | Active practice | Concept + debugging questions, 45–60 min |
| Design-system interview / system design | Industry practice | [`exams/README.md`](./exams/README.md) | 2026-10-29 | Panda 2.4 | Active practice | Token/theming/component-API design, 45–60 min |
| Live coding / take-home | Industry practice | [`exams/interview.md`](./exams/interview.md) hands-on tasks | 2026-10-29 | Panda 2.4 | Active practice | Build/fix/migrate a component, 45–90 min; each task has a verification test |

[`exams/interview.md`](./exams/interview.md) has 60 original questions across 7 domains (difficulty-tagged, with distractor explanations and references) and a 60-minute mock interview with a scoring key. The domain → module matrix is in [`exams/README.md`](./exams/README.md).

## Version notes

- **Panda 2.x** is the current line (2.4.0, 2026-10-22). The last 1.x is 1.12.1 (2026-09-04); this track was previously pinned to `^0.51` (2024-12-31). The [migration module](./modules/12-migration-and-upgrades.md) has the full checklist and version history; every changed practice has a "Then vs now" section in its module.
- The v2 native compiler installed and ran here (`@pandacss/compiler-linux-x64-gnu`); the WASM fallback (`@pandacss/compiler-wasm`) was not needed.

## References

- Documentation: https://panda-css.com/docs
- Upgrading to v2: https://panda-css.com/docs/get-started/upgrading-to-v2
- Source and design notes: https://github.com/chakra-ui/panda
- npm: https://www.npmjs.com/package/@pandacss/dev
