# Review: panda-css

## Hand-off (primary author, Opus) · ready for challenger/verifier · updated 2026-10-30

**Status:** All four priorities done. Track migrated from `@pandacss/dev ^0.51` to **2.4.0** (re-checked on npm 2026-10-30: still `latest`), restructured 13 → 12 modules, exams, glossary, cheatsheet and README rewritten. STATUS.md not edited (see conflicts).

### Test command output (2026-10-30, Node 26.12.1)
- `npm run typecheck` → clean (React tsconfig + Solid tsconfig; includes `@ts-expect-error` negative type tests).
- `npm test` → `tests 118 · pass 118 · fail 0 · skipped 0` (~60 s; Playwright suites ran, not skipped).
- `node tools/mermaid-check/check.mjs technologies/panda-css` → `7 diagram(s), 0 failing`.
- The v2 native compiler (`@pandacss/compiler-linux-x64-gnu`) installed and ran; the WASM fallback was not needed.

### Done, module by module
| Module | Executable proof added |
|---|---|
| M01 mental model & v2 architecture | atomic dedupe snapshot; vanilla app: `transform: true` 19,811 → 923 B JS; React/Solid show runtime stays when dynamic calls exist |
| M02 installation & build integration | `integration-postcss.test.ts`; `no-preset-base` config; doctor/check/debug in `cli.test.ts` |
| M03 styling API & conditions | property-order + border-tier Playwright tests; array-condition config (warning + conversion) |
| M04 patterns & layout | `scrollable` pattern with `map` + `blocklist`; pattern-prop-in-breakpoint negative (leaks CSS `columns: 3`); `containerSizes` negative |
| M05 tokens | `token()` folds to raw value (not theme-aware) in snapshot; `@property` registration + `propertyFallback`; strictTokens/strictPropertyValues type tests; `codegen --spec` test |
| M06 color mode & theming | themes config + Playwright (static theme, dark composition, theme condition, on-demand JSON, theme contract type error) |
| M07 recipes & config recipes | runtime class strings; JIT/renamed-wrapper negatives; `staticCss` and `smartCompoundVariants` configs; compound sub-layer e2e |
| M08 slot recipes & recipe contexts | `recipe-context.test.ts`: React and Solid SSR of generated `createSlotRecipeContext`/`createRecipeContext` |
| M09 JSX factory (React + Solid) | `type-cost.test.ts`: `jsxStyleProps` all 8,587 vs minimal 5,073 instantiations |
| M10 compiler internals | `compiler.test.ts`: conditional fold, `js_parse_error`, plugins/hooks, `config_hooks_removed`, `--splitting`, `--profile` span names |
| M11 monorepos & DS libraries | npm workspace `examples/monorepo`: `panda lib` package + `designSystem` app; build-info replay, stale fallback, `design_system_in_include`, `treeshakeDesignSystem` |
| M12 migration & upgrades | `v2-upgrade-audit.ts` + v1-era fixture project; CSS-variable bridge e2e; 23-step checklist; version-history table; v2 best-practices catalogue |
| Exams | `exams/README.md` (no official cert → interview format; 7-domain matrix, all ✅) + `exams/interview.md` (60 Q: D1 12, D2 6, D3 9, D4 9, D5 12, D6 6, D7 6; hands-on tasks tied to tests; 60-min mock with scoring key) |
| GLOSSARY / CHEATSHEET / README | Rewritten for v2; README has Verified-against line and Certifications & Exams |

### Re-verify list resolution
- `@pandacss/dev` 2.4.0 (2026-10-22), 2.0.0 (2026-09-29), 1.0.0 (2025-08-05): confirmed on npm. **Correction:** 1.12.1 *is* on npm (2026-09-04) and was the last 1.x (dossier said 1.9.0).
- `@park-ui/panda-preset` 0.43.1: still latest (2024-11-22); peer `@pandacss/dev >0.22.0`; nests `preset-base`; static grep finds no `containerSizes`/`defineParts`. Runtime v2 compatibility **not tested**; stated as such in M08.
- DTCG import: no DTCG importer in 2.4.0 source; docs say format "follows" W3C spec but uses `value` not `$value`. Taught as "no direct import; convert with Style Dictionary/Terrazzo".
- "Course modelled on the Panda Mastery video course": could not verify; claim removed.
- `languages/css` track: planned (brief exists), not yet in the repo; cross-links point to `languages/css/README.md`.
- `panda ship`/`emit-pkg` → `panda lib`/`buildinfo`: confirmed. `emitPackage`: absent from 2.4.0 types and compiler source; silently ignored (no diagnostic).
- Extra correction vs dossier: "local `panda studio` removed" is outdated: 2.4.0 re-added `panda studio`, which opens the **hosted** Studio live-connected.

### Findings discovered while building (worth challenging)
- `optimize.removeUnusedTokens` prunes primitives used only by on-demand themes → injected theme renders transparent (Playwright-proved).
- Default `importMap` follows `outdir`; changing `outdir` silently stops extraction of old import paths.
- `pure_helper_unevaluated` is documented in the diagnostics reference but was removed in 2.2.0 (changelog); unsupported helpers fail silently.
- A `js_parse_error` (unclosed object at EOF) lost the whole file, including earlier valid calls.
- `theme.containerSizes`, root `hooks`, `emitPackage` all still type-check in `defineConfig`.
- A `'*'` `staticCss` rule pulls compounds even with `smartCompoundVariants`.
- Panda 2.4.0 Solid codegen triggers Rolldown `INVALID_ANNOTATION` warnings under Vite 8 (cosmetic; silenced in `examples/solid/vite.config.ts`).

## Remaining work (ordered)
1. **Challenger + verifier passes** (per AGENTS.md), especially the least-certain claims below.
2. Run `mise lock` on a networked machine to add Node 26 platform checksums to `technologies/panda-css/mise.lock` (hand-written; nodejs.org blocked here).
3. When `languages/css` and `languages/javascript` land, verify the cross-links (`../../../languages/css/README.md`, `../../../languages/javascript/README.md`) and optionally deepen them to module anchors. These are the only unresolved relative links (12 occurrences); all others pass an offline link/anchor check.
4. Optional depth: modules are 180–320 lines (below the 400–900 rule of thumb) because detail lives in tested examples rather than prose; a continuation agent could add worked exercises per module.
5. Optional: Playwright pinned at 1.64.1 via a project devDependency + `playwright install chromium` on machines with network (here the preinstalled 1.63.0/Chromium 153 was used on purpose).

## Least-certain claims
- `mise.lock` lacks checksums (see above).
- M01 package map: "~11 MB" native binary size measured on linux-x64 only.
- M06 FOUC head-script pattern is not covered by an automated test (class-toggle mechanics are).
- M07: "variant classes ordered by variant name" inferred from two runtime outputs; 2.3.0 changelog says recipe variants *emit in config order* in CSS. Both observed facts hold; the generalisation of runtime class order is the weak part.
- M09: `jsxStyleProps` type-cost ratio measured on a 2-component project; extrapolation to large apps is qualitative.
- M10: crate tiers, fold rules and pipeline stages come from `design-notes/*.md` on `main` (2026-10-29), which describe the engine but may drift from the 2.4.0 release.
- M12: 1.0.0 "no breaking changes" from newreleases.io's copy of the GitHub release notes (GitHub page not fetchable here); exact 0.x minor dates are npm `time` values.
- M12: `@layer legacy` + `@import … layer()` coexistence recipe is standard CSS but not tested in this track.
- Browser floor numbers for `@property` (Chrome 85, Safari 16.4, Firefox 128) are quoted from the Panda v2 upgrade guide.

## Proposals for integrator
- **Root glossary candidates:** Constant Folding (Skládání konstant), Abstract Syntax Tree (Abstraktní syntaktický strom), Tree Shaking (Odstraňování nepoužitého kódu), Monorepo (Monorepozitář) are general CS terms currently defined in the panda-css glossary; move them to the root glossary and have panda-css reuse the wording.
- **OWNERSHIP.md:** register under `technologies/panda-css`: "Static style extraction / source transforms (build-time CSS-in-JS compilers)", "Design-system distribution via build info (`panda lib`/`designSystem`)". Register under `languages/css` (if not already): "CSS migration coexistence via cascade layers (`@import … layer()`)", which M12 currently explains briefly.
- **Cross-track handovers:** `languages/css` should cover Tailwind 4 vs Panda vs StyleX architecture (M01 §1.7 is a short delta table); `solidjs` track may link M09 for Solid + Panda integration; `typescript` track (TS 7 `noUncheckedSideEffectImports`, type instantiation measurement) may reuse `examples/bench/jsx-style-props`.
- **Tooling:** the `tools/mermaid-check` passes for this track; consider adding the offline link/anchor checker used here (simple Python) to `tools/`.

## Brief/contract conflicts
- Brief §7.1 says set STATUS.md to 🟦/🟨; AUTHOR_PROMPT forbids editing STATUS.md. Followed AUTHOR_PROMPT; integrator should set the row to 🟨.
- Brief proposes Vitest; AGENTS.md mandates `node --test` for TypeScript. Used `node --test`.
- Brief's dossier proposes `node = "24"`; AUTHOR_PROMPT and brief §1 say Node 26. Pinned Node 26.
- Brief asks to pin Playwright 1.64.1; preinstalled browsers match 1.63.0 only and `playwright install` was forbidden, so Playwright is resolved from the environment and the suites skip cleanly when absent.
