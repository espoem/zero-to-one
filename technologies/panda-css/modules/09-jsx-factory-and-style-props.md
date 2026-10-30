# Module 09 · The JSX Factory and Style Props (React and Solid)

> **Verified against** `@pandacss/dev` 2.4.0, React 19.3.1, Solid 1.9.17, TypeScript 7.0.2 on 2026-10-29.
> **Executable proof:** [`examples/react/src/`](../examples/react/src/) and [`examples/solid/src/`](../examples/solid/src/) (same app in both frameworks); fixture [`09-jsx.tsx`](../examples/fixtures/positive/09-jsx.tsx) + snapshot; [`examples/bench/jsx-style-props/`](../examples/bench/jsx-style-props/) with [`type-cost.test.ts`](../examples/tests/type-cost.test.ts); the four app builds in [`e2e-computed-style.test.ts`](../examples/tests/e2e-computed-style.test.ts).

With `jsxFramework` set, codegen writes `styled-system/jsx`: the `styled` factory, `Box`, one component per pattern, `createRecipeContext`, `createSlotRecipeContext`, `splitCssProps` and `isCssProperty`. Panda generates framework-specific code for `react`, `preact`, `vue` and `solid` (Qwik JSX components were removed in v2). Typing JSX itself (`IntrinsicElements`, polymorphic props) is owned by [`languages/typescript`](../../../languages/typescript/README.md).

---

## 9.1 Style props are `css()` with a different surface

`<styled.button bg="blue.500" px="4" />` is extracted to exactly the atoms `css({ bg: 'blue.500', px: '4' })` produces. The extractor reads, for every JSX element it recognises:

1. **Style props** (utility names), when `jsxStyleProps` allows them;
2. the **`css` prop** and props ending in **`Css`** (`trackCss`);
3. **variant props** on recipe-backed components (tracked by tag name, [Module 07](./07-recipes-and-config-recipes.md#jit-emission-and-its-three-failure-modes));
4. **pattern props** on pattern components (`<Stack gap="6">`).

From the [`09-jsx`](../examples/fixtures/__snapshots__/09-jsx.css) fixture:

```tsx
const Title = styled('h2', { base: { fontSize: '3xl', fontWeight: 'black' } })
<Stack gap="6">
  <Title>Hello</Title>
  <Box bg="bg.subtle" p="5" css={{ borderRadius: 'xl' }} />
  <styled.p color="fg.muted" _hover={{ color: 'fg.default' }}>Body</styled.p>
</Stack>
```

At runtime, the factory component splits props into variant props, style props, `css`, and the rest, computes `className`/`class` with `cx(recipe(variants), css(styleProps, cssProp), className)`, and renders the element without the style props. Panda reads "every capitalised component" for style props, so your own `<Card px="4">` works if `Card` forwards to a factory; narrow that with `jsxMatchTag` (e.g. `{ from: '@tanstack/react-table', ignore: true }`).

### Factory props and options

| Prop | Meaning |
|---|---|
| `css` | Extra style object, merged **last** among styles |
| `className` (React) / `class` (Solid) | Appended after factory classes |
| `as` | Render another element (`<styled.button as="a" href=…>`) |
| `htmlWidth`, `htmlHeight`, `htmlTranslate`, `htmlContent` | Real HTML attributes (`width`, `height`, `translate`, `content` are style props) |
| `unstyled` | On recipe-backed components: drop recipe classes, keep style props/`css` |

```ts
styled(component, recipe?, {
  defaultProps,        // sit under incoming props
  shouldForwardProp,   // (prop, variantKeys) => boolean; default: drop variants and CSS properties
  forwardProps,        // allowlist on top; a forwarded key no longer feeds the recipe
  dataAttr,            // data-recipe={name}
})
```

`styled(Button, iconButtonRecipe)` composes two recipes of the **same kind** (two `cva`, or two config recipes); the later recipe wins per key. Wrapping a headless component that needs parent-pushed variants calls for `createRecipeContext` instead ([Module 08](./08-slot-recipes-and-recipe-contexts.md)).

---

## 9.2 React and Solid side by side

The two example apps are the same component tree. Differences are only framework idioms:

| Concern | React ([`examples/react`](../examples/react/)) | Solid ([`examples/solid`](../examples/solid/)) |
|---|---|---|
| Config | `jsxFramework: 'react'` | `jsxFramework: 'solid'` |
| Class prop | `className` | `class` |
| Recipe-bound element | `styled('button', button)` | identical |
| Slot recipe context | `createSlotRecipeContext(alert)` | identical API; Solid context + `createMemo` inside |
| Accepting a `css` prop | Destructure: `({ tone, css: cssProp, className, ...rest })` | `splitProps(props, ['tone', 'css', 'class'])`: never destructure props |
| State for the dark toggle | `useState` | `createSignal` |
| TS JSX config | `jsx: "react-jsx"` | `jsx: "preserve"`, `jsxImportSource: "solid-js"` ([`tsconfig.solid.json`](../tsconfig.solid.json)) |
| Vite plugin | `@vitejs/plugin-react` | `vite-plugin-solid` |

The generated Solid factory uses `splitProps`/`mergeProps` and `createMemo`, so a reactive style prop (`<styled.div bg={dark() ? 'ink.900' : 'white'}>`) updates the class without re-running the component. Both values must be statically visible for CSS to exist: the ternary's two literal branches fold to a conditional and both atoms are emitted ([Module 10](./10-compiler-internals-and-debugging.md#103-the-literal-fold-what-the-compiler-can-know)).

The e2e suite builds both apps (and both with `transform: true`) and runs identical computed-style assertions on them. One Solid-specific finding while building: Panda 2.4.0's Solid codegen writes `export const Box = /* @__PURE__ */ function Box(props) {…}`, a position Rolldown (Vite 8) ignores and warns about (`INVALID_ANNOTATION`). It is cosmetic (tree-shaking hint only); [`examples/solid/vite.config.ts`](../examples/solid/vite.config.ts) silences the check with a comment.

---

## 9.3 `jsxStyleProps`: extraction surface and type cost

| Mode | Style props (`bg`, `px`) | `css` / `*Css` | Pattern & recipe props | Runtime / types |
|---|---|---|---|---|
| `'all'` (default) | Yes | Yes | Yes | Largest prop types |
| `'minimal'` | **No** | Yes | Yes | Smaller |
| `'none'` | No; `styled.div` and `styled('div')` without recipe are invalid | `css()` function only | Recipes on `styled()` | Smallest |

Every style prop is a union of tokens and CSS values on **every** JSX element's props type, so `'all'` multiplies type work in large apps (worse with `strictTokens`). We measured it with identical source in [`examples/bench/jsx-style-props`](../examples/bench/jsx-style-props/) (two trivial components, TypeScript 7.0.2 `--extendedDiagnostics`):

| | Types | Instantiations |
|---|---|---|
| `jsxStyleProps: 'all'` | 4,967 | 8,587 |
| `jsxStyleProps: 'minimal'` | 4,172 | 5,073 (−41 %) |

[`type-cost.test.ts`](../examples/tests/type-cost.test.ts) re-measures and asserts `minimal` stays at least 20 % cheaper in instantiations. The absolute numbers are from a tiny project; the ratio in a large app depends on how many JSX elements carry style-prop types. (Panda's own design-notes report a generated-types rewrite for v2 with −99 % instantiations against legacy types; that benchmark is Panda's, not reproduced here.)

Recommendation for design systems: `'minimal'` plus `css`/`*Css` props, which keeps one explicit override surface and fast type checks.

### Then vs now

| | v1 | v2 |
|---|---|---|
| Matching custom components | `jsx` arrays plus `matchTag`/`matchTagProp` callbacks | Declarative `jsxMatchTag` rules (`tag`, `from`, `props`, `ignore`); last matching rule wins |
| Generated `.d.ts` | Large conditional types | Smaller types keyed on a clean props type; `cva`/`sva` support `isolatedDeclarations` |
| Qwik | `styled`, `Box`, patterns generated | Not generated; use `css()`/`cva()` with `class` |

---

## 9.4 Writing your own style-prop component

```tsx
import { css } from '../styled-system/css'
import { splitCssProps } from '../styled-system/jsx'
import type { HTMLStyledProps } from '../styled-system/types'

export function Panel(props: HTMLStyledProps<'div'>) {
  const [cssProps, rest] = splitCssProps(props)
  const { css: cssProp, ...styleProps } = cssProps
  return <div {...rest} className={css({ display: 'flex' }, styleProps, cssProp)} />
}
```

Extraction still sees `<Panel w="2">` because `Panel` is a capitalised component and `w` is a utility. Types worth knowing: `HTMLStyledProps<'button'>`, `JsxStyleProps`, `StyledVariantProps<typeof Button>`, `StackProps` (per pattern), `RecipeVariantProps<typeof recipe>`.

The extraction-visible rule is about **names at the call site**: `<Carousel elementWidth="300px">` forwarding to `width` is invisible. Expose a utility name, `css`, or a `*Css` prop instead.

---

## 9.5 Production failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Style prop ignored after switching to `'minimal'` | Generic style props are no longer extracted or typed | Move them into `css` |
| `width` attribute missing on `<styled.img width=…>` | `width` is a style prop | `htmlWidth` |
| Renamed prop (`elementWidth`) does not style | Extraction reads names at call sites | Use the utility name or `*Css` |
| Slow `tsc` / editor in a large React app | `jsxStyleProps: 'all'` + `strictTokens` | `'minimal'`; measure with `--extendedDiagnostics` |
| Solid component loses reactivity | Destructured props | `splitProps` |
| Third-party component props scanned as styles | Capitalised components are read | `jsxMatchTag: [{ from: 'lib', ignore: true }]` |
| `INVALID_ANNOTATION` warnings with Solid on Vite 8 | Panda 2.4.0 Solid codegen annotation position | Cosmetic; silence `checks.invalidAnnotation` |

---

## Interview Drill

<details><summary>1. Are style props a runtime feature? What actually happens with `<Box bg="red.500" />`?</summary>

No style computation happens at runtime beyond class-name mapping. At build time the extractor reads `bg="red.500"` from the JSX and emits the atom; at runtime `Box` splits style props from DOM props, maps them to the same class names (`bg_red.500`) and renders a `div` without the `bg` attribute.
</details>

<details><summary>2. Why would a design system choose `jsxStyleProps: 'minimal'`?</summary>

Lower type-check cost (every element's props otherwise include all utilities; measured −41 % instantiations in this track's bench), a smaller runtime, and a single explicit override surface (`css` / `*Css`) that is easy to review. Pattern and recipe props still work.
</details>

<details><summary>3. How do you build the same `Badge` with a `css` prop in React and in Solid?</summary>

Both: `cx(css(badge.raw({ tone }), cssProp), className)`. React destructures `{ tone, css, className, ...rest }`; Solid must use `splitProps(props, ['tone','css','class'])` to keep reactivity, and uses `class` instead of `className`.
</details>

<details><summary>4. A wrapper `<Carousel elementWidth="300px" />` forwards to `<styled.div width={elementWidth}>`. Why no CSS, and what API do you expose instead?</summary>

Extraction reads prop names at the call site; `elementWidth` is not a utility, and inside `Carousel` the value is a runtime variable. Expose `width` (a utility name), `css`, or `trackCss`, which extraction reads where the literal is written.
</details>

<details><summary>5. What do `shouldForwardProp` and `forwardProps` control?</summary>

Which props reach the wrapped element. By default variant keys and CSS properties are stripped. `forwardProps` allowlists names (and a forwarded key stops feeding the recipe); `shouldForwardProp` is the general predicate, e.g. to let Framer Motion props through.
</details>

<details><summary>6. What changed for JSX between Panda 1.x and 2.x?</summary>

`createStyleContext` replaced by recipe contexts; Qwik JSX no longer generated; custom tag matching moved to declarative `jsxMatchTag`; generated types became smaller and compatible with `isolatedDeclarations`.
</details>

## References

- Style props: https://panda-css.com/docs/styling/style-props
- Styled factory: https://panda-css.com/docs/recipes/styled-factory
- Extraction rules: https://panda-css.com/docs/styling/extraction-rules
- Config `jsxStyleProps`, `jsxFramework`, `jsxMatchTag`: https://panda-css.com/docs/reference/config
- Using SolidJS: https://panda-css.com/docs/get-started/solidjs
- Upgrading to v2: https://panda-css.com/docs/get-started/upgrading-to-v2
