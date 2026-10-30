# Panda CSS 2.4 Cheatsheet

Fast lookup for the [Panda CSS track](./README.md). Every item links to the module that explains it. Verified against `@pandacss/dev` 2.4.0 on 2026-10-29.

## Setup ([M02](./modules/02-installation-and-build-integration.md))

```bash
npm i -D @pandacss/dev            # Node >= 22, ESM-only
npx panda init [--postcss] [--jsx-framework react|solid] [--strict-tokens]
npx panda codegen --clean          # once after any upgrade (.mjs -> .js)
```

```ts
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'], // NOT implicit in v2
  include: ['./src/**/*.{ts,tsx}'], exclude: [], outdir: 'styled-system',
  jsxFramework: 'react', preflight: true, strictTokens: true,
})
```

```css
/* root CSS file (PostCSS / Vite plugin replace it) */
@layer reset, base, tokens, recipes, utilities;
```

| Integration | Config |
|---|---|
| PostCSS | `{ plugins: { '@pandacss/dev/postcss': {} } }` |
| Vite | `plugins: [pandacss({ transform?: boolean }), react()]` from `@pandacss/vite` |
| CLI | `panda` / `panda dev` / `panda cssgen -o styles.css` |

## CLI ([M02](./modules/02-installation-and-build-integration.md), [M10](./modules/10-compiler-internals-and-debugging.md))

| Command | Purpose |
|---|---|
| `panda` · `build` · `dev` | Codegen + CSS (once / watch) |
| `codegen [--check] [--clean] [--spec]` | `styled-system` only; drift gate; JSON spec |
| `cssgen [-o file] [--splitting --outdir dir] [--include glob]` | CSS only |
| `doctor [--json]` | Validate setup |
| `debug [--include g] [--outdir d] [--dry]` | Resolved config + per-file `*.extract.json` |
| `analyze [--scope s] [--unused] [--json]` | Usage report |
| `lib [--watch] [--files g]` · `buildinfo --outfile f` | Publish a design system |
| `studio [--no-open]` | Hosted Studio, live-connected |
| Flags | `--max-warnings 0`, `--format github`, `--log-level silent`, `--profile` (→ `.panda/trace.json`, `timings.json`) |

## Styling ([M03](./modules/03-styling-api-and-conditions.md))

```ts
css({ p: '4', bg: 'brand.500/40', color: { base: 'fg.default', _hover: 'accent.default' },
      md: { px: '6' }, '&[data-state=open]': { fontWeight: 'bold' }, _dark: { bg: 'ink.900' } })
css(base, override)                 // merge objects: last wins per property
css.raw({...}); cva.raw(p)          // mark/compose objects
cx(recipeClass, className)          // join strings only (no conflict resolution)
```

| Key | Meaning |
|---|---|
| `_hover`, `_focusVisible`, `_disabled`, `_open` | `:is(:pseudo, [data-*])` |
| `_groupHover` / `_peerInvalid` | needs `.group` ancestor / `.peer` previous sibling |
| `sm md lg xl 2xl`, `mdDown`, `mdOnly`, `smToLg` | `@media (width >= …)` ranges |
| `_dark`, `_osDark`, `_motionReduce`, `_starting` | `.dark &`, `prefers-color-scheme`, reduced motion, `@starting-style` |
| `'@card/wide'`, `'@/md'` | container queries (`theme.containers`) |
| `color: 'red!'` | `!important` |
| `w: '[18rem]'` | raw value under `strictTokens` |

Custom condition: `conditions: { extend: { hocus: '&:is(:hover, :focus)', supportsHover: { '@media (hover: hover)': { '&:hover': '@slot' } } } }`.

## Patterns ([M04](./modules/04-patterns-and-layout.md))

`stack hstack vstack flex wrap grid gridItem container center square circle aspectRatio float bleed linkOverlay box visuallyHidden divider cq spacer`

```tsx
<Grid columns={{ base: 1, md: 3 }} />      // ✅ condition on the prop
<Grid columns={1} md={{ columns: 3 }} />    // ❌ emits CSS `columns: 3`
definePattern({ properties, defaultValues, strict, blocklist, jsx, transform(props, { map }) {} })
```

## Tokens ([M05](./modules/05-design-tokens.md))

| Form | Output | Theme-aware |
|---|---|---|
| `color: 'brand.600'` | `var(--colors-brand-600)` | ✅ |
| `'0 0 0 2px {colors.brand.100}'` | `var(…)` inside | ✅ |
| `'token(colors.x, crimson)'` (string) | `var(--colors-x, crimson)` | ✅ |
| `token.var('colors.x')` | `var(--colors-x)` | ✅ |
| `token('colors.x')` (JS call) | raw value | ❌ |
| `bg: 'brand.500/40'` | `color-mix(in oklab, …)` | ✅ |

`semanticTokens: { colors: { fg: { value: { base: '{colors.ink.900}', _dark: '{colors.ink.50}' } } } }` · `optimize: { removeUnusedTokens, removeUnusedKeyframes, propertyFallback }`

## Theming ([M06](./modules/06-color-mode-and-theming.md))

```ts
themes: { forest: defineTheme({ semanticTokens: {...} }) }, staticCss: { themes: ['forest'] }
// <html data-panda-theme="forest" class="dark">;  getTheme(name) + injectTheme(el, theme) for on demand
```

Always use `theme.extend`. Without it, only the named entry is replaced, except `breakpoints` (whole set).

## Recipes ([M07](./modules/07-recipes-and-config-recipes.md), [M08](./modules/08-slot-recipes-and-recipe-contexts.md))

| | `cva` / `sva` | `defineRecipe` / `defineSlotRecipe` |
|---|---|---|
| CSS | atoms in `utilities` | named classes in `recipes` |
| Emission | all variants | JIT: literals, `jsx` tags, `staticCss` |
| Compounds | atoms | `recipes.compound_variants` class |

```ts
recipe.splitVariantProps(props); recipe.variantMap; RecipeVariantProps<typeof recipe>
const { withProvider, withContext, withRootProvider, PropsProvider } = createSlotRecipeContext(slotRecipe)
const { withContext, PropsProvider } = createRecipeContext(recipe)
staticCss: { recipes: { button: [{ size: ['*'] }] } } · optimize: { smartCompoundVariants: true }
```

## JSX ([M09](./modules/09-jsx-factory-and-style-props.md))

`styled(el, recipe?, { defaultProps, shouldForwardProp, forwardProps, dataAttr })` · props `css`, `*Css`, `as`, `htmlWidth`, `unstyled` · `jsxStyleProps: 'all' | 'minimal' | 'none'` · `jsxMatchTag` · React `className` / Solid `class` + `splitProps`.

## Extraction rules ([M10](./modules/10-compiler-internals-and-debugging.md))

| Visible | Invisible |
|---|---|
| literals, ternaries (both branches), `&&`/`??` right side | props, state, `Math.random()` |
| same-file consts; **named** imports, re-exports, barrels, tsconfig paths | default and namespace imports |
| pure helpers (one expression / consts + return) | helpers with `if`, loops, unknown calls (`String()`) |
| `css.raw`, `cva.raw`, `token()` | renamed props (`elementWidth`), unlisted wrapper tags |

## Design systems ([M11](./modules/11-monorepos-and-design-system-libraries.md))

Package: `panda codegen && panda lib` → `dist/panda/{lib.json,preset.mjs,buildinfo.json}` + synced exports. App: `designSystem: '@acme/ds'` (never in `include`), `optimize.treeshakeDesignSystem`.

## v1 → v2 silent breakers ([M12](./modules/12-migration-and-upgrades.md))

`preset-base` missing · `containerSizes` → `containers` · stale `.mjs` → `--clean` · `emitPackage`/removed options ignored · default imports · compound and border visual changes · `breakpoints` without `extend` · `sizes.prose` 60ch · `@property` browser floor. Errors: root `hooks`, `createStyleContext`, `defineParts`, template literals, `panda ship`.
