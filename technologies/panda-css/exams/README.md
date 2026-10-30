# Panda CSS · Certifications, Exams and Interview Preparation

## Certification status (verified 2026-10-29)

**No official certification exists for Panda CSS.** Neither Chakra Systems (the maintainer) nor the OpenJS Foundation, Linux Foundation or any vendor offers a Panda CSS exam; the official site (panda-css.com) has documentation, a playground and Studio, but no certification programme. There is also no widely recognised third-party Panda exam.

Following [AGENTS.md § Certification and Exam Coverage](../../../AGENTS.md) (priority 3), this track prepares for the **recognised interview format** in which Panda knowledge is actually assessed:

| Format | What it looks like | Typical duration | Where this track covers it |
|---|---|---|---|
| Senior frontend technical interview | Concept questions on CSS-in-JS architecture, the cascade, build tooling, framework integration, debugging scenarios | 45–60 min | [`interview.md`](./interview.md) sections D1–D7 |
| Design-system interview / system design | Design a token system, theming, a component API (variants, slots, overrides), and how to ship it to many apps | 45–60 min | D4, D5, D6 questions + hands-on tasks |
| Live coding / take-home | Build a component with recipes and tokens, fix missing styles, migrate a styled-component | 45–90 min | Hands-on tasks (each with a verification test in `examples/`) |

Product version targeted: **Panda CSS 2.4.0** (the track's version), so there is no exam version delta. Interviewers may still ask about 1.x behaviour: questions tagged "Then vs now" cover the differences.

## Domain → module coverage matrix

Weights are this track's own weighting of the interview topics (no official weights exist), derived from the dossier's interview hot topics and the docs' table of contents.

| ID | Domain / objectives | Weight | Modules | Examples / tests | Questions | Status |
|---|---|---|---|---|---|---|
| D1 | Static extraction & the v2 compiler: static vs runtime CSS-in-JS, atoms, what extraction can and cannot see, cross-file folding, diagnostics, debugging, plugins | 20 % | [M01](../modules/01-mental-model-and-v2-architecture.md), [M10](../modules/10-compiler-internals-and-debugging.md) | `negative-extraction.test.ts`, `compiler.test.ts`, `cli.test.ts`, `runtime.test.ts` | 12 | ✅ |
| D2 | Setup, build integration & tooling: presets, PostCSS/Vite/CLI, codegen, CI gates, source transforms | 10 % | [M02](../modules/02-installation-and-build-integration.md), [M01](../modules/01-mental-model-and-v2-architecture.md) | `integration-postcss.test.ts`, `cli.test.ts`, `e2e-computed-style.test.ts` | 6 | ✅ |
| D3 | Styling API, conditions & cascade: `css`/`cx` merging, conditions, layers, property order, patterns, container queries | 15 % | [M03](../modules/03-styling-api-and-conditions.md), [M04](../modules/04-patterns-and-layout.md) | `e2e-fixtures.test.ts`, `css-snapshots.test.ts` | 9 | ✅ |
| D4 | Design tokens & theming: token tiers, semantic tokens, references, strict modes, `@property`, color mode, multi-brand themes | 15 % | [M05](../modules/05-design-tokens.md), [M06](../modules/06-color-mode-and-theming.md) | `type-tests.ts`, `e2e-fixtures.test.ts` (themes) | 9 | ✅ |
| D5 | Recipes & component architecture: `cva` vs config recipes, compound variants, slot recipes, recipe contexts, JSX factory, style-prop cost, React and Solid | 20 % | [M07](../modules/07-recipes-and-config-recipes.md), [M08](../modules/08-slot-recipes-and-recipe-contexts.md), [M09](../modules/09-jsx-factory-and-style-props.md) | `runtime.test.ts`, `recipe-context.test.ts`, `type-cost.test.ts`, e2e | 12 | ✅ |
| D6 | Design-system delivery & monorepos: presets vs `panda lib`, `designSystem`, build info, tree-shaking, include hygiene | 10 % | [M11](../modules/11-monorepos-and-design-system-libraries.md) | `monorepo.test.ts` | 6 | ✅ |
| D7 | Migration & upgrades: runtime CSS-in-JS and Tailwind migration, v1 → v2 checklist, silent breakers | 10 % | [M12](../modules/12-migration-and-upgrades.md) | `migration.test.ts`, misconfig configs | 6 | ✅ |
| | **Total** | 100 % | | | **60** | |

Each question in [`interview.md`](./interview.md) is tagged with its domain, a difficulty 1–3 (3 = harder than a typical interview), and its type (single, multi, scenario, ordering, hands-on). Hands-on tasks name the test that verifies a correct solution.

## Mock interview

[`interview.md` § Mock interview](./interview.md#mock-interview) is a 60-minute, 24-question loop that mirrors a senior design-system interview (warm-up concepts → debugging scenarios → design questions → one hands-on task), with a scoring key and a pass bar.

## Integrity

All questions are original and written from the public Panda documentation and this track's executable examples. There is no official exam whose content could leak.
