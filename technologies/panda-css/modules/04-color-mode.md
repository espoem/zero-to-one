# Module 04: Color Mode

Designing applications with first-class light and dark mode requires more than swapping color hex codes. A robust theming architecture must prevent Flash of Unstyled Content (FOUC) on Server-Side Rendering (SSR), synchronize cleanly with user system preferences, and scale across thousands of components without repetitive conditional styling. This module explores configuring color mode conditions in Panda CSS, comparing inline condition overrides with semantic design tokens, eliminating FOUC, and building a production-ready three-state theme switcher (Light / Dark / System).

---

## Lesson 4.1: Setting Up Color Mode

Color mode in Panda CSS is powered by Conditions. Rather than relying on JavaScript re-renders or runtime theme providers that inject CSS variables dynamically, Panda CSS generates conditional CSS rules that activate when a specific attribute or class is present on a parent element (typically the `<html>` or `<body>` tag).

### Attribute-Based vs Class-Based Strategies

There are two primary strategies for toggling color modes in CSS:

1. **Attribute-Based (`data-color-mode` or `data-theme`)**: The recommended standard for modern applications. It is explicit, avoids collisions with regular CSS utility classes, and works smoothly with multi-theme architectures (e.g. `data-theme="ocean"`, `data-theme="forest"`).
2. **Class-Based (`.dark`)**: Common in legacy setups or simple Tailwind migrations. It toggles a `.dark` class on the root element.

### Configuring Conditions in `panda.config.ts`

In `panda.config.ts`, you configure or extend the `conditions` object. By default, Panda includes `_dark: '.dark &'` or `_dark: '[data-color-mode=dark] &'`. You can customize the selector to match your project's attribute strategy:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  conditions: {
    extend: {
      // Attribute-based configuration
      light: '[data-color-mode=light] &',
      dark: '[data-color-mode=dark] &',
      
      // Alternative: Class-based configuration
      // dark: '.dark &',
    },
  },
});
```

With this configuration in place, whenever `<html data-color-mode="dark">` is set, any styling declared under `_dark` activates automatically across the DOM tree.

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Scoping Themes via React Context Injected Styles
```tsx
// ❌ Re-injecting CSS variables or styles via client React Context
const ThemeContext = createContext({ theme: 'light' });

export function ThemeWrapper({ children }) {
  const { theme } = useContext(ThemeContext);
  return (
    <div style={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#000000' }}>
      {children}
    </div>
  );
}
```
*Why this fails:* Inline style swapping bypasses the CSS cascade, causes layout recalculations on every render, cannot be cached, and causes hydration flashes on SSR.

#### ✅ Best Practice: Native DOM Attribute Conditions
```tsx
// ✅ Styles compile to static CSS selectors targeting data attributes
import { css } from 'styled-system/css';

const container = css({
  bg: { base: 'white', _dark: 'slate.900' },
  color: { base: 'slate.900', _dark: 'white' },
});
```
*Why this succeeds:* Styles are completely static. Swapping `<html data-color-mode="dark">` immediately switches the visual appearance across all elements simultaneously with zero JavaScript overhead.

---

## Lesson 4.2: Light & Dark Mode Styling

Panda CSS offers two distinct paradigms for authoring dark-mode-aware components: Inline Condition Styling and Semantic Token Styling.

### Paradigm 1: Inline Condition Styling

In inline condition styling, you define explicit color values for both light (base) and dark modes directly inside the component's `css()` call:

```tsx
import { css } from 'styled-system/css';

export function InlineCard() {
  return (
    <div
      className={css({
        bg: { base: 'white', _dark: 'gray.900' },
        borderColor: { base: 'gray.200', _dark: 'gray.800' },
        borderWidth: '1px',
        p: '6',
        rounded: 'lg',
      })}
    >
      <h3 className={css({ color: { base: 'gray.900', _dark: 'gray.100' } })}>
        Inline Styling
      </h3>
      <p className={css({ color: { base: 'gray.600', _dark: 'gray.400' } })}>
        Each color pair is declared manually at the call site.
      </p>
    </div>
  );
}
```

### Paradigm 2: Semantic Token Styling

In semantic token styling, you abstract design intent into named semantic tokens within `panda.config.ts`. The semantic token defines its light and dark values once in the central configuration. Components then reference the single token name:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: {
            canvas: {
              value: { base: '{colors.gray.50}', _dark: '{colors.gray.950}' },
            },
            surface: {
              value: { base: '{colors.white}', _dark: '{colors.gray.900}' },
            },
            subtle: {
              value: { base: '{colors.gray.100}', _dark: '{colors.gray.800}' },
            },
          },
          fg: {
            default: {
              value: { base: '{colors.gray.900}', _dark: '{colors.gray.50}' },
            },
            muted: {
              value: { base: '{colors.gray.600}', _dark: '{colors.gray.400}' },
            },
          },
          border: {
            default: {
              value: { base: '{colors.gray.200}', _dark: '{colors.gray.800}' },
            },
          },
        },
      },
    },
  },
});
```

Now, the component references the semantic tokens directly:

```tsx
import { css } from 'styled-system/css';

export function SemanticCard() {
  return (
    <div
      className={css({
        bg: 'bg.surface',
        borderColor: 'border.default',
        borderWidth: '1px',
        p: '6',
        rounded: 'lg',
      })}
    >
      <h3 className={css({ color: 'fg.default' })}>
        Semantic Token Styling
      </h3>
      <p className={css({ color: 'fg.muted' })}>
        Clean, token-driven, and scalable across thousands of components.
      </p>
    </div>
  );
}
```

### Why Semantic Tokens Scale Better

| Metric | Inline Conditions (`_dark`) | Semantic Tokens (`bg.surface`) |
| :--- | :--- | :--- |
| **Call Site Boilerplate** | High (must write `{ base, _dark }` on every styled element) | Minimal (single string token reference) |
| **Consistency** | Low (easy for developers to mix `gray.800` and `gray.900`) | High (enforced design system palette) |
| **Theme Swapping** | Hard (requires find-and-replace across entire codebase) | Centralized (update once in `panda.config.ts`) |
| **CSS Output Size** | Emits separate utility classes for every combination | Emits a single utility class referencing a CSS custom property |

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Scattering `{ base, _dark }` Everywhere
```tsx
// ❌ High cognitive load and repetitive boilerplate in every file
<button className={css({
  bg: { base: 'indigo.600', _dark: 'indigo.500' },
  color: { base: 'white', _dark: 'gray.100' },
  borderColor: { base: 'indigo.700', _dark: 'indigo.400' }
})}>
  Submit
</button>
```
*Why this fails:* Developers duplicate color decisions across dozens of components. Changing the dark mode brand tone requires editing hundreds of files.

#### ✅ Best Practice: Semantic Token References
```tsx
// ✅ Component focuses on intent, not color mechanics
<button className={css({
  bg: 'brand.solid',
  color: 'brand.contrast',
  borderColor: 'brand.border'
})}>
  Submit
</button>
```
*Why this succeeds:* Color mode switching is handled transparently by the generated CSS variable mapped to `brand.solid`. The component code remains compact and decoupled from color mechanics.

---

## Lesson 4.3: Responding to System Preferences & Preventing FOUC

A production color mode solution must support three user choices: explicit Light, explicit Dark, and System (following the operating system's setting).

### System Preferences (`_osDark` and `_osLight`)

Panda CSS provides built-in media query conditions for operating system preferences:
- `_osDark`: `@media (prefers-color-scheme: dark)`
- `_osLight`: `@media (prefers-color-scheme: light)`

### The Hybrid Selector Strategy

When building a three-state system, the selector strategy must satisfy two rules:
1. If the user explicitly sets `<html data-color-mode="dark">`, force dark mode.
2. If the user sets `<html data-color-mode="light">`, force light mode.
3. If `<html data-color-mode="system">` (or no attribute is present), follow `@media (prefers-color-scheme: dark)`.

You can express this hybrid condition directly in `panda.config.ts`:

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  conditions: {
    extend: {
      dark: '[data-color-mode=dark] &, [data-color-mode=system] &@media (prefers-color-scheme: dark)',
      light: '[data-color-mode=light] &, [data-color-mode=system] &@media (prefers-color-scheme: light)',
    },
  },
});
```

### Preventing Flash of Unstyled Content (FOUC) on SSR

Flash of Unstyled Content (FOUC) occurs when an application rendered on the server (e.g. Next.js, Remix) renders default light mode HTML, transmits it to the browser, and then—after client-side JavaScript loads and hydrates minutes or seconds later—reads `localStorage` and flips to dark mode. The user experiences an intense white flash before the page snaps dark.

#### The Root Cause:
```
Server renders HTML (default light) ──> Sent to browser (White screen renders!)
                                              │
Browser downloads JS bundle ──────────────────┘
                                              │
Client React hydrates ────────────────────────┘
                                              │
useEffect reads localStorage('theme') ────────┘
                                              │
React sets <html data-color-mode="dark"> ─────> Screen turns dark! (FOUC FLASH)
```

#### The Zero-FOUC Solution: Synchronous Head Script
To eliminate FOUC completely, place a tiny, blocking, dependency-free `<script>` in the document `<head>` before any body markup or stylesheets render. This script executes synchronously, inspects `localStorage` and `prefers-color-scheme`, and sets `data-color-mode` on `document.documentElement` **before** the browser draws the first pixel:

```html
<script>
  (function() {
    try {
      var stored = localStorage.getItem('app-theme') || 'system';
      var theme = stored;
      if (stored === 'system') {
        var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = isDark ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-color-mode', theme);
    } catch (e) {}
  })();
</script>
```

### ❌ Anti-Pattern vs ✅ Best Practice

#### ❌ Anti-Pattern: Reading `localStorage` Inside `useEffect`
```tsx
// ❌ Setting theme attribute inside useEffect causes violent FOUC on SSR
export function ThemeProvider({ children }) {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-color-mode', saved);
  }, []);
  return <>{children}</>;
}
```
*Why this fails:* In SSR applications, the HTML paints on screen with default light styles before JavaScript hydrates, flashing the user with a bright background.

#### ✅ Best Practice: Synchronous Inline Head Script + SSR-Safe Hydration
```tsx
// ✅ Blocking inline script sets data-color-mode before the first paint occurs
export function ThemeScript() {
  const code = `(function(){try{var s=localStorage.getItem('app-theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='system'?(m?'dark':'light'):s;document.documentElement.setAttribute('data-color-mode',t);}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
```
*Why this succeeds:* The attribute is resolved before the DOM parser renders visual elements. The initial paint uses the exact correct theme colors immediately.

---

## Lesson 4.4: Exercise — Three-State Theme Switcher (Light / Dark / System)

### Scenario & Requirements
You need to construct a complete, production-ready theming foundation for an enterprise Next.js/React application.

### Specifications
1. **Panda Configuration**:
   - Define semantic tokens for `bg.canvas`, `bg.surface`, `bg.muted`, `fg.default`, `fg.muted`, `border.subtle`, and `accent.solid`.
   - Configure `conditions.extend` for `dark` and `light` supporting `data-color-mode="dark"` and `data-color-mode="light"`.
2. **React Theme Context & Provider (`ThemeProvider`)**:
   - Supported modes: `'light' | 'dark' | 'system'`.
   - Persist user preference to `localStorage` under key `'app-color-mode'`.
   - Listen to `window.matchMedia('(prefers-color-scheme: dark)')` so that if the user selects `'system'`, changing OS theme settings dynamically updates the UI without page reloads.
   - Synchronize `<html data-color-mode="...">` attribute.
3. **Accessible Segmented Control Component (`ThemeSwitcher`)**:
   - Displays three options: "Light", "Dark", and "System".
   - Accessible button group utilizing `role="radiogroup"` and `aria-checked`.
   - Keyboard accessible with distinct `_focusVisible` outlines.
   - Visually indicates active selection using semantic token colors.
4. **Surface Card Demonstration Component (`SemanticSurfaceCard`)**:
   - A demonstration card styled exclusively with semantic tokens.
   - Validates that when switching modes, all surfaces, text colors, and accents adapt instantly.

### Starter Code Skeleton

```tsx
// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // TODO: Implement ThemeProvider adhering to the requirements above
  return <>{children}</>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
```

---

## Lesson 4.5: Solution — Production Theme Provider, Toggle & Semantic Surface Card

Here is the complete, production-grade implementation of the color mode architecture.

### Part 1: `panda.config.ts` Theme Definition

```ts
// panda.config.ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  outdir: 'styled-system',
  jsxFramework: 'react',

  conditions: {
    extend: {
      light: '[data-color-mode=light] &',
      dark: '[data-color-mode=dark] &',
    },
  },

  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: { base: '{colors.slate.50}', _dark: '{colors.slate.950}' } },
            surface: { value: { base: '{colors.white}', _dark: '{colors.slate.900}' } },
            muted: { value: { base: '{colors.slate.100}', _dark: '{colors.slate.800}' } },
          },
          fg: {
            default: { value: { base: '{colors.slate.900}', _dark: '{colors.slate.50}' } },
            muted: { value: { base: '{colors.slate.600}', _dark: '{colors.slate.400}' } },
            subtle: { value: { base: '{colors.slate.400}', _dark: '{colors.slate.500}' } },
          },
          border: {
            subtle: { value: { base: '{colors.slate.200}', _dark: '{colors.slate.800}' } },
            accent: { value: { base: '{colors.indigo.500}', _dark: '{colors.indigo.400}' } },
          },
          accent: {
            solid: { value: { base: '{colors.indigo.600}', _dark: '{colors.indigo.500}' } },
            hover: { value: { base: '{colors.indigo.700}', _dark: '{colors.indigo.600}' } },
            contrast: { value: { base: '{colors.white}', _dark: '{colors.white}' } },
          },
        },
      },
    },
  },
});
```

### Part 2: Zero-FOUC Blocking Head Script

```tsx
// src/theme/ThemeScript.tsx
export function ThemeScript() {
  const themeInitScript = `
    (function() {
      try {
        var storageKey = 'app-color-mode';
        var stored = localStorage.getItem(storageKey) || 'system';
        var isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var resolved = stored === 'system' ? (isDarkSystem ? 'dark' : 'light') : stored;
        document.documentElement.setAttribute('data-color-mode', resolved);
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
```

### Part 3: Production `ThemeProvider` and `useTheme` Hook

```tsx
// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'app-color-mode';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isMounted, setIsMounted] = useState(false);

  // Apply theme to DOM and localStorage
  const applyTheme = useCallback((targetTheme: Theme) => {
    const active = targetTheme === 'system' ? getSystemPreference() : targetTheme;
    setResolvedTheme(active);
    document.documentElement.setAttribute('data-color-mode', active);
  }, []);

  // Initialize on mount
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
    setThemeState(saved);
    applyTheme(saved);
    setIsMounted(true);
  }, [applyTheme]);

  // Listen to OS system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (e) {
      // Handle private browsing storage restrictions
    }
    applyTheme(newTheme);
  };

  // Prevent hydration mismatches by exposing consistent interface
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### Part 4: Accessible `ThemeSwitcher` Segmented Control

```tsx
// src/components/ThemeSwitcher.tsx
import { css } from 'styled-system/css';
import { useTheme, type Theme } from '../theme/ThemeProvider';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const options: { label: string; value: Theme; icon: string }[] = [
    { label: 'Light', value: 'light', icon: '☀️' },
    { label: 'Dark', value: 'dark', icon: '🌙' },
    { label: 'System', value: 'system', icon: '💻' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color Mode Switcher"
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        p: '1',
        bg: 'bg.muted',
        borderWidth: '1px',
        borderColor: 'border.subtle',
        rounded: 'xl',
        gap: '1',
      })}
    >
      {options.map((opt) => {
        const isSelected = theme === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            type="button"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.value)}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.5',
              px: '3',
              py: '1.5',
              rounded: 'lg',
              fontSize: 'xs',
              fontWeight: 'semibold',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',

              // Active state styling using semantic tokens
              bg: isSelected ? 'bg.surface' : 'transparent',
              color: isSelected ? 'fg.default' : 'fg.muted',
              shadow: isSelected ? 'xs' : 'none',

              _hover: {
                color: 'fg.default',
              },

              _focusVisible: {
                outline: '2px solid',
                outlineColor: 'border.accent',
                outlineOffset: '2px',
              },
            })}
          >
            <span aria-hidden="true">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

### Part 5: Demonstration Surface Card (`SemanticSurfaceCard`)

```tsx
// src/components/SemanticSurfaceCard.tsx
import { css } from 'styled-system/css';
import { useTheme } from '../theme/ThemeProvider';
import { ThemeSwitcher } from './ThemeSwitcher';

export function SemanticSurfaceCard() {
  const { theme, resolvedTheme } = useTheme();

  return (
    <div
      className={css({
        minH: '100vh',
        bg: 'bg.canvas',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: '6',
        transition: 'background-color 0.2s ease',
      })}
    >
      <div
        className={css({
          w: 'full',
          maxW: 'md',
          bg: 'bg.surface',
          borderWidth: '1px',
          borderColor: 'border.subtle',
          rounded: '2xl',
          p: '8',
          shadow: 'md',
          transition: 'all 0.2s ease',
        })}
      >
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
          <span className={css({ textTransform: 'uppercase', fontSize: 'xs', fontWeight: 'bold', color: 'border.accent' })}>
            Design Tokens Demo
          </span>
          <ThemeSwitcher />
        </div>

        <h2 className={css({ mt: '6', fontSize: 'xl', fontWeight: 'bold', color: 'fg.default' })}>
          Enterprise Workspace
        </h2>

        <p className={css({ mt: '2', fontSize: 'sm', color: 'fg.muted', lineHeight: 'relaxed' })}>
          This surface card uses 100% semantic tokens. When toggling between Light, Dark, and System modes, every background, text shade, and border adapts synchronously.
        </p>

        {/* State readout badges */}
        <div className={css({ mt: '6', p: '4', rounded: 'xl', bg: 'bg.muted', borderWidth: '1px', borderColor: 'border.subtle' })}>
          <div className={css({ display: 'flex', justifyContent: 'space-between', fontSize: 'xs' })}>
            <span className={css({ color: 'fg.muted' })}>User Preference:</span>
            <strong className={css({ color: 'fg.default', textTransform: 'capitalize' })}>{theme}</strong>
          </div>
          <div className={css({ display: 'flex', justifyContent: 'space-between', fontSize: 'xs', mt: '2' })}>
            <span className={css({ color: 'fg.muted' })}>Active Mode:</span>
            <strong className={css({ color: 'fg.default', textTransform: 'uppercase' })}>{resolvedTheme}</strong>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          className={css({
            mt: '6',
            w: 'full',
            py: '3',
            px: '4',
            bg: 'accent.solid',
            color: 'accent.contrast',
            fontWeight: 'semibold',
            rounded: 'xl',
            shadow: 'sm',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            _hover: { bg: 'accent.hover' },
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'border.accent',
              outlineOffset: '2px',
            },
          })}
        >
          Confirm Workspace Settings
        </button>
      </div>
    </div>
  );
}
```

### Architectural Breakdown of the Solution
1. **Semantic Color Decoupling**: Notice how neither `SemanticSurfaceCard` nor `ThemeSwitcher` ever specifies `{ base: '...', _dark: '...' }` at the call site. The components are declared with semantic intents (`bg.canvas`, `bg.surface`, `fg.default`, `accent.solid`).
2. **Zero FOUC on Server Rendering**: The `ThemeScript` renders as a blocking synchronous script in the document `<head>`, ensuring the `data-color-mode` attribute is applied before CSS evaluation and first paint.
3. **Reactive System Synchronization**: When `'system'` is selected, the `matchMedia` event listener observes OS dark/light mode toggles in real time, updating the UI dynamically without requiring manual page refreshes.
4. **Accessible Segmented Control**: `ThemeSwitcher` implements WAI-ARIA radio group patterns (`role="radiogroup"` and `role="radio"`) with accessible `aria-checked` states and distinct `_focusVisible` outlines.
