# Module 03: Layout Patterns

Layout is the structural backbone of every modern web application. Panda CSS elevates layout construction above manual flexbox and CSS grid declarations through Layout Patterns. Patterns encapsulate recurring spatial relationships into type-safe, ergonomic functions and JSX components that compile directly to atomic CSS at build time. This module covers built-in flexbox and grid patterns, structural layout primitives, container queries (`cq`), authoring custom patterns (`autoflex` and `scrollable`), and constructing a responsive analytics dashboard shell.

---

## Lesson 3.1: Introduction to Layout Patterns

In traditional CSS development, creating standard layouts involves writing repetitive combinations of `display: flex`, `flex-direction`, `align-items`, `justify-content`, and `gap`. Layout patterns in Panda CSS formalize these relationships into structured primitives.

### What Patterns Are

Patterns are predefined layout functions located in `styled-system/patterns` (e.g., `flex`, `stack`, `grid`, `container`). When JSX generation is enabled (`jsxFramework: 'react'` in `panda.config.ts`), Panda also generates corresponding JSX components (e.g., `<Flex>`, `<Stack>`, `<Grid>`, `<Container>`).

Under the hood, layout patterns are not runtime React components with internal layout logic. Instead, they are pure compile-time abstractions. At build time, Panda's static parser evaluates the pattern call or JSX tag and transforms it directly into a standard `css()` atomic class invocation.

```tsx
// Pattern Function Call
import { hstack } from 'styled-system/patterns';
const className = hstack({ gap: '4', justify: 'space-between' });

// Pattern JSX Component (Equally zero-runtime)
import { HStack } from 'styled-system/jsx';
<HStack gap="4" justify="space-between">
  <div>Item 1</div>
  <div>Item 2</div>
</HStack>
```

Both forms compile down to the exact same atomic CSS utility classes:
```css
@layer utilities {
  .d_flex { display: flex; }
  .flex-d_row { flex-direction: row; }
  .ai_center { align-items: center; }
  .gap_4 { gap: var(--spacing-4); }
  .jc_space-between { justify-content: space-between; }
}
```

### When to Use Patterns vs Raw `css()`

- **Use Layout Patterns**: Whenever defining spatial structure, alignments, grids, item flows, aspect ratios, or responsive card arrangements. Patterns make code intent clear and enforce consistent layout rules across a team.
- **Use Raw `css()`**: When styling non-structural visual attributes (backgrounds, borders, shadows, text styles, animations) or when building unique custom components where flex/grid patterns do not apply.

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Re-Declaring Flexbox Boilerplate Repeatedly
```tsx
// ❌ Redundant flex declarations scattered across files
<div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4' })}>
  <div className={css({ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2' })}>
    <span className={css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: '8', h: '8', rounded: 'full' })}>
      1
    </span>
    <span>Step One</span>
  </div>
</div>
```
*Why this fails:* Verbose styling obscures DOM hierarchy and leads to subtle inconsistencies (e.g., one developer using `alignItems: 'center'`, another using `alignItems: 'baseline'`).

#### ✅ Best Practice: Composable Layout Patterns
```tsx
// ✅ Expressive, semantic layout components
import { VStack, HStack, Circle } from 'styled-system/jsx';

<VStack gap="4" align="stretch">
  <HStack gap="2">
    <Circle size="8" bg="brand.100" color="brand.700">1</Circle>
    <span>Step One</span>
  </HStack>
</VStack>
```
*Why this succeeds:* Semantic primitives communicate layout intent immediately, eliminating hundreds of lines of boilerplate while compiling to the exact same zero-runtime atomic CSS.

---

## Lesson 3.2: Flexbox Patterns

Panda CSS provides a comprehensive suite of flexbox-derived patterns designed to solve 1D layout problems.

### Core Flexbox Primitives

| Pattern | Default Behavior | Common Props |
| :--- | :--- | :--- |
| `flex` | `display: flex` | `direction`, `justify`, `align`, `wrap`, `basis`, `grow`, `shrink` |
| `stack` | 1D flow with consistent spacing | `direction`, `gap`, `align`, `justify` |
| `vstack` | Vertical stack (`flex-direction: column`) | `gap`, `align` (defaults to `flex-start` or configurable) |
| `hstack` | Horizontal stack (`flex-direction: row`, `alignItems: center`) | `gap`, `justify` |
| `wrap` | Wrapping flex container (`flex-wrap: wrap`) | `gap`, `rowGap`, `columnGap`, `align`, `justify` |
| `spacer` | Flexible filling element (`flex: 1`) | Preserves fluid gaps between sibling items |
| `center` | Centered container (`align-items: center`, `justify-content: center`) | `inline: boolean` |
| `circle` | Equal-dimension circle (`border-radius: 9999px`) | `size` (sets both `width` and `height`) |
| `square` | Equal-dimension square container | `size` (sets both `width` and `height`) |

### Code Examples: Flexbox in Action

```tsx
import { HStack, VStack, Wrap, Spacer, Center, Circle, Square } from 'styled-system/jsx';
import { css } from 'styled-system/css';

export function NavigationToolbar() {
  return (
    <VStack gap="6" align="stretch" p="6" bg="white" rounded="xl" shadow="sm">
      {/* Horizontal bar with spacer */}
      <HStack gap="4">
        {/* Circle avatar badge */}
        <Circle size="10" bg="brand.600" color="white" fontWeight="bold">
          AG
        </Circle>

        <div>
          <h4 className={css({ fontWeight: 'bold', fontSize: 'sm' })}>Antigravity Project</h4>
          <p className={css({ fontSize: 'xs', color: 'gray.500' })}>Active Development</p>
        </div>

        {/* Spacer pushes subsequent children to the far right edge */}
        <Spacer />

        <HStack gap="2">
          <Square size="8" bg="gray.100" rounded="md" cursor="pointer">
            🔔
          </Square>
          <Square size="8" bg="gray.100" rounded="md" cursor="pointer">
            ⚙️
          </Square>
        </HStack>
      </HStack>

      {/* Wrapping tag list */}
      <Wrap gap="2">
        {['React', 'TypeScript', 'Panda CSS', 'PostCSS', 'Design Tokens'].map((tag) => (
          <span
            key={tag}
            className={css({
              px: '3',
              py: '1',
              rounded: 'full',
              bg: 'gray.100',
              fontSize: 'xs',
              color: 'gray.700',
              fontWeight: 'medium',
            })}
          >
            {tag}
          </span>
        ))}
      </Wrap>
    </VStack>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Using Margin Hacks for Spacing Instead of `Spacer` or `gap`
```tsx
// ❌ Using margin-left: auto or hardcoded margins to push flex items apart
<div className={css({ display: 'flex' })}>
  <div>Logo</div>
  <div className={css({ ml: 'auto' })}>Settings</div>
</div>
```
*Why this fails:* Hardcoded margin overrides couple elements to their current layout order. If another child is placed in between, the margin push breaks.

#### ✅ Best Practice: Semantic `Spacer` and `HStack`
```tsx
// ✅ Explicit layout structure using Spacer
<HStack w="full">
  <div>Logo</div>
  <Spacer />
  <div>Settings</div>
</HStack>
```
*Why this succeeds:* The `Spacer` element expands dynamically with `flex: 1`, leaving child elements independent of directional margin overrides.

---

## Lesson 3.3: Grid & Structural Patterns

CSS Grid handles two-dimensional layouts, complex spanning requirements, and intrinsic sizing. Panda CSS provides grid patterns and structural layout helpers.

### Grid and Structural Primitives

| Pattern | Purpose | Primary Properties |
| :--- | :--- | :--- |
| `grid` | Two-dimensional layout container | `columns` (number or responsive object), `minChildWidth` (auto-fit/fill), `gap` |
| `gridItem` | Explicit positioning within a grid | `colSpan`, `rowSpan`, `colStart`, `colEnd`, `rowStart`, `rowEnd` |
| `container` | Centered layout container with max-width boundaries | `maxW` (defaults to design token size) |
| `bleed` | Breaks children out of container padding boundaries | `inline`, `block` |
| `aspectRatio` | Preserves width-to-height ratio without padding hacks | `ratio` (e.g. `16/9`, `4/3`, `1/1`) |
| `float` | Positions floating overlays (e.g., status badges, close buttons) | `placement` (`top-start`, `top-end`, `bottom-start`, `bottom-end`), `offset` |
| `divider` | Accessible separator line | `orientation` (`horizontal` or `vertical`), `thickness`, `color` |
| `visuallyHidden` | Screen-reader accessible hiding (`sr-only`) | Hides element visually while keeping it readable by assistive technology |
| `linkOverlay` | Makes an entire card clickable while preserving nested links | Used in tandem with `linkBox` (`position: relative`) |

### Responsive Auto-Fit Grid with `minChildWidth`

The `minChildWidth` property eliminates the need for manual media queries when building responsive grids. It compiles to `grid-template-columns: repeat(auto-fit, minmax(minChildWidth, 1fr))`:

```tsx
import { Grid, GridItem } from 'styled-system/jsx';
import { css } from 'styled-system/css';

export function MetricsGrid() {
  return (
    // Automatically creates 1 column on mobile, 2 on tablet, and 4 on desktop
    // based on whether each child can fit 240px!
    <Grid minChildWidth="240px" gap="6">
      <div className={css({ p: '5', bg: 'white', rounded: 'lg', border: '1px solid', borderColor: 'gray.200' })}>
        Metric 1
      </div>
      <div className={css({ p: '5', bg: 'white', rounded: 'lg', border: '1px solid', borderColor: 'gray.200' })}>
        Metric 2
      </div>
      <div className={css({ p: '5', bg: 'white', rounded: 'lg', border: '1px solid', borderColor: 'gray.200' })}>
        Metric 3
      </div>
    </Grid>
  );
}
```

### The `linkOverlay` Pattern for Accessible Clickable Cards

A common UX anti-pattern is wrapping an entire card inside an `<a>` tag. Doing so violates HTML specifications if the card contains other interactive buttons, causes screen readers to read the entire card as one massive link label, and breaks keyboard accessibility.

Panda provides the `linkBox` / `linkOverlay` pattern:
1. Wrap the card in `linkBox` (creates a relative positioning context).
2. Wrap the primary title in `linkOverlay` (its pseudo-element `::before` expands to cover the entire card bounds).
3. Any secondary buttons or links placed inside remain fully clickable without triggering the main link!

```tsx
import { css } from 'styled-system/css';
import { linkBox, linkOverlay } from 'styled-system/patterns';

export function ArticleCard({ title, excerpt, href, authorHref, authorName }: {
  title: string;
  excerpt: string;
  href: string;
  authorHref: string;
  authorName: string;
}) {
  return (
    <article
      className={linkBox({
        p: '6',
        bg: 'white',
        rounded: 'xl',
        borderWidth: '1px',
        borderColor: 'gray.200',
        _hover: { shadow: 'md' },
      })}
    >
      <h3 className={css({ textStyle: 'lg', fontWeight: 'bold' })}>
        {/* Main link expands over entire article card */}
        <a href={href} className={linkOverlay({ color: 'gray.900' })}>
          {title}
        </a>
      </h3>

      <p className={css({ mt: '2', color: 'gray.600', fontSize: 'sm' })}>{excerpt}</p>

      {/* Secondary link: sits above the linkOverlay pseudo-element via position: relative */}
      <div className={css({ mt: '4', position: 'relative', zIndex: 1 })}>
        <a href={authorHref} className={css({ fontSize: 'xs', color: 'brand.600', _hover: { underline: true } })}>
          By {authorName}
        </a>
      </div>
    </article>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Wrapping Entire Components in Anchor Tags
```tsx
// ❌ Invalid HTML: anchor tag wrapping buttons and nested interactive elements
<a href="/post/1" className={css({ display: 'block', p: '4' })}>
  <h3>Title</h3>
  <button onClick={handleBookmark}>Bookmark</button>
</a>
```
*Why this fails:* Clicking the bookmark button triggers navigation, nested links are invalid in HTML5, and screen readers read the entire card payload as a single confusing link title.

#### ✅ Best Practice: Accessible `linkBox` and `linkOverlay`
```tsx
// ✅ Valid HTML, screen-reader friendly, with fully functional nested buttons
<div className={linkBox({ p: '4', position: 'relative' })}>
  <h3>
    <a href="/post/1" className={linkOverlay()}>Title</a>
  </h3>
  <button style={{ position: 'relative', zIndex: 1 }} onClick={handleBookmark}>
    Bookmark
  </button>
</div>
```
*Why this succeeds:* Screen readers announce the heading link accurately. The nested button is isolated on a higher stacking context and functions without triggering navigation.

---

## Lesson 3.4: Container Queries (`cq`)

Viewport media queries evaluate the size of the user's browser window. In modular component-driven design, however, a component does not know if it is rendered in a full-width main view, a narrow two-column split, or a slide-over drawer. Container Queries allow components to adapt according to their parent container's inline width.

### Viewport Queries vs Container Queries

```
 Viewport Query: Evaluates entire window (e.g., 1440px)
 ┌──────────────────────────────────────────────────────────────┐
 │ Window Width: 1440px                                         │
 │                                                              │
 │ ┌───────────────┐  ┌───────────────────────────────────────┐ │
 │ │ Sidebar       │  │ Main Content Area                     │ │
 │ │ Width: 320px  │  │ Width: 1080px                         │ │
 │ │               │  │                                       │ │
 │ │ [Card]        │  │ [Card]                                │ │
 │ │ Needs stacked │  │ Needs horizontal layout               │ │
 │ └───────────────┘  └───────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────────────┘
 Container Query: Each [Card] inspects its direct parent container!
```

### Configuring Container Queries in Panda CSS

Panda provides native container query support via the `cq` pattern and `@` query selectors:

```tsx
import { cq } from 'styled-system/patterns';
import { css } from 'styled-system/css';

// 1. Establish the container context on the parent wrapper
export function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cq({
        name: 'cardContainer',
        type: 'inline-size',
      })}
    >
      {children}
    </div>
  );
}
```

### Querying Containers with Named and Unnamed Selectors

- **Unnamed queries**: `@/sm`, `@/md`, `@/lg` (query the nearest ancestor container).
- **Named queries**: `@cardContainer/sm`, `@cardContainer/md`, `@cardContainer/lg` (explicitly query the named container).

```tsx
export function AdaptiveCard({ title, metric, description }: { title: string; metric: string; description: string }) {
  return (
    <div
      className={css({
        p: '5',
        bg: 'white',
        rounded: 'xl',
        borderWidth: '1px',
        borderColor: 'gray.200',

        // Layout shifts based on CONTAINER width, regardless of browser viewport!
        display: 'flex',
        flexDirection: {
          base: 'column',
          '@cardContainer/md': 'row',
        },
        alignItems: {
          base: 'flex-start',
          '@cardContainer/md': 'center',
        },
        justifyContent: {
          base: 'flex-start',
          '@cardContainer/md': 'space-between',
        },
        gap: '4',
      })}
    >
      <div>
        <h4 className={css({ fontSize: 'sm', color: 'gray.500', fontWeight: 'medium' })}>{title}</h4>
        <p className={css({ textStyle: '2xl', fontWeight: 'bold', color: 'gray.900' })}>{metric}</p>
      </div>

      <p
        className={css({
          fontSize: 'xs',
          color: 'gray.600',
          maxW: { base: 'full', '@cardContainer/md': '200px' },
        })}
      >
        {description}
      </p>
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Using Window Media Queries for Embedded Components
```tsx
// ❌ Component uses viewport media query md (768px)
const card = css({
  flexDirection: { base: 'column', md: 'row' }
});
```
*Why this fails:* When this card is placed inside a narrow 300px sidebar on a 1920px screen, the `md` viewport query evaluates to true, rendering the card horizontally and overflowing the sidebar.

#### ✅ Best Practice: Container Queries via `cq`
```tsx
// ✅ Component queries its actual rendering container
const card = css({
  flexDirection: { base: 'column', '@card/md': 'row' }
});
```
*Why this succeeds:* The card renders vertically in the narrow sidebar and horizontally in the wide main column, even when both instances are visible on screen simultaneously.

---

## Lesson 3.5: Creating an `autoflex` Custom Pattern

While Panda includes standard patterns, real-world design systems require custom domain-specific patterns. An `autoflex` pattern provides a responsive flex container that automatically balances child items, sets uniform minimum widths, and wraps smoothly without manual media queries.

### Defining Custom Patterns with `definePattern`

In `panda.config.ts`, use the `definePattern` helper. You define the pattern's name, description, typed properties, default values, and the `transform` function that converts props into a style object:

```ts
// panda.config.ts
import { defineConfig, definePattern } from '@pandacss/dev';

const autoflexPattern = definePattern({
  name: 'autoflex',
  description: 'A self-wrapping flexbox container that sizes children with automatic minimum widths',
  properties: {
    minItemWidth: { type: 'property', value: 'minWidth' },
    gap: { type: 'property', value: 'gap' },
    justify: { type: 'property', value: 'justifyContent' },
    align: { type: 'property', value: 'alignItems' },
  },
  defaultValues: {
    minItemWidth: '200px',
    gap: '4',
    justify: 'flex-start',
    align: 'stretch',
  },
  transform(props) {
    const { minItemWidth, gap, justify, align, ...rest } = props;
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap,
      justifyContent: justify,
      alignItems: align,
      // Target direct children to enforce flex-grow and min-width
      '& > *': {
        flex: '1 1 0%',
        minWidth: minItemWidth,
      },
      ...rest,
    };
  },
});

export default defineConfig({
  patterns: {
    extend: {
      autoflex: autoflexPattern,
    },
  },
});
```

### Running Codegen & Using the Custom Pattern

Run `npx panda codegen`. Panda extracts the new pattern, generates full TypeScript types, and exports both the `autoflex` function and `<Autoflex>` JSX component:

```tsx
import { autoflex } from 'styled-system/patterns';
import { css } from 'styled-system/css';

export function TagGroup() {
  return (
    <div className={autoflex({ minItemWidth: '160px', gap: '3' })}>
      <div className={css({ p: '3', bg: 'white', rounded: 'md', borderWidth: '1px' })}>Card A</div>
      <div className={css({ p: '3', bg: 'white', rounded: 'md', borderWidth: '1px' })}>Card B</div>
      <div className={css({ p: '3', bg: 'white', rounded: 'md', borderWidth: '1px' })}>Card C</div>
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Ad-Hoc Style Duplication Across Components
Writing custom `& > *` child flex rules in individual components creates inconsistencies and makes global layout updates difficult to coordinate.

#### ✅ Best Practice: Centralized Custom Patterns via `definePattern`
Defining the pattern once in `panda.config.ts` ensures uniform child flex formulas across all applications, complete with TypeScript type checking and IDE autocompletion.

---

## Lesson 3.6: Creating a `scrollable` Custom Pattern

Data tables, navigation tab bars, and Kanban boards require specialized scroll containers with clean scrollbars and smooth scroll-snapping.

### Pattern Definition in `panda.config.ts`

```ts
// panda.config.ts
import { defineConfig, definePattern } from '@pandacss/dev';

const scrollablePattern = definePattern({
  name: 'scrollable',
  description: 'A customizable scroll container with cross-browser scrollbar control and scroll-snapping',
  properties: {
    direction: { type: 'enum', value: ['horizontal', 'vertical', 'both'] },
    hideScrollbar: { type: 'boolean' },
    scrollSnap: { type: 'boolean' },
  },
  defaultValues: {
    direction: 'horizontal',
    hideScrollbar: false,
    scrollSnap: false,
  },
  transform(props) {
    const { direction, hideScrollbar, scrollSnap, ...rest } = props;

    const styles: Record<string, any> = {
      WebkitOverflowScrolling: 'touch',
    };

    if (direction === 'horizontal') {
      styles.overflowX = 'auto';
      styles.overflowY = 'hidden';
    } else if (direction === 'vertical') {
      styles.overflowX = 'hidden';
      styles.overflowY = 'auto';
    } else {
      styles.overflowX = 'auto';
      styles.overflowY = 'auto';
    }

    if (scrollSnap) {
      styles.scrollSnapType = direction === 'vertical' ? 'y mandatory' : 'x mandatory';
      styles['& > *'] = {
        scrollSnapAlign: 'start',
      };
    }

    if (hideScrollbar) {
      // Firefox
      styles.scrollbarWidth = 'none';
      // IE and Edge
      styles.msOverflowStyle = 'none';
      // Webkit (Chrome, Safari)
      styles['&::-webkit-scrollbar'] = {
        display: 'none',
      };
    }

    return {
      ...styles,
      ...rest,
    };
  },
});

export default defineConfig({
  patterns: {
    extend: {
      scrollable: scrollablePattern,
    },
  },
});
```

### Using the `scrollable` Pattern

```tsx
import { scrollable } from 'styled-system/patterns';
import { css } from 'styled-system/css';

export function TabBar({ tabs }: { tabs: string[] }) {
  return (
    <div
      className={scrollable({
        direction: 'horizontal',
        hideScrollbar: true,
        scrollSnap: true,
        gap: '2',
        display: 'flex',
        p: '2',
        bg: 'gray.100',
        rounded: 'lg',
      })}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          className={css({
            px: '4',
            py: '2',
            rounded: 'md',
            bg: 'white',
            fontWeight: 'medium',
            fontSize: 'sm',
            whiteSpace: 'nowrap',
            shadow: 'xs',
          })}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Incomplete Vendor Scrollbar Reset
```tsx
// ❌ Incomplete scrollbar reset that breaks in Firefox
css({
  overflowX: 'auto',
  '&::-webkit-scrollbar': { display: 'none' }, // Only works in Chrome/Safari!
})
```
*Why this fails:* Firefox users will still see an unwanted scrollbar because `scrollbarWidth: 'none'` was omitted.

#### ✅ Best Practice: Universal Cross-Browser `scrollable` Pattern
```tsx
// ✅ Tested across Firefox, Safari, Chrome, and Edge with typed pattern props
scrollable({ direction: 'horizontal', hideScrollbar: true })
```
*Why this succeeds:* Panda's pattern encapsulates cross-engine prefixes (`scrollbarWidth`, `msOverflowStyle`, `::-webkit-scrollbar`) into a single boolean prop.

---

## Lesson 3.7: Exercise — Responsive Analytics Dashboard Shell

### Scenario & Requirements
Build a responsive Analytics Dashboard Shell combining the layout patterns covered in this module.

### Detailed Requirements
1. **App Shell Grid**:
   - Header spanning the full width across the top (`colSpan: 12`).
   - Collapsible/responsive sidebar on the left: hidden on mobile screens (`display: { base: 'none', lg: 'block' }`), spanning 3 columns on desktop.
   - Main content area spanning the remaining 9 columns on desktop (or all 12 columns on mobile).
2. **Horizontal Filter Bar**:
   - Must use the custom `scrollable` pattern with `direction: 'horizontal'`, `hideScrollbar: true`, and `gap: '3'` to allow horizontal scrolling of category filters on mobile devices.
3. **Metric KPI Cards (Container Queries)**:
   - Metric cards must sit inside a container query context (`cq({ name: 'metricCard', type: 'inline-size' })`).
   - When the metric container is wider than `@metricCard/md`, the card content arranges horizontally (`flexDirection: 'row'`); otherwise, it stacks vertically.
4. **Recent Activity Feed (`linkOverlay`)**:
   - A list of recent transaction items.
   - Each item must be an accessible clickable card using `linkBox` and `linkOverlay` pointing to the transaction detail URL, while containing a secondary "Download Invoice" action button that does not trigger card navigation.
5. **Tags Section (`autoflex`)**:
   - Uses the custom `autoflex` pattern with `minItemWidth: '140px'` to arrange status tags cleanly.

### Starter Code Template

```tsx
// src/components/DashboardShell.tsx
import { css } from 'styled-system/css';

export function DashboardShell() {
  // TODO: Implement the responsive analytics dashboard shell
  return null;
}
```

---

## Lesson 3.8: Solution — Complete Dashboard Layout

Here is the complete, production-ready implementation of the Responsive Analytics Dashboard Shell.

```tsx
// src/components/DashboardShell.tsx
import { css } from 'styled-system/css';
import {
  grid,
  gridItem,
  vstack,
  hstack,
  spacer,
  cq,
  linkBox,
  linkOverlay,
  scrollable,
  autoflex,
} from 'styled-system/patterns';

export function DashboardShell() {
  const filterCategories = [
    'All Transactions',
    'Completed',
    'Pending Approval',
    'Flagged / Fraud Review',
    'Disputed',
    'Refunded',
    'International Wire',
  ];

  const recentTransactions = [
    { id: 'tx-101', title: 'Stripe Payout - Enterprise ACME', amount: '+$14,250.00', date: '2 hours ago', url: '/transactions/101' },
    { id: 'tx-102', title: 'AWS Cloud Hosting Services', amount: '-$1,842.10', date: '5 hours ago', url: '/transactions/102' },
    { id: 'tx-103', title: 'GitHub Enterprise Subscription', amount: '-$420.00', date: 'Yesterday', url: '/transactions/103' },
  ];

  return (
    <div
      className={grid({
        columns: 12,
        minH: '100vh',
        bg: 'gray.50',
        gap: '6',
        p: { base: '4', md: '6' },
      })}
    >
      {/* 1. Header: spans full 12 columns */}
      <header
        className={gridItem({
          colSpan: 12,
          bg: 'white',
          p: '4',
          rounded: 'xl',
          shadow: 'xs',
          borderWidth: '1px',
          borderColor: 'gray.200',
        })}
      >
        <div className={hstack({ justify: 'space-between', w: 'full' })}>
          <div className={hstack({ gap: '3' })}>
            <div className={css({ w: '8', h: '8', rounded: 'lg', bg: 'brand.600', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' })}>
              P
            </div>
            <h1 className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.900' })}>
              Panda Analytics
            </h1>
          </div>
          <div className={hstack({ gap: '4' })}>
            <span className={css({ fontSize: 'sm', color: 'gray.600', hideBelow: 'md' })}>
              Production Cluster: us-east-1
            </span>
            <div className={css({ w: '8', h: '8', rounded: 'full', bg: 'brand.100', color: 'brand.700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'xs', fontWeight: 'bold' })}>
              MS
            </div>
          </div>
        </div>
      </header>

      {/* 2. Responsive Sidebar: hidden on mobile, 3 columns on lg */}
      <aside
        className={gridItem({
          colSpan: { base: 12, lg: 3 },
          hideBelow: 'lg',
        })}
      >
        <nav
          className={vstack({
            gap: '2',
            align: 'stretch',
            bg: 'white',
            p: '4',
            rounded: 'xl',
            borderWidth: '1px',
            borderColor: 'gray.200',
          })}
        >
          <div className={css({ px: '3', py: '2', fontWeight: 'bold', fontSize: 'xs', color: 'gray.400', textTransform: 'uppercase' })}>
            Navigation
          </div>
          <a href="#overview" className={css({ px: '3', py: '2', rounded: 'md', bg: 'brand.50', color: 'brand.700', fontWeight: 'semibold', fontSize: 'sm' })}>
            📊 Executive Overview
          </a>
          <a href="#revenue" className={css({ px: '3', py: '2', rounded: 'md', color: 'gray.600', fontSize: 'sm', _hover: { bg: 'gray.50' } })}>
            💰 Revenue Streams
          </a>
          <a href="#customers" className={css({ px: '3', py: '2', rounded: 'md', color: 'gray.600', fontSize: 'sm', _hover: { bg: 'gray.50' } })}>
            👥 Customer Cohorts
          </a>
          <a href="#settings" className={css({ px: '3', py: '2', rounded: 'md', color: 'gray.600', fontSize: 'sm', _hover: { bg: 'gray.50' } })}>
            ⚙️ System Settings
          </a>
        </nav>
      </aside>

      {/* 3. Main Dashboard Area: 9 columns on lg, 12 on mobile */}
      <main
        className={gridItem({
          colSpan: { base: 12, lg: 9 },
        })}
      >
        <div className={vstack({ gap: '6', align: 'stretch' })}>
          {/* Horizontal scrollable filter bar with custom scrollable pattern */}
          <div
            className={scrollable({
              direction: 'horizontal',
              hideScrollbar: true,
              display: 'flex',
              gap: '3',
              pb: '2',
            })}
          >
            {filterCategories.map((cat, idx) => (
              <button
                key={cat}
                className={css({
                  px: '4',
                  py: '1.5',
                  rounded: 'full',
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  borderWidth: '1px',
                  borderColor: idx === 0 ? 'brand.600' : 'gray.200',
                  bg: idx === 0 ? 'brand.600' : 'white',
                  color: idx === 0 ? 'white' : 'gray.700',
                  _hover: { borderColor: 'brand.500' },
                })}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Metric KPI cards with container queries */}
          <div className={grid({ columns: { base: 1, sm: 2, xl: 3 }, gap: '4' })}>
            {[
              { title: 'Gross Volume (MRR)', value: '$124,592', change: '+14.2% vs last month' },
              { title: 'Active Subscribers', value: '3,842', change: '+201 net new' },
              { title: 'Average Revenue / Account', value: '$84.20', change: '+3.1% expansion' },
            ].map((kpi) => (
              <div
                key={kpi.title}
                className={cq({
                  name: 'metricCard',
                  type: 'inline-size',
                })}
              >
                <div
                  className={css({
                    p: '5',
                    bg: 'white',
                    rounded: 'xl',
                    borderWidth: '1px',
                    borderColor: 'gray.200',
                    display: 'flex',
                    flexDirection: {
                      base: 'column',
                      '@metricCard/md': 'row',
                    },
                    justifyContent: 'space-between',
                    alignItems: {
                      base: 'flex-start',
                      '@metricCard/md': 'center',
                    },
                    gap: '2',
                  })}
                >
                  <div>
                    <span className={css({ fontSize: 'xs', color: 'gray.500', fontWeight: 'medium' })}>
                      {kpi.title}
                    </span>
                    <p className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.900', mt: '1' })}>
                      {kpi.value}
                    </p>
                  </div>
                  <span className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'emerald.600', bg: 'emerald.50', px: '2', py: '1', rounded: 'md' })}>
                    {kpi.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Status Tags Section via autoflex custom pattern */}
          <div className={autoflex({ minItemWidth: '180px', gap: '3' })}>
            <div className={css({ p: '3', bg: 'white', rounded: 'lg', borderWidth: '1px', borderColor: 'gray.200', fontSize: 'xs' })}>
              🟢 <strong>Gateway:</strong> Operational (99.98%)
            </div>
            <div className={css({ p: '3', bg: 'white', rounded: 'lg', borderWidth: '1px', borderColor: 'gray.200', fontSize: 'xs' })}>
              🔵 <strong>Latency:</strong> 42ms p99 Global
            </div>
            <div className={css({ p: '3', bg: 'white', rounded: 'lg', borderWidth: '1px', borderColor: 'gray.200', fontSize: 'xs' })}>
              🟣 <strong>Webhooks:</strong> 0 Failed Ingestions
            </div>
          </div>

          {/* Recent Activity List with linkOverlay pattern */}
          <div
            className={vstack({
              align: 'stretch',
              gap: '3',
              bg: 'white',
              p: '6',
              rounded: 'xl',
              borderWidth: '1px',
              borderColor: 'gray.200',
            })}
          >
            <h2 className={css({ fontSize: 'md', fontWeight: 'bold', color: 'gray.900' })}>
              Recent Ledger Activity
            </h2>

            <div className={vstack({ align: 'stretch', gap: '2' })}>
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className={linkBox({
                    p: '3.5',
                    rounded: 'lg',
                    borderWidth: '1px',
                    borderColor: 'gray.100',
                    transition: 'all 0.15s ease',
                    _hover: { bg: 'gray.50', borderColor: 'gray.300' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  })}
                >
                  <div className={vstack({ align: 'flex-start', gap: '0.5' })}>
                    <a
                      href={tx.url}
                      className={linkOverlay({
                        fontWeight: 'semibold',
                        fontSize: 'sm',
                        color: 'gray.900',
                      })}
                    >
                      {tx.title}
                    </a>
                    <span className={css({ fontSize: 'xs', color: 'gray.400' })}>
                      {tx.date}
                    </span>
                  </div>

                  <div className={hstack({ gap: '4' })}>
                    <span className={css({ fontWeight: 'bold', fontSize: 'sm', color: tx.amount.startsWith('+') ? 'emerald.600' : 'gray.900' })}>
                      {tx.amount}
                    </span>

                    {/* Secondary interactive button inside linkBox without navigation collision */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`Downloading receipt for ${tx.id}`);
                      }}
                      className={css({
                        position: 'relative',
                        zIndex: 1,
                        px: '2.5',
                        py: '1',
                        rounded: 'md',
                        bg: 'gray.100',
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        cursor: 'pointer',
                        _hover: { bg: 'gray.200' },
                      })}
                    >
                      Receipt 📥
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Architectural Highlights of the Complete Layout
1. **Fluid Responsive Shell**: Utilizes a 12-column grid system where the sidebar automatically disappears on mobile screens (`hideBelow: 'lg'`), allowing the main content area to expand seamlessly from 9 columns to the full 12 columns.
2. **Horizontal Filter Scroll**: Uses the custom `scrollable` pattern with touch inertia and hidden scrollbars to provide a slick mobile category picker without horizontal page overflow.
3. **Container-Responsive Metric Cards**: By wrapping each card with `cq({ name: 'metricCard' })`, the card's internal layout responds to its individual slot width. Whether placed in a 3-column desktop row or a single mobile column, it optimizes its alignment without viewport media query fragility.
4. **Accessible Compound Cards**: Uses `linkBox` and `linkOverlay` on ledger items so that clicking anywhere navigates to the transaction details, while preserving independent click actions on the receipt download button without triggering the parent URL.
