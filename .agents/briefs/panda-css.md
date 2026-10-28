# Brief: Panda CSS (`technologies/panda-css`)

| | |
|---|---|
| Phase | 1 |
| Kind | EXISTING track: restructure and update in place, keeping tests green throughout |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/panda-css` · `../zto-panda-css` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/A-frontend.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- **Owner decision D5 = option A:** migrate the whole track to `@pandacss/dev` 2.x (2.4.0 at research time; re-check).
- Restructure 13 → 12 modules. The final module is "Migration & upgrades", with a 0.x/1.x → v2 checklist and a version-history table.
- Wherever practice changed (createStyleContext → recipe contexts, `panda ship` → `panda lib`, `containerSizes` → `containers`, compound-variant semantics, explicit `preset-base`), add a **Then vs now** comparison.
- Rewrite the compiler-internals content against the v2 Rust/Oxc compiler source. Remove the ts-morph "lowering passes" as current material; they may survive only as history.
- Add **Solid** examples next to React (`jsxFramework: 'solid'`).
- Replace "typecheck + codegen" with real tests: CSS snapshot fixtures, negative fixtures (dynamic values and default imports produce no CSS), and Playwright computed-style checks.
- CSS fundamentals now belong to the new `languages/css` track (decision D7). Cross-link to it instead of explaining the cascade, `@layer`, `@property` or container queries.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Panda extraction, recipes, slot recipes, codegen, v2 compiler

**Cross-link only (do not re-explain):**
- Proxy/Reflect, WeakRef/FinalizationRegistry → owned by `languages/javascript`
- Typing JSX, components, hooks, generic/polymorphic components → owned by `languages/typescript` (M12)
- Cascade, `@layer`, `@scope`, specificity, inheritance, value processing → owned by `languages/css`
- Layout (flow, flex, grid, subgrid, anchor positioning), stacking contexts → owned by `languages/css`
- Custom properties, `@property`, container queries, color spaces → owned by `languages/css`
- Design-token theory (W3C DTCG format) → owned by `languages/css`
- CSS architecture comparison (BEM/ITCSS, utility-first, runtime vs zero-runtime CSS-in-JS) → owned by `languages/css`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Panda CSS — `technologies/panda-css`

- **Current stable version(s)**
  - `@pandacss/dev` **2.4.0** (2026-10-22). Release history: 2.0.0 on 2026-09-29; 1.0.0 on 2025-08-05; 1.9.0 on 2026-03-08 was the last 1.x on npm `latest` (the repo `main` changelog shows 1.12.1, unverified on npm). The repo's `^0.51` dates from 2024-12-31.
  - v2 architecture: a **Rust (Oxc) compiler** shipped as `@pandacss/compiler` (native binaries, plus `@pandacss/compiler-wasm`). The CLI is published as `@pandacss/cli`. **ESM-only** and **Node ≥22**.
  - `@pandacss/vite@2.4.0` is an inline-compiler Vite plugin, with `transform: true` to rewrite static `css()` calls to class strings at build time.
  - The PostCSS plugin is still supported.
  - MCP server: `@pandacss/mcp`. New `panda doctor`.
  - Upgrade guide: https://panda-css.com/docs/get-started/upgrading-to-v2 (v2 docs: https://panda-css.com, which v2.panda-css.com redirects to).
  - `@park-ui/panda-preset@0.43.1`; its v2 compatibility is unverified.
- **Authoritative syllabi used**
  - panda-css.com v2 docs ToC: Overview, Installation (CLI/PostCSS/framework guides/Storybook/Linting), Using AI (MCP/llms.txt/Agent Skills), Migration (StyleX, Tailwind, Styled Components, Emotion, vanilla-extract, Chakra), Frameworks (including SolidJS), Styling, Recipes, Theming, Design Systems, Reference.
  - W3C Design Tokens Format Module 2025.10 (final CG report, https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/). Whether Panda can import DTCG files is unverified.
  - The existing course is modelled on the official "Panda CSS" video course structure (unverified source).
  - No certification exists.
- **Proposed modules** (12)
  1. **Static CSS-in-JS mental model & v2 architecture**: build-time extraction vs runtime CSS-in-JS; atomic CSS; cascade layers (`reset, base, tokens, recipes, utilities`); the Rust/Oxc pipeline; the runtime `css()` helper vs `transform` mode; RSC/SSR implications (framework-neutral). Existing M01 + 09.1.
  2. **Installation & build integration**: CLI vs PostCSS vs `@pandacss/vite`; **explicit `@pandacss/preset-base` + `preset-panda`**; `styled-system` codegen + `prepare`; ESM-only config; `panda doctor`; `build --clean` after upgrades; TS 7 `noUncheckedSideEffectImports` + the CSS import declaration. Existing M02.1.
  3. **Styling API & conditions**: `css()`, shorthands, pseudo/data/group/peer conditions, custom conditions, responsive object syntax (**array syntax deprecated**), `css.raw()`/`cx()` merging, the `css` prop forwarding pattern. Existing M02.2–2.5.
  4. **Patterns & layout**: built-in patterns, `definePattern`, container queries with **`theme.containers`**, the `linkOverlay` a11y pattern. Existing M03.
  5. **Design tokens & semantic tokens**: token tiers, `defineTokens`/`defineSemanticTokens`, references, opacity modifier, `@property`-backed variables (and `optimize.propertyFallback`), `strictTokens`/`strictPropertyValues`, CSS variable scoping. Existing M08.
  6. **Color mode & theming**: condition-aware semantic tokens, `_osDark`, FOUC-free SSR script; `themes`, multi-brand; text/layer styles; keyframes and motion-safe. Merges existing M04 + M10.
  7. **Recipes (`cva`) & config recipes**: variants, `colorPalette` virtual colors, **compound variants emitted as separate classes (v2)**, `defineRecipe`, `splitVariantProps`, `RecipeVariantProps`, `staticCss` (now rarely needed). Merges existing M05 + M07.1–7.4.
  8. **Slot recipes & recipe contexts**: `sva`, `defineSlotRecipe`, compound components via **`createSlotRecipeContext`/`createRecipeContext`/`withRootProvider`**, headless (Ark/Park) integration. Merges existing M06 + M11.4 + M13.2.
  9. **JSX factory & style props**: `styled`, `jsxStyleProps` modes and their TS cost, `shouldForwardProp`, recipes as JSX. Examples for **both React and Solid** (`jsxFramework: 'solid'`). Existing M11.1–11.3.
  10. **Compiler internals & static-analysis debugging**: v2 extraction rules (named imports, barrels and path aliases resolve; default/namespace imports don't; runtime values never produce CSS); `panda debug`/`analyze`/`--profile`; `cssgen --splitting`; plugins with `hooks` (`config:resolved`, `parser:before`, `codegen:prepare`, `cssgen:done`). Rewrite of existing M13.1 + M07.5 + M08.8.
  11. **Monorepos & shipping a design-system library**: `importMap`, `include` scanning, **`panda lib` / `panda buildinfo`** (replacing `panda ship`/`emit-pkg`), presets via `definePreset`, Turborepo caching. Existing M12 + M10.4.
  12. **Migration & upgrades**: runtime CSS-in-JS (styled-components/Emotion/Stitches) → Panda; Tailwind → Panda; **v1 → v2 upgrade checklist**; the 25-practices catalog rewritten for v2. Existing M09 + M13.4.
- **Gotchas & production failure modes**
  1. In v2, forgetting `@pandacss/preset-base` in `presets` means no utilities, conditions or tokens. It is no longer implicit.
  2. Stale v1 `styled-system/*.mjs` next to v2 `.js` files lets Vite resolve the old file. Run `panda build --clean` once.
  3. `theme.containerSizes` is silently ignored in v2, so `@name/size` container conditions emit nothing. Rename it to `theme.containers`.
  4. Mixing v1 and v2 `@pandacss/*` packages (e.g. an old `@pandacss/postcss`) causes subtle codegen mismatches. They form a fixed version group.
  5. Dynamic values (`css({ color: props.color })`) never produce CSS. Use CSS variables, recipes or `staticCss`.
  6. Default and namespace imports of style helpers are not followed by the v2 extractor, so styles silently disappear. Use named imports.
  7. v2 compound variants no longer replace base properties. Overrides that relied on replacement stop winning.
  8. Border shorthands now sort by breadth, not source order. Use longhands when an override must win.
  9. `@property`-based variables need Safari ≥16.4 / Firefox ≥128. Older browsers render unstyled unless `optimize.propertyFallback: true`.
  10. `jsxStyleProps: 'all'` balloons TS type-check time in large apps. Use `'minimal'`.
  11. Concatenating class strings instead of `css()`/`cx()` merging produces order-dependent atomic conflicts.
  12. Unscoped `include` globs scan `node_modules` or build output, causing slow builds and bloated CSS. Monorepo packages not in `include` lose their styles.
  13. Color-mode FOUC on SSR without a blocking head script.
  14. Overriding a theme key without `extend` replaces only that entry in v2, but `breakpoints` still replace the full set. A partial breakpoint override deletes the others.
  15. `sizes.prose` changed from 65ch to 60ch in v2, a visual regression that only screenshots catch.
- **Interview hot topics**: static vs runtime CSS-in-JS trade-offs (RSC compatibility, runtime cost); atomic CSS and specificity/cascade layers; design-token tiers and semantic tokens for theming; recipe vs slot recipe vs config recipe; what static extraction can and cannot see; type-safety cost of style props; multi-brand theming without a runtime; shipping a design system across a monorepo; comparison with Tailwind v4 and StyleX.
- **Executable-proof strategy**
  - `.mise.toml`: `node = "24"` (≥22 required). Pin `@pandacss/dev@2.4.0` and `@pandacss/vite@2.4.0` exactly, with `vitest@5.0.5`.
  - Codegen/CSS: run `panda codegen` + `panda cssgen` on fixture source files, then snapshot the emitted CSS (deterministic hashing). Negative fixtures assert that runtime-only values and default-import usages produce **no** CSS.
  - `panda doctor --json` and `panda analyze` output are asserted in tests.
  - Type tests: `strictTokens`/`strictPropertyValues` rejections with `@ts-expect-error` under `tsc --noEmit` (TS 7).
  - Recipe behaviour: Vitest asserting class strings from `cva`/`sva`/`splitVariantProps`, without a DOM.
  - Rendering/cascade/color mode/container queries: Playwright (1.64.1) on a `vite preview` build, asserting `getComputedStyle` values. Also include a `transform: true` build check that the runtime chunk is absent.
  - Cannot be proven locally: cross-browser `@property` fallback on old Safari. Fallback: snapshot the fallback declarations emitted with `propertyFallback`.
- **Overlaps / dedupe**
  - CSS fundamentals go to a shared `technologies/css` (or `web-platform`) track, unverified whether it's planned: cascade layers, specificity, custom properties/`@property`, container queries, color spaces, view transitions.
  - Design-token theory (the DTCG spec) can live there too, with Panda cross-linking.
  - The React/Solid component mechanics used in the recipe components live in their own tracks.
  - Typing of generated `styled-system` types belongs to TS M12/M13, cross-linked.
- **Gap analysis vs existing**
  - **(a) Missing topics**
    - The whole v2 architecture and upgrade path.
    - `@pandacss/vite` + `transform`; `panda doctor`, `--profile`, `cssgen --splitting`.
    - Plugins/hooks; MCP/LLM tooling.
    - `@property` variables and browser floor; the v2 extraction rules.
    - Solid examples (the user's primary stack; all existing components are React).
    - Tailwind/StyleX migration.
    - Visual regression testing; CSS bundle-size budgets.
  - **(b) Outdated or incorrect claims vs 2.4.0**
    - M02 installs `^0.51`, needs Node ≥22 and ESM-only. Its array responsive syntax is now deprecated, and `prepare: panda codegen` is still advised.
    - M03.4: container queries must use `theme.containers`.
    - M05.5: compound variants semantics changed.
    - M07.4: `staticCss` is often unnecessary now that imports resolve.
    - M08.2 "Visualizing tokens with Panda Studio": local `panda studio` was removed (Studio is hosted).
    - M08.1/M13.1 "W3C DTCG compliance": unverified; don't claim compliance without a source.
    - M11.4 builds `createStyleContext`, which is **removed in v2**. Use `createSlotRecipeContext`/`createRecipeContext`.
    - M12.2 Strategy 3 "`panda ship`" was replaced by `panda lib`/`buildinfo`. `emit-pkg` is removed; check whether `emitPackage` config is still valid (unverified).
    - M13.1 "Box Evaluation Algorithm", "What Cannot Be Statically Evaluated" and "6 Formal Compiler Lowering Passes": these described the ts-morph/ts-evaluator engine, **replaced by Rust/Oxc in v2**. Rewrite from current source.
    - M13.1 "Debugging with Panda CLI" positional globs: v2 `analyze`/`debug` use the config `include`.
    - M01 is framed around Next.js App Router RSC; v2 is framework-neutral. Keep RSC as one case.
    - Template-literal `css` (if used in M09 migration examples) is removed in v2.
    - The `hooks` config, if mentioned, is now `plugins: [{ hooks }]`.
  - **(c) Proposed restructure** (13 → 12 modules)
    - Merge M04+M10 (color mode + theming), M05+M07 (recipes + config recipes) and M06+M11.4+M13.2 (slot recipes + contexts + headless).
    - Rewrite M13.1 as a standalone "Compiler internals" module (M10). Turn M13.3–13.4 into a v2 best-practices appendix inside M12.
    - Keep M02 (split into install vs styling API), M03, M08, M09 (as migration, plus v1→v2), M11 (JSX; add Solid) and M12.
    - Upgrade the pin to 2.4.0 first; every example must be regenerated.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- `@pandacss/dev` **2.4.0** (2026-10-22). Release history: 2.0.0 on 2026-09-29; 1.0.0 on 2025-08-05; 1.9.0 on 2026-03-08 was the last 1.x on npm `latest` (the repo `main` changelog shows 1.12.1, unverified on npm). The repo's `^0.51` dates from 2024-12-31.
- `@park-ui/panda-preset@0.43.1`; its v2 compatibility is unverified.
- W3C Design Tokens Format Module 2025.10 (final CG report, https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/). Whether Panda can import DTCG files is unverified.
- The existing course is modelled on the official "Panda CSS" video course structure (unverified source).
- CSS fundamentals go to a shared `technologies/css` (or `web-platform`) track, unverified whether it's planned: cascade layers, specificity, custom properties/`@property`, container queries, color spaces, view transitions.
- M08.1/M13.1 "W3C DTCG compliance": unverified; don't claim compliance without a source.
- M12.2 Strategy 3 "`panda ship`" was replaced by `panda lib`/`buildinfo`. `emit-pkg` is removed; check whether `emitPackage` config is still valid (unverified).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/panda-css` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(panda-css)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/panda-css.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/panda-css.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
