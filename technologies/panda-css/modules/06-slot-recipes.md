# Module 06: Slot Recipes (sva)

Composite UI components consist of multiple DOM elements functioning as a single conceptual unit. An alert contains a container, an icon, a content wrapper, a title, a description, and a close button. Standard single-element recipes (`cva`) cannot style composite components without relying on fragile child selectors or splitting styles across disconnected recipes. Slot recipes (`sva`) solve this by defining a shared anatomy of named slots styled simultaneously across variant dimensions.

---

## Lesson 6.1: Introduction to Slot Recipes (`sva`)

Most production UI components are multi-part (composite) controls. When building an alert, dialog, tabs, or accordion, styles must apply synchronously to different DOM elements based on a single set of variant props.

When teams attempt to style multi-part components with single-element `cva` recipes, they encounter severe architectural drawbacks:

### ❌ Anti-Pattern: Monolithic CVA with Cascading Child Selectors

```tsx
// ❌ Anti-Pattern: Fragile child class cascades that break encapsulation and types
import { cva } from 'styled-system/css';

const badAlertRecipe = cva({
  base: {
    display: 'flex',
    gap: '3',
    p: '4',
    borderRadius: 'md',
    '& .alert-icon': {
      flexShrink: 0,
      w: '5',
      h: '5',
    },
    '& .alert-title': {
      fontWeight: 'semibold',
      fontSize: 'sm',
    },
    '& .alert-desc': {
      fontSize: 'sm',
      color: 'gray.600',
    },
  },
  variants: {
    status: {
      error: {
        bg: 'red.50',
        '& .alert-icon': { color: 'red.600' },
        '& .alert-title': { color: 'red.900' },
        '& .alert-desc': { color: 'red.700' },
      },
      success: {
        bg: 'green.50',
        '& .alert-icon': { color: 'green.600' },
        '& .alert-title': { color: 'green.900' },
        '& .alert-desc': { color: 'green.700' },
      },
    },
  },
});
```

This child selector anti-pattern leads to:
1. **Broken tree shaking**: CSS rules target arbitrary child class names that the compiler cannot trace or optimize.
2. **Specificity leaks**: Deep child selectors like `& .alert-title` carry higher specificity, making local overrides frustrating for consumers.
3. **No slot-level type safety**: Developers have no autocomplete or static validation for slot class names in JSX.

### ✅ Best Practice: Slot Variance Authority with `sva`

Panda CSS provides `sva` (Slot Variance Authority) from `styled-system/css`. In an `sva` recipe, you explicitly declare component anatomy via the `slots` array. Every variant then styles individual slots directly without nested CSS selectors:

```typescript
// ✅ Best Practice: Explicit anatomy, direct slot targeting, zero specificity wars
import { sva } from 'styled-system/css';

export const alertRecipe = sva({
  slots: ['root', 'icon', 'content', 'title', 'description'],
  base: {
    root: {
      display: 'flex',
      gap: '3',
      p: '4',
      borderRadius: 'md',
    },
    icon: {
      flexShrink: 0,
      w: '5',
      h: '5',
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1',
    },
    title: {
      fontWeight: 'semibold',
      fontSize: 'sm',
      lineHeight: 'tight',
    },
    description: {
      fontSize: 'sm',
    },
  },
  variants: {
    status: {
      error: {
        root: { bg: 'red.50', border: '1px solid', borderColor: 'red.200' },
        icon: { color: 'red.600' },
        title: { color: 'red.900' },
        description: { color: 'red.700' },
      },
      success: {
        root: { bg: 'green.50', border: '1px solid', borderColor: 'green.200' },
        icon: { color: 'green.600' },
        title: { color: 'green.900' },
        description: { color: 'green.700' },
      },
    },
  },
  defaultVariants: {
    status: 'error',
  },
});
```

Invoking `const styles = alertRecipe({ status: 'error' })` returns an object mapping each slot to its generated atomic class name:

```typescript
// Inspecting output:
// styles = {
//   root: 'd_flex gap_3 p_4 rounded_md bg_red.50 ...',
//   icon: 'w_5 h_5 text_red.600 ...',
//   content: 'd_flex flex_column gap_1',
//   title: 'font_semibold text_sm text_red.900 ...',
//   description: 'text_sm text_red.700 ...'
// }
```

Each DOM node receives atomic classes tailored to its role, maintaining flat specificity and strict type safety.

---

## Lesson 6.2: Creating an `alert` Slot Recipe

Let us create a production-grade Alert recipe with multiple visual styles, virtual colors, status dimensions, and compound variants targeting specific slots.

The Alert anatomy consists of 6 slots:
- `root`: Container element.
- `icon`: Leading status icon wrapper.
- `content`: Vertical flex column holding title and description.
- `title`: Primary headline.
- `description`: Secondary explanatory text.
- `closeTrigger`: Optional dismiss button positioned at the top-right.

```typescript
// src/components/Alert/alert.recipe.ts
import { sva } from 'styled-system/css';

export const alertRecipe = sva({
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
      transition: 'all 0.2s ease',
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
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
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      p: '1',
      borderRadius: 'md',
      cursor: 'pointer',
      opacity: '0.8',
      transition: 'opacity 0.15s ease',
      _hover: { opacity: '1', bg: 'black/5' },
      _focusVisible: { outline: '2px solid', outlineColor: 'colorPalette.500' },
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
        root: {
          bg: 'colorPalette.50',
          _dark: { bg: 'colorPalette.950' },
        },
        icon: {
          color: 'colorPalette.600',
          _dark: { color: 'colorPalette.400' },
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
        },
      },
      solid: {
        root: {
          bg: 'colorPalette.600',
          color: 'white',
        },
        icon: {
          color: 'white',
        },
        title: {
          color: 'white',
        },
        description: {
          color: 'white/90',
        },
        closeTrigger: {
          color: 'white',
          _hover: { bg: 'white/20' },
        },
      },
      outline: {
        root: {
          bg: 'transparent',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'colorPalette.300',
          _dark: { borderColor: 'colorPalette.700' },
        },
        icon: {
          color: 'colorPalette.600',
          _dark: { color: 'colorPalette.400' },
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
        },
      },
      leftAccent: {
        root: {
          bg: 'colorPalette.50',
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid',
          borderLeftColor: 'colorPalette.600',
          borderRadius: 'none',
          borderTopRightRadius: 'lg',
          borderBottomRightRadius: 'lg',
          _dark: { bg: 'colorPalette.950' },
        },
        icon: {
          color: 'colorPalette.600',
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
        },
      },
    },
  },
  compoundVariants: [
    {
      variant: 'solid',
      status: 'warning',
      css: {
        root: {
          color: 'gray.900',
        },
        icon: {
          color: 'gray.900',
        },
        title: {
          color: 'gray.900',
        },
        description: {
          color: 'gray.800',
        },
        closeTrigger: {
          color: 'gray.900',
          _hover: { bg: 'black/10' },
        },
      },
    },
  ],
  defaultVariants: {
    status: 'info',
    variant: 'subtle',
  },
});
```

In the compound variant above, amber/yellow text on solid backgrounds requires dark text rather than white text to maintain WCAG AAA contrast compliance. The `compoundVariants` block targets individual slots within its `css` map.

---

## Lesson 6.3: Creating a `tabs` Slot Recipe

The Tabs component is an essential navigation pattern with interacting states, layout directions, and active indicators.

Its anatomy consists of 5 slots:
- `root`: Surrounding wrapper managing orientation.
- `list`: Flex container holding trigger elements.
- `trigger`: Individual tab button with interactive and active states.
- `indicator`: Active marker showing current selection.
- `content`: Tab panel displaying content for the selected tab.

```typescript
// src/components/Tabs/tabs.recipe.ts
import { sva } from 'styled-system/css';

export const tabsRecipe = sva({
  slots: ['root', 'list', 'trigger', 'indicator', 'content'],
  base: {
    root: {
      display: 'flex',
      width: 'full',
    },
    list: {
      position: 'relative',
      display: 'flex',
      userSelect: 'none',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'gray.200',
      _dark: { borderBottomColor: 'gray.800' },
    },
    trigger: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'medium',
      cursor: 'pointer',
      color: 'gray.600',
      transition: 'all 0.15s ease',
      outline: 'none',
      _dark: { color: 'gray.400' },
      _hover: {
        color: 'gray.900',
        _dark: { color: 'gray.100' },
      },
      _selected: {
        color: 'colorPalette.600',
        fontWeight: 'semibold',
        _dark: { color: 'colorPalette.400' },
      },
      _disabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
      },
      _focusVisible: {
        ring: '2px',
        ringColor: 'colorPalette.500',
        ringOffset: '2px',
      },
    },
    indicator: {
      position: 'absolute',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    content: {
      width: 'full',
      pt: '4',
      outline: 'none',
      _focusVisible: {
        ring: '2px',
        ringColor: 'colorPalette.500',
      },
    },
  },
  variants: {
    variant: {
      line: {
        trigger: {
          borderBottomWidth: '2px',
          borderBottomStyle: 'solid',
          borderBottomColor: 'transparent',
          mb: '-1px',
          _selected: {
            borderBottomColor: 'colorPalette.600',
            _dark: { borderBottomColor: 'colorPalette.400' },
          },
        },
      },
      enclosed: {
        list: {
          gap: '1',
          p: '1',
          bg: 'gray.100',
          borderRadius: 'lg',
          borderBottom: 'none',
          _dark: { bg: 'gray.900' },
        },
        trigger: {
          borderRadius: 'md',
          _selected: {
            bg: 'white',
            color: 'gray.900',
            boxShadow: 'sm',
            _dark: { bg: 'gray.800', color: 'white' },
          },
        },
      },
      softRounded: {
        list: {
          gap: '2',
          borderBottom: 'none',
        },
        trigger: {
          borderRadius: 'full',
          _selected: {
            bg: 'colorPalette.100',
            color: 'colorPalette.800',
            _dark: { bg: 'colorPalette.900', color: 'colorPalette.200' },
          },
        },
      },
    },
    size: {
      sm: {
        trigger: { px: '3', py: '1.5', fontSize: 'xs' },
        content: { pt: '3' },
      },
      md: {
        trigger: { px: '4', py: '2', fontSize: 'sm' },
        content: { pt: '4' },
      },
      lg: {
        trigger: { px: '5', py: '2.5', fontSize: 'md' },
        content: { pt: '5' },
      },
    },
    orientation: {
      horizontal: {
        root: { flexDirection: 'column' },
        list: { flexDirection: 'row' },
      },
      vertical: {
        root: { flexDirection: 'row', gap: '6' },
        list: {
          flexDirection: 'column',
          borderBottom: 'none',
          borderRightWidth: '1px',
          borderRightStyle: 'solid',
          borderRightColor: 'gray.200',
          _dark: { borderRightColor: 'gray.800' },
        },
        trigger: {
          justifyContent: 'flex-start',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'line',
    size: 'md',
    orientation: 'horizontal',
  },
});
```

Slot recipes enable state pseudo-classes like `_selected` and `_focusVisible` directly on the target slot (`trigger`), cleanly insulating caller code from CSS state mechanics.

---

## Lesson 6.4: Converting Slot Recipes to Compound JSX Components

When consuming a multi-slot recipe in React, passing the `styles` object manually to every child component produces cumbersome and repetitive JSX:

```tsx
// ❌ Clunky consumer code without React Context
const styles = alertRecipe({ status: 'error' });
<div className={styles.root}>
  <span className={styles.icon}><Icon /></span>
  <div className={styles.content}>
    <h4 className={styles.title}>Error</h4>
    <p className={styles.description}>Failed to save changes</p>
  </div>
</div>
```

The idiomatic React design pattern combines slot recipes with **Compound Components** via React Context. The root component evaluates the recipe once, stores the slot class strings in context, and each subcomponent grabs its designated slot class automatically.

### Architecture of the Compound Component

```
┌────────────────────────────────────────────────────────┐
│ <Alert.Root status="error" variant="subtle">           │
│   ├── Evaluates alertRecipe(props)                     │
│   ├── AlertContext.Provider value={styles}             │
│   │                                                    │
│   ├── <Alert.Icon />        -> reads styles.icon       │
│   └── <Alert.Content>                                  │
│         ├── <Alert.Title>   -> reads styles.title      │
│         └── <Alert.Description> -> styles.description │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Complete Implementation

```tsx
// src/components/Alert/Alert.tsx
import * as React from 'react';
import { cx } from 'styled-system/css';
import { alertRecipe } from './alert.recipe';

// Extract slot styles type
type AlertSlotStyles = Record<
  'root' | 'icon' | 'content' | 'title' | 'description' | 'closeTrigger',
  string
>;

const AlertStylesContext = React.createContext<AlertSlotStyles | null>(null);

function useAlertStyles(slotName: keyof AlertSlotStyles) {
  const context = React.useContext(AlertStylesContext);
  if (!context) {
    throw new Error(`Alert compound components must be rendered inside <Alert.Root>`);
  }
  return context[slotName];
}

// 1. Root Component
export interface AlertRootProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: 'info' | 'success' | 'warning' | 'error';
  variant?: 'subtle' | 'solid' | 'outline' | 'leftAccent';
  children: React.ReactNode;
}

const AlertRoot = React.forwardRef<HTMLDivElement, AlertRootProps>(function AlertRoot(
  { status = 'info', variant = 'subtle', className, children, ...props },
  ref
) {
  const styles = alertRecipe({ status, variant }) as AlertSlotStyles;

  return (
    <AlertStylesContext.Provider value={styles}>
      <div ref={ref} role="alert" className={cx(styles.root, className)} {...props}>
        {children}
      </div>
    </AlertStylesContext.Provider>
  );
});

// 2. Icon Component
export interface AlertIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

const AlertIcon = React.forwardRef<HTMLSpanElement, AlertIconProps>(function AlertIcon(
  { className, children, ...props },
  ref
) {
  const slotClass = useAlertStyles('icon');
  return (
    <span ref={ref} aria-hidden="true" className={cx(slotClass, className)} {...props}>
      {children}
    </span>
  );
});

// 3. Content Wrapper Component
export interface AlertContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const AlertContent = React.forwardRef<HTMLDivElement, AlertContentProps>(function AlertContent(
  { className, children, ...props },
  ref
) {
  const slotClass = useAlertStyles('content');
  return (
    <div ref={ref} className={cx(slotClass, className)} {...props}>
      {children}
    </div>
  );
});

// 4. Title Component
export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(function AlertTitle(
  { className, children, ...props },
  ref
) {
  const slotClass = useAlertStyles('title');
  return (
    <h5 ref={ref} className={cx(slotClass, className)} {...props}>
      {children}
    </h5>
  );
});

// 5. Description Component
export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  function AlertDescription({ className, children, ...props }, ref) {
    const slotClass = useAlertStyles('description');
    return (
      <p ref={ref} className={cx(slotClass, className)} {...props}>
        {children}
      </p>
    );
  }
);

// 6. Close Trigger Component
export interface AlertCloseTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const AlertCloseTrigger = React.forwardRef<HTMLButtonElement, AlertCloseTriggerProps>(
  function AlertCloseTrigger({ className, children, ...props }, ref) {
    const slotClass = useAlertStyles('closeTrigger');
    return (
      <button ref={ref} type="button" aria-label="Close" className={cx(slotClass, className)} {...props}>
        {children ?? '×'}
      </button>
    );
  }
);

// Export unified compound component object
export const Alert = {
  Root: AlertRoot,
  Icon: AlertIcon,
  Content: AlertContent,
  Title: AlertTitle,
  Description: AlertDescription,
  CloseTrigger: AlertCloseTrigger,
};
```

### Usage in Application Code

```tsx
import { Alert } from './Alert';
import { CheckCircle2 } from 'lucide-react';

export function OrderNotification() {
  return (
    <Alert.Root status="success" variant="leftAccent">
      <Alert.Icon>
        <CheckCircle2 size={20} />
      </Alert.Icon>
      <Alert.Content>
        <Alert.Title>Payment processed</Alert.Title>
        <Alert.Description>Your receipt has been sent to your email.</Alert.Description>
      </Alert.Content>
      <Alert.CloseTrigger onClick={() => console.log('dismiss')} />
    </Alert.Root>
  );
}
```

---

## Lesson 6.5: Exercise — Pricing Tier Card & Accordion Slot Recipes

In this hands-on exercise, you will architect slot recipes and compound components for two foundational UI patterns:

### Part A: Accordion Slot Recipe
1. Define `accordionRecipe` using `sva`:
   - Slots: `root`, `item`, `trigger`, `content`, `indicator`.
   - Variants:
     - `variant`: `'outline'`, `'separated'`, `'plain'`.
     - `size`: `'sm'`, `'md'`, `'lg'`.
   - Implement `_expanded` state selectors on the indicator (rotating the chevron 180 degrees) and background highlights on the active item.

### Part B: Pricing Tier Card Slot Recipe
1. Define `pricingCardRecipe` using `sva`:
   - Slots: `root`, `header`, `badge`, `price`, `interval`, `featureList`, `featureItem`, `ctaTrigger`.
   - Variants:
     - `tier`: `'starter'`, `'pro'`, `'enterprise'` (using `colorPalette`).
     - `highlighted`: `true` | `false` (scales the card slightly, adds an elevated ring, and elevates button visual).
2. Build an accessible, fully interactive Accordion component and Pricing Card component using typed React compound components.

---

## Lesson 6.6: Solution — Full Multi-Slot Accordion & Pricing Card Implementation

### 1. Accordion Slot Recipe (`src/components/Accordion/accordion.recipe.ts`)

```typescript
import { sva } from 'styled-system/css';

export const accordionRecipe = sva({
  slots: ['root', 'item', 'trigger', 'content', 'indicator'],
  base: {
    root: {
      width: 'full',
      display: 'flex',
      flexDirection: 'column',
    },
    item: {
      overflow: 'hidden',
      transition: 'background-color 0.15s ease',
    },
    trigger: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: 'full',
      fontWeight: 'medium',
      textAlign: 'left',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.15s ease',
      _focusVisible: {
        ring: '2px',
        ringColor: 'blue.500',
        ringOffset: '2px',
      },
    },
    content: {
      overflow: 'hidden',
      transition: 'all 0.25s ease-in-out',
      color: 'gray.600',
      _dark: { color: 'gray.300' },
    },
    indicator: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      _expanded: {
        transform: 'rotate(180deg)',
      },
    },
  },
  variants: {
    variant: {
      outline: {
        root: {
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'gray.200',
          borderRadius: 'lg',
          divideY: '1px',
          divideColor: 'gray.200',
          _dark: { borderColor: 'gray.800', divideColor: 'gray.800' },
        },
        trigger: {
          _hover: { bg: 'gray.50', _dark: { bg: 'gray.900' } },
        },
      },
      separated: {
        root: {
          gap: '3',
        },
        item: {
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'gray.200',
          borderRadius: 'lg',
          boxShadow: 'xs',
          _dark: { borderColor: 'gray.800' },
        },
        trigger: {
          _hover: { bg: 'gray.50', _dark: { bg: 'gray.900' } },
        },
      },
      plain: {
        item: {
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: 'gray.200',
          _dark: { borderBottomColor: 'gray.800' },
        },
      },
    },
    size: {
      sm: {
        trigger: { py: '2.5', px: '3', fontSize: 'xs' },
        content: { pb: '2.5', px: '3', fontSize: 'xs' },
        indicator: { w: '4', h: '4' },
      },
      md: {
        trigger: { py: '3.5', px: '4', fontSize: 'sm' },
        content: { pb: '3.5', px: '4', fontSize: 'sm' },
        indicator: { w: '5', h: '5' },
      },
      lg: {
        trigger: { py: '4.5', px: '5', fontSize: 'md' },
        content: { pb: '4.5', px: '5', fontSize: 'md' },
        indicator: { w: '6', h: '6' },
      },
    },
  },
  defaultVariants: {
    variant: 'outline',
    size: 'md',
  },
});
```

### 2. Accordion React Compound Component (`src/components/Accordion/Accordion.tsx`)

```tsx
import * as React from 'react';
import { cx } from 'styled-system/css';
import { ChevronDown } from 'lucide-react';
import { accordionRecipe } from './accordion.recipe';

type AccordionSlotStyles = Record<'root' | 'item' | 'trigger' | 'content' | 'indicator', string>;

interface AccordionContextValue {
  styles: AccordionSlotStyles;
  openItems: Set<string>;
  toggleItem: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export interface AccordionRootProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'outline' | 'separated' | 'plain';
  size?: 'sm' | 'md' | 'lg';
  allowMultiple?: boolean;
  defaultValue?: string[];
  children: React.ReactNode;
}

const AccordionRoot = React.forwardRef<HTMLDivElement, AccordionRootProps>(function AccordionRoot(
  { variant = 'outline', size = 'md', allowMultiple = false, defaultValue = [], className, children, ...props },
  ref
) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set(defaultValue));
  const styles = accordionRecipe({ variant, size }) as AccordionSlotStyles;

  const toggleItem = React.useCallback(
    (value: string) => {
      setOpenItems((prev) => {
        const next = new Set(allowMultiple ? prev : []);
        if (prev.has(value)) {
          next.delete(value);
        } else {
          next.add(value);
        }
        return next;
      });
    },
    [allowMultiple]
  );

  return (
    <AccordionContext.Provider value={{ styles, openItems, toggleItem }}>
      <div ref={ref} className={cx(styles.root, className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
});

interface ItemContextValue {
  value: string;
  isOpen: boolean;
}

const ItemContext = React.createContext<ItemContextValue | null>(null);

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { value, className, children, ...props },
  ref
) {
  const rootContext = React.useContext(AccordionContext);
  if (!rootContext) throw new Error('Accordion.Item must be used within Accordion.Root');

  const isOpen = rootContext.openItems.has(value);

  return (
    <ItemContext.Provider value={{ value, isOpen }}>
      <div
        ref={ref}
        data-state={isOpen ? 'open' : 'closed'}
        className={cx(rootContext.styles.item, className)}
        {...props}
      >
        {children}
      </div>
    </ItemContext.Provider>
  );
});

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(function AccordionTrigger(
  { className, children, ...props },
  ref
) {
  const rootContext = React.useContext(AccordionContext);
  const itemContext = React.useContext(ItemContext);
  if (!rootContext || !itemContext) throw new Error('Accordion.Trigger must be inside Accordion.Item');

  const { value, isOpen } = itemContext;

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={isOpen}
      onClick={() => rootContext.toggleItem(value)}
      className={cx(rootContext.styles.trigger, className)}
      {...props}
    >
      <span>{children}</span>
      <span
        data-state={isOpen ? 'open' : 'closed'}
        className={rootContext.styles.indicator}
        style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
      >
        <ChevronDown size={18} />
      </span>
    </button>
  );
});

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(function AccordionContent(
  { className, children, ...props },
  ref
) {
  const rootContext = React.useContext(AccordionContext);
  const itemContext = React.useContext(ItemContext);
  if (!rootContext || !itemContext) throw new Error('Accordion.Content must be inside Accordion.Item');

  if (!itemContext.isOpen) return null;

  return (
    <div ref={ref} role="region" className={cx(rootContext.styles.content, className)} {...props}>
      {children}
    </div>
  );
});

export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
};
```

### 3. Pricing Tier Card Slot Recipe (`src/components/PricingCard/pricingCard.recipe.ts`)

```typescript
import { sva } from 'styled-system/css';

export const pricingCardRecipe = sva({
  slots: ['root', 'header', 'badge', 'price', 'interval', 'featureList', 'featureItem', 'ctaTrigger'],
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      p: '6',
      borderRadius: 'xl',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'gray.200',
      bg: 'white',
      boxShadow: 'sm',
      transition: 'all 0.2s ease',
      _dark: {
        bg: 'gray.900',
        borderColor: 'gray.800',
      },
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: '4',
    },
    badge: {
      fontSize: 'xs',
      fontWeight: 'semibold',
      px: '2.5',
      py: '0.5',
      borderRadius: 'full',
      bg: 'colorPalette.100',
      color: 'colorPalette.800',
      _dark: { bg: 'colorPalette.950', color: 'colorPalette.300' },
    },
    price: {
      fontSize: '4xl',
      fontWeight: 'bold',
      lineHeight: '1',
      color: 'gray.900',
      _dark: { color: 'white' },
    },
    interval: {
      fontSize: 'sm',
      color: 'gray.500',
      ml: '1',
    },
    featureList: {
      my: '6',
      display: 'flex',
      flexDirection: 'column',
      gap: '3',
      flex: '1',
    },
    featureItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '2',
      fontSize: 'sm',
      color: 'gray.700',
      _dark: { color: 'gray.300' },
    },
    ctaTrigger: {
      width: 'full',
      py: '2.5',
      px: '4',
      borderRadius: 'lg',
      fontWeight: 'semibold',
      fontSize: 'sm',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      outline: 'none',
    },
  },
  variants: {
    tier: {
      starter: {
        root: { colorPalette: 'slate' },
        ctaTrigger: {
          bg: 'gray.100',
          color: 'gray.900',
          _hover: { bg: 'gray.200' },
          _dark: { bg: 'gray.800', color: 'white', _hover: { bg: 'gray.700' } },
        },
      },
      pro: {
        root: { colorPalette: 'blue' },
        ctaTrigger: {
          bg: 'blue.600',
          color: 'white',
          _hover: { bg: 'blue.700' },
        },
      },
      enterprise: {
        root: { colorPalette: 'purple' },
        ctaTrigger: {
          bg: 'purple.600',
          color: 'white',
          _hover: { bg: 'purple.700' },
        },
      },
    },
    highlighted: {
      true: {
        root: {
          borderColor: 'colorPalette.500',
          borderWidth: '2px',
          boxShadow: 'xl',
          transform: 'scale(1.02)',
          zIndex: '1',
        },
      },
      false: {},
    },
  },
  defaultVariants: {
    tier: 'starter',
    highlighted: false,
  },
});
```

With `sva`, both compound components and multi-part complex layouts receive robust, compile-time verified styling that scales seamlessly across complex design systems.
