# Module 04 · Patterns and Layout

> **Verified against** `@pandacss/dev` 2.4.0, `@pandacss/preset-base` 2.4.0, `@pandacss/preset-panda` 2.4.0 on 2026-10-29.
> **Executable proof:** [`examples/system/patterns/scrollable.pattern.ts`](../examples/system/patterns/scrollable.pattern.ts); fixture [`04-patterns.ts`](../examples/fixtures/positive/04-patterns.ts) + snapshot; negative fixture [`pattern-prop-in-breakpoint.tsx`](../examples/fixtures/negative/pattern-prop-in-breakpoint.tsx); legacy config [`container-sizes.config.ts`](../examples/fixtures/configs/container-sizes.config.ts); the `patterns (Module 04)` and `legacy theme.containerSizes` tests in [`negative-extraction.test.ts`](../examples/tests/negative-extraction.test.ts); the container-query test in [`e2e-computed-style.test.ts`](../examples/tests/e2e-computed-style.test.ts); pattern type tests in [`type-tests.ts`](../examples/react/src/type-tests.ts).

Flexbox, grid, subgrid, positioning and the container-query model (containment, `container-type`, query evaluation) are owned by [`languages/css`](../../../languages/css/README.md) (modules "Layout: flexbox, grid, subgrid" and "Containment & container queries"). This module covers what Panda adds: patterns as typed layout functions, and the theme API for container queries.

---

## 4.1 What a pattern is

**Definition.** A pattern is a pair `(P, T)` where `P` is a typed property schema and `T : props → StyleObject` is a transform. Codegen turns it into three entry points:

```ts
import { stack } from '../styled-system/patterns'   // stack(props) → class string
stack.raw({ gap: '4' })                              // → style object, for composition
import { Stack } from '../styled-system/jsx'         // <Stack gap="4"> → <div class=…>
```

The compiler calls `T` **at build time** with the statically folded props of every call site it extracts, then encodes the returned style object into atoms like any `css()` call. The same `T` is also serialised into the generated runtime so `stack(props)` can compute class names in the browser. Two consequences:

1. A pattern adds **no CSS of its own**. It is sugar over atomic utilities. In the [`04-patterns`](../examples/fixtures/__snapshots__/04-patterns.css) snapshot, `hstack({ gap: '3', justify: 'space-between' })` yields `.d_flex`, `.ai_center`, `.gap_3`, `.jc_space-between`, atoms shared with every other user of those values.
2. `T` must be **pure and serialisable**: no closures over module state, no imports at runtime. It runs in the compiler host (where a user `transform` callback is invoked from Rust through the JS boundary) and in the browser.

Patterns versus recipes: a pattern is a layout helper with a few props, typically resolving to layout properties; a component with named visual variants belongs in a recipe ([Module 07](./07-recipes-and-config-recipes.md)).

---

## 4.2 The built-in patterns (from `@pandacss/preset-base`)

| Group | Patterns | Notes |
|---|---|---|
| Stacking and flex | `stack`, `hstack`, `vstack`, `flex`, `spacer` | `stack` default gap is `8px`; `hstack`/`vstack` have their own defaults |
| Wrapping and grids | `wrap`, `grid`, `gridItem` | `grid({ columns: 3 })` → `repeat(3, minmax(0, 1fr))`; `minChildWidth` → `auto-fit` |
| Sizing and centering | `container`, `center`, `square`, `circle`, `aspectRatio` | `aspectRatio` uses a `::before` with `padding-bottom: (1/ratio)·100%` (default ratio 4/3), not the `aspect-ratio` property |
| Positioning | `float`, `bleed`, `linkOverlay` | |
| Utilities | `box`, `visuallyHidden`, `divider`, `cq` | `cq` declares a query container |

`panda doctor` lists 21 patterns for the React app (`analyze` reports `patterns.total: 21`, 20 built-ins plus the custom `scrollable`).

### `linkOverlay`: one link, whole card clickable

```tsx
<article className={css({ position: 'relative' })}>
  <h3><a href="/post/1" className={linkOverlay()}>Read the post</a></h3>
</article>
```

The pattern positions an empty `::before` over the nearest positioned ancestor (`before:pos_absolute`, `before:inset_0`, `before:content_""` in the snapshot). Accessibility rationale: the card has exactly **one** link, with a meaningful accessible name, instead of wrapping block content in an `<a>` (verbose for screen readers) or attaching `onClick` to a `div` (not focusable). Any second interactive element inside the card must be raised above the overlay (`position: relative; z-index: 1`), or it becomes unclickable.

---

## 4.3 Responsive pattern props

Pattern props accept the same condition objects as style properties:

```ts
// examples/fixtures/positive/04-patterns.ts
scrollable({ direction: { base: 'horizontal', md: 'vertical' }, hideScrollbar: true })
grid({ columns: { base: 1, md: 3 }, gap: '4' })
```

Inside `T`, a responsive prop arrives as the **object**, so `direction === 'horizontal'` is never true. The `map` helper applies a function to each condition value and rebuilds the object:

```ts
// examples/system/patterns/scrollable.pattern.ts
transform(props, { map }) {
  const { direction, hideScrollbar, ...rest } = props
  return {
    overflowX: map(direction, (d) => (d === 'horizontal' ? 'auto' : 'hidden')),
    overflowY: map(direction, (d) => (d === 'vertical' ? 'auto' : 'hidden')),
    scrollbarWidth: hideScrollbar ? 'none' : undefined,
    ...rest,
  }
}
```

The test `responsive pattern props are mapped per breakpoint` asserts the four overflow atoms (`ov-x_auto`, `ov-y_hidden`, `md:ov-x_hidden`, `md:ov-y_auto`) and `md:grid-tc_repeat(3,_minmax(0,_1fr))`.

### The breakpoint-wrapping trap

```tsx
// examples/fixtures/negative/pattern-prop-in-breakpoint.tsx
<Grid columns={1} md={{ columns: 3 }} />
```

`md={{ columns: 3 }}` is a **style prop** condition, not a pattern prop, so `T` never sees it. Worse, `columns` is a real CSS property (multi-column layout), so Panda emits it verbatim:

```css
@media (width >= 48rem) { .md\:columns_3 { columns: 3; } }
```

The grid stays single-column, and its children now also flow into three *text* columns at `md`. The negative test asserts this exact rule exists and that no responsive `grid-template-columns` does. Correct form: `<Grid columns={{ base: 1, md: 3 }} />`.

---

## 4.4 Writing and adjusting patterns

```ts
export const scrollablePattern = definePattern({
  description: 'A scroll container with an optional hidden scrollbar', // JSDoc on the generated function
  properties: {
    direction: { type: 'enum', value: ['horizontal', 'vertical'] },
    hideScrollbar: { type: 'boolean' },
  },
  defaultValues: { direction: 'vertical', hideScrollbar: false },
  blocklist: ['overflow', 'overflowX', 'overflowY'],
  transform(props, { map }) { /* … */ },
})
// preset.ts
patterns: { extend: { scrollable: scrollablePattern } }
```

### Property types

| `type` | Typed as | Resolution |
|---|---|---|
| `property` (`value: 'alignItems'`) | That CSS property's values | Like the property |
| `enum` (`value: [...]`) | Union of strings | Passed to `T` |
| `token` (`value: 'sizes', property: 'borderWidth'`) | Token names in the category | Resolved through the given property |
| `number`, `boolean`, `string` | Primitive | Passed to `T` as is |

### Options

- `defaultValues`: object or `(props) => object` (the base `grid` sets `gap: '8px'` only when neither `columnGap` nor `rowGap` is given).
- `strict: true`: only `properties` are accepted; no extra style props.
- `blocklist`: everything except the listed style properties (marked experimental in the types). [`type-tests.ts`](../examples/react/src/type-tests.ts) proves `scrollable({ overflowX: 'visible' })` and `direction: 'diagonal'` are type errors.
- `jsxName` (component name), `jsxElement` (default `div`), and `jsx` (extra component names or regexes that count as usages during extraction).
- Value helpers in `T`: `map`, `isCssUnit`, `isCssVar`, `isCssFunction` (how `bleed` accepts both `'6'` and `'2rem'`).

Adjust a built-in without forking it, under `patterns.extend`:

```ts
patterns: {
  extend: {
    stack: { defaultValues: { gap: '4' } },                              // change a default
    flex: { properties: { direction: { type: 'enum', value: ['row', 'column'] } } }, // narrow a prop
  },
}
```

**Missing `extend` is destructive:** `patterns: { scrollable }` replaces *all* built-in patterns.

### Wrapping a pattern component

Extraction finds patterns by component name. If you wrap `<Stack>` in `<Section>`, `<Section gap="8">` is invisible until you register the name: `patterns: { extend: { stack: { jsx: ['Stack', 'Section'] } } }`.

---

## 4.5 Container queries: `theme.containers`

```ts
// examples/system/preset.ts
theme: {
  extend: {
    containers: { narrow: '20rem', wide: '40rem' }, // size scale
    containerNames: ['card'],                         // named scopes
  },
},
```

Panda separates the two jobs of CSS container queries:

- **Declare** a container with native properties: `css({ containerType: 'inline-size', containerName: 'card' })`, or the `cq` pattern (`cq({ name: 'card' })` emits the same two atoms; `type` defaults to `inline-size`).
- **Query** an ancestor with a condition `@<name>/<size>`, or `@/<size>` for the nearest container:

```css
/* 04-patterns snapshot */
@container (inline-size >= 28rem)      { .\@\/md\:fs_md { font-size: var(--font-sizes-md); } }
@container card (inline-size >= 40rem) { .\@card\/wide\:flex-d_row { flex-direction: row; } }
```

`preset-panda` ships a default scale (`xs 320px` … `8xl 1440px`; `md` = 28rem, as the snapshot shows). Range forms exist like breakpoints (`@/smDown`, `@/smOnly`, `@/smToMd`).

The e2e suite renders the same `cardBody` class inside an 18rem and a 48rem `card` container. Chromium computes `flex-direction: column` and `row` respectively, in both React and Solid builds.

### Then vs now: `containerSizes` → `containers`

| | 0.x / 1.x | 2.x |
|---|---|---|
| Size scale key | `theme.containerSizes` | `theme.containers` (shared scale for named and unnamed queries) |
| Names | `theme.containerNames` | unchanged |
| Old key in a v2 config | — | **Silently ignored**: no diagnostic, still type-checks |

The fixture [`container-sizes.config.ts`](../examples/fixtures/configs/container-sizes.config.ts) uses the old key. The test proves the stylesheet contains **no** `@container` rule and the CLI reports `diagnostics: 0`, and `tsc` accepts the config (the theme type is open-ended). Only a visual check or a test like this catches it. Migration: rename the key; run `panda analyze` or a CSS grep for `@container` in CI.

Validation that *does* exist: `config_container_invalid`, `config_container_name_invalid` (space, `/` or `@` in a name), `config_container_units_mixed`, `config_container_condition_conflict`.

---

## 4.6 Production failure modes

| Symptom | Cause | Fix / proof |
|---|---|---|
| Container layout never switches after upgrade | `containerSizes` ignored in v2 | Rename to `containers`; legacy-config test |
| Grid unexpectedly multi-column text | Pattern prop inside a breakpoint key → raw CSS `columns` | Put the condition on the prop; negative test |
| Responsive pattern prop half-works | `T` compares an object with `===` | Use `map` |
| All `Stack`/`Grid` vanished | `patterns: {...}` without `extend` | Use `patterns.extend` |
| `<Section gap>` ignored | Wrapper name unknown to extraction | `jsx: ['Stack', 'Section']` |
| Card buttons unclickable | Under the `linkOverlay` `::before` | Raise them with `position: relative; z-index` |

---

## Interview Drill

<details><summary>1. What does a pattern compile to, and why does it add no CSS of its own?</summary>

At build time the compiler calls the pattern's transform with the folded props, then encodes the returned style object into atoms in `@layer utilities`. The same atoms are shared with any other `css()` that uses those values; the pattern only names a recurring style object and types its props.
</details>

<details><summary>2. Why must a responsive pattern prop be branched with `map`?</summary>

The prop can arrive as a condition object (`{ base: 'x', md: 'y' }`). `map(value, fn)` applies `fn` per condition and rebuilds the object, producing responsive output; a direct `===` comparison against an object is always false.
</details>

<details><summary>3. `<Grid columns={1} md={{ columns: 3 }} />` — what does the browser get?</summary>

A one-column grid at all sizes, plus a `columns: 3` multi-column declaration at `md` (because `columns` is a CSS property and the nested object is a style condition, not a pattern prop). Fix: `columns={{ base: 1, md: 3 }}`.
</details>

<details><summary>4. How do you declare and query a named container in Panda v2?</summary>

Declare with `containerType`/`containerName` (or `cq({ name })`), define sizes in `theme.containers` and names in `theme.containerNames`, and query with `'@name/size'` (or `'@/size'` for the nearest container). The output is `@container name (inline-size >= …)`.
</details>

<details><summary>5. After a v1 → v2 upgrade all container queries stopped working, with no warnings. Diagnose.</summary>

`theme.containerSizes` was renamed to `theme.containers`, and v2 silently ignores the old key; the conditions resolve to no size so nothing is emitted. Rename the key and add a CI check (CSS snapshot or grep for `@container`).
</details>

<details><summary>6. When is `strict: true` or `blocklist` the right call on a pattern?</summary>

`strict` when the pattern must not double as a styling escape hatch (only its own props allowed); `blocklist` when the pattern owns specific properties (e.g. overflow on a scroll area) that callers must not override but other style props are fine. Both are type-level constraints.
</details>

<details><summary>7. Why is `linkOverlay` better than wrapping a card in `<a>`?</summary>

It keeps a single, well-named link in the heading while making the whole card clickable through a positioned pseudo-element. Wrapping block content in an anchor produces a long, noisy accessible name, and `onClick` on a `div` is not keyboard accessible. The trade-off: nested interactive elements must be raised above the overlay.
</details>

## References

- Patterns (styling): https://panda-css.com/docs/styling/patterns
- Patterns (theming, `definePattern`): https://panda-css.com/docs/theming/patterns
- Container queries: https://panda-css.com/docs/styling/conditional-styles#container-queries
- Upgrading to v2 (`containerSizes` → `containers`): https://panda-css.com/docs/get-started/upgrading-to-v2
