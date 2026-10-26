# Panda CSS — Fast-Lookup Cheat Sheet

A dense reference covering Panda CSS configuration, styling APIs, recipes, tokens, patterns, JSX factory utilities, CLI commands, and static extraction rules.

## 1. Cascade Layer Order

Every Panda CSS entry stylesheet begins with the five-layer cascade declaration:

```css
@layer reset, base, tokens, recipes, utilities;
```

| Layer | Purpose | Specificity Priority |
| :--- | :--- | :--- |
| `reset` | Preflight CSS normalize rules (`preflight: true`) | Lowest (1) |
| `base` | Global styles defined via `globalCss` | Low (2) |
| `tokens` | CSS custom properties (`--colors-*`, `--spacing-*`) and theme overrides | Medium-Low (3) |
| `recipes` | Config recipe classes (`defineRecipe`, `defineSlotRecipe`) | Medium-High (4) |
| `utilities` | Atomic classes from `css()`, `cva()`, `sva()`, and patterns | Highest (5 — always overrides config recipes cleanly) |

## 2. Core Styling Primitives (`styled-system/css`)

### `css()` — Atomic Style Function

```tsx
import { css } from '../styled-system/css'

const boxClass = css({
  bg: { base: 'bg.surface', _dark: 'slate.900' },
  color: 'fg.default',
  p: { base: '4', md: '6' },
  rounded: 'lg',
  shadow: 'sm',
  borderWidth: '1px',
  borderColor: 'border.subtle',
  transition: 'all 0.2s token(easings.easeOut)',
  _hover: {
    borderColor: 'brand.500',
    transform: 'translateY(-2px)',
  },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'brand.500',
    outlineOffset: '2px',
  },
})
```

### `css.raw()` & Deterministic Merging

Never concatenate two `css()` strings when properties might collide. Pass raw style objects into `css()` so Panda merges conflicting properties deterministically (last argument wins):

```tsx
import { css, type SystemStyleObject } from '../styled-system/css'

const baseCard = css.raw({ bg: 'white', p: '6', rounded: 'md' })

export function Card({ css: cssProp, children }: { css?: SystemStyleObject; children: React.ReactNode }) {
  // If caller passes { p: '2' }, p: '6' is removed before class names are emitted
  return <div className={css(baseCard, cssProp)}>{children}</div>
}
```

### `cx()` — Class Name Joiner

Use `cx()` to join a config recipe class, an atomic `css()` override class, and an external `className`:

```tsx
import { css, cx } from '../styled-system/css'
import { badge } from '../styled-system/recipes'

const className = cx(badge({ visual: 'solid' }), css({ mt: '2' }), externalClassName)
```

## 3. Common Shorthands

| Shorthand | CSS Property | Token Category |
| :--- | :--- | :--- |
| `bg` | `backgroundColor` | `colors` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | `padding`, `paddingInline`, `paddingBlock`, etc. | `spacing` |
| `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml` | `margin`, `marginInline`, `marginBlock`, etc. | `spacing` |
| `w`, `h`, `minW`, `maxW`, `minH`, `maxH` | `width`, `height`, `minWidth`, etc. | `sizes` |
| `boxSize` | `width` + `height` | `sizes` |
| `rounded` | `borderRadius` | `radii` |
| `shadow` | `boxShadow` | `shadows` |
| `ring`, `ringColor`, `ringOffset` | `outlineWidth`, `outlineColor`, `outlineOffset` | `sizes` / `colors` |
| ` pos` | `position` | N/A |
| `inset`, `insetX`, `insetY` | `inset`, `insetInline`, `insetBlock` | `spacing` |
| `srOnly` | Visually hidden for screen readers (`boolean`) | Utility |
| `truncate` | Single-line ellipsis overflow (`boolean`) | Utility |
| `lineClamp` | Multi-line clamp (`1`, `2`, `3`, `'none'`) | Utility |

## 4. Layout Patterns (`styled-system/patterns`)

| Pattern | Import | Key Pattern Props |
| :--- | :--- | :--- |
| `stack` | `import { stack } from 'styled-system/patterns'` | `direction` (`'column'` default), `gap`, `align`, `justify` |
| `vstack` | `import { vstack } from 'styled-system/patterns'` | `gap`, `justify` (`alignItems: 'center'` by default) |
| `hstack` | `import { hstack } from 'styled-system/patterns'` | `gap`, `justify` (`alignItems: 'center'` by default) |
| `flex` | `import { flex } from 'styled-system/patterns'` | `direction`, `align`, `justify`, `wrap`, `basis`, `grow`, `shrink` |
| `wrap` | `import { wrap } from 'styled-system/patterns'` | `gap`, `rowGap`, `columnGap`, `align`, `justify` |
| `grid` | `import { grid } from 'styled-system/patterns'` | `columns`, `gap`, `rowGap`, `columnGap`, `minChildWidth` |
| `gridItem` | `import { gridItem } from 'styled-system/patterns'` | `colSpan`, `rowSpan`, `colStart`, `colEnd`, `rowStart`, `rowEnd` |
| `center` | `import { center } from 'styled-system/patterns'` | `inline` (`boolean`) |
| `circle` / `square` | `import { circle, square } from 'styled-system/patterns'` | `size` |
| `container` | `import { container } from 'styled-system/patterns'` | Centers content with `maxW: '8xl'` and responsive `px` |
| `cq` | `import { cq } from 'styled-system/patterns'` | `name`, `type` (`'inline-size'` default) for `@/sm`, `@/md` queries |
| `linkOverlay` | `import { linkOverlay, linkBox } from 'styled-system/patterns'` | Stretches `<a>` pseudo-element across a relative `linkBox` container |

## 5. Recipes Decision Matrix

| Feature | Atomic Recipe (`cva`) | Atomic Slot Recipe (`sva`) | Config Recipe (`defineRecipe`) | Config Slot Recipe (`defineSlotRecipe`) |
| :--- | :--- | :--- | :--- | :--- |
| **Where defined** | Colocated in component file | Colocated in component file | `panda.config.ts` (`theme.recipes`) | `panda.config.ts` (`theme.slotRecipes`) |
| **CSS Layer** | `@layer utilities` | `@layer utilities` | `@layer recipes` | `@layer recipes` |
| **Class Output** | Pure atomic classes (`bg_blue_500 p_4`) | Pure atomic classes per slot | Named recipe classes (`badge badge--size_md`) | Named slot classes (`alert__root alert__icon`) |
| **`splitVariantProps`** | Yes (`recipe.splitVariantProps`) | Yes (`recipe.splitVariantProps`) | Yes (`recipe.splitVariantProps`) | Yes (`recipe.splitVariantProps`) |
| **Codegen required** | No (zero codegen on edit) | No (zero codegen on edit) | Yes (`panda codegen` on schema change) | Yes (`panda codegen` on schema change) |
| **Best for** | App-local single-element components | App-local multi-part components | Design-system single-element primitives | Design-system multi-part primitives |

## 6. Virtual Colors (`colorPalette`)

Declare `colorPalette` once on a parent or variant, and reference `colorPalette.*` shades across every state:

```tsx
const button = cva({
  base: {
    colorPalette: 'brand', // Default palette
    bg: 'colorPalette.600',
    color: 'white',
    _hover: { bg: 'colorPalette.700' },
    _focusVisible: { ringColor: 'colorPalette.400' },
  },
})

// Override palette per instance:
<button className={cx(button(), css({ colorPalette: 'emerald' }))}>Save</button>
```

## 7. Design Token Helpers (`styled-system/tokens`)

```tsx
import { token } from '../styled-system/tokens'

// 1. Raw value (e.g. '#3b82f6' or '1rem') — useful for Canvas or third-party JS libs
const rawHex = token('colors.brand.500')

// 2. CSS variable reference (e.g. 'var(--colors-brand-500)') — respects dark mode & themes!
const cssVar = token.var('colors.brand.500')

// 3. Inline token interpolation inside compound CSS values
const box = css({
  border: '1px solid token(colors.border.default)',
  boxShadow: '0 4px 12px token(colors.brand.500/25)',
})
```

## 8. Essential CLI Commands

| Command | Description |
| :--- | :--- |
| `panda init --postcss` | Initialize `panda.config.ts`, `postcss.config.cjs`, and generate `styled-system/` |
| `panda codegen` | Regenerate JS/TS runtime files in `styled-system/` after editing `panda.config.ts` |
| `panda codegen --watch` | Watch `panda.config.ts` and regenerate `styled-system/` on changes |
| `panda cssgen` | Extract styles from `include` files and write static CSS output |
| `panda --watch` | Run both codegen and CSS extraction in watch mode |
| `panda studio` | Launch interactive local web UI showing all tokens, typography, and colors |
| `panda analyze` | Analyze token and recipe usage across source files (`--json` for CI pipelines) |
| `panda ship` | Emit `./styled-system/panda.buildinfo.json` for pre-compiled UI library packages |
| `panda debug` | Debug AST extraction and generated CSS per source file |
