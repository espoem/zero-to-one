# Module 03 · The Styling API and Conditions

> **Verified against** `@pandacss/dev` 2.4.0 with `@pandacss/preset-base` 2.4.0 on 2026-10-29.
> **Executable proof:** fixtures [`03-conditions.ts`](../examples/fixtures/positive/03-conditions.ts) and [`03-property-order.ts`](../examples/fixtures/positive/03-property-order.ts) with snapshots; [`runtime.test.ts`](../examples/tests/runtime.test.ts) (merging); [`e2e-fixtures.test.ts`](../examples/tests/e2e-fixtures.test.ts) (computed styles for property breadth, border tiers, group/peer, breakpoints); the `array condition definitions` test in [`negative-extraction.test.ts`](../examples/tests/negative-extraction.test.ts).

`css()` is the primitive everything else compiles down to: patterns return style objects, `cva` returns style objects per variant, JSX style props become a style object. Learn its object language precisely and the rest of Panda is composition.

Selector and cascade theory (`:is()`, `:where()`, specificity, nesting, `@media` range syntax) is owned by [`languages/css`](../../../languages/css/README.md). This module covers Panda's mapping from object keys to those constructs.

---

## 3.1 The style object grammar

A **system style object** (`SystemStyleObject` in `styled-system/types`) is defined by this grammar:

```
StyleObject   ::= { Entry* }
Entry         ::= Property ":" Value
               |  Condition ":" StyleObject           // _hover: { color: 'red.500' }
               |  Selector  ":" StyleObject           // '&[data-state=open]': {...}
               |  AtRule    ":" StyleObject           // '@media (…)': {...}
Value         ::= Scalar | { (Condition | "base"): Value }   // property-based conditions
Scalar        ::= string | number | (Scalar | undefined)[]   // array = responsive by breakpoint index
Property      ::= CSS property (camelCase) | shorthand | utility | --custom-property
Condition     ::= "_" name | breakpoint | breakpointRange | "@" containerName? "/" size
Selector      ::= string containing "&"
```

Two equivalent placements of a condition:

```ts
css({ _hover: { color: 'accent.default' } })        // nested condition
css({ color: { base: 'fg.default', _hover: 'accent.default' } }) // property-based condition
```

Both encode to the same atoms. Prefer property-based conditions when one property varies over several states; prefer nesting when several properties share one condition.

### Shorthands and utilities

`preset-base` defines **utilities**: a property name (or shorthand) → CSS property + token category + optional transform. Some you will meet constantly:

| Write | Emits | Token category |
|---|---|---|
| `p`, `px`, `py`, `pt`… | `padding`, `padding-inline`, `padding-block`… | `spacing` |
| `m`, `mx`, `my`… | `margin…` | `spacing` |
| `bg` | `background` (not `background-color`) | `colors` |
| `bgColor` | `background-color` | `colors` |
| `c` / `color` | `color` | `colors` |
| `w`, `h`, `maxW`, `minH` | `width`, `height`, … | `sizes` |
| `rounded` / `borderRadius` | `border-radius` | `radii` |
| `textStyle`, `layerStyle` | expands a composition ([Module 06](./06-color-mode-and-theming.md)) | — |

`bg` emitting the `background` shorthand is visible in every snapshot (`.bg_brand\.100 { background: var(--colors-brand-100); }`). It resets `background-image` too; use `bgColor` when you only want the color.

### Values

A value is resolved in this order: token path for the property's category (`'brand.600'` → `var(--colors-brand-600)`), token reference in curly braces anywhere in the string (`'0 0 0 2px {colors.brand.100}'`), color opacity modifier (`'brand.500/40'` → `color-mix(in oklab, …)`), otherwise the raw string. Token mechanics are [Module 05](./05-design-tokens.md).

- `!important`: `color: 'red !important'` or the short form `color: 'red!'`.
- Escape hatch under `strictTokens`: wrap a raw value in brackets, `w: '[18rem]'` ([Module 05](./05-design-tokens.md#55-strict-modes)). The React app uses it for container widths.

---

## 3.2 Conditions

A **condition** is a named selector or at-rule template. Each one has a placeholder `&` (the element being styled), and the compiler substitutes the atom's class selector for it. `preset-base` ships roughly 480 of them (`panda doctor` reports `conditions: 479` for the React app). Most built-in state conditions also match a `data-*` twin, which is how headless libraries (Ark, Radix, Zag) expose state:

```css
/* from the 03-conditions snapshot */
.hover\:c_accent\.default:is(:hover, [data-hover]) { color: var(--colors-accent-default); }
.focusVisible\:ring-w_2px:is(:focus-visible, [data-focus-visible]) { outline-width: 2px; }
```

### Families

| Family | Examples | Emitted shape |
|---|---|---|
| Pseudo-class with data twin | `_hover`, `_focusVisible`, `_disabled`, `_checked`, `_invalid`, `_open` | `.cls:is(:hover, [data-hover])` |
| Pseudo-element | `_before`, `_after`, `_placeholder`, `_selection`, `_file` | `.cls::before` |
| Group (ancestor) | `_groupHover`, `_groupFocus`, … | `.group:is(:hover, [data-hover]) .cls` |
| Peer (previous sibling) | `_peerInvalid`, `_peerChecked`, … | `.peer:is(:invalid, …) ~ .cls` |
| ARIA / data state | `_expanded`, `_selected`, `_pressed` | `[aria-expanded=true]`, `[data-expanded]` |
| Media | `_motionReduce`, `_osDark`, `_print`, `_pointerFine` (new in v2) | `@media (...)` |
| Color mode | `_dark`, `_light` | `.dark &` by default ([Module 06](./06-color-mode-and-theming.md)) |
| v2 additions | `_userValid`, `_inert`, `_pointerFine`, `_starting` (`@starting-style`) | — |

Group and peer conditions rely on a **marker class** (`group`, `peer`) you add to the ancestor or sibling yourself. Forgetting the marker is the usual reason `_groupHover` "does nothing". [`e2e-fixtures.test.ts`](../examples/tests/e2e-fixtures.test.ts) hovers a `.group` parent and reads the child's background, and renders an `aria-invalid` `.peer` input followed by a label.

### Responsive conditions

Breakpoints come from `theme.breakpoints` (`sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem` in `preset-panda`). They are mobile-first `min-width` queries written in the range syntax:

```css
@media (width >= 48rem) { .md\:fs_md { font-size: var(--font-sizes-md); } }
```

Generated keys per breakpoint `bp`: `bp` (≥), `bpDown` (<), `bpOnly` (only that band), and `bpToBp2` ranges such as `smToLg`. The e2e test resizes the viewport to 500/800/1100 px and reads 14/16/18 px font sizes.

Object syntax is the default. **Array values** are still supported in v2 (`fontWeight: ['medium', undefined, undefined, 'bold']` → base and `lg`); the index is the breakpoint order, so arrays become wrong silently when someone inserts a breakpoint. Prefer objects. (Do not confuse this with *array condition definitions* in the config, which v2 deprecates; see 3.4.)

Pattern props are compiled by the pattern, so put breakpoints on the prop (`columns={{ base: 1, md: 2 }}`), not around the pattern ([Module 04](./04-patterns-and-layout.md)).

### Arbitrary selectors and at-rules

Any key containing `&` is a selector; any key starting with `@media`, `@container`, `@supports`, `@layer` or `@page` is an at-rule:

```ts
css({
  '&[data-state=open]': { fontWeight: 'bold' },   // .\[\&\[data-state\=open\]\]\:fw_bold[data-state=open]
  '& > *': { margin: '2' },
  '@supports (display: grid)': { display: 'grid' },
})
```

A key that is neither a condition, a selector nor an at-rule is treated as a CSS property. Nesting a style object under it produces dead CSS and the `nested_property` warning:

```text
warning nested_property … `padding` in `padding.md` is not a condition or selector, so it is emitted as a CSS property …
```

We triggered this exact warning in [`configs/breakpoints-replace.config.ts`](../examples/fixtures/configs/breakpoints-replace.config.ts), where `md` no longer existed.

---

## 3.3 Composition: `css(a, b)`, `css.raw`, `cx`

### The merge rule

`css(...objects)` deep-merges its arguments left to right **as objects**, then encodes the result. For any property under the same condition path, the last argument wins. The output contains one class per surviving atom.

```ts
// examples/tests/runtime.test.ts
css({ color: 'orange.700' }, { color: 'orange.300' })                       // 'c_orange.300'
css(css.raw({ color: 'orange.700' }), css.raw({ color: 'orange.300' }))     // 'c_orange.300'
```

`css.raw(obj)` returns `obj` unchanged and typed. Its job is to **mark a style object as Panda's** so the extractor picks it up wherever it is defined (another file included, in v2), and to make it composable without producing classes yet. `cva.raw()`, `sva.raw()`, pattern `.raw()` and config-recipe `.raw()` do the same for their outputs.

### `cx` is not a merge

`cx(...classStrings)` only concatenates truthy strings. It does not deduplicate and does not resolve conflicts:

```ts
cx('a', false, undefined, 'b', 'a')                          // 'a b a'
cx(css({ color: 'red.500' }), css({ color: 'blue.500' }))    // 'c_red.500 c_blue.500' — both atoms
```

With two conflicting atoms on one element, the winner is whichever rule comes **later in the stylesheet**, and Panda sorts atoms of the same property by value, not by usage order. The Playwright test `NEGATIVE: concatenated classes …` renders `${css({color:'orange.700'})} ${css({color:'orange.300'})}` and shows the element is `orange.700`, even though `orange.300` was written last.

| Need | Use |
|---|---|
| Merge style objects (caller overrides component) | `css(base, override)` or `css(recipe.raw(props), cssProp)` |
| Join a recipe class with an externally produced class | `cx(button(), className)` |
| Never | Template-string concatenation of `css()` outputs that may conflict |

### Property breadth ordering (and the v2 border change)

Inside `@layer utilities`, atoms are sorted by **property breadth**: broader shorthands first, longhands last. So a longhand always beats a shorthand for the same box side, independent of source order:

```css
/* 03-property-order snapshot (abridged) */
.p_10px { padding: 10px; }
.bd-e_0 { border-inline-end: 0; }
.border-style_solid { border-style: solid; }
.bd-w_1px { border-width: 1px; }
.bd-e-w_0 { border-inline-end-width: 0; }
.pt_20px { padding-top: 20px; }
```

**Then vs now (borders, v1 → v2).** In v1, `cx(css({ borderWidth: '1px', borderStyle: 'solid' }), css({ borderInlineEnd: '0' }))` rendered an *open bracket*, because the override was emitted later. In v2 all border shorthands share one tier, and the per-side `border-inline-end` sorts *before* `border-width`, so the side re-closes. Only the longhand `borderInlineEndWidth: '0'` wins. The e2e test checks both: `border-right-width` is `1px` with the per-side shorthand and `0px` with the longhand. Migration: grep for per-side border shorthands used as overrides and switch to longhands.

### The `css` prop forwarding pattern

Components that accept style overrides should take a **style object**, not a class string, and merge it last:

```tsx
// examples/react/src/Badge.tsx
export function Badge({ tone, css: cssProp, className, ...rest }: BadgeProps) {
  return <span className={cx(css(badge.raw({ tone }), cssProp), className)} {...rest} />
}
// <Badge tone="brand" css={{ fontWeight: 'bold' }} />
```

```tsx
// examples/solid/src/Badge.tsx — never destructure props in Solid
export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['tone', 'css', 'class'])
  return <span class={cx(css(badge.raw({ tone: local.tone }), local.css), local.class)} {...rest} />
}
```

Extraction reads `css={{…}}` and any prop ending in `Css` (`rootCss`, `bodyCss`) at the call site, so the caller's object becomes CSS even though `Badge` merges it at runtime. A prop named anything else (`style`, `sx`, `overrides`) is not read unless its value is wrapped in `css.raw()`. Solid's reactivity rules (why `splitProps` instead of destructuring) are owned by the [`solidjs`](../../solidjs/README.md) track.

---

## 3.4 Custom conditions

```ts
// examples/system/preset.ts
conditions: {
  extend: {
    dark: '.dark &, [data-color-mode=dark] &',                 // override a built-in
    supportsHover: '@media (hover: hover) and (pointer: fine)', // at-rule condition
  },
},
```

Rules:

- A selector condition must contain `&` at the **start or the end** (`config_condition_selector_invalid` otherwise).
- A condition string may call `token()`: `'@media (min-width: token(sizes.4xl))'`.
- Changing conditions changes generated types, so re-run codegen (the Vite plugin does it for you).
- Put new conditions under `conditions.extend`; writing `conditions: {…}` without `extend` replaces the built-ins you name.

### Block form with `@slot` (and the Then vs now)

To nest several rules under one name, v2 uses an object whose leaves are `'@slot'`:

```ts
conditions: {
  extend: {
    hoverV2: { '@media (hover: hover)': { '&:hover': '@slot' } },
    // several independent blocks under one name
    hoverActive: {
      '@media (hover: hover)': { '&:is(:hover, [data-hover])': '@slot' },
      '@media (hover: none)': { '&:is(:active, [data-active])': '@slot' },
    },
  },
}
```

| | v1 | v2 |
|---|---|---|
| Nested condition | `supportHover: ['@media (hover: hover)', '&:hover']` (array) | `{ '@media (hover: hover)': { '&:hover': '@slot' } }` |
| Multiple independent blocks | Not expressible | One path per `@slot` |
| Old array form | — | Still works, converted, with `config_condition_array_unsupported` warning |

[`configs/array-condition.config.ts`](../examples/fixtures/configs/array-condition.config.ts) defines the same condition both ways. The test asserts the warning and that both compile to `@media (hover: hover) { .x:hover { … } }`.

---

## 3.5 Global styles and global variables

```ts
import { defineConfig, defineGlobalStyles } from '@pandacss/dev'
const globalCss = defineGlobalStyles({
  'html, body': { color: 'fg.default', lineHeight: '1.5' },
})
export default defineConfig({ globalCss /* … */ })
```

`globalCss` is emitted into `@layer base`, so it sits below tokens, recipes and utilities. It accepts the same style language (tokens, conditions). `globalVars` declares custom properties or `@property` registrations that Panda then autocompletes in style objects; if a plain `globalVars` value collides with a utility's own `@property` registration, Panda warns `global_var_utility_conflict`. `globalFontface` declares `@font-face` rules.

---

## 3.6 Production failure modes

| Symptom | Cause | Fix / proof |
|---|---|---|
| Override loses intermittently | String concatenation of conflicting atoms | Merge objects with `css(a, b)`; Playwright concat test |
| Per-side border override no longer opens the side after upgrading | v2 border tiers | Use longhands; e2e border test |
| `_groupHover` has no effect | Missing `group` class on the ancestor | Add the marker class |
| `bg` wipes a background image | `bg` → `background` shorthand | `bgColor` |
| Responsive array shifts after adding a breakpoint | Index-based arrays | Object syntax |
| `nested_property` warning, dead CSS | Nesting under a non-condition key | Use `_condition`, `&` selector or at-rule |
| `unknown_condition` | Typo, or condition defined in a preset you forgot | Check presets; codegen |

---

## Interview Drill

<details><summary>1. What is the difference between `css(a, b)` and `cx(css(a), css(b))`?</summary>

`css(a, b)` merges the objects first (last wins per property and condition path) and returns one class per surviving atom. `cx` joins class strings; both conflicting atoms remain on the element, and the cascade (layer, then stylesheet order within `utilities`) decides, which is not the order you wrote them.
</details>

<details><summary>2. Why does `css({ paddingTop: '20px', padding: '10px' })` yield 20 px on top?</summary>

Atoms in the utilities layer are emitted in property-breadth order: shorthands before longhands. `.pt_20px` therefore comes after `.p_10px` and wins on `padding-top` regardless of key order.
</details>

<details><summary>3. How do `_hover` conditions support headless UI libraries?</summary>

Built-in state conditions emit `:is(:pseudo, [data-pseudo])`, so a component that sets `data-hover`, `data-state`, `data-disabled` etc. (Ark/Zag, Radix) matches the same style as the native pseudo-class.
</details>

<details><summary>4. What changed in v2 about array syntax? Be precise.</summary>

Array *condition definitions* in the config (`['@media …', '&:hover']`) are deprecated: they are converted to the block form and warn `config_condition_array_unsupported`. Responsive *array values* in style objects are still supported, though object syntax is preferable because arrays are positional.
</details>

<details><summary>5. A design system exposes `<Card sx={{ p: 4 }}>`. Styles never appear. Why, and what do you change?</summary>

The extractor reads `css` and `*Css` props at JSX call sites (plus style props). `sx` is not read, so the object is never extracted. Rename to `css` (or `rootCss`), or have callers wrap it in `css.raw()`.
</details>

<details><summary>6. What does `&` mean in a condition, and where may it appear?</summary>

It is the placeholder for the generated class selector. It must sit at the start (`&:hover`, `&[data-x]`) or the end (`.dark &`, `[role=group]:hover &`) of the selector so Panda can compose it with other conditions.
</details>

<details><summary>7. Explain the v2 border-override breaking change and the migration.</summary>

v2 sorts atoms by property breadth deterministically and puts all border shorthands in one tier. An all-sides `borderWidth` now wins over a per-side shorthand like `borderInlineEnd: 0` regardless of merge order, so an "open bracket" built by overriding one side closes again. Use the longhand (`borderInlineEndWidth: 0`), which ranks above all shorthands. Padding and margin follow the same breadth rule.
</details>

<details><summary>8. Why might `cx(button(), className)` be correct while `cx(css(a), css(b))` is a smell?</summary>

`button()` returns recipe classes in `@layer recipes`, and `className` typically carries utilities from the caller; layer order guarantees the caller wins. Two `css()` outputs live in the same layer, so conflicts between them are decided by stylesheet order, not intent. Merge objects instead.
</details>

## References

- Writing styles: https://panda-css.com/docs/styling/writing-styles
- Conditional styles: https://panda-css.com/docs/styling/conditional-styles
- Conditions (theming): https://panda-css.com/docs/theming/conditions
- Responsive design: https://panda-css.com/docs/styling/responsive-design
- Merging styles: https://panda-css.com/docs/styling/merging-styles
- Extraction rules: https://panda-css.com/docs/styling/extraction-rules
- Upgrading to v2 (border overrides, array conditions): https://panda-css.com/docs/get-started/upgrading-to-v2
