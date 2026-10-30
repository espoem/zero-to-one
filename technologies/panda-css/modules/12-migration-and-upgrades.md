# Module 12 · Migration and Upgrades

> **Verified against** `@pandacss/dev` 2.4.0 (npm `latest`), release dates from the npm registry `time` field, and the repository `CHANGELOG.md` on 2026-10-29.
> **Executable proof:** [`examples/scripts/v2-upgrade-audit.ts`](../examples/scripts/v2-upgrade-audit.ts) run against the v1-era project [`examples/fixtures/v1-project/`](../examples/fixtures/v1-project/) and against this track's own v2 code in [`migration.test.ts`](../examples/tests/migration.test.ts); the misconfiguration configs in [`examples/fixtures/configs/`](../examples/fixtures/configs/) with [`negative-extraction.test.ts`](../examples/tests/negative-extraction.test.ts) and [`compiler.test.ts`](../examples/tests/compiler.test.ts); the CSS-variable bridge test in [`e2e-fixtures.test.ts`](../examples/tests/e2e-fixtures.test.ts).

Two migrations matter in practice: **into** Panda from runtime CSS-in-JS or Tailwind, and **within** Panda from 0.x/1.x to 2.x. Both are mostly mechanical once you know which differences are silent. This module closes the track with the upgrade checklist, the version history, and a v2 best-practices catalogue that indexes the earlier modules.

The architectural comparison of runtime vs zero-runtime CSS-in-JS is owned by [`languages/css`](../../../languages/css/README.md) (module "CSS architecture & design tokens at scale").

---

## 12.1 From runtime CSS-in-JS (styled-components, Emotion, Stitches)

### The one hard problem: dynamic values

Runtime libraries evaluate interpolations per render: `` color: ${(p) => p.$tone}; ``. Panda cannot ([Module 01](./01-mental-model-and-v2-architecture.md#11-three-ways-to-get-from-a-style-object-to-pixels)). Map each dynamic value to one of three static shapes:

| Runtime pattern | Value space | Panda shape |
|---|---|---|
| `${p => p.$variant === 'primary' ? … : …}` | Finite, known | Recipe variant (`cva` or config recipe) |
| `${p => p.$active && css`…`}` | Boolean | Boolean variant, or `_active`/`data-*` condition |
| `${p => p.$width}px`, user-picked colors | Continuous / unbounded | Static style reading a CSS variable, variable set inline |

The CSS-variable bridge:

```tsx
// static: extracted at build time
const swatch = css({ color: 'var(--badge-tone)' })
// dynamic: only the variable is set at runtime
<span className={swatch} style={{ '--badge-tone': user.color } as React.CSSProperties} />
```

[`e2e-fixtures.test.ts`](../examples/tests/e2e-fixtures.test.ts) renders `class="c_var(--badge-tone)" style="--badge-tone: rgb(1, 2, 3)"` and reads `color: rgb(1, 2, 3)`. Prefer a token where the set is finite; an inline variable bypasses `strictTokens`.

### Concept map

| styled-components / Emotion | Stitches | Panda |
|---|---|---|
| `styled.button` with template CSS | `styled('button', {...})` | `styled('button', recipe)` or `cva` ([Module 07](./07-recipes-and-config-recipes.md)) |
| Transient props `$size` | `variants` | Recipe variants (split from DOM props automatically) |
| `.attrs({ type: 'button' })` | — | `defaultProps` factory option |
| Component selector `` ${Card}:hover & `` | — | `_groupHover` + `group` class, or `data-*` + condition |
| `css` prop (Emotion) | `css` prop | `css` prop on factory components / pattern in [Module 03](./03-styling-api-and-conditions.md#the-css-prop-forwarding-pattern) |
| `ThemeProvider` + `props.theme.colors.x` | `createStitches({ theme })`, `$token` | Tokens + semantic tokens; `colors.x` values ([Module 05](./05-design-tokens.md)) |
| Theme switching with nested providers | `createTheme()` classes | `themes` + `data-panda-theme` ([Module 06](./06-color-mode-and-theming.md)) |
| `createGlobalStyle` / `<Global>` | `globalCss()` | `globalCss` in config (`@layer base`) |
| `keyframes` | `keyframes` | `theme.keyframes` or `keyframes()` |
| `as` prop | `as` prop | `as` prop on factory components |

Stitches users relied on `$token` spelling. v2 does **not** implement it: a `tokenSyntax: '$'` design note exists but is marked "proposed (not yet implemented)", and the v1 `tokens:created` hook that people used to fake it is gone. Rewrite `$colors$blue500` as `'blue.500'` (category inferred) or `'{colors.blue.500}'`.

### Coexistence during the migration

Run both systems side by side, component by component. Two cascade facts decide who wins:

1. Panda's rules are layered; most runtime CSS-in-JS output is **unlayered**, and unlayered declarations beat every layered declaration regardless of specificity. A not-yet-migrated parent's styles can therefore override a migrated child's Panda utilities when they target the same element.
2. Fix by wrapping legacy CSS in a layer **below** Panda's, e.g. declare `@layer legacy, reset, base, tokens, recipes, utilities;` and import legacy global CSS with `@import url(legacy.css) layer(legacy);` (runtime-injected tags cannot be layered this way; migrate leaf components first so overrides flow from Panda outward).

Keep the runtime library until the last styled component is gone; then remove its provider and SSR style-collection code.

---

## 12.2 From Tailwind CSS

Tailwind and Panda are both utility-first with build-time generation; the migration is a syntax translation:

| Tailwind 4 | Panda |
|---|---|
| `class="bg-red-500 px-4 hover:bg-red-600"` | `css({ bg: 'red.500', px: '4', _hover: { bg: 'red.600' } })` |
| `md:flex` | `{ display: { md: 'flex' } }` |
| `w-[327px]` arbitrary value | `width: '327px'` (raw values allowed; `'[327px]'` under `strictTokens`) |
| `bg-red-500/40` | `bg: 'red.500/40'` (`color-mix`) |
| `@theme { --color-brand: … }` | `theme.extend.tokens.colors.brand` |
| `dark:bg-gray-900` | `_dark` condition or a semantic token |
| `@custom-variant hocus (&:hover, &:focus)` | `conditions.extend.hocus: '&:is(:hover, :focus)'` |
| `group-hover:` / `peer-invalid:` | `_groupHover` / `_peerInvalid` |
| `tailwind-merge` for overrides | Not needed: `css(base, overrides)` merges objects |
| `tailwind-variants` / CVA | `cva`, `sva`, config recipes |
| Class detection by text scan (any string that looks like a class) | AST extraction; class strings built at runtime are never "detected" |

The important semantic difference runs the other way too: Tailwind's scanner picks up a class name from any string literal, so dynamic class *selection* among literals works; Panda's fold follows ternaries and imports but not runtime string building. Tailwind's `@apply` has no equivalent; use `css.raw`/recipes. Tailwind's `preflight` and Panda's `preflight` differ in detail, so expect visual diffs and run screenshot tests during the switch.

---

## 12.3 Upgrading Panda 0.x / 1.x → 2.x

### Checklist

Run the audit script first; it finds the v1 idioms v2 **silently ignores** (the ones that pass CI and break the UI):

```bash
node examples/scripts/v2-upgrade-audit.ts path/to/project
```

Against [`v1-project`](../examples/fixtures/v1-project/) it reports `preset-base-missing`, `containerSizes`, `emitPackage`, removed options and a default-imported style module as **silent**, and root `hooks`, `createStyleContext`, `panda ship`, template-literal `css`` ` as errors. Against this track's own v2 examples it reports nothing (both asserted in `migration.test.ts`).

| # | Step | Why | Silent if missed? | Proof |
|---|---|---|---|---|
| 1 | Node ≥ 22; config and tooling as ESM | `@pandacss/*` are ESM-only (`require` fails) | No (crash) | — |
| 2 | Upgrade **all** `@pandacss/*` to the same 2.x | One version group; v1/v2 mixes break codegen subtly | Partly | — |
| 3 | List `@pandacss/preset-base` (and `preset-panda` if used) in `presets` | No implicit presets | **Yes** (warnings only) | `no-preset-base` test |
| 4 | `panda codegen --clean` once | v2 writes `.js`, leaves old `.mjs` that Vite prefers | **Yes** | — |
| 5 | `theme.containerSizes` → `theme.containers` | Old key ignored | **Yes** | `container-sizes` test |
| 6 | Root `hooks` → `plugins: [{ name, hooks }]`; drop engine hooks (`tokens:created`, `utility:created`, `parser:after`…); `cssgen:done` is observe-only | Hook model rewritten | No (`config_hooks_removed`) | `compiler.test.ts` |
| 7 | `createStyleContext` → `createSlotRecipeContext` / `createRecipeContext`; `defineParts` → selectors or slot recipes | Removed | No (import fails) | `recipe-context.test.ts` |
| 8 | Template-literal syntax → objects; remove `syntax` | Removed | No | — |
| 9 | Array condition definitions → `@slot` block form | Deprecated (converted + warning) | Warning | `array-condition` test |
| 10 | Compound variants: override each property explicitly | Each compound is its own class in `recipes.compound_variants` | **Yes** (visual) | e2e compound tests |
| 11 | Per-side border shorthand overrides → longhands | Breadth tiers | **Yes** (visual) | e2e border test |
| 12 | Theme keys without `extend`: check `breakpoints` | Only `breakpoints` still replaces the whole set; other keys now replace just the named entry | **Yes** | `breakpoints-replace` test |
| 13 | `scrollbarWidth` → keywords; single colors in `scrollbarColor` → `scrollbarThumb` | Utility semantics changed | **Yes** | — |
| 14 | `sizes.prose` 65ch → 60ch: override if needed | Preset default changed | **Yes** (visual) | React build CSS |
| 15 | Browser floor for `@property` (Safari 16.4, Firefox 128) or `optimize.propertyFallback` | No universal variable reset | **Yes** on old browsers | `propertyFallback` test |
| 16 | Delete `staticCss`/inlined values that only existed because v1 ignored imports; convert default/namespace imports of style values to named imports | Imports now followed, except default/namespace | Default imports: **yes** | `10-cross-file`, `default-import` tests |
| 17 | `panda ship`/`emit-pkg`/`emitPackage` → `panda lib` + `designSystem` | Removed | `emitPackage`: **yes** | `monorepo.test.ts` |
| 18 | CLI: `--include` instead of positional globs, `--outdir`/`--outfile`, `--log-level`, `--profile`, kebab-case flags; `panda spec` → `codegen --spec`; `panda mcp` → `npx @pandacss/mcp` | CLI redesigned | Positional globs: **yes** (ignored) | `cli.test.ts` |
| 19 | Remove `@pandacss/plugin-vue`/`plugin-svelte`, imports of internal packages (`@pandacss/core`, `node`, `extractor`, …), removed options (`eject`, `lightningcss`, `browserslist`, `gitignore`, `emitTokensOnly`, `clean`, `watch`, `poll`, `studio`) | Folded into the compiler / removed | Options: **yes** (ignored) | audit script |
| 20 | Types: import config types from `@pandacss/types`; `RecipeConfig` → `RecipeDefinition`; `Token` moved to `styled-system/types`; `UtilityValues`, `CssProperties` removed | Smaller generated types | No (tsc) | — |
| 21 | Qwik: no generated JSX components | Removed | No | — |
| 22 | Editor tooling: `@pandacss/typescript-plugin` and `@pandacss/language-server` discontinued (2.1.2); use the ESLint/oxlint plugin and the MCP server | TS 7 has no tsserver plugins | — | — |
| 23 | Verify: `panda doctor`, `panda --max-warnings 0`, `panda codegen --check`, a CSS snapshot and a screenshot pass | Catch the silent ones | — | this whole suite |

### Mixing old and new

Do not run v1 and v2 side by side in one app (different runtime, class grouping and compound semantics). In a monorepo, upgrade the design-system package first, run `panda lib`, then each app; old build info is reported as `design_system_buildinfo_stale` and falls back to re-extraction ([Module 11](./11-monorepos-and-design-system-libraries.md#fallback-and-failure)).

### 0.x → 1.x

The 1.0.0 release notes (2025-08-05) list no breaking changes: 1.0 marked the API stable and added the generated `createStyleContext` helper (which 2.0 then removed). Projects on late 0.x (this track was on `^0.51` from 2024-12-31) can jump straight to 2.x with the checklist above.

---

## 12.4 Version history

Dates from the npm registry (`npm view @pandacss/dev time`), 2026-10-29.

| Version | Date | Relevance for practitioners |
|---|---|---|
| first publish | 2023-02-13 | Package created |
| 0.3.0 | 2023-06-14 | Early public 0.x; static extraction with `ts-morph`/`ts-evaluator`, PostCSS plugin |
| 0.30.0 | 2024-02-05 | Mature 0.x line (config recipes, slot recipes, `panda ship`, Studio) |
| 0.40.0 | 2024-05-29 | |
| 0.51.1 | 2025-01-01 | Previous pin of this track |
| 0.54.0 | 2025-06-12 | Last 0.x |
| **1.0.0** | 2025-08-05 | Stable API; generated `createStyleContext` |
| 1.9.0 | 2026-03-08 | |
| 1.12.1 | 2026-09-04 | Last 1.x |
| **2.0.0** | 2026-09-29 | Rust/Oxc compiler, ESM-only, Node ≥ 22, explicit presets, imports followed, compound-variant sub-layer, recipe contexts, `panda lib`/`designSystem`, plugins replace hooks, `@pandacss/vite` with `transform`, `@property` registration |
| 2.1.0 | 2026-10-01 | `nested_property` warning, brace globs in `--include`, MCP usage report |
| 2.1.2 | 2026-10-06 | `panda lib` exports `./types`; richer pure helpers; presets ESM-only; TS plugin and language server discontinued |
| 2.2.0 | 2026-10-09 | `PropsProvider` for slot recipe contexts; `pure_helper_unevaluated` removed; array conditions load again (converted) |
| 2.3.0 | 2026-10-19 | `jsxMatchTag`; `panda analyze` counts config usage; recipe variants emit in config order again |
| **2.4.0** | 2026-10-22 | `panda studio` (hosted, live-connected); recipe conditions follow authoring order; `cornerShape` types; `treeshakeDesignSystem` fix |

---

## 12.5 Best-practices catalogue (v2)

The previous version of this course ended with 25 rules written for 0.x. Here they are rewritten for 2.4, each pointing at the module and test that justify it.

**Extraction**

1. Write statically knowable styles; for continuous values use a static style that reads a CSS variable ([M10](./10-compiler-internals-and-debugging.md), bridge test).
2. Import style values with **named** imports; default/namespace imports are invisible (negative tests).
3. Keep style helpers to one expression or `const`s + one `return`; unsupported helpers fail silently ([M10](./10-compiler-internals-and-debugging.md#103-the-literal-fold-what-the-compiler-can-know)).
4. No dynamic object keys (`{ [key]: 'red' }`); use conditions or variants.
5. Gate CI on `panda --max-warnings 0`, `panda codegen --check`, CSS snapshots ([M02](./02-installation-and-build-integration.md#26-ci-gates)).

**Recipes**

6. Config recipes for design-system primitives, `cva` for component-local variants ([M07](./07-recipes-and-config-recipes.md)).
7. Slot recipes + `createSlotRecipeContext` for multi-part components ([M08](./08-slot-recipes-and-recipe-contexts.md)).
8. Always set `defaultVariants`; never put variant keys in `defaultProps`.
9. Remember config-recipe JIT: literals at call sites, `jsx` for wrappers, targeted `staticCss` for runtime-only values.
10. Override compounds property by property; enable `smartCompoundVariants` once runtime-only combinations are listed.

**Tokens and theming**

11. Never hard-code colors in components; enable `strictTokens` (and `strictPropertyValues`) in apps ([M05](./05-design-tokens.md#55-strict-modes)).
12. Components read semantic tokens; modes and themes only redeclare them ([M06](./06-color-mode-and-theming.md)).
13. Use `textStyle`/`layerStyle` for repeated bundles; remember plain utilities override them.
14. Use `token.var()` or category values in styles; JS `token()` only where a literal value is required (canvas, meta tags).
15. With on-demand themes, do not let `removeUnusedTokens` prune their primitives.

**Types and DX**

16. `jsxStyleProps: 'minimal'` in large apps ([M09](./09-jsx-factory-and-style-props.md#93-jsxstyleprops-extraction-surface-and-type-cost)).
17. Export `RecipeVariantProps<typeof recipe>` / `ButtonVariantProps` instead of re-declaring unions.
18. Accept overrides as `css` / `*Css` style objects, merge with `css(recipe.raw(p), cssProp)`.
19. Use `forwardProps`/`shouldForwardProp` deliberately for headless and motion libraries.
20. Gitignore `styled-system`, regenerate in `prepare`, check with `codegen --check`.

**Monorepo and delivery**

21. Ship component libraries with `panda lib`; consume with `designSystem`; never `include` them ([M11](./11-monorepos-and-design-system-libraries.md)).
22. Keep each `include` to the package's own source; never `node_modules`, `dist` or `styled-system`.
23. Turn on `treeshakeDesignSystem`, `removeUnusedTokens`, `removeUnusedKeyframes` in production after testing.
24. Measure `transform: true` before adopting; it only removes the runtime if every call site is static ([M01](./01-mental-model-and-v2-architecture.md#14-two-outputs-the-stylesheet-and-the-styled-system-package)).
25. Re-verify after upgrades with snapshots *and* screenshots: several v2 changes are visual-only (compounds, borders, `sizes.prose`).

---

## Interview Drill

<details><summary>1. How do you migrate `color: ${p => p.$color}` from styled-components?</summary>

If the set of colors is finite, make it a recipe variant (or a `colorPalette` variant). If it is user-provided, write a static style `css({ color: 'var(--tone)' })` and set `--tone` inline. Never `css({ color: props.color })`, which emits nothing.
</details>

<details><summary>2. During a gradual migration, migrated Panda components lose to legacy styles. Why?</summary>

Legacy CSS-in-JS output is usually unlayered; unlayered declarations beat all layered ones. Layer the legacy CSS below Panda's (`@layer legacy, reset, …` + `@import … layer(legacy)`), migrate leaf components first, and remove the runtime library when done.
</details>

<details><summary>3. Which v1 → v2 changes are silent, and how do you catch them?</summary>

Missing `preset-base` (warnings only), `containerSizes`, removed config options such as `emitPackage`, stale `.mjs` files, default imports of style values, compound-variant and border-tier visual changes, `breakpoints` without `extend`, `sizes.prose`, `@property` on old browsers. Catch them with a static audit, `panda --max-warnings 0`, CSS snapshots and screenshot tests.
</details>

<details><summary>4. What replaced `panda ship`, `emit-pkg` and `emitPackage`?</summary>

`panda lib`, which writes `dist/panda/lib.json`, `preset.mjs` and `buildinfo.json` and syncs `package.json` exports; apps consume with `designSystem: '@pkg'`. `panda buildinfo --outfile` writes only build info.
</details>

<details><summary>5. Tailwind → Panda: what do you lose and gain?</summary>

Gain typed properties and tokens, native object merging (no `tailwind-merge`), first-class variants and slot recipes, semantic tokens and themes. Lose class-string ergonomics in markup and text-scan detection of dynamically chosen class names (Panda needs foldable expressions). `@apply` has no direct equivalent.
</details>

<details><summary>6. Why can a project jump from 0.51 straight to 2.4?</summary>

1.0 introduced no breaking changes (it stabilised the API and added `createStyleContext`). All breaking changes are in 2.0, so one checklist covers 0.x and 1.x; if the project adopted `createStyleContext` in 1.x, that is part of the v2 migration.
</details>

<details><summary>7. Stitches users want `$colors$brand`. What do you tell them?</summary>

v2 has no `$` token syntax (a `tokenSyntax: '$'` design is only proposed) and no `tokens:created` hook to emulate it. Use category values (`color: 'brand'`) or curly references (`'{colors.brand}'`); a codemod handles the rewrite.
</details>

## References

- Upgrading to v2: https://panda-css.com/docs/get-started/upgrading-to-v2
- Migrating from Tailwind: https://panda-css.com/docs/get-started/tailwind
- Migrating from styled-components: https://panda-css.com/docs/get-started/styled-components
- Migrating from Emotion: https://panda-css.com/docs/get-started/emotion
- Migrating from StyleX: https://panda-css.com/docs/get-started/stylex
- Repository changelog: https://github.com/chakra-ui/panda/blob/main/CHANGELOG.md
- npm registry: https://www.npmjs.com/package/@pandacss/dev?activeTab=versions
- @pandacss/dev 1.0.0 release notes: https://newreleases.io/project/github/chakra-ui/panda/release/@pandacss%2Fdev@1.0.0
