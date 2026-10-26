# Module 05: Atomic Recipes (cva)

Atomic recipes provide a type-safe, declarative mechanism to define multi-variant component styles in Panda CSS. Built upon the Class Variance Authority (CVA) pattern and exported directly from `styled-system/css`, `cva` lets you define base styles, orthogonal variant dimensions, default variants, and compound variant overrides in a single co-located structure. This module covers everything required to architect robust, scalable component APIs with atomic recipes.

---

## Lesson 5.1: Introduction to Recipes

Components in design systems inevitably evolve beyond single-style elements. A button requires visual treatments (solid, outline, ghost), multiple sizes (sm, md, lg), and state-specific overrides. Without a structured pattern, teams resort to ad-hoc string concatenation, nested ternary operators, or disparate helper functions.

Consider the common anti-pattern of managing variant styles through manual template literals or utility functions like `clsx` and `tailwind-merge`:

### ❌ Anti-Pattern: Ad-Hoc Conditional Classes and Ternaries

```tsx
// ❌ Anti-Pattern: Brittle, un-typed, prone to specificity bugs and missing variants
import { css } from 'styled-system/css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isFullWidth?: boolean;
}

export function Button({ variant = 'solid', size = 'md', isFullWidth, className, ...props }: ButtonProps) {
  const baseClass = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'semibold',
    cursor: 'pointer',
  });

  const variantClass = css(
    variant === 'solid'
      ? { bg: 'blue.600', color: 'white', _hover: { bg: 'blue.700' } }
      : variant === 'outline'
      ? { border: '1px solid', borderColor: 'blue.600', color: 'blue.600' }
      : { bg: 'transparent', color: 'blue.600', _hover: { bg: 'blue.50' } }
  );

  const sizeClass = css(
    size === 'sm'
      ? { px: '3', h: '8', fontSize: 'xs' }
      : size === 'lg'
      ? { px: '6', h: '12', fontSize: 'lg' }
      : { px: '4', h: '10', fontSize: 'sm' }
  );

  const widthClass = isFullWidth ? css({ w: 'full' }) : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${className ?? ''}`}
      {...props}
    />
  );
}
```

This manual approach exhibits critical flaws:
1. **No single source of truth**: The TypeScript interface and the style calculation logic can drift out of sync if an author adds a variant to props without handling it in the style mapping.
2. **Compound styling nightmare**: Handling combinations—such as removing padding when `variant="link"` regardless of `size`—requires nested conditionals inside the render function.
3. **No runtime introspection**: Consumers cannot inspect variant options or extract variant props automatically.
4. **Poor ergonomics**: Combining generated classnames manually introduces runtime string operations and potential duplicate class keys.

### ✅ Best Practice: Declarative Atomic Recipes with `cva`

Panda CSS provides `cva` (Class Variance Authority) from `styled-system/css` to solve these challenges with compile-time type safety and static style extraction:

```tsx
// ✅ Best Practice: Declarative, strictly typed, zero-runtime overhead recipe
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'semibold',
    borderRadius: 'md',
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
    _disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  variants: {
    visual: {
      solid: { bg: 'blue.600', color: 'white', _hover: { bg: 'blue.700' } },
      outline: { border: '1px solid', borderColor: 'blue.600', color: 'blue.600', _hover: { bg: 'blue.50' } },
      ghost: { bg: 'transparent', color: 'blue.600', _hover: { bg: 'blue.50' } },
    },
    size: {
      sm: { px: '3', h: '8', fontSize: 'xs' },
      md: { px: '4', h: '10', fontSize: 'sm' },
      lg: { px: '6', h: '12', fontSize: 'lg' },
    },
    fullWidth: {
      true: { w: 'full' },
      false: { w: 'auto' },
    },
  },
  defaultVariants: {
    visual: 'solid',
    size: 'md',
    fullWidth: false,
  },
});

export type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;
```

Calling `buttonRecipe({ visual: 'outline', size: 'lg' })` returns a clean, deduplicated atomic class string. The static scanner in Panda extracts all referenced classes ahead of time, ensuring optimal bundle size with zero runtime CSS-in-JS injection.

---

## Lesson 5.2: Thinking in Recipes

Designing an atomic recipe requires deconstructing the visual states and dimensions of a UI component into orthogonal axes. A well-designed recipe consists of four distinct sections:

1. **`base`**: Non-negotiable foundational styles applied to every instance of the component regardless of variant configuration. This includes layout primitives (`display`, `alignItems`, `justifyContent`), foundational resets, transition tokens, and base interactive states (`_focusVisible`, `_disabled`).
2. **`variants`**: Independent axes of variation. Each key represents a dimension, and each value is an object mapping variant values to Panda style objects. Variant dimensions should remain orthogonal—meaning the `size` dimension should dictate dimensions, padding, and typography, while the `visual` dimension dictates colors, borders, and shadows.
3. **`defaultVariants`**: The baseline configuration applied whenever an author omits specific variant props. Explicit default variants eliminate `undefined` checks and prevent visual regressions.
4. **`compoundVariants`**: Target specific intersections where two or more variant values collide and require specialized styling that neither variant should own independently.

```
┌────────────────────────────────────────────────────────┐
│                      cva Structure                     │
├────────────────────────────────────────────────────────┤
│ base: { display, alignItems, transition, focusRing }   │
├────────────────────────────────────────────────────────┤
│ variants:                                              │
│   ├── visual:    [ solid | subtle | outline | ghost ]  │
│   ├── size:      [ sm | md | lg ]                      │
│   └── fullWidth: [ true | false ]                      │
├────────────────────────────────────────────────────────┤
│ defaultVariants: { visual: 'solid', size: 'md' }       │
├────────────────────────────────────────────────────────┤
│ compoundVariants:                                      │
│   └── [ visual='outline' + size='lg' ] -> { border: 2 }│
└────────────────────────────────────────────────────────┘
```

Keeping axes orthogonal ensures that your design system scales linearly. When dimensions cross concerns—such as adding a `visual="dangerOutlineLarge"` variant—the variant matrix becomes unmaintainable.

---

## Lesson 5.3: Creating a `badge` Recipe

Badges are compact status indicators that require multiple visual aesthetics (solid fills, subtle tint fills, crisp outlines, elevated surface treatments), varying scales, and pill or rounded-rectangle shapes.

Here is the complete implementation of a production-grade `badgeRecipe` using `cva`:

```typescript
// styled-system/recipes/badge.ts or src/components/Badge/badge.recipe.ts
import { cva } from 'styled-system/css';

export const badgeRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5',
    fontWeight: 'medium',
    textTransform: 'uppercase',
    letterSpacing: 'wider',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    verticalAlign: 'middle',
    lineHeight: '1',
  },
  variants: {
    visual: {
      solid: {
        bg: 'gray.800',
        color: 'white',
      },
      subtle: {
        bg: 'gray.100',
        color: 'gray.800',
      },
      outline: {
        bg: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.300',
        color: 'gray.700',
      },
      surface: {
        bg: 'white',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.200',
        color: 'gray.800',
        boxShadow: 'xs',
      },
    },
    size: {
      sm: {
        px: '1.5',
        py: '0.5',
        fontSize: '2xs',
        borderRadius: 'xs',
      },
      md: {
        px: '2',
        py: '1',
        fontSize: 'xs',
        borderRadius: 'sm',
      },
      lg: {
        px: '2.5',
        py: '1.5',
        fontSize: 'sm',
        borderRadius: 'md',
      },
    },
    pill: {
      true: {
        borderRadius: 'full',
      },
      false: {},
    },
  },
  defaultVariants: {
    visual: 'subtle',
    size: 'md',
    pill: false,
  },
});
```

Notice the handling of boolean variants: `pill: { true: { borderRadius: 'full' }, false: {} }`. When consumers pass `pill: true`, the fully rounded border radius overrides the size-specific `borderRadius` due to compound rule resolution in CSS specificity.

---

## Lesson 5.4: Using Virtual Colors (`colorPalette`)

The single most common scalability bottleneck in component recipes is color proliferation. If a badge supports 4 visual treatments (`solid`, `subtle`, `outline`, `surface`) across 8 brand colors (`blue`, `emerald`, `amber`, `rose`, `purple`, `cyan`, `indigo`, `slate`), a naive recipe requires defining $4 \times 8 = 32$ manual variant styles:

### ❌ Anti-Pattern: Explicit Combinatorial Color Variants

```typescript
// ❌ Anti-Pattern: Explosion of variant keys (32+ variations)
export const badgeRecipe = cva({
  variants: {
    visual: {
      'solid-blue': { bg: 'blue.600', color: 'white' },
      'solid-emerald': { bg: 'emerald.600', color: 'white' },
      'solid-rose': { bg: 'rose.600', color: 'white' },
      'subtle-blue': { bg: 'blue.100', color: 'blue.800' },
      'subtle-emerald': { bg: 'emerald.100', color: 'emerald.800' },
      'subtle-rose': { bg: 'rose.100', color: 'rose.800' },
      // ... dozens more repetitious blocks
    },
  },
});
```

### ✅ Best Practice: Virtual Token Referencing with `colorPalette`

Panda CSS solves combinatorial styling with **Virtual Color Tokens** via the `colorPalette` feature. When you reference `colorPalette.<scale>` inside your recipe definitions, Panda automatically generates CSS variables that map dynamically to whatever palette name is passed to the component:

```typescript
// ✅ Best Practice: Orthogonal visual treatments backed by virtual color tokens
import { cva } from 'styled-system/css';

export const dynamicBadgeRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5',
    fontWeight: 'medium',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  variants: {
    visual: {
      solid: {
        bg: 'colorPalette.600',
        color: 'white',
      },
      subtle: {
        bg: 'colorPalette.50',
        color: 'colorPalette.700',
        _dark: {
          bg: 'colorPalette.950',
          color: 'colorPalette.300',
        },
      },
      outline: {
        bg: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.300',
        color: 'colorPalette.700',
        _dark: {
          borderColor: 'colorPalette.700',
          color: 'colorPalette.200',
        },
      },
      surface: {
        bg: 'white',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.200',
        color: 'colorPalette.800',
        boxShadow: 'xs',
        _dark: {
          bg: 'colorPalette.900',
          borderColor: 'colorPalette.800',
          color: 'colorPalette.100',
        },
      },
    },
    size: {
      sm: { px: '1.5', py: '0.5', fontSize: '2xs', borderRadius: 'xs' },
      md: { px: '2', py: '1', fontSize: 'xs', borderRadius: 'sm' },
      lg: { px: '2.5', py: '1.5', fontSize: 'sm', borderRadius: 'md' },
    },
    pill: {
      true: { borderRadius: 'full' },
      false: {},
    },
  },
  defaultVariants: {
    visual: 'subtle',
    size: 'md',
    pill: false,
  },
});
```

Under the hood, referencing `colorPalette.600` compiles to the CSS variable `var(--colors-color-palette-600)`. When invoked:

```typescript
// Consumer assigns the palette dynamically
const className = dynamicBadgeRecipe({ visual: 'solid', colorPalette: 'emerald' });
```

Panda applies utility classes that define `--colors-color-palette-600: var(--colors-emerald-600)` at the DOM node level. The recipe stays concise, support for new palette colors requires zero recipe edits, and bundle size remains minimal.

---

## Lesson 5.5: Compound Variants

Compound variants allow you to inject specific overrides when multiple variant criteria are satisfied at the same time. This is essential for resolving edge-case visual bugs, adjusting borders, or fine-tuning dimensions.

Consider an outline badge: at size `lg`, a 1px border looks fragile compared to the larger typography, so we want a 2px border. Additionally, for both `subtle` and `surface` variants at size `sm`, padding needs slight contraction:

```typescript
import { cva } from 'styled-system/css';

export const badgeWithCompounds = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: '1',
  },
  variants: {
    visual: {
      solid: { bg: 'colorPalette.600', color: 'white' },
      subtle: { bg: 'colorPalette.100', color: 'colorPalette.800' },
      outline: { borderWidth: '1px', borderColor: 'colorPalette.400', color: 'colorPalette.700' },
      surface: { bg: 'white', borderWidth: '1px', borderColor: 'colorPalette.200', color: 'colorPalette.800' },
    },
    size: {
      sm: { px: '2', py: '0.5', fontSize: 'xs' },
      md: { px: '2.5', py: '1', fontSize: 'sm' },
      lg: { px: '3.5', py: '1.5', fontSize: 'md' },
    },
  },
  compoundVariants: [
    // Condition 1: Increase border thickness when visual is outline AND size is lg
    {
      visual: 'outline',
      size: 'lg',
      css: {
        borderWidth: '2px',
        fontWeight: 'bold',
      },
    },
    // Condition 2: Array matching across multiple variants simultaneously
    {
      visual: ['subtle', 'surface'],
      size: 'sm',
      css: {
        px: '1.5',
        letterSpacing: 'tight',
      },
    },
  ],
  defaultVariants: {
    visual: 'subtle',
    size: 'md',
  },
});
```

Panda analyzes `compoundVariants` and generates atomic classes guarded by compound conditions. When the consumer invokes `badgeWithCompounds({ visual: 'outline', size: 'lg' })`, the generated class string includes both the base styles, the respective variant styles, and the compound override classes.

---

## Lesson 5.6: Converting to a Reusable JSX Component

To deliver an atomic recipe to application developers, wrap the recipe in a fully typed React component that supports `ref` forwarding, accepts an optional `css` override prop, and prevents variant props from leaking into the underlying DOM attributes.

### Type Extraction with `RecipeVariantProps`

Panda provides the `RecipeVariantProps<T>` utility type to infer the accepted variant props from the recipe definition. In addition, atomic recipes accept a `colorPalette` property:

```typescript
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const badgeRecipe = cva({
  /* ... */
});

// Infer variant types: { visual?: 'solid' | 'subtle' | 'outline' | 'surface'; size?: 'sm' | 'md' | 'lg'; pill?: boolean; }
export type BadgeVariants = RecipeVariantProps<typeof badgeRecipe>;
```

### Writing the `<Badge>` Component

When writing atomic components, separate variant props from native HTML props so the DOM element receives only valid HTML attributes:

```tsx
// src/components/Badge/Badge.tsx
import * as React from 'react';
import { css, cx } from 'styled-system/css';
import type { SystemStyleObject } from 'styled-system/types';
import { badgeRecipe, type BadgeVariants } from './badge.recipe';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeVariants {
  /** Optional style override using Panda CSS system style object */
  css?: SystemStyleObject;
  /** Virtual color palette name */
  colorPalette?: string;
  children?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { visual, size, pill, colorPalette, className, css: cssProp, children, ...htmlProps },
  ref
) {
  // 1. Generate recipe class string with extracted variant props
  const recipeClass = badgeRecipe({
    visual,
    size,
    pill,
    colorPalette,
  });

  // 2. Resolve ad-hoc css override prop if provided
  const overrideClass = cssProp ? css(cssProp) : undefined;

  // 3. Compose classes using cx helper
  const combinedClassName = cx(recipeClass, overrideClass, className);

  return (
    <span ref={ref} className={combinedClassName} {...htmlProps}>
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';
```

This pattern ensures:
- **Strict prop typing**: IntelliSense autocomplete for all variants (`visual`, `size`, `pill`, `colorPalette`).
- **Clean DOM output**: No invalid `visual="subtle"` or `pill="true"` attributes emitted onto the HTML `<span>`.
- **Composability**: Consumers can pass standard `className` or Panda `css={{ ... }}` objects for edge-case overrides without breaking encapsulation.

---

## Lesson 5.7: Exercise — Multi-Variant Button & IconButton System

Design and build a multi-variant Button component system for an enterprise design system.

### Requirements:
1. Define a `buttonRecipe` using `cva` in `src/components/Button/button.recipe.ts`.
2. Include the following variant axes:
   - `visual`: `'solid'`, `'outline'`, `'subtle'`, `'ghost'`, `'link'`.
   - `size`: `'xs'`, `'sm'`, `'md'`, `'lg'`.
   - `shape`: `'rounded'`, `'pill'`, `'square'`.
3. Support virtual colors via `colorPalette` across all visual variants.
4. Add compound variants:
   - When `visual: 'link'`, remove all `px` padding and set `height: auto` regardless of `size`.
   - When `shape: 'square'`, enforce equal width and height matching the size's height (e.g., `h: '8'`, `w: '8'`, `p: '0'`).
5. Build a `<Button>` React component in `src/components/Button/Button.tsx`:
   - Support `loading` (shows an accessible spinner and sets `aria-busy="true"`).
   - Support `leftIcon` and `rightIcon` slots.
   - Forward `ref` to the native `<button>` element.
   - When `loading` is true, prevent user interaction while preserving button layout dimensions.

---

## Lesson 5.8: Solution — Production Button Component with Loading, Icons & Virtual Colors

Here is the complete production solution:

### 1. Recipe Definition (`src/components/Button/button.recipe.ts`)

```typescript
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontWeight: 'medium',
    userSelect: 'none',
    verticalAlign: 'middle',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    outline: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    textDecoration: 'none',
    _focusVisible: {
      ring: '2px',
      ringColor: 'colorPalette.500',
      ringOffset: '2px',
    },
    _disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
      pointerEvents: 'none',
      boxShadow: 'none',
    },
  },
  variants: {
    visual: {
      solid: {
        bg: 'colorPalette.600',
        color: 'white',
        _hover: { bg: 'colorPalette.700' },
        _active: { bg: 'colorPalette.800' },
      },
      outline: {
        bg: 'transparent',
        borderColor: 'colorPalette.600',
        color: 'colorPalette.700',
        _hover: { bg: 'colorPalette.50' },
        _active: { bg: 'colorPalette.100' },
        _dark: {
          color: 'colorPalette.200',
          borderColor: 'colorPalette.400',
          _hover: { bg: 'colorPalette.950' },
        },
      },
      subtle: {
        bg: 'colorPalette.50',
        color: 'colorPalette.800',
        _hover: { bg: 'colorPalette.100' },
        _active: { bg: 'colorPalette.200' },
        _dark: {
          bg: 'colorPalette.900',
          color: 'colorPalette.100',
          _hover: { bg: 'colorPalette.800' },
        },
      },
      ghost: {
        bg: 'transparent',
        color: 'colorPalette.700',
        _hover: { bg: 'colorPalette.50' },
        _active: { bg: 'colorPalette.100' },
        _dark: {
          color: 'colorPalette.200',
          _hover: { bg: 'colorPalette.900' },
        },
      },
      link: {
        bg: 'transparent',
        color: 'colorPalette.600',
        border: 'none',
        _hover: { textDecoration: 'underline' },
        _active: { color: 'colorPalette.800' },
      },
    },
    size: {
      xs: {
        h: '7',
        minW: '7',
        px: '2',
        fontSize: 'xs',
        gap: '1',
      },
      sm: {
        h: '8',
        minW: '8',
        px: '3',
        fontSize: 'sm',
        gap: '1.5',
      },
      md: {
        h: '10',
        minW: '10',
        px: '4',
        fontSize: 'sm',
        gap: '2',
      },
      lg: {
        h: '12',
        minW: '12',
        px: '6',
        fontSize: 'md',
        gap: '2.5',
      },
    },
    shape: {
      rounded: {
        borderRadius: 'md',
      },
      pill: {
        borderRadius: 'full',
      },
      square: {
        borderRadius: 'md',
        px: '0',
      },
    },
    fullWidth: {
      true: {
        w: 'full',
      },
      false: {
        w: 'auto',
      },
    },
  },
  compoundVariants: [
    // Link variant strips height and minimum width across all sizes
    {
      visual: 'link',
      css: {
        h: 'auto',
        minW: 'auto',
        px: '0',
        py: '0',
      },
    },
    // Square shape enforces strict 1:1 aspect ratio matching height
    {
      shape: 'square',
      size: 'xs',
      css: { w: '7', h: '7', p: '0' },
    },
    {
      shape: 'square',
      size: 'sm',
      css: { w: '8', h: '8', p: '0' },
    },
    {
      shape: 'square',
      size: 'md',
      css: { w: '10', h: '10', p: '0' },
    },
    {
      shape: 'square',
      size: 'lg',
      css: { w: '12', h: '12', p: '0' },
    },
  ],
  defaultVariants: {
    visual: 'solid',
    size: 'md',
    shape: 'rounded',
    fullWidth: false,
  },
});

export type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;
```

### 2. React Component (`src/components/Button/Button.tsx`)

```tsx
import * as React from 'react';
import { css, cx } from 'styled-system/css';
import type { SystemStyleObject } from 'styled-system/types';
import { buttonRecipe, type ButtonVariants } from './button.recipe';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  /** Displays a loading spinner and disables interactions */
  loading?: boolean;
  /** Accessible text announced when loading */
  loadingText?: string;
  /** Element placed before the button children */
  leftIcon?: React.ReactElement;
  /** Element placed after the button children */
  rightIcon?: React.ReactElement;
  /** Virtual color palette */
  colorPalette?: string;
  /** Custom Panda style overrides */
  css?: SystemStyleObject;
}

const spinnerStyle = css({
  animation: 'spin 1s linear infinite',
  display: 'inline-block',
  w: '1em',
  h: '1em',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: 'currentColor',
  borderBottomColor: 'transparent',
  borderRadius: 'full',
});

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    visual,
    size,
    shape,
    fullWidth,
    colorPalette = 'blue',
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    disabled,
    className,
    css: cssProp,
    children,
    ...htmlProps
  },
  ref
) {
  const isInteractionDisabled = disabled || loading;

  const recipeClass = buttonRecipe({
    visual,
    size,
    shape,
    fullWidth,
    colorPalette,
  });

  const overrideClass = cssProp ? css(cssProp) : undefined;

  return (
    <button
      ref={ref}
      disabled={isInteractionDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isInteractionDisabled || undefined}
      className={cx(recipeClass, overrideClass, className)}
      {...htmlProps}
    >
      {loading ? (
        <>
          <span className={spinnerStyle} aria-hidden="true" />
          {loadingText ? <span>{loadingText}</span> : <span className={css({ visibility: 'hidden' })}>{children}</span>}
        </>
      ) : (
        <>
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
```

### 3. Usage Example

```tsx
import { Button } from './Button';
import { Mail, ArrowRight, Trash2 } from 'lucide-react';

export function ButtonDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {/* Virtual color palette used effortlessly */}
      <Button colorPalette="emerald" visual="solid" leftIcon={<Mail size={16} />}>
        Confirm Order
      </Button>

      <Button colorPalette="rose" visual="outline" leftIcon={<Trash2 size={16} />}>
        Delete Account
      </Button>

      {/* Loading state preservation */}
      <Button colorPalette="blue" loading loadingText="Submitting...">
        Submit
      </Button>

      {/* Square icon-only button */}
      <Button colorPalette="purple" visual="subtle" shape="square" aria-label="Next slide">
        <ArrowRight size={18} />
      </Button>
    </div>
  );
}
```
