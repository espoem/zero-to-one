# Module 07: Config Recipes & Static Analysis

While atomic recipes (`cva`/`sva`) declare styles in userland code using utility classes, config recipes (`defineRecipe`/`defineSlotRecipe`) register recipes directly within `panda.config.ts`. Config recipes generate dedicated, predictable BEM-style CSS classes inside `@layer recipes`, export automatic prop-splitting utilities, and provide deep integration with Panda's static analysis engine. Understanding when and how to leverage config recipes is critical for large design systems and enterprise applications.

---

## Lesson 7.1: Atomic (`cva`/`sva`) vs Config (`defineRecipe`/`defineSlotRecipe`) Recipes

Panda CSS provides two distinct paradigms for recipe creation. Choosing between them depends on where styles should live, how CSS classes are emitted, and whether components consume runtime dynamic data.

### Comprehensive Comparison

| Feature | Atomic Recipes (`cva` / `sva`) | Config Recipes (`defineRecipe` / `defineSlotRecipe`) |
| :--- | :--- | :--- |
| **Declaration Location** | Any component file or local directory (`src/**/*.ts`) | `panda.config.ts` via `theme.recipes` or `theme.slotRecipes` |
| **Import Source** | `styled-system/css` | `styled-system/recipes` |
| **CSS Class Generation** | Composed atomic utility classes (e.g., `d_flex bg_blue.600 px_4`) | Semantic BEM-style classes (e.g., `badge badge--visual_solid`) |
| **CSS Cascade Layer** | `@layer utilities` | `@layer recipes` |
| **Helper Methods** | None (pure function returning string or object) | `.raw()`, `.splitVariantProps()`, `.variantMap` |
| **CSS Generation Strategy** | Extracted in-place from AST usages in codebase | Just-In-Time (JIT) based on static usages, or pre-generated with `staticCss` |
| **JSX Pattern Integration** | Manual `className={recipe(props)}` | Native JSX factory support: `<styled.button recipe="button" />` |
| **HTML Class Attribute Length** | Longer (contains multiple atomic utilities) | Minimal (contains one base class + variant modifier classes) |
| **Code Splitting** | Bundled directly with the component file | Generated into central `styled-system/recipes` artifacts |

### Decision Matrix: When to Choose Which

```
                                  Architecture Decision
                                            │
                    Is this component part of a shared design system
                       or reused across multiple independent apps?
                                      /            \
                                    YES            NO
                                    /                \
             Use Config Recipes                       Use Atomic Recipes
         (defineRecipe / defineSlotRecipe)              (cva / sva)
                 │                                            │
   - Single semantic class in DOM              - Fast prototyping in-place
   - `.splitVariantProps()` helper             - Zero config registrations
   - Guarantees predictable CSS in @layer      - Co-located with single component
   - JIT static extraction with staticCss      - Direct atomic utilities
```

Use **Atomic Recipes (`cva` / `sva`)** when building feature-specific components, rapid prototypes, or localized UI patterns that do not need to be published across package boundaries.

Use **Config Recipes (`defineRecipe` / `defineSlotRecipe`)** when building design system libraries, core UI kits, or components whose variants may be passed dynamically from APIs or CMS data.

---

## Lesson 7.2: Migrating the `badge` Recipe to `defineRecipe`

To migrate an atomic `badge` recipe to a config recipe, define the configuration object using `defineRecipe`, register it in `panda.config.ts`, run `panda codegen`, and consume the generated recipe from `styled-system/recipes`.

### Step 1: Define the Config Recipe

Create a dedicated recipe definition file in your theme directory:

```typescript
// src/theme/recipes/badge.recipe.ts
import { defineRecipe } from '@pandacss/dev';

export const badgeRecipe = defineRecipe({
  className: 'badge',
  description: 'Styles for badge status indicators',
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
        bg: 'colorPalette.600',
        color: 'white',
      },
      subtle: {
        bg: 'colorPalette.50',
        color: 'colorPalette.800',
        _dark: {
          bg: 'colorPalette.950',
          color: 'colorPalette.200',
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
          color: 'colorPalette.300',
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

### Step 2: Register in `panda.config.ts`

Import and add `badgeRecipe` to `theme.extend.recipes`:

```typescript
// panda.config.ts
import { defineConfig } from '@pandacss/dev';
import { badgeRecipe } from './src/theme/recipes/badge.recipe';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  theme: {
    extend: {
      recipes: {
        badge: badgeRecipe,
      },
    },
  },
  outdir: 'styled-system',
});
```

### Step 3: Run Codegen

Execute the Panda code generator:

```bash
npx panda codegen
```

Panda analyzes the configuration and generates:
- `styled-system/recipes/badge.mjs`: Runtime JavaScript function containing variant mappings and class builders.
- `styled-system/recipes/badge.d.ts`: Full TypeScript definitions and `BadgeVariantProps`.

### Step 4: Inspect Generated Output

The generated CSS in `@layer recipes` produces clean semantic classes:

```css
@layer recipes {
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1\.5);
    font-weight: var(--font-weights-medium);
    text-transform: uppercase;
    line-height: 1;
  }
  .badge--visual_solid {
    background-color: var(--colors-color-palette-600);
    color: var(--colors-white);
  }
  .badge--visual_subtle {
    background-color: var(--colors-color-palette-50);
    color: var(--colors-color-palette-800);
  }
  .badge--size_sm {
    padding-inline: var(--spacing-1\.5);
    padding-block: var(--spacing-0\.5);
    font-size: var(--font-sizes-2xs);
  }
  .badge--size_md {
    padding-inline: var(--spacing-2);
    padding-block: var(--spacing-1);
    font-size: var(--font-sizes-xs);
  }
  .badge--pill {
    border-radius: var(--radii-full);
  }
}
```

### Step 5: Consume the Recipe

```tsx
import { badge, type BadgeVariantProps } from 'styled-system/recipes';

// Inspect available variant keys and values programmatically
console.log(badge.variantMap);
// => { visual: ['solid', 'subtle', 'outline'], size: ['sm', 'md', 'lg'], pill: ['true', 'false'] }

const classString = badge({ visual: 'solid', size: 'lg', colorPalette: 'emerald' });
// Output: "badge badge--visual_solid badge--size_lg"
```

---

## Lesson 7.3: Migrating the `alert` Slot Recipe to `defineSlotRecipe`

Multi-slot recipes migrate to `panda.config.ts` using `defineSlotRecipe`. Config slot recipes generate BEM element class names (e.g., `alert__root`, `alert__title`) and modifier classes (e.g., `alert__root--status_error`).

### Step 1: Define the Config Slot Recipe

```typescript
// src/theme/recipes/alert.recipe.ts
import { defineSlotRecipe } from '@pandacss/dev';

export const alertSlotRecipe = defineSlotRecipe({
  className: 'alert',
  description: 'Multi-part alert styles',
  slots: ['root', 'icon', 'content', 'title', 'description', 'closeTrigger'],
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      width: 'full',
      gap: '3',
      p: '4',
      borderRadius: 'lg',
    },
    icon: {
      flexShrink: 0,
      w: '5',
      h: '5',
      mt: '0.5',
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1',
      flex: '1',
    },
    title: {
      fontWeight: 'semibold',
      fontSize: 'sm',
      lineHeight: '1.25',
    },
    description: {
      fontSize: 'sm',
      lineHeight: '1.5',
    },
    closeTrigger: {
      cursor: 'pointer',
      p: '1',
    },
  },
  variants: {
    status: {
      info: {
        root: { colorPalette: 'blue' },
      },
      success: {
        root: { colorPalette: 'emerald' },
      },
      warning: {
        root: { colorPalette: 'amber' },
      },
      error: {
        root: { colorPalette: 'rose' },
      },
    },
    variant: {
      subtle: {
        root: { bg: 'colorPalette.50', _dark: { bg: 'colorPalette.950' } },
        icon: { color: 'colorPalette.600' },
        title: { color: 'colorPalette.900', _dark: { color: 'colorPalette.100' } },
        description: { color: 'colorPalette.700', _dark: { color: 'colorPalette.300' } },
      },
      solid: {
        root: { bg: 'colorPalette.600', color: 'white' },
        icon: { color: 'white' },
        title: { color: 'white' },
        description: { color: 'white/90' },
      },
    },
  },
  defaultVariants: {
    status: 'info',
    variant: 'subtle',
  },
});
```

### Step 2: Register in `panda.config.ts`

```typescript
// panda.config.ts
import { defineConfig } from '@pandacss/dev';
import { alertSlotRecipe } from './src/theme/recipes/alert.recipe';

export default defineConfig({
  theme: {
    extend: {
      slotRecipes: {
        alert: alertSlotRecipe,
      },
    },
  },
  outdir: 'styled-system',
});
```

### Step 3: Splitting Props with `alert.splitVariantProps`

One of the greatest benefits of config recipes is the automatic `.splitVariantProps(props)` utility.

#### ❌ Anti-Pattern: Manual Destructuring of Variant Props

```tsx
// ❌ Anti-Pattern: Fragile manual prop extraction
function BadAlertComponent(props: AlertProps) {
  // If a new variant is added to the recipe, this destructuring must be manually updated
  const { status, variant, colorPalette, className, children, ...restProps } = props;
  const styles = alert({ status, variant, colorPalette });
  return <div className={styles.root} {...restProps}>{children}</div>;
}
```

#### ✅ Best Practice: Using `recipe.splitVariantProps`

```tsx
// ✅ Best Practice: Automated, strictly typed variant extraction
import * as React from 'react';
import { alert, type AlertVariantProps } from 'styled-system/recipes';
import { cx } from 'styled-system/css';

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    AlertVariantProps {
  children: React.ReactNode;
}

export function Alert(props: AlertProps) {
  // splitVariantProps automatically separates recipe variant props from standard HTML props
  const [variantProps, localProps] = alert.splitVariantProps(props);
  const styles = alert(variantProps);

  return (
    <div className={cx(styles.root, localProps.className)} {...localProps}>
      {props.children}
    </div>
  );
}
```

`splitVariantProps` inspects the recipe's `variantMap` at runtime. Any prop matching a recipe variant key is placed in `variantProps`, while DOM attributes, event handlers, and data attributes remain in `localProps`.

---

## Lesson 7.4: Just-in-Time Styles & `staticCss` Pre-generation

Panda CSS utilizes static analysis. At build time, Panda's AST parser reads through your source files to find static literal strings like `<Badge visual="solid" />`. It only generates CSS rules for the variant combinations detected in your code.

### The Dynamic Value Problem

When component variant props depend on dynamic data—such as server responses, database records, or CMS attributes—static analysis cannot deduce the values:

```tsx
// ❌ Static Scanner Blindspot: Panda cannot infer dynamic values at build time!
function OrderStatusBadge({ order }: { order: OrderRecord }) {
  // order.status is resolved at runtime ('pending' | 'shipped' | 'delivered')
  return <Badge visual={order.statusBadgeVisual} colorPalette={order.statusColor} />;
}
```

If `order.statusBadgeVisual` evaluates to `'outline'`, but the literal string `'outline'` was never written elsewhere in static JSX, Panda does not generate `.badge--visual_outline` in the production stylesheet. The badge renders unstyled.

### The Solution: `staticCss` Configuration

To guarantee that dynamic variant classes are pre-generated regardless of static scanner findings, configure the `staticCss` block in `panda.config.ts`:

```typescript
// panda.config.ts
import { defineConfig } from '@pandacss/dev';
import { badgeRecipe } from './src/theme/recipes/badge.recipe';
import { alertSlotRecipe } from './src/theme/recipes/alert.recipe';

export default defineConfig({
  theme: {
    extend: {
      recipes: { badge: badgeRecipe },
      slotRecipes: { alert: alertSlotRecipe },
    },
  },
  staticCss: {
    recipes: {
      // 1. Wildcard: Pre-generate EVERY variant combination for badge
      badge: ['*'],

      // 2. Targeted matrix: Pre-generate specific status and variant combinations for alert
      alert: [
        {
          status: ['*'],
          variant: ['subtle', 'solid'],
        },
      ],
    },
    // 3. Pre-generate specific utility properties for dynamic inline styling
    css: [
      {
        properties: {
          colorPalette: ['blue', 'emerald', 'amber', 'rose', 'slate'],
          bg: ['colorPalette.50', 'colorPalette.600'],
        },
      },
    ],
  },
  outdir: 'styled-system',
});
```

### Static CSS Rule Patterns:
- `badge: ['*']`: Emits all permutations of variants for `badge`.
- `alert: [{ status: ['info', 'error'], variant: ['solid'] }]`: Generates only the specified cross-product of variants.
- `css: [{ properties: { ... } }]`: Pre-generates arbitrary utility classes for dynamic styling.

Use `staticCss` judiciously: wildcards on recipes with large variant matrices can expand CSS output. Target only the variants required dynamically.

---

## Lesson 7.5: Recipe Analytics (`panda analyze`)

Panda CSS includes a built-in static analysis engine accessible via the CLI: `panda analyze`. This tool inspects your codebase, reports recipe usage metrics, identifies dead variants, and flags dynamic extraction misses.

### Running Analysis

Execute the analyze command in your terminal:

```bash
# Print human-readable summary to console
npx panda analyze

# Export comprehensive JSON report for automated CI assertions
npx panda analyze --json analysis-report.json
```

### Sample Analysis Output

```
Panda CSS Analysis Report
─────────────────────────────────────────────
Files Scanned:        142
CSS Rules Generated:  384
Recipes Evaluated:    4

Recipe: badge
  Total Usages:       38
  Variants Used:
    - visual.solid:   24 usages
    - visual.subtle:  14 usages
    - visual.outline: 0 usages  ⚠️ (Dead variant candidate)
    - size.sm:        12 usages
    - size.md:        26 usages
    - size.lg:        0 usages  ⚠️ (Dead variant candidate)

Dynamic Extraction Warnings:
  ⚠️ src/features/orders/OrderStatusBadge.tsx:14:10
     Recipe 'badge' called with dynamic variant expression 'order.status'.
     Class might be missing unless configured in staticCss.
```

### CI Automation with `panda analyze`

Incorporate `panda analyze` into your GitHub Actions or GitLab CI pipeline to catch unextracted dynamic calls before production deployment:

```json
// package.json
{
  "scripts": {
    "style:analyze": "panda analyze --json ./reports/panda-analysis.json",
    "style:audit": "node ./scripts/audit-panda-report.js"
  }
}
```

```javascript
// scripts/audit-panda-report.js
import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync('./reports/panda-analysis.json', 'utf8'));

if (report.warnings && report.warnings.length > 0) {
  console.error(`❌ Panda Analysis Failed: Found ${report.warnings.length} unextracted dynamic usages.`);
  for (const warning of report.warnings) {
    console.error(`  - [${warning.file}:${warning.line}] ${warning.message}`);
  }
  process.exit(1);
}

console.log('✅ Panda Analysis passed: All recipe and style usages statically verified.');
```

---

## Lesson 7.6: Exercise — Refactoring a Dynamic E-Commerce Order Status System

An e-commerce order management portal dynamically displays order statuses received from a GraphQL endpoint. In staging, the UI team noticed that orders marked `'refunded'` and `'shipped'` rendered with broken or missing styles because the status string was computed dynamically at runtime.

### Exercise Tasks:
1. Define a config recipe `orderStatusBadgeRecipe` in `src/theme/recipes/order-status.recipe.ts`:
   - `className`: `'order-status-badge'`.
   - Variants:
     - `status`: `'pending'`, `'processing'`, `'shipped'`, `'delivered'`, `'cancelled'`, `'refunded'`.
     - `emphasis`: `'low'`, `'high'`.
2. Define a config slot recipe `orderTimelineRecipe` in `src/theme/recipes/order-timeline.recipe.ts`:
   - `className`: `'order-timeline'`.
   - Slots: `root`, `step`, `dot`, `line`, `content`, `title`, `timestamp`.
   - Variants:
     - `state`: `'completed'`, `'current'`, `'upcoming'`.
3. Configure `panda.config.ts`:
   - Register both recipes.
   - Configure `staticCss` so that **all** `status` variants of `orderStatusBadgeRecipe` are pre-generated, preventing runtime missing-class bugs.
4. Implement `<OrderStatusBadge>` in `src/components/OrderStatusBadge.tsx` using `orderStatusBadgeRecipe.splitVariantProps(props)`.

---

## Lesson 7.7: Solution — Config Recipes + `staticCss` + `splitVariantProps` Implementation

### 1. Order Status Recipe (`src/theme/recipes/order-status.recipe.ts`)

```typescript
import { defineRecipe } from '@pandacss/dev';

export const orderStatusBadgeRecipe = defineRecipe({
  className: 'order-status-badge',
  description: 'Badges representing real-time e-commerce order statuses',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5',
    px: '2.5',
    py: '1',
    borderRadius: 'full',
    fontSize: 'xs',
    fontWeight: 'semibold',
    lineHeight: '1',
    textTransform: 'capitalize',
  },
  variants: {
    status: {
      pending: {
        colorPalette: 'amber',
      },
      processing: {
        colorPalette: 'blue',
      },
      shipped: {
        colorPalette: 'indigo',
      },
      delivered: {
        colorPalette: 'emerald',
      },
      cancelled: {
        colorPalette: 'rose',
      },
      refunded: {
        colorPalette: 'slate',
      },
    },
    emphasis: {
      low: {
        bg: 'colorPalette.100',
        color: 'colorPalette.800',
        _dark: {
          bg: 'colorPalette.950',
          color: 'colorPalette.300',
        },
      },
      high: {
        bg: 'colorPalette.600',
        color: 'white',
      },
    },
  },
  defaultVariants: {
    status: 'pending',
    emphasis: 'low',
  },
});
```

### 2. Order Timeline Slot Recipe (`src/theme/recipes/order-timeline.recipe.ts`)

```typescript
import { defineSlotRecipe } from '@pandacss/dev';

export const orderTimelineRecipe = defineSlotRecipe({
  className: 'order-timeline',
  description: 'Multi-part vertical timeline for tracking order milestone events',
  slots: ['root', 'step', 'dot', 'line', 'content', 'title', 'timestamp'],
  base: {
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: 'full',
      py: '2',
    },
    step: {
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '4',
      pb: '6',
      _last: { pb: '0' },
    },
    dot: {
      position: 'relative',
      zIndex: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      w: '6',
      h: '6',
      borderRadius: 'full',
      borderWidth: '2px',
      borderStyle: 'solid',
      bg: 'white',
      _dark: { bg: 'gray.900' },
    },
    line: {
      position: 'absolute',
      left: '11px',
      top: '24px',
      bottom: '0',
      width: '2px',
      bg: 'gray.200',
      _dark: { bg: 'gray.800' },
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      flex: '1',
      pt: '0.5',
    },
    title: {
      fontSize: 'sm',
      fontWeight: 'medium',
      lineHeight: 'tight',
    },
    timestamp: {
      fontSize: 'xs',
      color: 'gray.500',
      mt: '1',
    },
  },
  variants: {
    state: {
      completed: {
        dot: {
          borderColor: 'emerald.500',
          bg: 'emerald.500',
          color: 'white',
        },
        line: {
          bg: 'emerald.500',
        },
        title: {
          color: 'gray.900',
          _dark: { color: 'white' },
        },
      },
      current: {
        dot: {
          borderColor: 'blue.600',
          bg: 'blue.50',
          color: 'blue.600',
          _dark: { bg: 'blue.950' },
        },
        line: {
          bg: 'gray.200',
        },
        title: {
          color: 'blue.600',
          fontWeight: 'semibold',
          _dark: { color: 'blue.400' },
        },
      },
      upcoming: {
        dot: {
          borderColor: 'gray.300',
          bg: 'white',
          _dark: { borderColor: 'gray.700', bg: 'gray.900' },
        },
        line: {
          bg: 'gray.200',
        },
        title: {
          color: 'gray.400',
          _dark: { color: 'gray.600' },
        },
      },
    },
  },
  defaultVariants: {
    state: 'upcoming',
  },
});
```

### 3. Panda Configuration (`panda.config.ts`)

```typescript
import { defineConfig } from '@pandacss/dev';
import { orderStatusBadgeRecipe } from './src/theme/recipes/order-status.recipe';
import { orderTimelineRecipe } from './src/theme/recipes/order-timeline.recipe';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      recipes: {
        orderStatusBadge: orderStatusBadgeRecipe,
      },
      slotRecipes: {
        orderTimeline: orderTimelineRecipe,
      },
    },
  },
  staticCss: {
    recipes: {
      // Pre-generate all status variants for orderStatusBadge so dynamic CMS/API data always has CSS
      orderStatusBadge: [
        {
          status: ['*'],
          emphasis: ['low', 'high'],
        },
      ],
      orderTimeline: [
        {
          state: ['*'],
        },
      ],
    },
  },
  outdir: 'styled-system',
});
```

### 4. React Component with `splitVariantProps` (`src/components/OrderStatusBadge.tsx`)

```tsx
import * as React from 'react';
import { orderStatusBadge, type OrderStatusBadgeVariantProps } from 'styled-system/recipes';
import { cx } from 'styled-system/css';

export interface OrderStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    OrderStatusBadgeVariantProps {
  children?: React.ReactNode;
}

export const OrderStatusBadge = React.forwardRef<HTMLSpanElement, OrderStatusBadgeProps>(
  function OrderStatusBadge(props, ref) {
    // splitVariantProps automatically separates recipe variant props from standard HTML props
    const [variantProps, localProps] = orderStatusBadge.splitVariantProps(props);
    const className = orderStatusBadge(variantProps);

    return (
      <span
        ref={ref}
        className={cx(className, localProps.className)}
        {...localProps}
      >
        {props.children ?? variantProps.status}
      </span>
    );
  }
);

OrderStatusBadge.displayName = 'OrderStatusBadge';
```

### 5. Dynamic Rendering in Application View

```tsx
// src/features/orders/OrderDetailView.tsx
import * as React from 'react';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';

interface OrderItem {
  id: string;
  // Status returned dynamically from GraphQL / REST API
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  customer: string;
}

export function OrderDetailView({ order }: { order: OrderItem }) {
  return (
    <div>
      <h3>Order #{order.id}</h3>
      {/* Even though order.status is resolved at runtime, staticCss guarantees the rule exists */}
      <OrderStatusBadge status={order.status} emphasis="high" />
    </div>
  );
}
```

With config recipes and `staticCss`, design systems achieve the best of both worlds: clean BEM classes in `@layer recipes`, convenient prop splitting, and zero missing-style regressions for dynamic runtime data.
