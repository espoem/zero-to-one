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
