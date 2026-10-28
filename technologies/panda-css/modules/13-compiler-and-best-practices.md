# Module 13: Bonus — Compiler Internals, Headless UI Presets & 25 Production Best Practices

To extract maximum performance and reliability from Panda CSS, engineering teams must look beyond surface syntax and understand the mechanical underpinnings of the static compiler, the design principles behind headless component presets, and the hard-won production practices learned across enterprise deployments.

This module delivers technical deep-dives into the Panda compiler engine, the architectural blueprint for building headless design systems like Park UI, creator insights on the evolution of web styling, and a definitive catalog of 25 production best practices and anti-patterns.

---

## Lesson 13.1: Inside the Panda Compiler (Insights from Alex)

Panda CSS does not execute your JavaScript or React components during its compilation phase. Instead, it relies on static Abstract Syntax Tree (AST) analysis to extract styles ahead of time. Understanding this extraction engine eliminates mysterious "missing styles" bugs and ensures 100% extraction efficiency.

### The Static Extraction Pipeline

The Panda compiler (engineered by Alex and the core Chakra team) transforms source code into atomic stylesheets through four distinct phases:

```
┌────────────────────────────────────────────────────────┐
│ 1. AST Traversal & Import Tracking (ts-morph)          │
│    Scans files, matches import declarations from       │
│    styled-system/css, styled-system/jsx, or importMap  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 2. Box Node Representation                             │
│    Wraps AST nodes into Box data structures:           │
│    MapBox, ArrayBox, LiteralBox, ConditionalBox        │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 3. Static Evaluation & Unwrapping                      │
│    Resolves local identifiers, object spreads, ternary │
│    expressions, and static property lookups            │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 4. Atomic CSS Generation & Deduplication               │
│    Maps style properties to CSS Cascade Layers         │
│    Emits atomic utilities and variant classes          │
└────────────────────────────────────────────────────────┘
```

### The Box Evaluation Algorithm

When the Panda parser encounters a style function call (`css({ bg: 'blue.500' })`), it converts AST nodes into specialized **Box** nodes:
- **`LiteralBox`**: Primitive values (e.g., `'blue.500'`, `16`, `true`).
- **`MapBox`**: Key-value object literals (`{ color: 'text.primary' }`).
- **`ArrayBox`**: Array sequences (e.g., responsive lists `['4', '6', '8']`).
- **`ConditionalBox`**: Ternary operations (`condition ? valueA : valueB`).

The parser performs local scope analysis to unwrap identifiers:

```tsx
// This evaluates successfully because the identifier is a local static constant
const CARD_PADDING = '6';

export function Card() {
  return <div className={css({ p: CARD_PADDING, bg: 'white' })}>Content</div>;
}
```

### What Cannot Be Statically Evaluated

Static analysis ceases where runtime evaluation begins. The compiler cannot execute runtime logic, read network responses, or access external state:

1. **Imported Runtime Variables**: Constants imported from non-Panda modules cannot be evaluated without executing the entire runtime bundle.
2. **Function Return Values**: Calling arbitrary functions inside style objects fails extraction (`p: getDynamicPadding(props)`).
3. **Computed Dynamic Property Keys**: Dynamic object keys (`{ [dynamicProp]: 'value' }`) cannot be statically indexed.
4. **Rest Props Spreading**: Spreading un-typed, dynamic objects into style calls (`css({ ...untypedRestProps })`) prevents property detection.

### Debugging Extraction with Panda CLI

When a style rule fails to appear in your generated CSS, utilize Panda's built-in diagnostic tools:

```bash
# Print detailed AST extraction information for a specific file
npx panda debug src/components/Button.tsx

# Analyze total rule coverage, unused tokens, and extraction statistics
npx panda analyze

# Check config validity and output path resolution
npx panda check
```

The output of `panda debug` displays exactly which Box nodes were identified, which call expressions were evaluated, and any extraction warnings.

### The 6 Formal Compiler Lowering Passes & Deterministic Atomic Hashing

Panda transforms high-level style objects into production CSS via a deterministic 6-pass lowering pipeline:

1. **Shorthand Expansion (Desugaring)**: Expands authoring shorthands to standard CSS property names (`p` $\to$ `padding`, `px` $\to$ `padding-inline`, `bg` $\to$ `background`, `w` $\to$ `width`, `rounded` $\to$ `border-radius`).
2. **Token Path Resolution**: Resolves dotted token strings (`blue.500`, `spacing.4`) against the theme schema into CSS Custom Properties (`var(--colors-blue-500)`).
3. **Condition & Breakpoint Resolution**: Unpacks responsive objects (`{ base: '4', md: '8' }`) and pseudo-selectors (`_hover`, `_dark`) into media query and selector envelopes (`@media screen and (min-width: 48em)`, `[data-theme="dark"] &`).
4. **Deterministic Class Name Hashing**: Unlike runtime CSS-in-JS libraries that compute non-deterministic runtime hashes (e.g. MurmurHash), Panda uses a deterministic property-value slug algorithm (`<prefix>-<property>_<value>`), generating stable class names like `p_4` or `bg_blue\.500`.
5. **Cascade Layer Assignment**: Directs generated CSS rules into W3C `@layer` boundaries (`@layer reset, base, tokens, recipes, utilities`), guaranteeing deterministic override precedence regardless of stylesheet import order.
6. **Rule Deduplication & Static Sheet Emission**: Collects all unique declarations across the entire project AST, deduplicates identical rules, and writes the consolidated atomic stylesheet to disk.

### W3C Design Tokens Community Group (DTCG) Compliance

Panda CSS token definitions adhere to the formal W3C DTCG specification, allowing interoperability with design tools like Figma and Style Dictionary:

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#2563eb",
        "$type": "color",
        "$description": "Primary brand interactive color"
      },
      "surface": {
        "$value": "{color.brand.primary}",
        "$type": "color"
      }
    }
  }
}
```

### Taxonomy of Extraction Failure Modes & Repair Strategies

| Failure Mode | Root Cause | Observable Symptom | Repair Strategy |
| :--- | :--- | :--- | :--- |
| **Dynamic Key Omission** | Object has dynamic computed key (`{ [prop]: value }`) | Style silently missing from `.css` | Map dynamic key to a static recipe variant or use explicit `staticCss` manifest. |
| **Un-tracked Import** | Component imports `css` from relative file instead of `styled-system` | Classes appear in HTML but not in generated CSS | Update import path to `styled-system/css` or configure `importMap` in `panda.config.ts`. |
| **Runtime Expression** | Style value calls external function (`w: getWidth()`) | AST parser skips expression | Refactor to inline CSS Custom Property (`style={{ '--width': getWidth() }}`) or static tokens. |
| **Silent Rest Prop Drop** | Spreading untyped props into JSX style calls (`<Box {...props} />`) | Custom styles dropped | Explicitly destructure recognized style props or use `styled()` factory with typed prop forward. |

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Attempting to call external runtime functions inside style objects
import { computeResponsivePadding } from '../utils/layout';

// The compiler cannot execute `computeResponsivePadding` at build time; p is skipped!
const cardClass = css({
  p: computeResponsivePadding(window.innerWidth),
});

// ✅ Best Practice: Use Panda's responsive object syntax or inline CSS Custom Properties
const cardClass = css({
  p: { base: '4', md: '6', lg: '8' }, // Statically extractable responsive mapping
});
```

---

## Lesson 13.2: Building a Headless Component Preset Like Park UI (Insights from Chris)

Park UI, designed by Christian Schröter, demonstrates the premier architectural pattern for modern design systems: pairing accessible, headless UI state machines (such as **Ark UI** or **Radix UI**) with Panda CSS **Slot Recipes** (`sva`).

### The Headless + Static Styling Architecture

Headless UI libraries handle keyboard navigation, ARIA attributes, focus trapping, and screen-reader accessibility via DOM data attributes (`[data-state]`, `[data-disabled]`, `[data-highlighted]`). Panda CSS applies styling directly to these state attributes without incurring any runtime JavaScript styling overhead:

```
┌────────────────────────────────────────────────────────┐
│ Ark UI / Radix Primitives                              │
│ (State machines, DOM management, [data-*] attributes)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Data attributes in DOM
┌──────────────────────────▼─────────────────────────────┐
│ Panda CSS Slot Recipe (sva)                            │
│ (Targeting [data-state="open"], &[data-disabled])     │
└────────────────────────────────────────────────────────┘
```

### Designing a Headless Accordion with Slot Recipes

Ark UI Accordion exposes multiple coordinated slots: `root`, `item`, `itemTrigger`, `itemContent`, and `itemIndicator`. We define a slot recipe in Panda that styles every part and state:

```ts
// recipes/accordion.recipe.ts
import { defineSlotRecipe } from '@pandacss/dev';

export const accordionRecipe = defineSlotRecipe({
  className: 'accordion',
  slots: ['root', 'item', 'itemTrigger', 'itemContent', 'itemIndicator'],
  base: {
    root: {
      w: 'full',
      divideY: '1px',
      divideColor: 'border.subtle',
      borderWidth: '1px',
      borderColor: 'border.subtle',
      rounded: 'xl',
      overflow: 'hidden',
    },
    item: {
      bg: 'bg.surface',
      transition: 'background-color 0.15s ease',
      _hover: {
        bg: 'bg.muted',
      },
      '&[data-state="open"]': {
        bg: 'bg.surface',
      },
      '&[data-disabled]': {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
    },
    itemTrigger: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      w: 'full',
      px: '5',
      py: '4',
      textStyle: 'body.md',
      fontWeight: 'medium',
      color: 'text.primary',
      cursor: 'pointer',
      outline: 'none',
      _focusVisible: {
        ring: '2px',
        ringColor: 'blue.500',
        ringInset: 'inset',
      },
    },
    itemIndicator: {
      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      transformOrigin: 'center',
      '&[data-state="open"]': {
        transform: 'rotate(180deg)',
      },
    },
    itemContent: {
      px: '5',
      pb: '5',
      pt: '1',
      textStyle: 'body.sm',
      color: 'text.muted',
      overflow: 'hidden',
      '&[data-state="open"]': {
        animation: 'accordionDown 0.2s cubic-bezier(0, 0, 0.2, 1)',
      },
      '&[data-state="closed"]': {
        animation: 'accordionUp 0.2s cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
});
```

### Keyframes for Headless Animations

Pair the state attributes with CSS keyframes declared in `panda.config.ts`:

```ts
// panda.config.ts
import { defineConfig, defineKeyframes } from '@pandacss/dev';

const keyframes = defineKeyframes({
  accordionDown: {
    from: { height: '0', opacity: '0' },
    to: { height: 'var(--height)', opacity: '1' },
  },
  accordionUp: {
    from: { height: 'var(--height)', opacity: '1' },
    to: { height: '0', opacity: '0' },
  },
});

export default defineConfig({
  theme: {
    extend: {
      keyframes,
    },
  },
});
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Using React state and manual boolean toggles to conditionally inject classes
function AccordionItem({ isOpen, children }: any) {
  return (
    <div className={isOpen ? css({ bg: 'white', display: 'block' }) : css({ display: 'none' })}>
      {children}
    </div>
  );
}

// ✅ Best Practice: Let headless state machines manage [data-state] and style state attributes declaratively in the slot recipe
// In slot recipe:
itemContent: {
  '&[data-state="open"]': { display: 'block' },
  '&[data-state="closed"]': { display: 'none' },
}
```

---

## Lesson 13.3: The Design Intent of Panda CSS (Insights from Sage)

Segun Adebayo (creator of Chakra UI and Panda CSS) designed Panda to resolve a historical tension in web development: balancing the exceptional developer experience of component-based runtime CSS-in-JS with the raw performance and cacheability of static utility CSS.

### The Historical Evolution of Frontend Styling

```
CSS Modules (2015) ─────────────> Runtime CSS-in-JS (2016-2020)
Local scoping, but                Styled Components & Emotion.
disconnected styling.             Great DX, but severe runtime cost.
                                                │
                                                ▼
Type-Safe Build-Time (2023+) <─── Utility CSS (2019-2023)
Panda CSS & Ark UI.               Tailwind CSS.
Static AST extraction,            Zero runtime, fast,
Cascade Layers, pure types.       but string-based, HTML clutter.
```

1. **The Promise of Chakra UI**: Chakra popularized prop-based styling, accessible primitives, and intuitive token abstractions. However, as applications scaled, evaluating styles on every render slowed page interactions.
2. **The Rise of Utility CSS**: Tailwind proved that pre-compiled, atomic CSS delivers unparalleled performance and cache efficiency. However, writing long string classes in JSX sacrificed component encapsulation and rich TypeScript validation.
3. **Panda CSS as the Synthesis**: Panda combines both paradigms. Developers write structured, type-checked JavaScript/TypeScript objects (`css({ bg: 'brand.primary' })`), and the compiler outputs atomic, unlayered CSS into native CSS Cascade Layers.

### Embracing Modern Web Standards

Panda intentionally avoids proprietary bundler plugins or runtime monkey-patching. It is designed around emerging W3C web standards:
- **CSS Cascade Layers (`@layer`)**: Solves specificity wars definitively by organizing reset, base, tokens, recipes, and utilities into discrete layers.
- **CSS Custom Properties**: Ensures token values switch instantaneously between dark and light modes with zero JavaScript re-renders.
- **Modern Color Spaces (`oklch`, `display-p3`)**: Provides perceptually uniform palettes and wide-gamut displays on modern screens.

---

## Lesson 13.4: The 25 Production Best Practices & Anti-Patterns Catalog

This catalog outlines 25 essential rules for architecting enterprise-grade design systems with Panda CSS.

---

### Category 1: Static Extraction & Compiler Safety

#### Rule 1: Always Write Statically Analysable Expressions
- **Principle**: Never compute object keys or wrap style objects in runtime function calls.
- **Rationale**: The compiler extracts styles via AST pattern matching; dynamic runtime logic cannot be evaluated at build time.

```tsx
// ❌ Anti-Pattern
const getSpacing = (factor: number) => `${factor * 4}px`;
const style = css({ margin: getSpacing(2) });

// ✅ Best Practice
const style = css({ m: '2' }); // Resolves statically to var(--spacing-2)
```

#### Rule 2: Use CSS Custom Properties for Continuous Dynamic Values
- **Principle**: Bind runtime variables (slider values, mouse coordinates, dynamic widths) to inline CSS variables.
- **Rationale**: Generates fixed atomic utility classes while delegating continuous value changes to browser layout variables.

```tsx
// ❌ Anti-Pattern
function ProgressBar({ percent }: { percent: number }) {
  return <div className={css({ width: `${percent}%` })} />; // Creates a new CSS class per percentage value!
}

// ✅ Best Practice
function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      style={{ '--progress': `${percent}%` } as React.CSSProperties}
      className={css({ width: 'var(--progress)', bg: 'blue.500', h: '2', rounded: 'full' })}
    />
  );
}
```

#### Rule 3: Avoid Dynamic Object Keys in Style Calls
- **Principle**: Write fixed property keys; do not use computed property names.
- **Rationale**: Computed property syntax (`[computedKey]: value`) prevents Box node analysis.

```tsx
// ❌ Anti-Pattern
const propName = isVertical ? 'mb' : 'mr';
const layoutClass = css({ [propName]: '4' });

// ✅ Best Practice
const layoutClass = css(isVertical ? { mb: '4' } : { mr: '4' });
```

#### Rule 4: Co-Locate Local Constants or Export as Tokens
- **Principle**: Keep style constants local to the file or register them in `panda.config.ts`.
- **Rationale**: Panda cannot follow arbitrary cross-file runtime imports during isolated AST parsing.

```tsx
// ❌ Anti-Pattern: Importing raw style numbers from external logic files
import { BRAND_RADIUS } from '../constants';
const box = css({ rounded: BRAND_RADIUS });

// ✅ Best Practice: Register tokens in panda.config.ts
const box = css({ rounded: 'xl' });
```

#### Rule 5: Run `panda analyze` in Continuous Integration
- **Principle**: Add `panda analyze` to pull request validation pipelines.
- **Rationale**: Catches unextractable expressions, dead tokens, and syntax mismatches before deployment.

```bash
# ✅ Best Practice CI script
pnpm panda analyze --json > extraction-report.json
```

---

### Category 2: Recipes, Slot Recipes & Variants

#### Rule 6: Use Config Recipes for Shared Component Primitives
- **Principle**: Define multi-variant component recipes in `panda.config.ts` or standalone presets rather than inline `cva`.
- **Rationale**: Config recipes are compiled into the static stylesheet ahead of time, reducing bundle size and speeding up runtime execution.

```ts
// ✅ Best Practice: panda.config.ts
export default defineConfig({
  theme: {
    extend: {
      recipes: {
        badge: defineRecipe({
          className: 'badge',
          base: { px: '2', py: '0.5', rounded: 'md' },
          variants: {
            status: {
              success: { bg: 'green.100', color: 'green.800' },
              error: { bg: 'red.100', color: 'red.800' },
            },
          },
        }),
      },
    },
  },
});
```

#### Rule 7: Use Slot Recipes (`sva`) for Multi-Part Components
- **Principle**: Whenever a component has two or more elements that coordinate styling, use `sva`.
- **Rationale**: Prevents prop drilling and keeps all sub-element styling synchronized under a single variant API.

```tsx
// ✅ Best Practice
export const alertRecipe = sva({
  slots: ['root', 'icon', 'title', 'description'],
  base: {
    root: { p: '4', rounded: 'lg', display: 'flex', gap: '3' },
    title: { fontWeight: 'bold' },
    description: { textStyle: 'body.sm' },
  },
});
```

#### Rule 8: Always Specify `defaultVariants` on Recipes
- **Principle**: Declare explicit default variants for every recipe.
- **Rationale**: Prevents undefined class lookups and guarantees visual predictability if props are omitted.

```ts
// ✅ Best Practice
export const buttonRecipe = cva({
  // ...
  defaultVariants: {
    variant: 'solid',
    size: 'md',
  },
});
```

#### Rule 9: Leverage `compoundVariants` for Cross-Variant Overrides
- **Principle**: Use `compoundVariants` rather than nested conditionals to style combinations of variants.
- **Rationale**: Declarative, readable, and automatically extracted into dedicated compound selectors.

```ts
// ✅ Best Practice
compoundVariants: [
  {
    variant: 'outline',
    tone: 'danger',
    css: { borderColor: 'red.500', color: 'red.600' },
  },
]
```

#### Rule 10: Use `splitVariantProps` in Custom Component Wrappers
- **Principle**: Always use `recipe.splitVariantProps(props)` to separate variant props from HTML DOM attributes.
- **Rationale**: Prevents custom styling props from leaking into HTML DOM elements.

```tsx
// ✅ Best Practice
export function Badge(props: BadgeProps) {
  const [variantProps, htmlProps] = badgeRecipe.splitVariantProps(props);
  return <span className={badgeRecipe(variantProps)} {...htmlProps} />;
}
```

---

### Category 3: Tokens, Semantic Tokens & Theming

#### Rule 11: Never Hardcode Raw Color Hex Values in Component Code
- **Principle**: Reference semantic tokens or base palette tokens exclusively.
- **Rationale**: Enables automatic dark mode switching, multi-brand adaptability, and theme governance.

```tsx
// ❌ Anti-Pattern
const card = css({ bg: '#ffffff', color: '#111827' });

// ✅ Best Practice
const card = css({ bg: 'bg.surface', color: 'text.primary' });
```

#### Rule 12: Structure Semantic Tokens with `base` and `_dark` Modes
- **Principle**: Define semantic tokens with condition-aware values in `panda.config.ts`.
- **Rationale**: Panda transforms these into mode-switching CSS Custom Properties attached to cascade layers.

```ts
// ✅ Best Practice: panda.config.ts
semanticTokens: {
  colors: {
    bg: {
      canvas: {
        value: { base: '{colors.gray.50}', _dark: '{colors.gray.950}' },
      },
    },
  },
}
```

#### Rule 13: Group Typography into Semantic `textStyles`
- **Principle**: Standardize typography using `defineTextStyles`.
- **Rationale**: Prevents mismatched font sizes and line heights across different developers.

```tsx
// ❌ Anti-Pattern
<p className={css({ fontSize: '14px', lineHeight: '20px', fontFamily: 'Inter' })}>Text</p>

// ✅ Best Practice
<p className={css({ textStyle: 'body.md' })}>Text</p>
```

#### Rule 14: Encapsulate Surfaces into `layerStyles`
- **Principle**: Bundle borders, shadows, backgrounds, and backdrops into reusable surface presets.
- **Rationale**: Enforces consistent elevation and depth throughout the entire user interface.

```tsx
// ✅ Best Practice
<div className={css({ layerStyle: 'surface.card', p: '6' })}>Card Content</div>
```

#### Rule 15: Use `token()` Helper When Interfacing with External Canvas/SVG APIs
- **Principle**: Use `token('colors.blue.500')` for Canvas rendering, WebGL, or chart libraries.
- **Rationale**: Provides type-safe access to resolved CSS variables outside standard HTML markup.

```tsx
// ✅ Best Practice
const stroke = token('colors.blue.500');
```

---

### Category 4: TypeScript Performance & Developer Experience

#### Rule 16: Configure `jsxStyleProps: 'minimal'` in Large Applications
- **Principle**: Consolidate styling props into `css={{ ... }}` on JSX layout elements.
- **Rationale**: Reduces TypeScript compiler memory usage and prevents TSServer autocomplete latency.

```ts
// ✅ Best Practice: panda.config.ts
export default defineConfig({
  jsxStyleProps: 'minimal',
});
```

#### Rule 17: Export Recipe Variant Props with `RecipeVariantProps`
- **Principle**: Use Panda's `RecipeVariantProps<typeof recipe>` to derive component prop types.
- **Rationale**: Eliminates manually maintained TypeScript unions that drift out of sync when recipes change.

```tsx
// ✅ Best Practice
import { type RecipeVariantProps } from 'styled-system/css';
import { buttonRecipe } from './button.recipe';

export type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;
```

#### Rule 18: Use `HTMLStyledProps<'tag'>` for Component Interfaces
- **Principle**: Extend `HTMLStyledProps<'element'>` when building custom styled primitives.
- **Rationale**: Provides full HTML attribute coverage, ref types, and Panda styling props in a single interface.

```tsx
// ✅ Best Practice
import { type HTMLStyledProps } from 'styled-system/jsx';

export interface InputProps extends HTMLStyledProps<'input'> {
  label: string;
}
```

#### Rule 19: Filter Custom Props with `shouldForwardProp`
- **Principle**: Supply a filter predicate when creating components that accept non-HTML props.
- **Rationale**: Keeps the DOM clean and prevents browser warnings regarding unrecognized HTML attributes.

```tsx
// ✅ Best Practice
export const BoxWithTracking = styled('div', undefined, {
  shouldForwardProp: (prop) => !['trackingKey', 'isFeatureActive'].includes(prop),
});
```

#### Rule 20: Keep `styled-system` Committed or Generated in CI Early
- **Principle**: Generate `styled-system` before running typecheck or build tasks in CI.
- **Rationale**: Prevents TypeScript errors in CI environments where generated types do not yet exist on disk.

```json
// package.json
"scripts": {
  "prepare": "panda codegen",
  "build": "panda && tsc --noEmit && next build"
}
```

---

### Category 5: Monorepo & Scalable Architecture

#### Rule 21: Distribute Design Systems via `definePreset`
- **Principle**: Package tokens, layer styles, and recipes into a standalone preset package.
- **Rationale**: Enables seamless versioning, testing, and sharing across multiple web applications.

```ts
// packages/preset/src/index.ts
export const acmePreset = definePreset({
  name: '@acme/preset',
  theme: { /* ... */ },
});
```

#### Rule 22: Use `importMap` for Centralized `@acme/styled-system`
- **Principle**: Point `importMap` to a workspace package to unify imports across apps and UI libraries.
- **Rationale**: Avoids relative `../../styled-system` import paths and ensures all packages share a single codegen target.

```ts
// panda.config.ts
export default defineConfig({
  importMap: '@acme/styled-system',
});
```

#### Rule 23: Include All Component Package Paths in App `include` Globs
- **Principle**: When using app-level extraction, ensure `include` scans all shared package directories.
- **Rationale**: Prevents missing styles for shared components that are consumed by the app.

```ts
// apps/web/panda.config.ts
export default defineConfig({
  include: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
});
```

#### Rule 24: Use `panda ship` for Pre-Compiled Library Distribution
- **Principle**: Generate `panda.buildinfo.json` when building UI packages for external consumers.
- **Rationale**: Consumer applications extract library styles instantaneously without re-parsing raw source files inside `node_modules`.

```bash
# In UI package build pipeline
panda emit --artifacts
```

#### Rule 25: Cache Codegen Tasks in Turborepo (`turbo.json`)
- **Principle**: Configure `turbo.json` with strict inputs and outputs for `codegen`.
- **Rationale**: Guarantees instant sub-second builds when configuration and preset files have not changed.

```json
// turbo.json
{
  "pipeline": {
    "codegen": {
      "inputs": ["panda.config.ts", "packages/preset/src/**"],
      "outputs": ["styled-system/**", "packages/styled-system/**"],
      "cache": true
    }
  }
}
```
