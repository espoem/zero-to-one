# Module 10: Advanced Theming & Multi-Brand Design Systems

Enterprise design systems require more than just a list of raw hexadecimal color values and pixel spacings. Scalable frontends need structured typographic scales, reusable surface treatments, shared animation curves, multi-brand adaptability, and distributable design presets. Panda CSS provides a unified, build-time theming architecture that combines CSS Cascade Layers, CSS Custom Properties, and static extraction to power multi-brand, multi-theme design systems at scale.

This module explores the advanced theming primitives of Panda CSS: Text Styles, Layer Styles, Standalone Presets, Multi-Brand Themes, and Motion Tokens.

---

## Lesson 10.1: Introduction to Panda's Theming Architecture

Panda's theming engine operates on a structured hierarchy of design primitives that compile directly into standard CSS Cascade Layers (`@layer`). Understanding how these layers interact prevents specificity issues and simplifies complex design systems.

### The Theming Layer Cake

A complete Panda CSS theme is composed of six distinct, composable layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Raw Tokens (tokens)                                      │
│    Absolute values: colors.blue.500, spacing.4, radii.md   │
├─────────────────────────────────────────────────────────────┤
│ 2. Semantic Tokens (semanticTokens)                         │
│    Contextual aliases & modes: bg.canvas, text.primary     │
├─────────────────────────────────────────────────────────────┤
│ 3. Text Styles (textStyles)                                 │
│    Composite typography presets: heading.h1, body.md       │
├─────────────────────────────────────────────────────────────┤
│ 4. Layer Styles (layerStyles)                               │
│    Composite surface visual presets: surface.card, glass    │
├─────────────────────────────────────────────────────────────┤
│ 5. Motion Primitives (keyframes & animations)               │
│    Reusable easing curves, durations, keyframe sequences    │
├─────────────────────────────────────────────────────────────┤
│ 6. Multi-Brand Themes (themes)                              │
│    Contextual token overrides: cyberpunk, minimal, corporate│
└─────────────────────────────────────────────────────────────┘
```

### The Role of CSS Cascade Layers

Panda CSS emits all generated styles inside native CSS Cascade Layers to guarantee deterministic precedence regardless of selector ordering:

```css
@layer reset, base, tokens, recipes, utilities;
```

- `@layer reset`: Modern CSS reset rules (box-sizing, margin resets, default list styles).
- `@layer base`: Global element defaults configured via `globalCss` (body background, default typography).
- `@layer tokens`: CSS Custom Properties (`--colors-blue-500`, `--colors-bg-canvas`) attached to `:root` and theme selectors.
- `@layer recipes`: Pre-compiled multi-variant component classes generated from `cva` and `sva` recipes.
- `@layer utilities`: Atomic utility classes generated from `css()` and JSX style props.

Because `@layer utilities` is declared after `@layer recipes`, any atomic utility applied to a component (`<Button className={css({ mt: '4' })}>`) cleanly overrides recipe defaults without needing `!important`.

### Token References: Curly Braces vs Runtime `token()`

Panda provides two mechanisms for referencing design tokens in configuration and runtime code:

1. **Curly Brace Reference Syntax (`{tokens.path}`)**: Used inside `panda.config.ts` for defining semantic tokens, layer styles, and text styles. The compiler automatically translates `{colors.blue.500}` into `var(--colors-blue-500)`.
2. **Runtime `token()` Helper**: Exported from `styled-system/tokens`, this helper resolves a token path to its corresponding CSS variable or raw value inside runtime JavaScript functions or canvas/chart rendering.

```ts
// panda.config.ts: Curly brace token references
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          border: {
            accent: {
              value: {
                base: '{colors.blue.500}',
                _dark: '{colors.blue.300}',
              },
            },
          },
        },
      },
    },
  },
});
```

```tsx
// Component: Runtime token helper usage
import { token } from 'styled-system/tokens';

export function CanvasChart() {
  // Useful for Canvas API, WebGL, or SVG charts that require raw computed values
  const strokeColor = token('colors.blue.500'); // Returns "var(--colors-blue-500)" or fallback
  return <canvas data-stroke={strokeColor} />;
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Hardcoding CSS custom property strings manually
const badCard = css({
  border: '1px solid var(--colors-blue-500)', // Brittle to renames, misses static type checks
  background: '#ffffff',
});

// ✅ Best Practice: Reference tokens using Panda's dot notation or curly brace syntax
const goodCard = css({
  borderColor: 'blue.500',
  bg: 'bg.canvas',
});
```

---

## Lesson 10.2: Typography Styles (`defineTextStyles`)

Individual typography properties (`fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, and `textTransform`) should rarely be applied in isolation. When different developers combine random font sizes with misaligned line heights, visual hierarchy degrades. Text styles group these properties into cohesive typographic presets.

### Defining Typographic Scales with `defineTextStyles`

Define typography presets inside `panda.config.ts` using the type-safe `defineTextStyles` helper:

```ts
// panda.config.ts
import { defineConfig, defineTextStyles } from '@pandacss/dev';

export const textStyles = defineTextStyles({
  display: {
    '2xl': {
      description: 'Hero marketing display titles',
      value: {
        fontFamily: 'sans',
        fontSize: { base: '4xl', md: '6xl' },
        lineHeight: 'tight',
        fontWeight: 'extrabold',
        letterSpacing: 'tighter',
      },
    },
    lg: {
      description: 'Page level display titles',
      value: {
        fontFamily: 'sans',
        fontSize: { base: '3xl', md: '4xl' },
        lineHeight: 'tight',
        fontWeight: 'bold',
        letterSpacing: 'tight',
      },
    },
  },
  heading: {
    h1: {
      description: 'Top-level view headings',
      value: {
        fontFamily: 'sans',
        fontSize: '2xl',
        lineHeight: 'snug',
        fontWeight: 'bold',
        letterSpacing: 'tight',
      },
    },
    h2: {
      description: 'Section headings',
      value: {
        fontFamily: 'sans',
        fontSize: 'xl',
        lineHeight: 'snug',
        fontWeight: 'semibold',
        letterSpacing: 'normal',
      },
    },
  },
  body: {
    lg: {
      description: 'Lead paragraphs and featured body text',
      value: {
        fontFamily: 'sans',
        fontSize: 'lg',
        lineHeight: 'relaxed',
        fontWeight: 'normal',
      },
    },
    md: {
      description: 'Standard application body text',
      value: {
        fontFamily: 'sans',
        fontSize: 'md',
        lineHeight: 'normal',
        fontWeight: 'normal',
      },
    },
    sm: {
      description: 'Captions, helper text, and metadata',
      value: {
        fontFamily: 'sans',
        fontSize: 'sm',
        lineHeight: 'normal',
        fontWeight: 'normal',
      },
    },
  },
  mono: {
    code: {
      description: 'Inline code blocks and terminal snippets',
      value: {
        fontFamily: 'mono',
        fontSize: 'sm',
        lineHeight: 'normal',
        fontWeight: 'medium',
        letterSpacing: 'tight',
      },
    },
  },
});

export default defineConfig({
  theme: {
    extend: {
      textStyles,
    },
  },
});
```

### Applying Text Styles in Components

Once defined, text styles are fully type-checked and accessible via the `textStyle` utility property:

```tsx
import { css } from 'styled-system/css';

export function ArticlePreview() {
  return (
    <article className={css({ maxW: 'prose', p: '6' })}>
      <h1 className={css({ textStyle: 'display.lg', color: 'text.primary', mb: '4' })}>
        Building Scalable Design Systems
      </h1>
      <p className={css({ textStyle: 'body.lg', color: 'text.muted', mb: '6' })}>
        Static analysis enables zero-runtime overhead while preserving component-level encapsulation.
      </p>
      <code className={css({ textStyle: 'mono.code', bg: 'gray.100', px: '2', py: '1', rounded: 'sm' })}>
        pnpm add -D @pandacss/dev
      </code>
    </article>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Manually spreading typography properties across every text element
<h2 className={css({ fontSize: '24px', lineHeight: '32px', fontWeight: '700', letterSpacing: '-0.5px' })}>
  Section Title
</h2>

// ✅ Best Practice: Reference a semantic textStyle preset to ensure design consistency
<h2 className={css({ textStyle: 'heading.h1' })}>
  Section Title
</h2>
```

---

## Lesson 10.3: Layer Styles (`defineLayerStyles`)

While text styles encapsulate typography, **Layer Styles** encapsulate visual surfaces. Properties such as `background`, `border`, `borderColor`, `boxShadow`, `backdropFilter`, and `borderRadius` frequently appear together across cards, dialogs, popovers, and banners. Layer styles bundle these attributes into reusable surface tokens.

### Defining Surfaces with `defineLayerStyles`

Define layer styles inside `panda.config.ts` using `defineLayerStyles`:

```ts
// panda.config.ts
import { defineConfig, defineLayerStyles } from '@pandacss/dev';

export const layerStyles = defineLayerStyles({
  surface: {
    card: {
      description: 'Standard elevated content card surface',
      value: {
        bg: 'bg.surface',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        rounded: 'xl',
        boxShadow: 'sm',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        _hover: {
          boxShadow: 'md',
          borderColor: 'border.muted',
        },
      },
    },
    glass: {
      description: 'Frosted glass floating overlay',
      value: {
        bg: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        borderWidth: '1px',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        rounded: '2xl',
        boxShadow: 'lg',
        _dark: {
          bg: 'rgba(17, 24, 39, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    sunken: {
      description: 'Recessed well for code blocks or form sections',
      value: {
        bg: 'bg.muted',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        rounded: 'lg',
      },
    },
    selected: {
      description: 'Selected row or list item surface',
      value: {
        bg: 'blue.50',
        borderColor: 'blue.500',
        borderWidth: '1px',
        rounded: 'md',
        _dark: {
          bg: 'blue.950',
          borderColor: 'blue.400',
        },
      },
    },
    danger: {
      description: 'Error callout surface',
      value: {
        bg: 'red.50',
        borderColor: 'red.200',
        borderWidth: '1px',
        color: 'red.900',
        rounded: 'md',
        _dark: {
          bg: 'red.950',
          borderColor: 'red.800',
          color: 'red.200',
        },
      },
    },
  },
});

export default defineConfig({
  theme: {
    extend: {
      layerStyles,
    },
  },
});
```

### Applying Layer Styles

Layer styles are applied through the `layerStyle` utility property:

```tsx
import { css } from 'styled-system/css';

export function NavigationHeader() {
  return (
    <header className={css({ layerStyle: 'surface.glass', p: '4', position: 'sticky', top: '0', zIndex: 'banner' })}>
      <nav className={css({ display: 'flex', justify: 'space-between', align: 'center' })}>
        <span className={css({ fontWeight: 'bold' })}>Acme Cloud</span>
      </nav>
    </header>
  );
}

export function PricingCard() {
  return (
    <div className={css({ layerStyle: 'surface.card', p: '8' })}>
      <h3 className={css({ textStyle: 'heading.h2', mb: '2' })}>Pro Tier</h3>
      <p className={css({ textStyle: 'body.md', color: 'text.muted' })}>For scaling engineering organizations.</p>
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Duplicating 6 surface properties across every card and panel
const modalStyle = css({
  bg: 'white',
  borderWidth: '1px',
  borderColor: 'gray.200',
  rounded: 'xl',
  boxShadow: 'xl',
  backdropFilter: 'blur(8px)',
});

// ✅ Best Practice: Encapsulate shared surface treatments inside layerStyles
const modalStyle = css({
  layerStyle: 'surface.glass',
  p: '6',
  maxW: 'lg',
});
```

---

## Lesson 10.4: Creating & Sharing Presets (`definePreset`)

In enterprise architectures or multi-repo teams, design tokens, recipes, and utilities should not be copy-pasted across application repositories. A **Panda Preset** packages tokens, semantic tokens, text styles, layer styles, recipes, slot recipes, conditions, and patterns into a version-controlled, reusable npm module.

### Anatomical Breakdown of a Preset

Use the `definePreset` helper to define a typed preset:

```ts
// packages/preset/src/index.ts
import { definePreset } from '@pandacss/dev';
import { textStyles } from './text-styles';
import { layerStyles } from './layer-styles';
import { buttonRecipe } from './recipes/button';
import { cardSlotRecipe } from './recipes/card';

export const acmePreset = definePreset({
  name: '@acme/panda-preset',
  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {
            50: { value: '#f0fdf4' },
            500: { value: '#22c55e' },
            900: { value: '#14532d' },
          },
        },
        fonts: {
          sans: { value: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' },
          mono: { value: 'JetBrains Mono, monospace' },
        },
      },
      semanticTokens: {
        colors: {
          brand: {
            primary: {
              value: { base: '{colors.brand.500}', _dark: '{colors.brand.50}' },
            },
          },
        },
      },
      textStyles,
      layerStyles,
      recipes: {
        button: buttonRecipe,
      },
      slotRecipes: {
        card: cardSlotRecipe,
      },
    },
  },
  conditions: {
    extend: {
      supportingMotion: '@media (prefers-reduced-motion: no-preference)',
    },
  },
});

export default acmePreset;
```

### Consuming Presets in `panda.config.ts`

Consumer applications import the preset and specify it in their `presets` array:

```ts
// apps/web/panda.config.ts
import { defineConfig } from '@pandacss/dev';
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'],
  presets: [
    '@pandacss/preset-base', // Provides standard layout utilities and reset
    acmePreset,              // Supplies brand design tokens and component recipes
  ],
  outdir: 'styled-system',
  theme: {
    extend: {
      // App-specific token overrides or additions
      tokens: {
        colors: {
          appSpecial: { value: '#ff0055' },
        },
      },
    },
  },
});
```

### Preset Merging Mechanics

When multiple presets are specified, Panda merges them from left to right. Later presets override earlier ones:
- **Tokens and Semantic Tokens**: Deep merged. If a key conflicts, the last preset wins.
- **Recipes and Slot Recipes**: Merged by recipe name.
- **Ejecting Base Preset**: If you want complete control with zero default tokens, omit `@pandacss/preset-base` or pass `eject: true`.

### ❌ Anti-Pattern vs ✅ Best Practice

```ts
// ❌ Anti-Pattern: Copying raw token configuration files across 10 monorepo packages
// If a brand color changes, 10 distinct panda.config.ts files must be updated manually.

// ✅ Best Practice: Publish a single internal preset package and import it across all apps
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  presets: [acmePreset],
  // ...
});
```

---

## Lesson 10.5: Multi-Brand Theming (`themes` in `panda.config.ts`)

Large software companies often operate multiple distinct customer-facing brands (e.g., enterprise portal vs consumer app) or offer white-label theming for B2B customers. Panda CSS supports multi-brand theming natively at build time via the `themes` configuration option.

### Configuring Brand Themes

Brand themes allow overriding base tokens and semantic tokens under scoped theme selectors:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: { value: '#2563eb' },
        surface: { value: '#ffffff' },
      },
    },
  },
  themes: {
    cyberpunk: {
      tokens: {
        colors: {
          brand: { value: '#fcee0a' },
          surface: { value: '#050505' },
        },
      },
      semanticTokens: {
        colors: {
          text: {
            primary: { value: '#00ffff' },
          },
        },
      },
    },
    minimal: {
      tokens: {
        colors: {
          brand: { value: '#171717' },
          surface: { value: '#fafafa' },
        },
      },
      semanticTokens: {
        colors: {
          text: {
            primary: { value: '#262626' },
          },
        },
      },
    },
  },
  staticCss: {
    themes: ['cyberpunk', 'minimal'],
  },
});
```

### Applying Themes via HTML Data Attributes

Panda CSS emits theme overrides scoped to `[data-panda-theme="<themeName>"]`. Activating a theme requires applying this attribute to any parent DOM node:

```tsx
import { useState } from 'react';
import { css } from 'styled-system/css';

type BrandTheme = 'default' | 'cyberpunk' | 'minimal';

export function ThemeSwitcherApp() {
  const [theme, setTheme] = useState<BrandTheme>('default');

  return (
    <div data-panda-theme={theme === 'default' ? undefined : theme} className={css({ minH: '100vh', bg: 'surface', p: '8' })}>
      <div className={css({ display: 'flex', gap: '4', mb: '8' })}>
        <button onClick={() => setTheme('default')} className={css({ px: '4', py: '2', bg: 'brand', color: 'white', rounded: 'md' })}>
          Corporate Default
        </button>
        <button onClick={() => setTheme('cyberpunk')} className={css({ px: '4', py: '2', bg: 'brand', color: 'black', rounded: 'md' })}>
          Cyberpunk
        </button>
        <button onClick={() => setTheme('minimal')} className={css({ px: '4', py: '2', bg: 'brand', color: 'white', rounded: 'md' })}>
          Minimal Mono
        </button>
      </div>

      <h1 className={css({ color: 'brand', textStyle: 'display.lg' })}>
        Adaptive Multi-Brand Design System
      </h1>
    </div>
  );
}
```

### On-Demand Dynamic Theme Loading

When managing dozens of white-label themes, embedding all brand CSS into the initial payload increases bundle size. Panda can generate separate theme CSS artifacts that are loaded on demand:

```ts
// Dynamically importing theme styles in Next.js or Vite
import { getTheme } from 'styled-system/themes';

export async function switchBrandTheme(brandName: 'cyberpunk' | 'minimal') {
  const themeCss = await getTheme(brandName);
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-panda-theme-style', brandName);
  styleEl.textContent = themeCss;
  document.head.appendChild(styleEl);
  document.documentElement.setAttribute('data-panda-theme', brandName);
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Using React state and dynamic CSS strings for brand switching
<div style={{ '--brand-color': brand === 'cyberpunk' ? '#fcee0a' : '#2563eb' } as any}>
  {/* Non-tokenized, non-type-safe styling */}
</div>

// ✅ Best Practice: Use Panda's static themes configuration and data-panda-theme attributes
<div data-panda-theme={currentBrand}>
  <ComponentThatUsesTokens />
</div>
```

---

## Lesson 10.6: Motion & Animation Styles (`defineKeyframes` & Animation Tokens)

Fluid micro-interactions and page transitions require predictable animation tokens and accessible motion control. In Panda CSS, animations are defined at build time using `defineKeyframes` and paired with reusable duration and easing tokens.

### Defining Keyframes and Motion Tokens

Declare keyframe sequences and animation curves inside `panda.config.ts`:

```ts
// panda.config.ts
import { defineConfig, defineKeyframes } from '@pandacss/dev';

export const keyframes = defineKeyframes({
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  slideUp: {
    '0%': { opacity: '0', transform: 'translateY(12px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
});

export default defineConfig({
  theme: {
    extend: {
      keyframes,
      tokens: {
        easings: {
          entrance: { value: 'cubic-bezier(0, 0, 0.2, 1)' },
          exit: { value: 'cubic-bezier(0.4, 0, 1, 1)' },
          bounce: { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
        },
        durations: {
          fast: { value: '150ms' },
          normal: { value: '250ms' },
          slow: { value: '400ms' },
        },
        animations: {
          enter: { value: 'slideUp 250ms cubic-bezier(0, 0, 0.2, 1)' },
          spinner: { value: 'spin 1s linear infinite' },
        },
      },
    },
  },
});
```

### Motion Accessibility: `_motionSafe` and `_motionReduce`

Vestibular disorders make rapid or flashing motion physically disorienting for some users. Panda CSS provides the `_motionSafe` and `_motionReduce` conditions corresponding to `@media (prefers-reduced-motion)`:

```tsx
import { css } from 'styled-system/css';

export function SkeletonLoader() {
  return (
    <div
      className={css({
        w: 'full',
        h: '24',
        rounded: 'lg',
        bg: 'gray.200',
        _motionSafe: {
          animation: 'shimmer 2s infinite linear',
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
          backgroundSize: '200% 100%',
        },
        _motionReduce: {
          animation: 'none',
          opacity: 0.8,
        },
      })}
    />
  );
}

export function DialogModal({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        layerStyle: 'surface.glass',
        p: '6',
        _motionSafe: {
          animation: 'enter',
        },
      })}
    >
      {children}
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Unconditional animation strings without reduced-motion safeguards
<div className={css({ animation: 'spin 1s infinite linear' })}>
  <Spinner />
</div>

// ✅ Best Practice: Respect accessibility preferences using _motionSafe condition
<div className={css({ _motionSafe: { animation: 'spinner' } })}>
  <Spinner />
</div>
```
