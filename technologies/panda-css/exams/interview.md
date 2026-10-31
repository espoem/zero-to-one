# Panda CSS 2.4 · Interview Question Bank

Original questions for the senior frontend / design-system interview format (see [README](./README.md)). Answers are collapsed. Difficulty: 1 = fundamentals, 2 = typical senior interview, 3 = harder than a typical interview. Official doc links point to https://panda-css.com.

---

## D1 · Static extraction and the v2 compiler (12)

### Q-INT-001 · D1 · difficulty 1 · single
What does Panda need in order to generate CSS for `css({ color: 'red.500' })`?
- A) The component to render once in the browser
- B) The call to appear in a file matched by `include`, with `css` imported from the generated `css` entry point
- C) A `<style>` tag injected by the Panda runtime
- D) `staticCss` listing `color`
<details><summary>Answer</summary>

**B.** Extraction parses the source of files in `include` and recognises calls bound to imports that match the import map.
- Why not A: Panda never executes components to produce CSS.
- Why not C: there is no style injection runtime.
- Why not D: `staticCss` is for values extraction cannot see.
- Ref: [M01 §1.1](../modules/01-mental-model-and-v2-architecture.md#11-three-ways-to-get-from-a-style-object-to-pixels), https://panda-css.com/docs/get-started/why-panda
</details>

### Q-INT-002 · D1 · difficulty 1 · multi
Which of these produce CSS in Panda 2.4? (Select all that apply.)
- A) `css({ color: props.tone })`
- B) `css({ color: isActive ? 'green.700' : 'gray.500' })`
- C) `css(surface)` where `surface` is a named import of a `const` object from another file
- D) `css({ color: defaults.color })` where `defaults` is a default import
- E) `css({ color: 'var(--tone)' })`
<details><summary>Answer</summary>

**B, C, E.** An open ternary folds to both branches; v2 follows named imports; a static string that reads a variable is a normal atom.
- Why not A: a prop is a runtime value.
- Why not D: default (and namespace) imports are not followed.
- Ref: [M10 §10.3](../modules/10-compiler-internals-and-debugging.md#103-the-literal-fold-what-the-compiler-can-know), `negative-extraction.test.ts`, https://panda-css.com/docs/styling/extraction-rules
</details>

### Q-INT-003 · D1 · difficulty 2 · single
Formally, what is an atom in Panda's encoder?
- A) A CSS rule with a hashed selector
- B) The triple (property, value, conditions) after shorthand expansion and token resolution
- C) One style object passed to `css()`
- D) One utility definition in `preset-base`
<details><summary>Answer</summary>

**B.** The stylesheet is the set union of atoms; each atom maps to one rule and one class.
- Why not A: the class name is derived from the atom, not the atom itself.
- Why not C: a style object denotes a *set* of atoms.
- Why not D: a utility is the mapping used to *produce* atoms.
- Ref: [M01 §1.2](../modules/01-mental-model-and-v2-architecture.md#12-atomic-css-formally)
</details>

### Q-INT-004 · D1 · difficulty 2 · scenario
A teammate writes `function local(css) { return css({ color: 'pink.300' }) }` in a file that also imports `css` from `styled-system/css`. `pink.300` never appears in the CSS. Why?
- A) Oxc cannot parse functions with a parameter named `css`
- B) The resolver checks the binding at the call site; the parameter shadows the import, so the call is not a Panda call
- C) `pink.300` is not a token in `preset-panda`
- D) Panda only extracts top-level calls
<details><summary>Answer</summary>

**B.** Extraction is resolver-gated: a local binding named `css` is not the imported one.
- Why not A/D: both are false; nested calls are extracted when bound to the import.
- Why not C: `pink.300` exists; the same file's real `css({ color: 'pink.700' })` is emitted.
- Ref: [M10 §10.2](../modules/10-compiler-internals-and-debugging.md#102-import-matching-rules), `negative/shadowed-css.ts`
</details>

### Q-INT-005 · D1 · difficulty 2 · single
Which statement about the generated `css()` function at runtime is true?
- A) It inserts missing rules into a `<style>` tag
- B) It maps a style object to class names and never creates CSS
- C) It throws when a class has no rule
- D) It is required on the server only
<details><summary>Answer</summary>

**B.** It is a string function; if extraction never saw the object, the returned classes point at missing rules (silent).
- Why not A/C: no injection, no runtime check.
- Why not D: it runs wherever it is called; source transforms can remove it.
- Ref: [M01 §1.4](../modules/01-mental-model-and-v2-architecture.md#14-two-outputs-the-stylesheet-and-the-styled-system-package)
</details>

### Q-INT-006 · D1 · difficulty 2 · multi
Which constructs does the v2 literal fold support? (Select all that apply.)
- A) A pure helper `(n) => ({ p: \`${n}\` })` imported by name and called with a literal
- B) A helper whose body uses `if`
- C) `token.var('colors.brand.600')`
- D) A TS `as` expression around a literal
- E) `String(n)` inside a helper
<details><summary>Answer</summary>

**A, C, D.** Pure single-expression helpers (same-file or imported), token helpers and syntactic no-ops fold.
- Why not B: statements like `if` are not lowered.
- Why not E: unknown calls are not folded; the helper is skipped **silently** (`helper-unsupported.ts`).
- Ref: [M10 §10.3](../modules/10-compiler-internals-and-debugging.md#103-the-literal-fold-what-the-compiler-can-know), https://panda-css.com/docs/styling/dynamic-styling
</details>

### Q-INT-007 · D1 · difficulty 3 · scenario
A file has a syntax error near the end (an unclosed object). The build passes, the file's styles vanish, and the log shows `warning js_parse_error`. A colleague says "Oxc recovers, so only the broken call is lost." Is that guaranteed?
- A) Yes, Oxc always recovers per statement
- B) No; recovery depends on the error. For an unclosed object at EOF the partial AST can contain nothing usable, so even earlier valid calls are lost
- C) No; Panda discards any file with diagnostics by design
- D) Yes, because Panda re-parses each call separately
<details><summary>Answer</summary>

**B.** Panda extracts from whatever partial AST Oxc returns. In `negative/parse-error.ts` the valid first call was lost too. Treat `js_parse_error` as fatal in CI.
- Why not A/D: recovery is error-dependent; there is one parse per file.
- Why not C: Panda does extract from partial ASTs when they contain calls.
- Ref: [M10 §10.3](../modules/10-compiler-internals-and-debugging.md#diagnostics-you-will-see-and-one-you-will-not), `compiler.test.ts`
</details>

### Q-INT-008 · D1 · difficulty 2 · ordering
Order the v2 per-file pipeline stages.
1. Encode to atoms and recipe groups
2. Oxc parse
3. Fold arguments to literals (with cross-file resolution)
4. Match imports against the import map
5. Emit layered CSS
<details><summary>Answer</summary>

**2 → 4 → 3 → 1 → 5.** If step 4 finds no Panda import, the file stops there (fast path).
- Ref: [M10 §10.1](../modules/10-compiler-internals-and-debugging.md#101-the-pipeline), design-notes/extraction-pipeline.md
</details>

### Q-INT-009 · D1 · difficulty 2 · single
In v2, how do you remove the built-in `spacer` pattern from `preset-base`?
- A) `patterns: { spacer: undefined }`
- B) A plugin with a `config:resolved` hook returning `utils.omit(config, ['patterns.spacer'])`
- C) A root `hooks: { 'config:resolved': … }`
- D) `exclude: ['spacer']`
<details><summary>Answer</summary>

**B.** `extend` only adds; removal needs `config:resolved`. Hooks live on plugin objects in v2.
- Why not A: not a supported removal mechanism.
- Why not C: root `hooks` fails with `config_hooks_removed`.
- Why not D: `exclude` filters source files.
- Ref: [M10 §10.5](../modules/10-compiler-internals-and-debugging.md#105-plugins-extending-without-forking), `compiler.test.ts`, https://panda-css.com/docs/reference/plugins
</details>

### Q-INT-010 · D1 · difficulty 3 · single
Which v1 hook capability has **no** v2 equivalent?
- A) Rewriting source before parsing
- B) Rewriting the resolved config
- C) Rewriting the final CSS in `cssgen:done`
- D) Rewriting generated artifacts before they are written
<details><summary>Answer</summary>

**C.** `cssgen:done` is observe-only in v2; use `optimize.removeUnusedTokens`/`removeUnusedKeyframes` or a bundler step.
- Why not A/B/D: `parser:before`, `config:resolved`, `codegen:prepare` still exist.
- Ref: [M10 §10.5](../modules/10-compiler-internals-and-debugging.md#105-plugins-extending-without-forking), https://panda-css.com/docs/get-started/upgrading-to-v2
</details>

### Q-INT-011 · D1 · difficulty 2 · hands-on
Using `panda debug`, show that a default-imported style value leaves nothing to extract while a named-import chain through a barrel is folded.
<details><summary>Answer</summary>

Run `panda debug --include negative/default-import.ts --outdir <tmp> --json` in `examples/fixtures` and read `negative__default-import.ts.extract.json`: `"calls": []` (the only member was unknown, so the whole object was dropped). For `positive/10-cross-file.ts`, the second argument folds to `{ "p": "8" }` from the imported `pad(8)`.
- Verification: `examples/tests/cli.test.ts` (describe `panda debug`).
- Ref: [M10 §10.6](../modules/10-compiler-internals-and-debugging.md#106-debugging-playbook), https://panda-css.com/docs/reference/debugging
</details>

### Q-INT-012 · D1 · difficulty 3 · scenario
After changing `outdir` from `styled-system` to `ds-gen`, a whole app loses its styles; nothing warns. Code still imports from `../styled-system/css` (stale but present files). Explain.
- A) Oxc caches the old outdir
- B) The default import map derives from `outdir`; imports must contain `ds-gen/css` as a substring, so the old imports are no longer recognised as Panda imports
- C) `outdir` must always be `styled-system`
- D) The old folder shadows the new one in Node resolution only
<details><summary>Answer</summary>

**B.** Matching is by substring against the configured import map; we reproduced this with `themes-usage.ts` (`"calls": []`). Fix the imports or set `importMap` for both paths.
- Why not A/C/D: no such cache; any outdir works; resolution of runtime files is a separate issue.
- Ref: [M10 §10.2](../modules/10-compiler-internals-and-debugging.md#102-import-matching-rules)
</details>

---

## D2 · Setup, build integration and tooling (6)

### Q-INT-013 · D2 · difficulty 1 · single
A v2 config lists only `presets: ['@acme/preset']`. What happens?
- A) Panda adds `preset-base` automatically
- B) No base utilities or conditions: `unknown_condition` warnings and invalid CSS like `color: red.500`
- C) The build fails with an error
- D) Panda falls back to `preset-panda`
<details><summary>Answer</summary>

**B.** v2 adds no presets; list `@pandacss/preset-base` (and `preset-panda` for the default theme) explicitly.
- Why not A/D: that was v1 behaviour (and only partially).
- Why not C: it warns, it does not fail.
- Ref: [M02 §2.2](../modules/02-installation-and-build-integration.md#presets-is-no-longer-implicit), `no-preset-base.config.ts`
</details>

### Q-INT-014 · D2 · difficulty 2 · single
How does `@pandacss/dev/postcss` decide which CSS file to replace?
- A) The file named `index.css`
- B) Any processed file containing the layer-order statement `@layer reset, base, tokens, recipes, utilities;`
- C) The file configured in `panda.config.ts` `cssRoot`
- D) Every CSS file
<details><summary>Answer</summary>

**B.** Other files pass through unchanged.
- Ref: [M02 §2.3.2](../modules/02-installation-and-build-integration.md#232-postcss), `integration-postcss.test.ts`, https://panda-css.com/docs/get-started/postcss
</details>

### Q-INT-015 · D2 · difficulty 2 · multi
Which belong in a CI job for a Vite + Panda app? (Select all that apply.)
- A) `panda --max-warnings 0`
- B) `panda codegen --check`
- C) Relying on Vite to fail the build on Panda warnings
- D) A CSS snapshot or screenshot test
<details><summary>Answer</summary>

**A, B, D.**
- Why not C: `@pandacss/vite` reports all diagnostics as warnings and never fails the build.
- Ref: [M02 §2.6](../modules/02-installation-and-build-integration.md#26-ci-gates)
</details>

### Q-INT-016 · D2 · difficulty 2 · scenario
After upgrading to v2, Vite serves old behaviour for `styled-system/css` and types disagree with runtime. What is the most likely cause and fix?
- A) Vite cache; delete `node_modules/.vite`
- B) v1 left `.mjs` files that v2 does not delete; Vite prefers `index.mjs`. Run `panda codegen --clean` once
- C) TypeScript 7 caches declarations; restart the editor
- D) Mixed React versions
<details><summary>Answer</summary>

**B.**
- Why not A/C/D: plausible generic causes, but the v2 upgrade guide documents this exact shadowing.
- Ref: [M02 §2.4](../modules/02-installation-and-build-integration.md#after-any-upgrade---clean), https://panda-css.com/docs/get-started/upgrading-to-v2
</details>

### Q-INT-017 · D2 · difficulty 3 · scenario
You enable `transform: true` in `@pandacss/vite` for a React app. The bundle grows by ~3 KB. Explain how that can happen and how to decide.
<details><summary>Answer</summary>

The transform rewrites only static call sites. Dynamic sites (e.g. `css(badge.raw({ tone }), cssProp)`, styled factories) keep the runtime alive, so the runtime still ships and the inlined class strings add bytes. In this track's React build the transformed bundle was larger; in an all-static app it dropped from 19,811 to 923 bytes. Decide by measuring, and by how much code can be made static.
- Verification: `e2e-computed-style.test.ts` (vanilla and React builds).
- Ref: [M01 §1.4](../modules/01-mental-model-and-v2-architecture.md#source-transforms-removing-the-runtime-entirely), https://panda-css.com/docs/styling/source-transforms
</details>

### Q-INT-018 · D2 · difficulty 2 · single
`tsc` reports `TS2882` on `import './index.css'` after moving to TypeScript 7. Why?
- A) Panda generates no CSS types
- B) `noUncheckedSideEffectImports` is on by default; add `declare module '*.css'` or `vite/client` types
- C) CSS imports are not allowed in ESM
- D) The CSS file is missing the layer statement
<details><summary>Answer</summary>

**B.**
- Ref: [M02 §2.4](../modules/02-installation-and-build-integration.md#typescript-7-and-the-css-import), `examples/react/src/env.d.ts`
</details>

---

## D3 · Styling API, conditions and cascade (9)

### Q-INT-019 · D3 · difficulty 1 · single
What does `css({ color: 'orange.700' }, { color: 'orange.300' })` return?
- A) `'c_orange.700 c_orange.300'`
- B) `'c_orange.300'`
- C) `'c_orange.700'`
- D) It throws: duplicate property
<details><summary>Answer</summary>

**B.** Objects merge left to right before encoding; the last value wins per property.
- Ref: [M03 §3.3](../modules/03-styling-api-and-conditions.md#33-composition-cssa-b-cssraw-cx), `runtime.test.ts`
</details>

### Q-INT-020 · D3 · difficulty 2 · scenario
An element has `class="c_orange.300 c_orange.700"` built by string concatenation, with `orange.300` written last on purpose. It renders `orange.700`. Why?
- A) The browser applies the first class in the attribute
- B) Class order is irrelevant; both rules are in `@layer utilities` with equal specificity, so the one later in the stylesheet wins, and atoms of one property are ordered by value, not usage
- C) `orange.300` is not a token
- D) A bug in Panda 2.4
<details><summary>Answer</summary>

**B.** Merge style objects with `css(a, b)` instead of concatenating classes.
- Ref: [M03 §3.3](../modules/03-styling-api-and-conditions.md#cx-is-not-a-merge), Playwright test `NEGATIVE: concatenated classes …`
</details>

### Q-INT-021 · D3 · difficulty 2 · single
Why does `css({ bg: 'red.500' })` override a config recipe's background even if the recipe selector is more specific?
- A) Utilities use `!important`
- B) `utilities` is declared after `recipes` in the layer order, and layer order is compared before specificity
- C) Recipes are emitted with `:where()`
- D) Utilities are inline styles
<details><summary>Answer</summary>

**B.**
- Ref: [M01 §1.3](../modules/01-mental-model-and-v2-architecture.md#13-the-layered-stylesheet); cascade theory in `languages/css`
</details>

### Q-INT-022 · D3 · difficulty 3 · scenario
In v1, `cx(css({ borderWidth: '1px', borderStyle: 'solid' }), css({ borderInlineEnd: '0' }))` produced an open bracket. In v2 the box is closed again. What changed and what is the fix?
<details><summary>Answer</summary>

v2 sorts atoms by property breadth and puts all border shorthands in one tier; the per-side shorthand `border-inline-end` is emitted before `border-width`, so `border-width: 1px` re-applies the side. Use the longhand `borderInlineEndWidth: '0'`, which sorts after all shorthands. Verified with computed `border-right-width` (1px vs 0px).
- Verification: `e2e-fixtures.test.ts` (v2 border tiers).
- Ref: [M03](../modules/03-styling-api-and-conditions.md#property-breadth-ordering-and-the-v2-border-change), https://panda-css.com/docs/get-started/upgrading-to-v2
</details>

### Q-INT-023 · D3 · difficulty 1 · multi
Which keys inside a style object are treated as conditions or selectors (not CSS properties)? (Select all that apply.)
- A) `_hover`
- B) `md`
- C) `'&[data-state=open]'`
- D) `padding`
- E) `'@container (min-width: 10px)'`
<details><summary>Answer</summary>

**A, B, C, E.** Nesting under `padding` emits dead CSS and a `nested_property` warning.
- Ref: [M03 §3.2](../modules/03-styling-api-and-conditions.md#32-conditions)
</details>

### Q-INT-024 · D3 · difficulty 2 · single
`_groupHover` styles never apply. What is missing most often?
- A) `jsxFramework`
- B) The `group` class (or `role=group` in a custom definition) on the ancestor
- C) A `:hover` polyfill
- D) `staticCss`
<details><summary>Answer</summary>

**B.** Group/peer conditions emit `.group:is(:hover, [data-hover]) .cls` and `.peer:… ~ .cls`.
- Ref: [M03 §3.2](../modules/03-styling-api-and-conditions.md#families), `e2e-fixtures.test.ts`
</details>

### Q-INT-025 · D3 · difficulty 2 · scenario
`<Grid columns={1} md={{ columns: 3 }} />` makes paragraphs flow into three text columns on tablets, but the grid stays single-column. Explain and fix.
<details><summary>Answer</summary>

The `md` object is a style-prop condition, not a pattern prop, so the grid transform never sees `columns: 3`; `columns` is also a CSS property (multi-column layout), so Panda emits `.md\:columns_3 { columns: 3 }`. Write `columns={{ base: 1, md: 3 }}`.
- Verification: `negative-extraction.test.ts` (patterns).
- Ref: [M04 §4.3](../modules/04-patterns-and-layout.md#the-breakpoint-wrapping-trap)
</details>

### Q-INT-026 · D3 · difficulty 2 · single
How are container queries declared and queried in Panda 2.x?
- A) `theme.containerSizes` + `cq` pattern only
- B) Declare with `containerType`/`containerName` (or `cq()`), sizes in `theme.containers`, names in `theme.containerNames`, query with `'@name/size'` or `'@/size'`
- C) Only through arbitrary `@container` keys
- D) Through breakpoints with a `cq` prefix
<details><summary>Answer</summary>

**B.** Arbitrary `@container` keys also work, but the theme API gives typed conditions.
- Why not A: `containerSizes` is the v1 key and is silently ignored in v2.
- Ref: [M04 §4.5](../modules/04-patterns-and-layout.md#45-container-queries-themecontainers), https://panda-css.com/docs/styling/conditional-styles#container-queries
</details>

### Q-INT-027 · D3 · difficulty 3 · hands-on
Define a `hoverActive` condition that applies hover styles on pointer devices and active styles on touch devices, under one name. Verify it compiles to two independent media blocks.
<details><summary>Answer</summary>

```ts
conditions: { extend: { hoverActive: {
  '@media (hover: hover)': { '&:is(:hover, [data-hover])': '@slot' },
  '@media (hover: none)': { '&:is(:active, [data-active])': '@slot' },
} } }
```

Each path to `@slot` becomes its own block. The v1 array form (`['@media …', '&:hover']`) can only nest and now warns `config_condition_array_unsupported`.
- Verification: adapt `configs/array-condition.config.ts` and its test in `negative-extraction.test.ts`.
- Ref: [M03 §3.4](../modules/03-styling-api-and-conditions.md#block-form-with-slot-and-the-then-vs-now), https://panda-css.com/docs/theming/conditions
</details>

---

## D4 · Design tokens and theming (9)

### Q-INT-028 · D4 · difficulty 1 · single
How does a semantic token with `{ base: '{colors.ink.900}', _dark: '{colors.ink.50}' }` compile?
- A) Two utility classes per usage
- B) One custom property declared on the root and redeclared under the dark selector, referencing other variables with `var()`
- C) A JavaScript object read at runtime
- D) A media query per component
<details><summary>Answer</summary>

**B.**
- Ref: [M05 §5.1](../modules/05-design-tokens.md#51-formal-model), `05-tokens` snapshot
</details>

### Q-INT-029 · D4 · difficulty 2 · scenario
`css({ borderColor: token('colors.brand.700') })` does not change in dark mode, but `css({ borderColor: 'brand.700' })` would. Why?
<details><summary>Answer</summary>

The generated `token()` call folds at build time to the token's raw value (`border-color: #4338ca`); a category value or `token.var()` keeps `var(--colors-brand-700)`, which follows redeclarations.
- Verification: `05-tokens` snapshot (`.bd-c_\#4338ca`).
- Ref: [M05 §5.3](../modules/05-design-tokens.md#53-five-ways-to-reference-a-token)
</details>

### Q-INT-030 · D4 · difficulty 2 · multi
Which statements about `strictTokens` are true? (Select all that apply.)
- A) `css({ color: '#ff0000' })` is a type error
- B) `css({ color: '[#ff0000]' })` type-checks
- C) The compiler refuses to emit CSS for raw values
- D) It increases type-check work in large apps
<details><summary>Answer</summary>

**A, B, D.**
- Why not C: strictness is type-level only.
- Ref: [M05 §5.5](../modules/05-design-tokens.md#55-strict-modes), `type-tests.ts`
</details>

### Q-INT-031 · D4 · difficulty 2 · single
Which conditions can a semantic token use?
- A) Any condition, including `_hover`
- B) At-rule and parent-selector conditions (e.g. `md`, `_osDark`, `_dark`)
- C) Only `_dark`
- D) Only breakpoints
<details><summary>Answer</summary>

**B.** The variable is declared on the root or a themed ancestor; element-state conditions do not fit that model.
- Ref: [M05 §5.2](../modules/05-design-tokens.md#52-declaring-tokens), https://panda-css.com/docs/theming/tokens
</details>

### Q-INT-032 · D4 · difficulty 3 · scenario
You ship an on-demand theme with `injectTheme` and enable `optimize.removeUnusedTokens`. The theme's accent renders transparent. Explain.
<details><summary>Answer</summary>

The on-demand theme references primitives (e.g. `--colors-black`) that nothing static used, so `removeUnusedTokens` pruned them from the main sheet. `var()` of an undefined variable makes the declaration invalid at computed-value time, so `background-color` falls back to transparent. Ship the theme statically (`staticCss.themes`), disable the flag, or reference the primitives from scanned code.
- Verification: `e2e-fixtures.test.ts` (themes).
- Ref: [M06 §6.3](../modules/06-color-mode-and-theming.md#what-the-e2e-test-proves)
</details>

### Q-INT-033 · D4 · difficulty 2 · single
What does `defineThemeContract` give you?
- A) Runtime validation of themes
- B) A type error when a theme omits a contracted token, instead of a silent fallback
- C) Automatic dark variants
- D) Smaller theme CSS
<details><summary>Answer</summary>

**B.**
- Ref: [M06 §6.3](../modules/06-color-mode-and-theming.md#theme-contract), `configs/themes.config.ts` (`brokenTheme`)
</details>

### Q-INT-034 · D4 · difficulty 2 · scenario
Users with a stored dark preference see a light flash on every SSR page load. Propose two fixes.
<details><summary>Answer</summary>

(1) A tiny blocking inline script in `<head>` that sets `class="dark"` from storage or `prefers-color-scheme` before first paint; (2) read a cookie on the server and render the class into the HTML. OS-only setups can use `_osDark` tokens with no JS at all. Also set `color-scheme`.
- Ref: [M06 §6.2](../modules/06-color-mode-and-theming.md#flash-of-incorrect-theme-fouc-on-server-rendering)
</details>

### Q-INT-035 · D4 · difficulty 3 · single
After upgrading to v2, utilities using `translate`/`filter` disappear in Safari 15 but work in Chrome. Why, and what is the opt-in fix?
- A) Safari lacks `color-mix`; enable `polyfill`
- B) v2 registers internal variables with `@property` instead of a universal reset; browsers without `@property` drop them. Enable `optimize.propertyFallback`
- C) Safari ignores cascade layers; enable `polyfill`
- D) Safari needs `-webkit-` prefixes; enable `lightningcss`
<details><summary>Answer</summary>

**B.** `propertyFallback` also emits the plain `*, ::before, ::after, ::backdrop` defaults.
- Why not D: `lightningcss` was removed in v2.
- Ref: [M05 §5.4](../modules/05-design-tokens.md#54-registered-variables-property-and-propertyfallback), `05-property-registration` snapshot and fallback test
</details>

### Q-INT-036 · D4 · difficulty 2 · single
`css({ textStyle: 'heading', fontSize: 'sm' })`: which font size applies?
- A) The heading's size, because compositions win
- B) `sm`, because compositions are in the nested `utilities.compositions` layer and direct utilities beat nested layers
- C) Whichever key is written last
- D) Undefined; it warns
<details><summary>Answer</summary>

**B.**
- Ref: [M06 §6.4](../modules/06-color-mode-and-theming.md#64-compositions-text-styles-layer-styles-animation-styles), `e2e-fixtures.test.ts`
</details>

---

## D5 · Recipes and component architecture (12)

### Q-INT-037 · D5 · difficulty 1 · single
What is the main CSS difference between `cva` and a config recipe?
- A) `cva` emits named classes; config recipes emit atoms
- B) `cva` emits atomic utilities for every variant; config recipes emit named classes in `@layer recipes` only for variants seen in source
- C) There is none
- D) Config recipes cannot have compound variants
<details><summary>Answer</summary>

**B.**
- Ref: [M07 §7.1](../modules/07-recipes-and-config-recipes.md#71-the-recipe-model), `07-recipes` snapshot
</details>

### Q-INT-038 · D5 · difficulty 2 · scenario
`<Button size="lg">` works in Storybook but in the app `<Button size={size}>` renders without size styles, although the class `button--size_lg` is on the element. Explain and give three fixes.
<details><summary>Answer</summary>

Config recipes are JIT: only literal variant values are emitted. Storybook's literal produced the CSS there; in the app `size={size}` is unknown, so only defaults are emitted while the runtime still returns the class. Fixes: a literal call somewhere scanned, `staticCss: { recipes: { button: [{ size: ['*'] }] } }`, or modelling the value so a literal appears.
- Verification: `negative-extraction.test.ts` (`config recipe with a runtime variant`, `staticCss pre-generates …`).
- Ref: [M07 §7.3](../modules/07-recipes-and-config-recipes.md#jit-emission-and-its-three-failure-modes), https://panda-css.com/docs/recipes/dynamic-variants
</details>

### Q-INT-039 · D5 · difficulty 2 · single
A wrapper `function Action(p) { return <button className={button(p)} /> }` is used as `<Action size="lg" />`. Why is `size=lg` missing?
- A) `button` must be called in JSX
- B) Recipe JSX tracking matches tag names (`jsx: ['Button']`); `Action` is not listed
- C) Wrappers are never supported
- D) `size` must be a boolean
<details><summary>Answer</summary>

**B.** Add `'Action'` to the recipe's `jsx`, rename the wrapper, or use `staticCss`.
- Ref: [M07 §7.3](../modules/07-recipes-and-config-recipes.md#jit-emission-and-its-three-failure-modes), `negative/recipe-renamed-wrapper.tsx`
</details>

### Q-INT-040 · D5 · difficulty 3 · multi
Which statements about compound variants in Panda 2.x config recipes are true? (Select all that apply.)
- A) Each matching compound is a named class like `button--compound__size_lg__visual_outline`
- B) They live in `@layer recipes.compound_variants`, above the recipe's variants
- C) `css()` overrides them only if its selector is more specific
- D) By default every compound of a used recipe is emitted; `smartCompoundVariants` limits that
- E) A direct call `button({ visual: 'outline', size: 'lg' })` does not include the compound class
<details><summary>Answer</summary>

**A, B, D.**
- Why not C: utilities beat everything in `recipes` by layer order.
- Why not E: v2 runtime appends the compound class on direct calls too.
- Ref: [M07 §7.4](../modules/07-recipes-and-config-recipes.md#74-compound-variants-then-vs-now), `runtime.test.ts`, e2e compound tests
</details>

### Q-INT-041 · D5 · difficulty 2 · single
What does `colorPalette: 'red'` emit on an element?
- A) A class that sets `color: red`
- B) Declarations pointing the `--colors-color-palette-*` variables at the red scale, which `colorPalette.*` tokens read and descendants inherit
- C) A theme block
- D) Nothing until `staticCss` is set
<details><summary>Answer</summary>

**B.**
- Ref: [M07 §7.5](../modules/07-recipes-and-config-recipes.md#75-virtual-colors-colorpalette), `08-slot-recipes` snapshot
</details>

### Q-INT-042 · D5 · difficulty 2 · single
Which replaced `createStyleContext` in v2?
- A) `createContext` from React
- B) `createSlotRecipeContext` (slot recipes) and `createRecipeContext` (single-element recipes) from `styled-system/jsx`
- C) `defineParts`
- D) `sva.context()`
<details><summary>Answer</summary>

**B.** `defineParts` was removed too.
- Ref: [M08 §8.2](../modules/08-slot-recipes-and-recipe-contexts.md#then-vs-now), `cli.test.ts` (doctor artifacts)
</details>

### Q-INT-043 · D5 · difficulty 2 · scenario
A Dialog root from a headless library renders no DOM element. Which helper wraps it and why?
<details><summary>Answer</summary>

`withRootProvider(Dialog.Root, { defaultProps })`: it provides the slot map through context without applying a slot class (there is no element to style). Parts use `withContext`.
- Ref: [M08 §8.2](../modules/08-slot-recipes-and-recipe-contexts.md#createslotrecipecontext), https://panda-css.com/docs/recipes/slot-recipe-context
</details>

### Q-INT-044 · D5 · difficulty 2 · hands-on
Build an `Alert` compound component (`Root`, `Title`, `Description`) from the `alert` slot recipe for React **and** Solid. Show that the root does not forward `status` to the DOM and that a part rendered outside the root throws.
<details><summary>Answer</summary>

```tsx
const { withProvider, withContext } = createSlotRecipeContext(alert)
export const Alert = {
  Root: withProvider('div', 'root', { defaultProps: { role: 'status' } }),
  Title: withContext('p', 'title'),
  Description: withContext('p', 'description'),
}
```

Identical source for both frameworks; the generated helpers differ internally.
- Verification: `examples/tests/recipe-context.test.ts` (React and Solid SSR); `examples/react/src/Alert.tsx`, `examples/solid/src/Alert.tsx`.
- Ref: [M08](../modules/08-slot-recipes-and-recipe-contexts.md)
</details>

### Q-INT-045 · D5 · difficulty 2 · single
Why should a Solid component accepting a `css` prop use `splitProps` instead of destructuring?
- A) Panda cannot extract destructured props
- B) Destructuring reads props once and loses reactivity; `splitProps` keeps reactive groups
- C) Solid forbids rest parameters
- D) `class` must be read last
<details><summary>Answer</summary>

**B.** Extraction reads the `css` prop at the call site either way.
- Ref: [M09 §9.2](../modules/09-jsx-factory-and-style-props.md#92-react-and-solid-side-by-side), `examples/solid/src/Badge.tsx`
</details>

### Q-INT-046 · D5 · difficulty 3 · single
In this track's benchmark, how did `jsxStyleProps: 'minimal'` compare to `'all'` on type-check work, and why?
- A) No difference
- B) ~41 % fewer type instantiations, because generic style props are no longer part of every element's props type
- C) Slower, because `css` objects are checked
- D) Faster only at runtime
<details><summary>Answer</summary>

**B.** 8,587 → 5,073 instantiations on identical source (tiny project; ratio depends on app size).
- Ref: [M09 §9.3](../modules/09-jsx-factory-and-style-props.md#93-jsxstyleprops-extraction-surface-and-type-cost), `type-cost.test.ts`
</details>

### Q-INT-047 · D5 · difficulty 2 · multi
Which prop names does extraction read on JSX call sites? (Select all that apply.)
- A) `css`
- B) `trackCss`
- C) `sx`
- D) Utility names like `bg` when `jsxStyleProps: 'all'`
- E) `elementWidth` forwarded to `width` inside the component
<details><summary>Answer</summary>

**A, B, D.**
- Why not C/E: other names are not read; wrap values in `css.raw()` or expose utility names / `*Css` props.
- Ref: [M09 §9.1](../modules/09-jsx-factory-and-style-props.md#91-style-props-are-css-with-a-different-surface), https://panda-css.com/docs/styling/extraction-rules
</details>

### Q-INT-048 · D5 · difficulty 3 · scenario
Design the override API for a `Card` with parts `root`, `header`, `body` in a design system used by 30 teams. Requirements: per-part overrides, no specificity wars, typed, extractable.
<details><summary>Answer</summary>

Use a config slot recipe (`defineSlotRecipe`) for named, layered classes and JIT emission; build the component with `createSlotRecipeContext`; expose `css` on the root plus `headerCss`/`bodyCss` (or per-part `css` on each part component) typed as `SystemStyleObject`, merged with `css(recipe.raw…, override)` or applied as utilities, which always beat `@layer recipes`. Use `jsxStyleProps: 'minimal'` for type cost, list wrapper names in `jsx`, and `forwardProps` for variants headless parts need.
- Ref: [M08](../modules/08-slot-recipes-and-recipe-contexts.md), [M09](../modules/09-jsx-factory-and-style-props.md), [M03 §3.3](../modules/03-styling-api-and-conditions.md#the-css-prop-forwarding-pattern)
</details>

---

## D6 · Design-system delivery and monorepos (6)

### Q-INT-049 · D6 · difficulty 1 · single
What does `panda lib` produce?
- A) A minified CSS file only
- B) `dist/panda/lib.json`, `preset.mjs`, `buildinfo.json`, and synced `package.json` exports
- C) A Storybook build
- D) An npm tarball
<details><summary>Answer</summary>

**B.**
- Ref: [M11 §11.2](../modules/11-monorepos-and-design-system-libraries.md#112-building-a-design-system-with-panda-lib), `monorepo.test.ts`
</details>

### Q-INT-050 · D6 · difficulty 2 · scenario
An app sets `designSystem: '@acme/ds'` and also adds `'@acme/ds'` to `include` "to be safe". What happens?
<details><summary>Answer</summary>

The build errors with `design_system_in_include`. The package is loaded through its manifest and build info; `include` is only for the app's own sources. A path glob into the package's source does not error but re-extracts work the build info already covers.
- Verification: `monorepo.test.ts` (NEGATIVE test).
- Ref: [M11 §11.3](../modules/11-monorepos-and-design-system-libraries.md#fallback-and-failure)
</details>

### Q-INT-051 · D6 · difficulty 2 · single
How does an app get the package's component styles without scanning the package's source?
- A) It imports the package's CSS file
- B) It replays the package's `buildinfo.json` into its own compilation
- C) It runs `panda lib` itself
- D) Through `staticCss: '*'`
<details><summary>Answer</summary>

**B.** The app run reported only its own files parsed, yet emitted the package's classes.
- Ref: [M11 §11.3](../modules/11-monorepos-and-design-system-libraries.md#113-consuming-a-design-system)
</details>

### Q-INT-052 · D6 · difficulty 3 · scenario
An app sets `hash: true` for production; components from the design system render unstyled. Explain.
<details><summary>Answer</summary>

The package's classes are baked into its build (runtime and build info) with its own `hash`/`prefix`/`separator`. A different app setting produces different class names in the app's CSS (`design_system_option_mismatch`). Leave these options unset in the app so they are inherited.
- Ref: [M11 §11.3](../modules/11-monorepos-and-design-system-libraries.md#fallback-and-failure), https://panda-css.com/docs/reference/diagnostics
</details>

### Q-INT-053 · D6 · difficulty 2 · multi
Which reduce CSS shipped by an app that uses 3 of 60 design-system components? (Select all that apply.)
- A) `optimize.treeshakeDesignSystem: true`
- B) `optimize.removeUnusedTokens: true`
- C) Adding the package's source to `include`
- D) For non-Panda consumers: `panda cssgen --splitting` and importing per-recipe files
<details><summary>Answer</summary>

**A, B, D.**
- Why not C: errors or duplicates extraction.
- Ref: [M11 §11.3](../modules/11-monorepos-and-design-system-libraries.md#tree-shaking-the-design-system), `monorepo.test.ts`
</details>

### Q-INT-054 · D6 · difficulty 2 · ordering
Order the CI tasks for a monorepo with a design-system package and an app.
1. App `build`
2. Package `panda codegen`
3. App `panda codegen`
4. Package `panda lib`
<details><summary>Answer</summary>

**2 → 4 → 3 → 1.** The app's Panda run needs the package's manifest and build info; the app's `styled-system` re-exports the package's.
- Ref: [M11 §11.4](../modules/11-monorepos-and-design-system-libraries.md#task-graph-and-caching-turborepo-or-similar), this track's `codegen` script
</details>

---

## D7 · Migration and upgrades (6)

### Q-INT-055 · D7 · difficulty 1 · single
How do you migrate `color: ${(p) => p.$color}` (user-chosen color) from styled-components?
- A) `css({ color: props.color })`
- B) A static style reading a CSS variable, with the variable set inline
- C) `staticCss` for every possible color
- D) A runtime `<style>` tag
<details><summary>Answer</summary>

**B.** Finite sets become variants instead.
- Ref: [M12 §12.1](../modules/12-migration-and-upgrades.md#121-from-runtime-css-in-js-styled-components-emotion-stitches), bridge test in `e2e-fixtures.test.ts`
</details>

### Q-INT-056 · D7 · difficulty 2 · multi
Which v1 → v2 changes produce **no** error and no warning? (Select all that apply.)
- A) `theme.containerSizes`
- B) Root `hooks`
- C) `emitPackage: true`
- D) `createStyleContext` import
- E) A default import of a style-values module
<details><summary>Answer</summary>

**A, C, E.**
- Why not B: `config_hooks_removed` error.
- Why not D: the import fails at type-check/build.
- Ref: [M12 §12.3](../modules/12-migration-and-upgrades.md#checklist), `migration.test.ts`
</details>

### Q-INT-057 · D7 · difficulty 2 · scenario
During a gradual migration, a migrated Panda component inside a legacy Emotion parent loses its padding to the parent's descendant selector. Explain and fix.
<details><summary>Answer</summary>

Emotion's injected CSS is unlayered, and unlayered declarations beat all layered ones regardless of specificity. Layer legacy global CSS below Panda's (`@layer legacy, reset, …` with `@import … layer(legacy)`), migrate leaf components first, and remove the runtime library at the end.
- Ref: [M12 §12.1](../modules/12-migration-and-upgrades.md#coexistence-during-the-migration)
</details>

### Q-INT-058 · D7 · difficulty 2 · single
What replaced Tailwind's `tailwind-merge` in a Panda codebase?
- A) `cx()`
- B) Object merging with `css(base, overrides)`
- C) `staticCss`
- D) Nothing is needed because Panda has no conflicts
<details><summary>Answer</summary>

**B.**
- Why not A: `cx` only joins strings.
- Ref: [M12 §12.2](../modules/12-migration-and-upgrades.md#122-from-tailwind-css)
</details>

### Q-INT-059 · D7 · difficulty 3 · hands-on
Write a static audit that flags v1 idioms v2 ignores silently, and prove it finds them in a v1 project while reporting nothing for a clean v2 project.
<details><summary>Answer</summary>

See `examples/scripts/v2-upgrade-audit.ts`: regex rules over source files with comments blanked, configuration-only rules (root `hooks`, removed options, array conditions), and a `preset-base-missing` check. Severity `silent` marks `containerSizes`, `emitPackage`/removed options, missing `preset-base` and default imports of style modules.
- Verification: `examples/tests/migration.test.ts` (v1 fixture project + the track's own v2 examples).
- Ref: [M12 §12.3](../modules/12-migration-and-upgrades.md#123-upgrading-panda-0x--1x--2x)
</details>

### Q-INT-060 · D7 · difficulty 2 · single
Why can a project move from Panda 0.51 directly to 2.4?
- A) 0.x and 2.x share the same engine
- B) 1.0 listed no breaking changes, so one v2 checklist covers 0.x and 1.x
- C) The CLI auto-migrates configs
- D) It cannot; it must stop at every 1.x minor
<details><summary>Answer</summary>

**B.** If the project adopted `createStyleContext` (added in 1.0), that is part of the v2 migration.
- Ref: [M12 §12.3](../modules/12-migration-and-upgrades.md#0x--1x)
</details>

---

## Mock interview

A 60-minute senior frontend / design-system loop. Answer without notes, then score with the key. The mix follows the domain weights in the [README](./README.md#domain--module-coverage-matrix) (D1 20 %, D5 20 %, D3/D4 15 %, D2/D6/D7 10 %).

| Block | Time | Questions | Points each | Points |
|---|---|---|---|---|
| 1. Warm-up concepts (answer in ≤ 1 minute each) | 8 min | Q-INT-001, 003, 013, 019, 028, 037, 049, 055 | 2 | 16 |
| 2. Precision checks (multi-select: all correct options, no wrong ones) | 10 min | Q-INT-002, 006, 030, 040, 053, 056 | 3 | 18 |
| 3. Debugging scenarios (explain cause and fix aloud) | 20 min | Q-INT-007, 012, 020, 025, 032, 038, 050, 057 | 4 | 32 |
| 4. Design discussion | 12 min | Q-INT-048, Q-INT-017 | 8 | 16 |
| 5. Hands-on (live) | 10 min | Q-INT-022 (or Q-INT-044 for component-heavy roles) | 18 | 18 |
| **Total** | **60 min** | **25** | | **100** |

### Scoring key

- Blocks 1–2: full points only for exactly the keyed answer(s); no partial credit on multi-select.
- Block 3 (4 points): 2 for the root cause matching the answer, 1 for a correct fix, 1 for naming how to verify (test, `panda debug`, computed style).
- Block 4 (8 points): 3 for the right primitives (slot recipe/context/override props; or measuring transform impact), 3 for the trade-offs (layer order, JIT, type cost; dynamic sites keep the runtime), 2 for the verification plan.
- Block 5 (18 points): 8 for a working solution, 6 for a passing verification (the referenced test or an equivalent computed-style check), 4 for explaining the v1 vs v2 behaviour.

| Score | Interpretation |
|---|---|
| ≥ 85 | Senior / design-system owner level: ready for Panda-heavy roles |
| 70–84 | Pass: solid practitioner; review the modules behind missed questions |
| 50–69 | Gaps in extraction or recipe internals: redo M07, M10 and their tests |
| < 50 | Restart from M01; run every test in `examples/tests` and read its fixture |

Per-domain self-check: map each missed question to its domain tag and re-read the module column in the [coverage matrix](./README.md#domain--module-coverage-matrix).
