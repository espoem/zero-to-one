# Module 05 · Design Tokens and Semantic Tokens

> **Verified against** `@pandacss/dev` 2.4.0, `@pandacss/preset-panda` 2.4.0 on 2026-10-29.
> **Executable proof:** [`examples/system/tokens.ts`](../examples/system/tokens.ts), [`semantic-tokens.ts`](../examples/system/semantic-tokens.ts); fixtures [`05-tokens.ts`](../examples/fixtures/positive/05-tokens.ts) and [`05-property-registration.ts`](../examples/fixtures/positive/05-property-registration.ts) with snapshots; [`configs/property-fallback.config.ts`](../examples/fixtures/configs/property-fallback.config.ts); the strict-mode type tests in [`examples/react/src/type-tests.ts`](../examples/react/src/type-tests.ts); `panda codegen --spec` test in [`cli.test.ts`](../examples/tests/cli.test.ts); the token-chain test in [`e2e-fixtures.test.ts`](../examples/tests/e2e-fixtures.test.ts).

Design-token theory (tiers, naming, the W3C Design Tokens Community Group format and its tooling) is owned by [`languages/css`](../../../languages/css/README.md) (module "CSS architecture & design tokens at scale"). Custom properties and `@property` semantics are owned by the same track (module "Custom properties, `@property` & CSS functions"). This module covers Panda's token model: how tokens are declared, referenced, compiled to custom properties, typed, and shipped.

---

## 5.1 Formal model

A Panda **token** is a pair `(path, value)` where `path` is `category.segment(.segment)*` (for example `colors.brand.600`) and the category is one of Panda's token categories. A token dictionary *D* maps paths to values. Values may contain **references** `{path}` to other tokens, so *D* induces a directed graph *G = (paths, references)*. Panda requires *G* to be acyclic and every reference to resolve:

| Violation | Diagnostic |
|---|---|
| `{colors.brand}` points at nothing | `config_token_missing_reference` |
| Reference cannot be resolved | `config_token_unknown_reference` |
| Token refers to itself | `config_token_self_reference` |
| Cycle `a → b → a` | `config_token_circular_reference` (message shows the chain) |
| `red: '#f00'` instead of `{ value: '#f00' }` | `config_token_missing_value` |

Two kinds of tokens:

- **Core (primitive) tokens**, `theme.tokens`: unconditional values (`brand.600 = #4f46e5`).
- **Semantic tokens**, `theme.semanticTokens`: values that reference other tokens and **may vary by condition** (`accent.default = brand.600` in light, `brand.500` in dark).

Compilation maps each token to a CSS custom property named from its path, `--<category>-<path-with-dashes>`, declared on `cssVarRoot` (default `:where(:root, :host)`) in `@layer tokens`. A reference compiles to `var(--…)`, so the **reference chain survives into CSS** and is resolved by the browser at computed-value time. That is what makes theme switching a pure-CSS operation.

```css
/* 05-tokens snapshot (abridged) */
@layer tokens {
  :where(:root, :host) {
    --colors-ink-900: #18181b;
    --colors-fg-default: var(--colors-ink-900);
    --spacing-gutter: var(--spacing-4);
  }
  :where(.dark, [data-color-mode=dark]) { --colors-fg-default: var(--colors-ink-50); }
  @media (width >= 48rem) { :where(:root, :host) { --spacing-gutter: var(--spacing-6); } }
}
```

The Playwright test `semantic token chain resolves through var() references` renders `.c_fg.default` and reads `rgb(24, 24, 27)` (= `ink.900`).

---

## 5.2 Declaring tokens

```ts
// examples/system/tokens.ts
export const tokens = defineTokens({
  colors: {
    brand: { 50: { value: '#eef2ff' }, 600: { value: '#4f46e5' } /* … */ },
  },
  radii: { control: { value: '{radii.md}' } },   // a core token may reference another
  durations: { snappy: { value: '120ms' } },
})

// examples/system/semantic-tokens.ts
export const semanticTokens = defineSemanticTokens({
  colors: {
    fg: { default: { value: { base: '{colors.ink.900}', _dark: '{colors.ink.50}' } } },
    accent: { default: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.500}' } } },
  },
  spacing: {
    gutter: { value: { base: '{spacing.4}', md: '{spacing.6}' } },   // a breakpoint condition
  },
})
```

Rules worth memorising:

- Every leaf is an object with `value` (plus optional `description`, `deprecated`, and `type` for some categories). `description` documents the token (Studio, spec); `deprecated: true` produces `deprecated_token_used` when `token('…')` references it.
- `DEFAULT` gives a group its own value: `bg: { DEFAULT: {…}, muted: {…} }` lets you write both `bg: 'bg'` and `bg: 'bg.muted'`.
- Semantic-token conditions are restricted to **at-rule and parent-selector conditions** (`_dark` = `.dark &`, `md`, `_osDark`). A condition that targets the element itself (`_hover`) cannot change a custom property declared on the root.
- Put everything under `theme.extend` unless you mean to replace a preset's entry ([Module 06](./06-color-mode-and-theming.md#then-vs-now-overriding-theme-keys)).

### Categories

`preset-panda` populates these categories, and utilities bind properties to them: `colors`, `gradients`, `sizes`, `spacing`, `fonts`, `fontSizes`, `fontWeights`, `letterSpacings`, `lineHeights`, `radii`, `borders`, `borderWidths`, `shadows`, `blurs`, `easings`, `durations`, `animations`, `opacity`, `zIndex`, `aspectRatios`, `cursor`, `assets`. `panda doctor` reports `token categories: 17` for the fixture project (those with at least one token defined).

Category binding is what makes `p: '4'` mean `var(--spacing-4)` and `w: '4'` mean `var(--sizes-4)`. Spacing tokens are also merged into `sizes`, and negative spacing (`mx: '-4'`) compiles to `calc(var(--spacing-4) * -1)` (visible as `translate-y_-1` in the `05-property-registration` snapshot).

### Then vs now: `sizes.prose`

`preset-panda` 2.x changed `sizes.prose` from `65ch` to `60ch` (visible in the React build CSS: `--sizes-prose:60ch`). It is a silent visual change that only screenshot tests catch. To keep v1 measure: `theme.extend.tokens.sizes.prose = { value: '65ch' }`.

---

## 5.3 Five ways to reference a token

| Form | Example | Compiles to | Theme-aware? |
|---|---|---|---|
| Category value | `color: 'brand.600'` | `var(--colors-brand-600)` | Yes |
| Curly reference in a string | `boxShadow: '0 0 0 2px {colors.brand.100}'` | `0 0 0 2px var(--colors-brand-100)` | Yes |
| `token()` inside a string | `border: '1px solid token(colors.danger, crimson)'` | `var(--colors-danger, crimson)` | Yes, with fallback |
| Opacity modifier | `bg: 'brand.500/40'` | `color-mix(in oklab, var(--colors-brand-500) 40%, transparent)` | Yes |
| `token()` **function call** | `borderColor: token('colors.brand.700')` | `#4338ca` (the raw value) | **No** |

The last row is a trap shown in the [`05-tokens`](../examples/fixtures/__snapshots__/05-tokens.css) snapshot: the compiler folds the generated `token()` function to the token's raw value at build time, so the class is `.bd-c_\#4338ca` and it will **not** follow a theme or dark-mode switch. Use `token.var('colors.brand.700')` (folds to `var(--colors-brand-700)`) or a category value instead. Reserve the JS `token()` for places that need a literal: canvas, chart libraries, `<meta name="theme-color">`.

The opacity modifier accepts a number (`/40`) or an `opacity` token (`/half`); anything else warns `invalid_color_opacity_modifier`. `color-mix()` in OKLab needs Baseline 2023 browsers (see `languages/css`).

---

## 5.4 Registered variables: `@property` and `propertyFallback`

Composed utilities (`translate`, `scale`, `filter`, `backdropFilter`, gradients, rings) work by setting internal variables (`--translate-y`) that one composing declaration reads (`translate: var(--translate-x) var(--translate-y)`). The axis utility alone only sets the variable; opt in with the composer:

```ts
css({ translate: 'auto', translateY: '-1', filter: 'auto', blur: 'sm' })
```

### Then vs now: universal variable reset → `@property`

| | v1 | v2 |
|---|---|---|
| Defaults for internal variables | A reset of about 34 variables on `*, ::before, ::after, ::backdrop` shipped in every build | Each variable is registered with `@property` (syntax, `inherits: false`, `initial-value`) in `@layer base`, **only when used** |
| Cost | Every element carries the variables; style recalcs touch them | Only used registrations ship |
| Browser floor | Any browser with custom properties | `@property`: Chrome 85+, Safari 16.4+, Firefox 128+. Older browsers drop the affected utilities rather than render them wrongly |
| Escape hatch | — | `optimize.propertyFallback: true` emits the plain reset too |

The [`05-property-registration`](../examples/fixtures/__snapshots__/05-property-registration.css) snapshot shows `@property --translate-y { syntax: '<length-percentage>'; inherits: false; initial-value: 0; }` and no universal reset. With [`property-fallback.config.ts`](../examples/fixtures/configs/property-fallback.config.ts) the test finds `*, ::before, ::after, ::backdrop { … --translate-y: 0; }` in addition. Old Safari itself cannot be tested here; the snapshot of the fallback declarations is the proof we can run.

---

## 5.5 Strict modes

Panda's types are generated from the dictionary, so the type checker can enforce token usage.

| Option | Effect | Escape hatch |
|---|---|---|
| `strictTokens: true` | Token-bound properties accept only token names (`color: '#ff0000'` is a type error) | `'[#ff0000]'` |
| `strictPropertyValues: true` | Keyword-only properties (`display`, `position`, `flexDirection`, border styles…) accept only their keywords | `'[var(--x)]'` |

The React app enables both. [`type-tests.ts`](../examples/react/src/type-tests.ts) holds `@ts-expect-error` lines for `color: '#ff0000'`, `p: '13px'`, `display: 'abc'`, an unknown `token('colors.brand.650')`, and an unknown recipe variant; `npm run typecheck` fails if any of them stops being an error. The escape hatch `'[18rem]'` is used for real in [`App.tsx`](../examples/react/src/App.tsx) and compiles to `width: 18rem`.

Strictness is **type-level only**. The compiler still emits CSS for a raw value in a `.js` file or behind `as any`. Treat it as a review signal: bracket values are greppable.

Cost: `strictTokens` turns every token-bound property into a large string-literal union, which increases type-check time in big apps (see [Module 09](./09-jsx-factory-and-style-props.md) on `jsxStyleProps`).

---

## 5.6 Shipping fewer tokens: `optimize.removeUnusedTokens`

By default every token in the dictionary is emitted. `optimize.removeUnusedTokens: true` emits only tokens reachable from used styles **including references** (in the `07-recipes` snapshot, `--radii-md` is kept because the used `--radii-control` references it). The fixture config in this track enables it, which is why each snapshot is a few hundred bytes. `removeUnusedKeyframes` does the same for `theme.keyframes`. Turn these off if other code reads variables by name (third-party CSS, `token.var()` in a non-scanned file).

Other knobs: `cssVarRoot` (selector for declarations), `prefix: 'acme'` or `prefix: { cssVar: 'acme', className: 'acme' }` (namespacing emitted class and variable names), `hash` (hashed variable names).

---

## 5.7 Tokens outside Panda

- **JSON spec.** `panda codegen --spec` writes `<outdir>/specs/design-system.json` (`schemaVersion: 1`) with categories, tokens, conditions, themes, recipes and patterns. Token entries keep `originalValue` (`{colors.brand.600}`) and the `cssVar`; the CLI test asserts both. Use it to feed docs sites, Figma sync or Storybook. `--spec=<path>` must be a relative path inside the project (an absolute temp path is rejected with `artifact output path must be a contained relative path`, observed while writing the test).
- **W3C DTCG files.** The Panda docs say its token format "follows" the W3C Design Tokens spec, but the shape differs (`value`/`description` vs DTCG `$value`/`$type`/`$description`), and Panda 2.4.0 has no DTCG importer (no DTCG reader in the package source as of 2026-10-29). Convert DTCG files with Style Dictionary or Terrazzo into a `defineTokens` module. Do not claim DTCG compliance.
- **Panda Studio.** `panda studio` (2.4.0) opens the hosted Studio, live-connected to your config, to browse tokens.

---

## 5.8 Production failure modes

| Symptom | Cause | Fix / proof |
|---|---|---|
| A color does not switch in dark mode | `token('…')` function call folded to a raw value | `token.var()` or a category value; 05-tokens snapshot |
| Utilities vanish on old Safari | `@property` floor | `optimize.propertyFallback`; fallback test |
| `translateY` does nothing | Composer not enabled | `translate: 'auto'` |
| Variables missing for third-party CSS | `removeUnusedTokens` | Turn off or reference the token in scanned code |
| Prose width changed after upgrade | `sizes.prose` 65ch → 60ch | Override the token |
| Hover-dependent token value ignored | Semantic tokens accept only at-rule/parent conditions | Use a utility condition instead |
| Circular reference warning | Token graph cycle | Break the cycle |

---

## Interview Drill

<details><summary>1. Why do semantic tokens make dark mode a pure-CSS operation in Panda?</summary>

Each token compiles to a custom property, and references compile to `var()`. A semantic token's conditional values become redeclarations of the same variable under a parent selector or media query (`:where(.dark, …) { --colors-fg-default: var(--colors-ink-50) }`). Toggling a class changes which declaration applies; every utility that reads the variable updates without JavaScript or new classes.
</details>

<details><summary>2. `css({ borderColor: token('colors.brand.700') })` does not follow the theme. Why?</summary>

The extractor folds the generated `token()` call to the token's raw value at build time, producing `border-color: #4338ca`. Use `borderColor: 'brand.700'`, `'{colors.brand.700}'` or `token.var('colors.brand.700')`, which keep `var(--colors-brand-700)`.
</details>

<details><summary>3. What does `strictTokens` guarantee, and what doesn't it?</summary>

It makes the generated types reject non-token values for token-bound properties (with `[raw]` as an explicit escape hatch). It is type-level only: the compiler still emits CSS for raw values it extracts, so JS files, `any` casts or disabled type-checks bypass it.
</details>

<details><summary>4. Explain the v2 move from a universal variable reset to `@property`. What is the risk?</summary>

v1 set defaults for ~34 internal variables on every element. v2 registers only the variables actually used with `@property` (typed syntax, `inherits: false`, initial value), so less CSS ships and the cascade does less work. Browsers without `@property` (Safari < 16.4, Firefox < 128) drop the affected utilities; `optimize.propertyFallback: true` re-adds the plain declarations.
</details>

<details><summary>5. Which conditions can a semantic token use, and why that restriction?</summary>

At-rule conditions (`md`, `_osDark`) and parent-selector conditions (`_dark` = `.dark &`, themes). The variable is declared on `cssVarRoot` or a themed ancestor; a self-targeting state like `_hover` would have to redeclare the variable on the hovered element, which does not fit the root-declaration model.
</details>

<details><summary>6. Can you import a W3C DTCG token file into Panda 2.4?</summary>

Not directly. Panda's format uses `value`/`description` rather than `$value`/`$type`, and 2.4.0 ships no DTCG importer. Transform the DTCG file with Style Dictionary or Terrazzo into a `defineTokens` object, or write a small conversion script in the config.
</details>

<details><summary>7. What does `removeUnusedTokens` keep, exactly?</summary>

Tokens referenced by used styles and, transitively, tokens they reference (e.g. `--radii-control` keeps `--radii-md`). It drops everything else, which can break external code that expects a variable by name.
</details>

## References

- Tokens: https://panda-css.com/docs/theming/tokens
- Token categories: https://panda-css.com/docs/theming/token-categories
- Color opacity modifier: https://panda-css.com/docs/styling/color-opacity-modifier
- Writing styles (strictTokens, strictPropertyValues): https://panda-css.com/docs/styling/writing-styles
- JSON spec: https://panda-css.com/docs/theming/json-spec
- Optimization: https://panda-css.com/docs/styling/optimization
- W3C Design Tokens Format Module 2025.10: https://www.designtokens.org/tr/2025.10/format/
