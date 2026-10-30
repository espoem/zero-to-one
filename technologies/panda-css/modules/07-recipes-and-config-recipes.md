# Module 07 · Recipes (`cva`) and Config Recipes

> **Verified against** `@pandacss/dev` 2.4.0 on 2026-10-29.
> **Executable proof:** [`examples/system/recipes/button.recipe.ts`](../examples/system/recipes/button.recipe.ts); [`examples/react/src/Badge.tsx`](../examples/react/src/Badge.tsx) and [`examples/solid/src/Badge.tsx`](../examples/solid/src/Badge.tsx); fixture [`07-recipes.ts`](../examples/fixtures/positive/07-recipes.ts) + snapshot; negative fixtures [`config-recipe-dynamic.ts`](../examples/fixtures/negative/config-recipe-dynamic.ts), [`recipe-renamed-wrapper.tsx`](../examples/fixtures/negative/recipe-renamed-wrapper.tsx); configs [`recipe-static-css.config.ts`](../examples/fixtures/configs/recipe-static-css.config.ts), [`smart-compounds.config.ts`](../examples/fixtures/configs/smart-compounds.config.ts); [`runtime.test.ts`](../examples/tests/runtime.test.ts) (class strings); the `config recipes (Module 07)` tests; Playwright cascade tests in [`e2e-computed-style.test.ts`](../examples/tests/e2e-computed-style.test.ts).

A **recipe** names the looks of a component. Instead of ternaries inside `css()`, you declare `base`, `variants`, `compoundVariants` and `defaultVariants` once. Panda has two implementations of the same authoring shape, with different CSS output and different extraction rules. Choosing between them is one of the most common senior-level Panda questions.

---

## 7.1 The recipe model

**Definition.** A recipe is `R = (B, V, C, D)`:

- `B`: base style object;
- `V : variantKey → (value → StyleObject)`: the variant map (`size: { sm: {…}, lg: {…} }`);
- `C`: list of compound variants `(match, css)` where `match : variantKey → value | value[]`;
- `D : variantKey → value`: default variants.

Applying `R` to props `p` (variant selection merged over `D`) yields:

```
resolve(p)  = D ⊕ p                              // caller wins per key
styles(p)   = B ⊕ V[k₁][resolve(p)(k₁)] ⊕ … ⊕ { c.css | c ∈ C, matches(c, resolve(p)) }
matches(c, r) = ∀ k ∈ keys(c.match): r(k) ∈ asSet(c.match(k))     // array = any of
```

`⊕` is the style-object merge from [Module 03](./03-styling-api-and-conditions.md#33-composition-cssa-b-cssraw-cx). Compound variants apply only when **every** key matches; an array value means "any of these". Booleans as variant keys work (`invalid: { true: {…} }`).

| | Atomic recipe `cva()` | Config recipe `defineRecipe()` |
|---|---|---|
| Lives in | Component code | Config / preset (`theme.recipes`) |
| CSS shape | Atomic utilities in `@layer utilities` | Named classes in `@layer recipes` (`button`, `button--size_lg`) |
| What is emitted | **Every** variant, as soon as the `cva` is defined | Only variants seen as literals (JIT), plus `base` and defaults on first use |
| Compound variants | Merged at call time into atoms | One **named class** per combination in `recipes.compound_variants` |
| Runtime | Ships the recipe config (merge at runtime) | A combo → class-name lookup |
| Override by `css()` | Same layer, resolved by merge (`css(recipe.raw(p), override)`) | Always, by layer order |
| Shareable across packages | As source | As config / preset, typed `styled-system/recipes` |
| JSX | `styled('button', cvaRecipe)` | `styled('button', button)` + JSX tracking by tag name |

Rule of thumb from the docs: if the recipe exists in one component file, use `cva`; if it is a design-system primitive used everywhere, make it a config recipe.

---

## 7.2 Atomic recipes: `cva`

```ts
// examples/fixtures/positive/07-recipes.ts
export const badge = cva({
  base: { display: 'inline-flex', px: '2', borderRadius: 'full' },
  variants: {
    tone: { neutral: { bg: 'ink.100' }, brand: { bg: 'brand.100', color: 'brand.900' } },
    size: { sm: { fontSize: 'xs' }, md: { fontSize: 'sm' } },
  },
  compoundVariants: [{ tone: 'brand', size: 'md', css: { fontWeight: 'semibold' } }],
  defaultVariants: { tone: 'neutral', size: 'sm' },
})
```

From [`runtime.test.ts`](../examples/tests/runtime.test.ts):

```ts
badge()                               // 'd_inline-flex px_2 bg_ink.100 fs_xs'
badge({ tone: 'brand', size: 'md' })  // 'd_inline-flex px_2 bg_brand.100 c_brand.900 fs_sm fw_semibold'
badge.splitVariantProps({ tone: 'brand', id: 'x' })   // [{ tone: 'brand' }, { id: 'x' }]
badge.variantMap                      // { tone: ['neutral', 'brand'], size: ['sm', 'md'] }
```

The snapshot proves the "eager" rule: all of `bg_ink.100`, `bg_brand.100`, `fs_xs`, `fs_sm` and the compound's `fw_semibold` are in the sheet although only the definition exists. That is why dynamic `cva` props are safe: `badge({ tone: props.tone })` always finds its CSS.

API surface: `badge(props)`, `badge.raw(props)` (style object for merging), `badge.splitVariantProps(props)`, `badge.variantMap`, `badge.variantKeys`, and the type helper `RecipeVariantProps<typeof badge>`. 2.4.0 adds a performance detail: recipes kept in a local object (`const styles = { button: cva(…) }`) and only called compile to plain functions, so their config no longer ships in the bundle.

### Overriding a `cva` from the outside

`cx(badge(p), css(override))` concatenates two atom sets in the same layer: a conflict is decided by stylesheet order. Merge objects instead:

```tsx
// examples/react/src/Badge.tsx
<span className={cx(css(badge.raw({ tone }), cssProp), className)} />
```

The Playwright test `cva + css prop merge` reads `font-weight: 700` from the caller's `css={{ fontWeight: 'bold' }}` and the recipe's `brand.100` background on the same element.

---

## 7.3 Config recipes: `defineRecipe`

```ts
// examples/system/recipes/button.recipe.ts
export const buttonRecipe = defineRecipe({
  className: 'button',          // CSS stem; the theme key `button` is the import name
  description: 'Action trigger',
  jsx: ['Button'],              // tag names that count as usages (replaces the default list)
  base: { display: 'inline-flex', alignItems: 'center', gap: '2', borderRadius: 'control', /* … */ },
  variants: {
    visual: { solid: { bg: 'accent.default', color: 'accent.fg' }, outline: { /* … */ } },
    size: { sm: { px: '3', h: '8', textStyle: 'sm' }, lg: { px: '5', h: '12', textStyle: 'lg' } },
  },
  compoundVariants: [{ visual: 'outline', size: 'lg', css: { borderWidth: '2px' } }],
  defaultVariants: { visual: 'solid', size: 'sm' },
})
// preset: theme.extend.recipes.button = buttonRecipe
```

Generated: `import { button, type ButtonVariantProps } from 'styled-system/recipes'`.

```ts
button()                                    // 'button button--size_sm button--visual_solid'
button({ visual: 'outline', size: 'lg' })   // 'button button--size_lg button--visual_outline button--compound__size_lg__visual_outline'
```

(Variant classes follow the key order of `defaultVariants` merged with props in the runtime resolver.)

Emitted CSS, from the [`07-recipes`](../examples/fixtures/__snapshots__/07-recipes.css) snapshot:

```css
@layer recipes {
  @layer base     { .button { display: inline-flex; gap: var(--spacing-2); … } }
  @layer variants { .button--visual_outline { border-width: 1px; … }
                    .button--size_lg { padding-inline: var(--spacing-5); height: var(--sizes-12); … } }
  @layer compound_variants { .button--compound__size_lg__visual_outline { border-width: 2px; } }
}
```

Note `textStyle: 'lg'` inside a recipe is **inlined** into the variant class (`font-size: 1.125rem; line-height: calc(1.75 / 1.125)`), not referenced as a composition class.

Naming: `className` changes only the CSS stem; the theme key is the import and type name; `jsx` is the tag list for extraction. `hash`, `prefix`, `separator` are baked into the generated runtime, so re-run codegen after changing them.

### JIT emission and its three failure modes

A config recipe emits a variant only when extraction sees a **literal** for it:

| Call site | Emitted |
|---|---|
| `button({ size: 'lg' })` / `<Button size="lg" />` | `size=lg` |
| `button({ size: wide ? 'sm' : 'lg' })` | both branches |
| `button({ size })` / `<Button size={size} />` | only defaults (+ base) |
| `<Action size="lg" />` where `Action` wraps `button()` | only defaults: tag not in `jsx` |

The negative tests prove the last two: [`config-recipe-dynamic.ts`](../examples/fixtures/negative/config-recipe-dynamic.ts) and [`recipe-renamed-wrapper.tsx`](../examples/fixtures/negative/recipe-renamed-wrapper.tsx) both produce `button--size_sm` but no `button--size_lg`. The runtime still returns `button--size_lg` as a class name, pointing at a rule that does not exist. Classic symptom: "works in Storybook (literal), blank in the app (prop)".

Fixes, in order of preference: a literal at a scanned call site; add the wrapper to `jsx` (`['Button', 'Action']`, regexes allowed); or pre-generate with `staticCss`:

```ts
staticCss: { recipes: { button: [{ size: ['*'] }] } }      // or on the recipe: staticCss: [{ size: ['sm','lg'] }]
```

[`recipe-static-css.config.ts`](../examples/fixtures/configs/recipe-static-css.config.ts) emits `button--size_lg` for the dynamic fixture. Caveats: each key in a `staticCss` rule generates independently (`{ size: ['sm'], visual: ['solid'] }` is two generations, not the pair); `'*'` on every recipe bloats production CSS (`static_css_wildcard_large` info above 250 values).

**Then vs now (`staticCss`).** In v1 many `staticCss` entries existed because the extractor could not follow imported values (`button({ size: SIZES.large })` with `SIZES` from another file). v2 resolves named imports, so audit and delete those entries; keep `staticCss` for genuinely runtime-only values and Storybook-style "render everything" pages.

---

## 7.4 Compound variants: then vs now

| | v1 (≤ 1.12) | v2 (2.0 →) |
|---|---|---|
| Config recipe compound CSS | Atomized into `@layer utilities`, next to `css()` | One named class (`button--compound__size_lg__visual_outline`, or your `compoundVariants[].className`) in `@layer recipes.compound_variants` |
| Beats the recipe's own variants? | Yes, by layer | Yes, by sub-layer order `base < slots < variants < compound_variants` |
| Can `css()` override it? | Not reliably: same layer, decided by emit order ([#3480](https://github.com/chakra-ui/panda/issues/3480), [#3503](https://github.com/chakra-ui/panda/issues/3503)) | Always: `recipes` < `utilities` |
| Direct call `button({…})` applies compounds? | Only via the JSX factory | Yes, the runtime appends the named class |
| Override via composition (`textStyle` in `css`) | Replaced the compound's text style | Each compound is its own class; properties you do not override still apply |
| Emission | Every compound of a used recipe | Same by default; `optimize.smartCompoundVariants` emits only extracted combinations |
| `cva`/`sva` compounds | Merged at runtime into atoms | Unchanged (atoms in `utilities`) |

Migration: if you relied on a compound "disappearing" when you set a composition or a property in `css`, now override **each** property explicitly. Remove workarounds that raised `css()` specificity to beat compounds.

Playwright proves the v2 ladder on a real button: `outline` + `lg` has `border-top-width: 2px` (compound beats the variant's `1px`), and adding `css={{ borderWidth: '4px', bg: 'brand.900' }}` yields `4px` and `rgb(49, 46, 129)` (utilities beat everything in `recipes`).

`smartCompoundVariants`: the test shows the compound class ships for a recipe used only with defaults, and disappears with the flag on. Observed in 2.4.0: a `'*'` `staticCss` rule on one key still pulls in compounds involving that key even with the flag on.

### Recipe condition order (2.4.0)

Conditions inside a recipe now follow **authoring order**: the one written last wins, including `_hover` vs `_active`. Write state conditions in the order you want them to override.

---

## 7.5 Virtual colors: `colorPalette`

`colorPalette` sets a placeholder palette that `colorPalette.*` tokens resolve against, so one recipe serves every color family:

```ts
// examples/system/recipes/alert.slot-recipe.ts
status: {
  info:   { root: { colorPalette: 'blue', bg: 'colorPalette.50', borderColor: 'colorPalette.200' } },
  danger: { root: { colorPalette: 'red',  bg: 'colorPalette.50', borderColor: 'colorPalette.200' } },
}
```

Mechanically, `colorPalette: 'red'` emits declarations that point the `--colors-color-palette-*` variables at the red scale on that element, and `colorPalette.50` reads `var(--colors-color-palette-50)`. Inheritance makes it work for descendants too. Every color group (core + semantic under the same name) is a palette; a nested group (`blue.solid`) can be a palette, and `DEFAULT` gives the bare `colorPalette` token a value. The Playwright alert test reads an `oklch(…)` red background on the `danger` alert.

---

## 7.6 Production failure modes

| Symptom | Cause | Fix / proof |
|---|---|---|
| Variant renders unstyled in the app, fine in Storybook | Config recipe JIT + runtime prop | Literal, `jsx`, or `staticCss`; dynamic negative test |
| Wrapper's variant ignored | Tag name not in `jsx` | Add it; renamed-wrapper test |
| Caller override loses to a `cva` | Concatenated classes | `css(recipe.raw(p), override)` |
| Compound no longer "goes away" after upgrade | v2 compound semantics | Override each property |
| Production CSS bloated by recipes | `staticCss: '*'`, eager compounds | Targeted rules; `smartCompoundVariants` |
| `:hover` vs `:active` precedence flips after 2.4 | Recipe conditions follow authoring order | Reorder conditions |

---

## Interview Drill

<details><summary>1. `cva` or config recipe for a design-system Button? Defend the choice.</summary>

Config recipe: named classes in `@layer recipes` are readable, shareable through a preset across apps, always overridable by `css()` thanks to layer order, and only used variants ship (JIT). Cost: JIT means runtime-chosen variants need literals, `jsx` tracking or `staticCss`. A one-off component-local recipe is better as `cva`, which emits everything eagerly and needs no config.
</details>

<details><summary>2. Why does `<Button size={size} />` sometimes render with no size styles?</summary>

For config recipes Panda emits only variant values it sees as literals; `size={size}` folds to unknown, so only `defaultVariants` are emitted. The runtime still returns `button--size_lg`, but the rule is missing. Fix with a literal somewhere scanned, `staticCss`, or by modelling the value differently.
</details>

<details><summary>3. Explain the v2 compound-variant change and how it affects overrides.</summary>

Config-recipe compounds became named classes in `@layer recipes.compound_variants`. They beat the recipe's base and variants (sub-layer order) but lose to any utility (`recipes` < `utilities`), which fixes v1's unreliable `css()` overrides. Each compound is a full class, so properties not overridden still apply; v1 code that relied on replacement must override each property.
</details>

<details><summary>4. What does `colorPalette` compile to, and why does it work for children?</summary>

It sets the `colorPalette.*` virtual variables on the element to point at the chosen palette's variables; `colorPalette.500` etc. read those virtual variables. Custom properties inherit, so descendants using `colorPalette.*` tokens resolve to the same palette.
</details>

<details><summary>5. How do you allow callers to override a `cva` component safely?</summary>

Accept a style object (`css` prop or `*Css` props), merge it with `css(recipe.raw(variantProps), cssProp)` and append `className` with `cx`. Extraction reads `css`/`*Css` at call sites, and the object merge makes the caller win per property.
</details>

<details><summary>6. What does `smartCompoundVariants` trade off?</summary>

Smaller CSS (only compounds for combinations actually extracted) against the risk that runtime-only combinations lose their compound styles; those need explicit `staticCss` rules (one key per rule).
</details>

<details><summary>7. A `staticCss` rule `{ size: ['sm'], visual: ['solid'] }` doesn't produce the `sm`+`solid` compound. Why?</summary>

Each key in a `staticCss` rule is generated independently with the other keys at their defaults; it is not one combined usage. List the combination as it would be used, or rely on a literal call with both props.
</details>

<details><summary>8. Why might the class order from `button()` differ from your variant declaration order, and does it matter?</summary>

The runtime orders variant classes by configuration key order in `defaultVariants` merged with incoming props. It does not matter: precedence comes from cascade layers and sub-layers, not class order in the attribute.
</details>

## References

- Recipes overview: https://panda-css.com/docs/recipes/overview
- Atomic recipe (`cva`): https://panda-css.com/docs/recipes/atomic-recipe
- Config recipe: https://panda-css.com/docs/recipes/config-recipe
- Compound variants: https://panda-css.com/docs/recipes/compound-variants
- Dynamic variants: https://panda-css.com/docs/recipes/dynamic-variants
- JSX tracking: https://panda-css.com/docs/recipes/jsx-tracking
- Virtual color: https://panda-css.com/docs/styling/virtual-color
- Static CSS: https://panda-css.com/docs/styling/static
- Optimization (`smartCompoundVariants`): https://panda-css.com/docs/styling/optimization
- Design note "Compound variant cascade": https://github.com/chakra-ui/panda/blob/main/design-notes/compound-variant-cascade.md
