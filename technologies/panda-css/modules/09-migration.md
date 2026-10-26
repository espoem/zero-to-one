# Module 09: Migrating from Runtime to Static CSS-in-JS

Runtime CSS-in-JS libraries like Styled Components and Emotion dominated React development for years by co-locating styling with component logic. However, as web applications grew larger and React embraced concurrent rendering and Server Components, the performance trade-offs of runtime style calculation became a significant bottleneck. Panda CSS delivers the identical ergonomic developer experience—type safety, component encapsulation, design tokens, and variant composition—while eliminating runtime overhead through compile-time static analysis.

This module provides a comprehensive guide for migrating legacy applications from Styled Components, Emotion, and Stitches to Panda CSS with zero regression, seamless incremental coexistence, and predictable static extraction.

---

## Lesson 9.1: Runtime -> Static CSS-in-JS Mental Model

Understanding the architectural shift between runtime CSS-in-JS and build-time static extraction is essential before writing a single line of migration code.

### The Runtime CSS-in-JS Execution Lifecycle

Libraries such as `styled-components` and `@emotion/react` operate entirely inside the browser's JavaScript execution thread:

1. **Render Trigger**: React renders a component containing styled elements.
2. **Prop Evaluation**: JavaScript executes interpolated functions `(${props => props.color})` on every render cycle.
3. **Hash Computation**: The library concatenates generated CSS rules and runs a hashing algorithm (such as MurmurHash) to produce a unique class name (e.g., `sc-1234abc` or `css-90ab12`).
4. **Style Sheet Injection**: The library checks an internal cache map. If the hash is new, it injects a `<style>` tag into document head or uses `CSSStyleSheet.insertRule()`.
5. **DOM Attachment**: The browser attaches the generated class name to the rendered DOM node.

This model incurs three major costs:
- **Main-Thread Latency**: Computing hashes and string concatenations blocks user interactions and layout updates, especially on low-powered mobile devices or during rapid animations.
- **Style Recalculation Thrashing**: Repeatedly inserting dynamic `<style>` rules forces the browser engine to invalidate style trees and recompute styles across the entire page.
- **Server Components Incompatibility**: React Server Components (RSC) cannot run client-side React contexts, lifecycle hooks, or dynamic style injection inside the streaming server pass.

### The Panda CSS Static Extraction Lifecycle

Panda CSS moves styling completely out of the runtime execution loop:

```
Source Code (.tsx) ──> AST Traversal (ts-morph) ──> Box Evaluation ──> Atomic CSS Generation ──> Output (.css)
```

1. **AST Parsing**: During build time (or Vite/Webpack dev watch), Panda scans source files matching `include` glob patterns and parses code into an Abstract Syntax Tree using `ts-morph`.
2. **Static Evaluation**: Panda evaluates call expressions (`css()`, `cva()`, `sva()`, `styled()`, `<Box>`), resolves object literals, unwraps local constants, and extracts static styling rules.
3. **Atomic CSS Generation**: Panda maps extracted properties to configured design tokens, generates deterministic utility class names, and outputs raw CSS organized into CSS Cascade Layers (`@layer`).
4. **Zero-Runtime Execution**: At runtime, React executes standard lightweight JavaScript functions that concatenate pre-computed static string class names. No `<style>` tags are created, no hashes are computed, and no context providers are needed.

### Bridging the Dynamic Gap: CSS Custom Properties

In runtime libraries, developers frequently interpolated arbitrary JavaScript values directly into template literals:

```tsx
// Runtime CSS-in-JS: Generates a brand-new CSS class and injects a new style rule on every pixel change
const ResizableCard = styled.div<{ width: number; angle: number }>`
  width: ${props => props.width}px;
  transform: rotate(${props => props.angle}deg);
  background: white;
  border-radius: 8px;
`;
```

Because Panda statically extracts CSS at build time, arbitrary numbers cannot be evaluated into fixed class names ahead of time. Instead, Panda leverages CSS Custom Properties (CSS variables) for continuous runtime values while using discrete variants (`cva`) for fixed states.

```tsx
// Panda CSS: Fixed atomic classes with dynamic CSS variable bindings
import { css } from 'styled-system/css';

interface ResizableCardProps {
  width: number;
  angle: number;
  children: React.ReactNode;
}

export function ResizableCard({ width, angle, children }: ResizableCardProps) {
  return (
    <div
      style={
        {
          '--card-width': `${width}px`,
          '--card-angle': `${angle}deg`,
        } as React.CSSProperties
      }
      className={css({
        width: 'var(--card-width)',
        transform: 'rotate(var(--card-angle))',
        bg: 'white',
        rounded: 'lg',
      })}
    >
      {children}
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Attempting runtime template interpolation inside Panda CSS
// The Panda compiler cannot evaluate `props.opacity` at build time; this rule is skipped or breaks extraction.
import { css } from 'styled-system/css';

function FadeBox({ opacity, children }: { opacity: number; children: React.ReactNode }) {
  return (
    <div className={css({ opacity: `${opacity}` })}>
      {children}
    </div>
  );
}

// ✅ Best Practice: Separate discrete states into recipe variants, and bind continuous values via inline CSS variables
import { cva } from 'styled-system/css';

const fadeBoxRecipe = cva({
  base: {
    transition: 'opacity 0.2s ease',
    bg: 'bg.surface',
    p: '4',
  },
  variants: {
    intensity: {
      subtle: { opacity: 0.3 },
      medium: { opacity: 0.6 },
      full: { opacity: 1 },
    },
  },
  defaultVariants: {
    intensity: 'full',
  },
});

function FadeBoxCustom({ dynamicOpacity, children }: { dynamicOpacity: number; children: React.ReactNode }) {
  return (
    <div
      style={{ '--custom-opacity': dynamicOpacity } as React.CSSProperties}
      className={css({
        opacity: 'var(--custom-opacity)',
        transition: 'opacity 0.2s ease',
        bg: 'bg.surface',
        p: '4',
      })}
    >
      {children}
    </div>
  );
}
```

---

## Lesson 9.2: Migrating Styled Components (Part I — Basics & Props)

Styled Components primarily uses tagged template literals attached to the `styled` object (`styled.button`, `styled.div`). Migrating to Panda CSS involves converting template literal styles into structured JavaScript objects and replacing dynamic boolean props with recipe variants.

### Step-by-Step Conversion: Styled Button

Consider a typical Styled Components button with boolean props and theme access:

```tsx
// BEFORE: Styled Components
import styled, { css as scCss } from 'styled-components';

interface ButtonProps {
  $variant?: 'primary' | 'secondary' | 'danger';
  $size?: 'sm' | 'md' | 'lg';
  $fullWidth?: boolean;
}

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  border: 1px solid transparent;
  width: ${props => (props.$fullWidth ? '100%' : 'auto')};

  ${props =>
    props.$size === 'sm' &&
    scCss`
      height: 32px;
      padding: 0 12px;
      font-size: 13px;
    `}

  ${props =>
    (!props.$size || props.$size === 'md') &&
    scCss`
      height: 40px;
      padding: 0 16px;
      font-size: 14px;
    `}

  ${props =>
    props.$variant === 'primary' &&
    scCss`
      background-color: ${props.theme.colors.blue600};
      color: white;
      &:hover {
        background-color: ${props.theme.colors.blue700};
      }
    `}

  ${props =>
    props.$variant === 'danger' &&
    scCss`
      background-color: ${props.theme.colors.red600};
      color: white;
      &:hover {
        background-color: ${props.theme.colors.red700};
      }
    `}
`;
```

In Panda CSS, this logic is modeled declaratively using `cva` (Class Variance Authority pattern) or `styled` with a recipe:

```tsx
// AFTER: Panda CSS Recipe with styled factory
import { styled } from 'styled-system/jsx';
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    rounded: 'md',
    fontWeight: 'medium',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    borderWidth: '1px',
    borderColor: 'transparent',
    outline: 'none',
    _focusVisible: {
      ring: '2px',
      ringColor: 'blue.500',
      ringOffset: '2px',
    },
  },
  variants: {
    variant: {
      primary: {
        bg: 'blue.600',
        color: 'white',
        _hover: { bg: 'blue.700' },
        _active: { bg: 'blue.800' },
      },
      secondary: {
        bg: 'gray.100',
        color: 'gray.900',
        borderColor: 'gray.300',
        _hover: { bg: 'gray.200' },
      },
      danger: {
        bg: 'red.600',
        color: 'white',
        _hover: { bg: 'red.700' },
        _active: { bg: 'red.800' },
      },
    },
    size: {
      sm: { h: '8', px: '3', textStyle: 'xs' },
      md: { h: '10', px: '4', textStyle: 'sm' },
      lg: { h: '12', px: '6', textStyle: 'md' },
    },
    fullWidth: {
      true: { w: 'full' },
      false: { w: 'auto' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    fullWidth: false,
  },
});

export type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;
export const Button = styled('button', buttonRecipe);
```

### Translating Transient Props (`$prop`)

Styled Components uses the dollar prefix (`$prop`) to prevent custom props from forwarding to the underlying HTML DOM node. With Panda CSS's `styled` factory, props defined in your recipe variants are automatically intercepted and consumed by the styling layer; they are never leaked to the DOM element.

If you have custom props that should not reach the DOM, configure `shouldForwardProp`:

```tsx
import { styled } from 'styled-system/jsx';

interface InternalProps {
  analyticsId?: string;
  isCustomState?: boolean;
}

export const ActionButton = styled('button', undefined, {
  shouldForwardProp: (prop) => !['analyticsId', 'isCustomState'].includes(prop),
});
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Retaining Styled Components transient prop naming inside Panda recipes
const badRecipe = cva({
  variants: {
    $isActive: { // Unnecessary dollar prefix that complicates prop types
      true: { bg: 'blue.500' },
    },
  },
});

// ✅ Best Practice: Clean, standard variant keys mapped to idiomatic boolean or string values
const cleanRecipe = cva({
  variants: {
    active: {
      true: { bg: 'blue.500', color: 'white' },
      false: { bg: 'transparent', color: 'gray.700' },
    },
  },
  defaultVariants: {
    active: false,
  },
});
```

---

## Lesson 9.3: Migrating Styled Components (Part II — Attrs, Component Selectors & Global Styles)

Advanced Styled Components features—including `.attrs()`, parent-child component selectors (`${Card}:hover &`), `createGlobalStyle`, and `ThemeProvider`—require specific migration patterns in Panda CSS.

### 1. Migrating `.attrs()`

In Styled Components, `.attrs()` injects static or computed HTML attributes directly into the component definition:

```tsx
// BEFORE: Styled Components .attrs()
const SearchInput = styled.input.attrs(props => ({
  type: 'search',
  'aria-label': props['aria-label'] || 'Search content',
  autoComplete: 'off',
}))`
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
`;
```

In Panda CSS, default HTML attributes are handled using standard React component wrapping or default props:

```tsx
// AFTER: Panda CSS with React default props or component wrapper
import React, { forwardRef } from 'react';
import { styled, type HTMLStyledProps } from 'styled-system/jsx';

const StyledInput = styled('input', {
  base: {
    px: '3',
    py: '2',
    borderWidth: '1px',
    borderColor: 'gray.300',
    rounded: 'md',
    outline: 'none',
    _focus: { borderColor: 'blue.500', ring: '1px', ringColor: 'blue.500' },
  },
});

export interface SearchInputProps extends HTMLStyledProps<'input'> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ type = 'search', 'aria-label': ariaLabel = 'Search content', autoComplete = 'off', ...props }, ref) => {
    return <StyledInput ref={ref} type={type} aria-label={ariaLabel} autoComplete={autoComplete} {...props} />;
  }
);
SearchInput.displayName = 'SearchInput';
```

### 2. Migrating Component Selectors (`${Parent}:hover &`)

Styled Components allows interpolating another styled component into a CSS selector:

```tsx
// BEFORE: Styled Components component interpolation
const ActionIcon = styled.svg`
  fill: #888;
  transition: fill 0.2s;
`;

const CardContainer = styled.div`
  padding: 16px;
  border: 1px solid #eee;

  &:hover ${ActionIcon} {
    fill: #0066cc;
  }
`;
```

Panda CSS does not dynamically inject random component class names into CSS rules. Instead, use Panda's built-in **Group and Peer conditions** or explicit slot selectors:

```tsx
// AFTER: Panda CSS Group Selector
import { css } from 'styled-system/css';

export function CardItem() {
  return (
    <div
      className={css({
        p: '4',
        borderWidth: '1px',
        borderColor: 'gray.200',
        rounded: 'lg',
        cursor: 'pointer',
      }) + ' group'}
    >
      <p className={css({ fontWeight: 'semibold', mb: '2' })}>Card Header</p>
      <svg
        className={css({
          w: '6',
          h: '6',
          fill: 'gray.400',
          transition: 'fill 0.2s ease',
          _groupHover: { fill: 'blue.600' },
        })}
        viewBox="0 0 24 24"
      >
        <path d="M12 4l-8 8h16z" />
      </svg>
    </div>
  );
}
```

### 3. Migrating `createGlobalStyle` to `defineGlobalStyles`

Styled Components uses `createGlobalStyle` inside your React tree:

```tsx
// BEFORE: Styled Components Global Style
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: ${props => props.theme.colors.bg};
    color: ${props => props.theme.colors.text};
  }
`;
```

In Panda CSS, define global styles statically in `panda.config.ts` using `defineGlobalStyles`. They are compiled into the generated `@layer reset, base` stylesheet:

```ts
// AFTER: panda.config.ts
import { defineConfig, defineGlobalStyles } from '@pandacss/dev';

const globalCss = defineGlobalStyles({
  '*, *::before, *::after': {
    boxSizing: 'border-box',
  },
  body: {
    margin: 0,
    fontFamily: 'sans',
    bg: 'bg.canvas',
    color: 'text.primary',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
  },
  'a': {
    color: 'inherit',
    textDecoration: 'none',
  },
});

export default defineConfig({
  globalCss,
  // ...
});
```

### 4. Migrating `ThemeProvider` to Panda Tokens and Semantic Tokens

Styled Components passes tokens through React Context via `<ThemeProvider theme={theme}>`. Every access requires `props.theme.colors.primary`.

In Panda CSS, tokens are transformed into native CSS Custom Properties at compile time. Define base tokens and dark/light semantic tokens in `panda.config.ts`:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  theme: {
    extend: {
      tokens: {
        colors: {
          blue: {
            500: { value: '#3b82f6' },
            600: { value: '#2563eb' },
          },
          gray: {
            100: { value: '#f3f4f6' },
            900: { value: '#111827' },
          },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            canvas: {
              value: {
                base: '{colors.gray.100}',
                _dark: '{colors.gray.900}',
              },
            },
          },
          text: {
            primary: {
              value: {
                base: '{colors.gray.900}',
                _dark: '#ffffff',
              },
            },
          },
        },
      },
    },
  },
});
```

Inside your components, reference tokens directly by path without any runtime theme context wrapper:

```tsx
import { css } from 'styled-system/css';

const containerStyle = css({
  bg: 'bg.canvas', // Resolves to var(--colors-bg-canvas) with automatic light/dark switching
  color: 'text.primary',
  p: '6',
});
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Retaining a React ThemeContext to pass color strings to components
const ThemeContext = React.createContext({ primary: '#2563eb' });

function Card() {
  const theme = useContext(ThemeContext);
  return <div style={{ color: theme.primary }}>Legacy pattern</div>;
}

// ✅ Best Practice: Rely on Panda's semantic tokens and CSS Custom Properties
import { css } from 'styled-system/css';

function Card() {
  return <div className={css({ color: 'text.primary', bg: 'bg.canvas' })}>Modern zero-runtime pattern</div>;
}
```

---

## Lesson 9.4: Migrating Emotion (`css` prop & `@emotion/styled`)

Emotion and Panda CSS share strong conceptual similarities—notably the object syntax and `css` functions. This makes Emotion one of the easiest libraries to migrate, but careful configuration is required to allow both libraries to coexist during an incremental transition.

### The Coexistence Strategy

Large production codebases cannot be rewritten in a single weekend. Emotion and Panda CSS can run simultaneously in the same Next.js or Vite application without style collisions:

1. **Panda CSS Cascade Layers**: Panda emits its rules inside `@layer reset, base, tokens, recipes, utilities`.
2. **Layer Priority**: Unlayered CSS (which Emotion emits by default) automatically takes precedence over layered CSS according to CSS specifications.
3. **Layering Emotion (Optional)**: If you want Panda utility classes to override legacy Emotion rules without `!important`, configure Emotion's `CacheProvider` with a custom stylis plugin or insert `@layer legacy { ... }` around Emotion styles.

```tsx
// app/layout.tsx or pages/_app.tsx
import '../styled-system/styles.css'; // Panda CSS generated cascade layers
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

const emotionCache = createCache({ key: 'legacy-css', prepend: true });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <CacheProvider value={emotionCache}>
      {children}
    </CacheProvider>
  );
}
```

### Migrating Emotion Object Styles to Panda `css()`

Emotion's `css` function and JSX prop use JavaScript objects. Migrating to Panda CSS requires replacing Emotion's pseudo-selectors and token references with Panda's condition syntax and token paths:

```tsx
// BEFORE: Emotion css prop
/** @jsxImportSource @emotion/react */
import { css as emotionCss } from '@emotion/react';

const alertBoxStyle = emotionCss({
  display: 'flex',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  '&:hover': {
    backgroundColor: '#dbeafe',
  },
  '@media (min-width: 768px)': {
    padding: '24px',
  },
});
```

```tsx
// AFTER: Panda CSS css() function
import { css } from 'styled-system/css';

const alertBoxStyle = css({
  display: 'flex',
  alignItems: 'center',
  p: { base: '4', md: '6' }, // Responsive object mapping replaces raw @media
  rounded: 'lg',
  bg: 'blue.50',
  borderWidth: '1px',
  borderColor: 'blue.200',
  _hover: {
    bg: 'blue.100', // Condition replaces '&:hover'
  },
});
```

### Replacing `css.raw()` for Composition

Emotion allows merging style objects by passing arrays to `css={[styleA, styleB]}`. In Panda CSS, `css()` returns a pre-compiled string of class names. If you need to pass raw style objects into higher-order functions or recipes before evaluation, use `css.raw()`:

```tsx
import { css } from 'styled-system/css';

// css.raw() returns the raw typed SystemStyleObject without compiling to class names
const baseCardStyle = css.raw({
  p: '4',
  rounded: 'md',
  bg: 'bg.surface',
});

const elevatedCardStyle = css(baseCardStyle, {
  boxShadow: 'lg',
  borderColor: 'gray.200',
});
```

### Replacing Emotion `keyframes`

Emotion's `keyframes` helper dynamically inserts `@keyframes` into `<head>`. In Panda CSS, keyframes are declared statically in `panda.config.ts` via `defineKeyframes` and referenced by name:

```ts
// panda.config.ts
import { defineConfig, defineKeyframes } from '@pandacss/dev';

export const keyframes = defineKeyframes({
  pulseGlow: {
    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
    '50%': { opacity: '0.6', transform: 'scale(0.98)' },
  },
});

export default defineConfig({
  theme: {
    extend: {
      keyframes,
      tokens: {
        animations: {
          pulse: { value: 'pulseGlow 2s ease-in-out infinite' },
        },
      },
    },
  },
});
```

Inside your component:

```tsx
import { css } from 'styled-system/css';

export function PulsingBadge() {
  return (
    <span
      className={css({
        px: '2',
        py: '1',
        rounded: 'full',
        bg: 'green.500',
        color: 'white',
        animation: 'pulse', // Resolves to the configured animation token
      })}
    >
      Live
    </span>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Combining Emotion @jsxImportSource pragma with Panda CSS
/** @jsxImportSource @emotion/react */
import { css } from 'styled-system/css';

// This results in runtime conflicts between Emotion's JSX factory and Panda class strings
export function BrokenWidget() {
  return <div css={css({ p: '4' })}>Broken</div>;
}

// ✅ Best Practice: Remove Emotion pragma and use standard className or Panda JSX Box
import { css } from 'styled-system/css';

export function WorkingWidget() {
  return <div className={css({ p: '4', bg: 'white', rounded: 'md' })}>Working</div>;
}
```

---

## Lesson 9.5: Migrating Stitches

Panda CSS is the architectural and philosophical successor to Stitches (originally developed by Pedro Duarte and the Modulz team). Stitches pioneered type-safe variants, atomic CSS generation, and near-zero runtime execution. If your team is migrating from Stitches, the mental model is nearly identical, making migration straightforward.

### Direct Concept Mapping

| Stitches Concept | Panda CSS Equivalent | Notes |
| :--- | :--- | :--- |
| `styled('button', { ... })` | `styled('button', cva({ ... }))` or `styled('button', { base: { ... } })` | Directly equivalent structure |
| `css({ ... })` | `css({ ... })` or `cva({ ... })` | Atomic utility extraction |
| `variants` | `variants` | Identical syntax |
| `compoundVariants` | `compoundVariants` | Identical syntax |
| `defaultVariants` | `defaultVariants` | Identical syntax |
| Token prefix (`$colors$blue500`) | Dot notation (`blue.500`) | Clean token identifiers |
| Media queries (`@media (min-width: 640px)`) | Condition keys (`sm:`, `md:`) | First-class responsive syntax |
| `createTheme({ ... })` | `themes` in `panda.config.ts` | Multi-theme support |

### Converting a Stitches Component to Panda CSS

Notice the near 1:1 line translation when converting a Stitches component:

```tsx
// BEFORE: Stitches Component
import { styled } from '../stitches.config';

export const Badge = styled('span', {
  display: 'inline-flex',
  alignItems: 'center',
  fontWeight: '$medium',
  borderRadius: '$pill',

  variants: {
    color: {
      violet: {
        backgroundColor: '$violet100',
        color: '$violet900',
        '&:hover': {
          backgroundColor: '$violet200',
        },
      },
      gray: {
        backgroundColor: '$gray100',
        color: '$gray900',
      },
    },
    size: {
      small: {
        fontSize: '$1',
        padding: '$1 $2',
      },
      large: {
        fontSize: '$2',
        padding: '$2 $4',
      },
    },
  },

  compoundVariants: [
    {
      color: 'violet',
      size: 'large',
      css: {
        boxShadow: '0 0 0 1px $violet300',
      },
    },
  ],

  defaultVariants: {
    color: 'gray',
    size: 'small',
  },
});
```

```tsx
// AFTER: Panda CSS Component
import { styled } from 'styled-system/jsx';
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const badgeRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 'medium',
    rounded: 'full',
  },
  variants: {
    color: {
      violet: {
        bg: 'violet.100',
        color: 'violet.900',
        _hover: {
          bg: 'violet.200',
        },
      },
      gray: {
        bg: 'gray.100',
        color: 'gray.900',
      },
    },
    size: {
      small: {
        fontSize: 'xs',
        px: '2',
        py: '1',
      },
      large: {
        fontSize: 'sm',
        px: '4',
        py: '2',
      },
    },
  },
  compoundVariants: [
    {
      color: 'violet',
      size: 'large',
      css: {
        boxShadow: '0 0 0 1px var(--colors-violet-300)',
      },
    },
  ],
  defaultVariants: {
    color: 'gray',
    size: 'small',
  },
});

export type BadgeVariants = RecipeVariantProps<typeof badgeRecipe>;
export const Badge = styled('span', badgeRecipe);
```

### Token Reference Conversion (`$token` -> Direct Dot Notation)

In Stitches, tokens required a `$` prefix (e.g., `$blue500`, `$space$4`). In Panda CSS:
- Reference tokens directly by string name in style objects: `color: 'blue.500'`, `p: '4'`.
- In raw CSS strings, access CSS variables via `var(--colors-blue-500)` or use the `token()` helper: `boxShadow: '0 0 0 1px {colors.blue.300}'`.

### Replacing Stitches `createTheme`

In Stitches, multi-theme support relied on creating dynamic class names via `createTheme`:

```ts
// BEFORE: Stitches createTheme
export const darkTheme = createTheme('dark-theme', {
  colors: {
    bg: '#000000',
    text: '#ffffff',
  },
});
```

In Panda CSS, multi-theme support is configured declaratively in `panda.config.ts` either via semantic tokens with conditions (`_dark`) or via the `themes` feature:

```ts
// AFTER: panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  themes: {
    dark: {
      tokens: {
        colors: {
          bg: { value: '#000000' },
          text: { value: '#ffffff' },
        },
      },
    },
  },
});
```

In your application markup, apply the theme via data attribute: `<body data-panda-theme="dark">`.

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Leaving Stitches dollar prefix in Panda property values
const badBox = css({
  color: '$blue500', // Treated as literal string "$blue500" instead of resolving the token
  padding: '$4',     // Fails to resolve to var(--spacing-4)
});

// ✅ Best Practice: Use Panda dot notation and token keys
const goodBox = css({
  color: 'blue.500',
  p: '4',
});
```
