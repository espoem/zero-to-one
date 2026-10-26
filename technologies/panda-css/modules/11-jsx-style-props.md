# Module 11: JSX Style Props & JSX Factory

React developers value ergonomic component APIs. Writing inline utility classes or style functions works well for simple leaf elements, but building expressive component libraries often demands JSX-based styling primitives: layout primitives like `<Box>` and `<Stack>`, custom styled elements via `styled.button`, and compound multi-slot components like `<Card.Root>`. Panda CSS includes a powerful JSX engine that provides the developer ergonomics of Chakra UI while preserving 100% build-time static extraction.

This module details how to configure and optimize JSX style props, master the `styled` factory, create variant-driven JSX components, and architect slot-recipe systems using `createStyleContext`.

---

## Lesson 11.1: Introduction to JSX Style Props

Panda CSS can generate native JSX layout components and style props directly in your `styled-system/jsx` directory. Configuring this behavior properly is critical for maintaining high developer velocity and fast TypeScript compilation.

### Configuring JSX in `panda.config.ts`

To enable JSX generation, configure `jsxFramework` in `panda.config.ts`:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'],
  jsxFramework: 'react', // 'react' | 'solid' | 'vue' | 'qwik' | 'preact'
  jsxFactory: 'styled',
  jsxStyleProps: 'minimal', // 'all' | 'minimal' | 'none'
  outdir: 'styled-system',
});
```

When generated, `styled-system/jsx` exports layout patterns:
- `<Box>`: Generic layout container.
- `<Flex>`: Flexbox container with shorthand alignment props (`justify`, `align`, `direction`, `wrap`).
- `<Stack>` / `<HStack>` / `<VStack>`: Layout containers with directional spacing gaps (`gap`, `spaceX`, `spaceY`).
- `<Grid>`: CSS Grid container with grid-specific shortcuts (`columns`, `gap`, `minChildWidth`).
- `<Container>`: Centered horizontal constraint container.
- `<Center>`: Flex container centering children along both axes.

```tsx
import { Flex, Stack, Box, Center } from 'styled-system/jsx';

export function UserProfileCard({ name, role }: { name: string; role: string }) {
  return (
    <Box bg="bg.surface" p="6" rounded="xl" borderWidth="1px" borderColor="border.subtle" maxW="sm">
      <Flex align="center" gap="4">
        <Center w="12" h="12" rounded="full" bg="blue.500" color="white" fontWeight="bold">
          {name.charAt(0)}
        </Center>
        <Stack gap="1">
          <Box fontWeight="semibold" textStyle="body.lg">{name}</Box>
          <Box color="text.muted" textStyle="body.sm">{role}</Box>
        </Stack>
      </Flex>
    </Box>
  );
}
```

### The `jsxStyleProps` Trade-Off: `'all'` vs `'minimal'` vs `'none'`

The `jsxStyleProps` configuration setting controls which style attributes are accepted directly as JSX props:

1. **`jsxStyleProps: 'all'` (Default)**: Every single CSS utility property (`bg`, `p`, `margin`, `display`, `fontSize`, `opacity`, etc.) is typed as a discrete prop on every generated JSX element and styled component (`<Box bg="blue.500" p="4">`).
2. **`jsxStyleProps: 'minimal'`**: Style props are strictly consolidated into a single `css={{ ... }}` prop (`<Box css={{ bg: 'blue.500', p: '4' }}>`).
3. **`jsxStyleProps: 'none'`**: Disables inline styling props entirely on JSX elements, restricting styling to predefined recipe variants and `className`.

### Why `'minimal'` Supercharges Enterprise TypeScript Performance

In large codebases with thousands of JSX elements, `jsxStyleProps: 'all'` poses a significant typechecking challenge for the TypeScript compiler (TSServer). When every `<Box>`, `<Flex>`, and `<styled.div>` declares over 500 individual styling props (each with responsive object support and autocomplete union types), TypeScript must construct and evaluate massive union types for every single JSX tag. This causes noticeable editor latency, slow autocomplete, and protracted CI typecheck times.

Setting `jsxStyleProps: 'minimal'` dramatically slashes TypeScript type-checking time:
- TypeScript evaluates only one object argument (`css?: SystemStyleObject`) per component.
- Autocomplete inside `css={{ ... }}` remains fully typed with all design tokens and conditions.
- Panda's static analysis engine extracts `css={{ ... }}` props with zero loss of capability.

```tsx
// With jsxStyleProps: 'minimal'
import { Box, HStack } from 'styled-system/jsx';

export function DashboardHeader() {
  return (
    <HStack css={{ justify: 'space-between', p: '4', bg: 'bg.canvas', borderBottomWidth: '1px' }}>
      <Box css={{ textStyle: 'heading.h2' }}>Analytics</Box>
      <Box css={{ color: 'text.muted' }}>Last updated: Just now</Box>
    </HStack>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Using jsxStyleProps: 'all' in codebases with 500+ components
// Causes TSServer memory inflation and slow editor completions.

// ✅ Best Practice: Set jsxStyleProps: 'minimal' in panda.config.ts for enterprise scale
// In panda.config.ts:
export default defineConfig({
  jsxStyleProps: 'minimal',
  // ...
});

// In React code:
<Box css={{ p: '4', bg: 'bg.surface', rounded: 'md' }}>Clean and fast</Box>
```

---

## Lesson 11.2: The `styled` JSX Factory

The `styled` factory exported from `styled-system/jsx` allows developers to create custom HTML elements and wrap third-party React components with Panda's styling engine.

### Using `<styled.tag>` Primitives

Panda provides pre-bound factory elements for all standard HTML tags:

```tsx
import { styled } from 'styled-system/jsx';

export function CustomForm() {
  return (
    <styled.form css={{ display: 'flex', flexDirection: 'column', gap: '4', maxW: 'md' }}>
      <styled.label css={{ textStyle: 'body.sm', fontWeight: 'medium' }}>
        Email Address
      </styled.label>
      <styled.input
        type="email"
        placeholder="you@example.com"
        css={{
          px: '3',
          py: '2',
          borderWidth: '1px',
          borderColor: 'gray.300',
          rounded: 'md',
          outline: 'none',
          _focus: { borderColor: 'blue.500', ring: '1px', ringColor: 'blue.500' },
        }}
      />
      <styled.button
        type="submit"
        css={{
          bg: 'blue.600',
          color: 'white',
          py: '2',
          rounded: 'md',
          fontWeight: 'medium',
          cursor: 'pointer',
          _hover: { bg: 'blue.700' },
        }}
      >
        Submit
      </styled.button>
    </styled.form>
  );
}
```

### Wrapping Third-Party Components

Enterprise applications frequently use third-party routing or UI primitives (such as Next.js `Link`, React Router `Link`, or Framer Motion `motion.div`). The `styled()` function wraps any React component, injecting typed styling and recipe support:

```tsx
import NextLink from 'next/link';
import { styled, type HTMLStyledProps } from 'styled-system/jsx';

// Wrap Next.js Link with Panda styling capabilities
export const StyledNextLink = styled(NextLink, {
  base: {
    color: 'blue.600',
    fontWeight: 'medium',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
    _hover: {
      color: 'blue.800',
      textDecoration: 'underline',
    },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'blue.500',
      outlineOffset: '2px',
    },
  },
});

export function NavigationBar() {
  return (
    <nav>
      <StyledNextLink href="/dashboard">Dashboard</StyledNextLink>
    </nav>
  );
}
```

### Filtering Custom Props with `shouldForwardProp`

When wrapping components that accept custom business logic props, you must prevent non-standard HTML attributes from reaching the DOM node:

```tsx
import { styled } from 'styled-system/jsx';

interface BaseToggleProps {
  trackingId?: string;
  isCollapsed?: boolean;
}

export const FilterToggle = styled(
  'button',
  {
    base: {
      px: '4',
      py: '2',
      rounded: 'md',
      cursor: 'pointer',
    },
  },
  {
    shouldForwardProp: (prop: string) => {
      // Forward standard props, filter out internal custom props
      return !['trackingId', 'isCollapsed'].includes(prop);
    },
  }
);
```

### Extracting Typed Component Props

Panda exports the `HTMLStyledProps` utility type to extract HTML and style props for any tag:

```tsx
import React, { forwardRef } from 'react';
import { styled, type HTMLStyledProps } from 'styled-system/jsx';

export interface CustomInputProps extends HTMLStyledProps<'input'> {
  errorMessage?: string;
}

const BaseInput = styled('input', {
  base: {
    px: '3',
    py: '2',
    borderWidth: '1px',
    rounded: 'md',
    outline: 'none',
  },
});

export const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  ({ errorMessage, ...props }, ref) => {
    return (
      <div>
        <BaseInput ref={ref} {...props} />
        {errorMessage && <span style={{ color: 'red' }}>{errorMessage}</span>}
      </div>
    );
  }
);
CustomInput.displayName = 'CustomInput';
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Manually applying css() class strings to third-party components without forwardRef
const UnstyledLink = (props: any) => <NextLink {...props} className={css({ color: 'blue.500' })} />;

// ✅ Best Practice: Wrap third-party components using the styled factory for type-safe props and ref forwarding
export const SafeStyledLink = styled(NextLink, {
  base: { color: 'blue.500', _hover: { textDecoration: 'underline' } },
});
```

---

## Lesson 11.3: Atomic & Config Recipes as JSX Components

Recipes are Panda's first-class mechanism for building multi-variant components. By passing recipes directly to the `styled()` factory, you generate fully typed React components where variant options behave as standard JSX props.

### Binding Recipes to JSX Elements

Pass a `cva` definition directly into `styled(tag, recipe)`:

```tsx
import { styled } from 'styled-system/jsx';
import { cva, type RecipeVariantProps } from 'styled-system/css';

export const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'medium',
    rounded: 'md',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  variants: {
    visual: {
      solid: { bg: 'blue.600', color: 'white', _hover: { bg: 'blue.700' } },
      outline: { borderWidth: '1px', borderColor: 'gray.300', bg: 'transparent', _hover: { bg: 'gray.50' } },
      ghost: { bg: 'transparent', _hover: { bg: 'gray.100' } },
    },
    size: {
      sm: { h: '8', px: '3', textStyle: 'body.sm' },
      md: { h: '10', px: '4', textStyle: 'body.md' },
      lg: { h: '12', px: '6', textStyle: 'body.lg' },
    },
  },
  defaultVariants: {
    visual: 'solid',
    size: 'md',
  },
});

export type ButtonProps = RecipeVariantProps<typeof buttonRecipe> & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = styled('button', buttonRecipe);
```

When consumed in JSX, TypeScript automatically autocompletes `visual` and `size`:

```tsx
export function ActionToolbar() {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {/* Typesafe variant props directly on the JSX element */}
      <Button visual="solid" size="md">Save Changes</Button>
      <Button visual="outline" size="md">Cancel</Button>
      <Button visual="ghost" size="sm">Help</Button>
    </div>
  );
}
```

### Combining Recipe Variants with Ad-Hoc Overrides

Consumer components can leverage recipe defaults while applying one-off layout adjustments via the `css` prop or `className`:

```tsx
export function SubmitArea() {
  return (
    <Button
      visual="solid"
      size="lg"
      css={{
        w: 'full', // Ad-hoc atomic utility overrides or extends the recipe base width
        mt: '4',
      }}
    >
      Complete Order
    </Button>
  );
}
```

### Compiler Tracking of the JSX Factory

When Panda's static analysis engine scans your source files, it specifically tracks imports originating from `styled-system/jsx`. When it encounters `<Button visual="solid" size="lg" />`, it:
1. Recognizes `Button` as an instance of `styled('button', buttonRecipe)`.
2. Extracts the selected variant combinations (`visual: solid`, `size: lg`).
3. Emits the corresponding atomic variant classes into the generated stylesheet at build time.

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Manually calling recipe functions inside every component render
function ActionButton({ visual, size, children }: any) {
  return (
    <button className={buttonRecipe({ visual, size })}>
      {children}
    </button>
  );
}

// ✅ Best Practice: Bind the recipe to styled() once to obtain clean, typed JSX components
export const ActionButton = styled('button', buttonRecipe);
```

---

## Lesson 11.4: Slot Recipes as JSX (`createStyleContext`)

Complex UI components (such as Cards, Modals, Accordions, and Tabs) consist of multiple sub-elements that share a coordinated variant state. For example, changing a `<Card variant="elevated">` may simultaneously adjust the card's outer shadow, header padding, title font weight, and footer border.

Passing variant props down through each child component causes prop-drilling and fragile code. Panda CSS solves this with **Slot Recipes** (`sva`) paired with the **Style Context Pattern**.

### Building the Reusable `createStyleContext` Utility

The `createStyleContext` utility creates a React Context provider and hook that automatically wires slot classes down the tree:

```tsx
// lib/create-style-context.tsx
import React, { createContext, useContext, forwardRef } from 'react';

type GenericSlotRecipe = {
  (props?: Record<string, any>): Record<string, string>;
  splitVariantProps: (props: Record<string, any>) => [Record<string, any>, Record<string, any>];
};

export function createStyleContext<R extends GenericSlotRecipe>(recipe: R) {
  const StyleContext = createContext<Record<string, string> | null>(null);

  function useStyleContext() {
    const context = useContext(StyleContext);
    if (!context) {
      throw new Error('useStyleContext must be used within a StyleContextProvider');
    }
    return context;
  }

  type RootProps = React.HTMLAttributes<HTMLElement> & Parameters<R>[0] & {
    as?: React.ElementType;
    children?: React.ReactNode;
  };

  const withProvider = (Component: React.ElementType, slotName: string) => {
    const Comp = forwardRef<any, RootProps>((props, ref) => {
      const [variantProps, localProps] = recipe.splitVariantProps(props);
      const slotStyles = recipe(variantProps);
      const { as: Tag = Component, className, ...rest } = localProps;

      return (
        <StyleContext.Provider value={slotStyles}>
          <Tag ref={ref} className={`${slotStyles[slotName]} ${className || ''}`} {...rest} />
        </StyleContext.Provider>
      );
    });
    Comp.displayName = `withProvider(${slotName})`;
    return Comp;
  };

  type SubComponentProps = React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    children?: React.ReactNode;
  };

  const withContext = (Component: React.ElementType, slotName: string) => {
    const Comp = forwardRef<any, SubComponentProps>((props, ref) => {
      const slotStyles = useStyleContext();
      const { as: Tag = Component, className, ...rest } = props;

      return (
        <Tag ref={ref} className={`${slotStyles[slotName]} ${className || ''}`} {...rest} />
      );
    });
    Comp.displayName = `withContext(${slotName})`;
    return Comp;
  };

  return {
    withProvider,
    withContext,
    useStyleContext,
  };
}
```

### Implementing a Multi-Slot Card Component

Define the multi-slot recipe using Panda's `sva` (Slot Variance Authority):

```tsx
// components/card/card.recipe.ts
import { sva } from 'styled-system/css';

export const cardRecipe = sva({
  slots: ['root', 'header', 'title', 'description', 'body', 'footer'],
  base: {
    root: {
      rounded: 'xl',
      borderWidth: '1px',
      bg: 'bg.surface',
      overflow: 'hidden',
    },
    header: {
      p: '6',
      borderBottomWidth: '1px',
      borderColor: 'border.subtle',
    },
    title: {
      textStyle: 'heading.h2',
      color: 'text.primary',
    },
    description: {
      textStyle: 'body.sm',
      color: 'text.muted',
      mt: '1',
    },
    body: {
      p: '6',
    },
    footer: {
      p: '6',
      borderTopWidth: '1px',
      borderColor: 'border.subtle',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '3',
    },
  },
  variants: {
    variant: {
      elevated: {
        root: {
          boxShadow: 'lg',
          borderColor: 'transparent',
        },
      },
      outline: {
        root: {
          borderColor: 'border.muted',
          boxShadow: 'none',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'elevated',
  },
});
```

Now, wire the multi-part Card component using `createStyleContext`:

```tsx
// components/card/index.tsx
import { createStyleContext } from '../../lib/create-style-context';
import { cardRecipe } from './card.recipe';

const { withProvider, withContext } = createStyleContext(cardRecipe);

export const Card = {
  Root: withProvider('div', 'root'),
  Header: withContext('header', 'header'),
  Title: withContext('h3', 'title'),
  Description: withContext('p', 'description'),
  Body: withContext('div', 'body'),
  Footer: withContext('footer', 'footer'),
};
```

### Consuming the Compound Component

Consumers write clean, declarative markup without repeating variant props on child nodes:

```tsx
import { Card } from './components/card';
import { Button } from './components/button';

export function InvoiceCard() {
  return (
    <Card.Root variant="elevated">
      <Card.Header>
        <Card.Title>Invoice #1042</Card.Title>
        <Card.Description>Billed to Acme Corporation on Oct 25, 2026</Card.Description>
      </Card.Header>
      <Card.Body>
        <p>Total Amount: $4,500.00 USD</p>
      </Card.Body>
      <Card.Footer>
        <Button visual="outline" size="sm">Download PDF</Button>
        <Button visual="solid" size="sm">Pay Now</Button>
      </Card.Footer>
    </Card.Root>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Prop-drilling variants to every child component in a compound system
<Card.Root variant="elevated">
  <Card.Header variant="elevated">
    <Card.Title variant="elevated">Title</Card.Title>
  </Card.Header>
</Card.Root>

// ✅ Best Practice: Use createStyleContext to provide slot class names implicitly to all descendants
<Card.Root variant="elevated">
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
</Card.Root>
```
