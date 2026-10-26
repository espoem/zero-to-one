# Module 12: Monorepo & Shared UI Library Architecture

Scaling frontend development across large engineering teams requires monorepos where multiple applications (e.g., marketing site, customer dashboard, documentation hub) share a centralized UI component library and design system. However, integrating a build-time static CSS-in-JS engine across monorepo boundaries introduces architectural questions: Where does code generation run? How do shared packages import `styled-system` without duplicating output? How is CSS extracted without re-parsing third-party dependencies?

This module details production-tested monorepo architectures for Panda CSS using pnpm workspaces, Turborepo, `importMap`, and `panda ship`.

---

## Lesson 12.1: Introduction to Panda CSS in a Monorepo

In a single-package project, Panda scans local files and outputs `styled-system` directly into `src/styled-system`. In a monorepo, multiple packages must share tokens, recipes, and utilities without emitting conflicting class names or duplicating code generation.

### Standard Monorepo Workspace Topology

A typical production monorepo using pnpm workspaces or Turborepo organizes code into applications and shared packages:

```
my-monorepo/
├── apps/
│   ├── web/                     # Primary web application (Next.js / Remix)
│   ├── docs/                    # Design system documentation (Astro / Next.js)
│   └── dashboard/               # B2B customer portal (Vite / React)
├── packages/
│   ├── panda-preset/            # Shared tokens, semanticTokens, textStyles, layerStyles
│   ├── styled-system/           # Generated typed artifacts (@acme/styled-system)
│   └── ui/                      # Shared component library (Button, Dialog, Card)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Dependency Architecture Graph

The following diagram illustrates how packages interact during development and build phases:

```mermaid
graph TD
    Preset["packages/panda-preset<br/>(Design Tokens & Recipes)"]
    StyledSys["packages/styled-system<br/>(@acme/styled-system)"]
    UI["packages/ui<br/>(Shared React Components)"]
    AppWeb["apps/web<br/>(Next.js App)"]
    AppDash["apps/dashboard<br/>(Vite App)"]

    Preset -->|defines tokens & recipes| StyledSys
    Preset -->|imported in config| AppWeb
    Preset -->|imported in config| AppDash

    StyledSys -->|provides css() & styled| UI
    StyledSys -->|provides css() & styled| AppWeb
    StyledSys -->|provides css() & styled| AppDash

    UI -->|reusable components| AppWeb
    UI -->|reusable components| AppDash
```

### The Core Architectural Questions

1. **Where does `styled-system` live?** Does each application maintain its own generated folder, or is `styled-system` an independent workspace package imported by name?
2. **Which package extracts the CSS?** Does the shared UI package emit its own pre-compiled stylesheet, or do consumer applications scan shared UI components and emit a single unified, deduplicated CSS bundle?
3. **How are builds cached?** How do we configure Turborepo or Nx so that running `panda codegen` only invalidates downstream packages when tokens or recipes actually change?

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Generating styled-system locally inside packages/ui and importing relative paths across packages
import { css } from '../../../packages/ui/src/styled-system/css'; // Fragile, breaks bundlers and package encapsulation

// ✅ Best Practice: Configure importMap to publish or alias styled-system as a workspace package
import { css } from '@acme/styled-system/css'; // Clean, portable, and workspace-aware
```

---

## Lesson 12.2: Configuring Packages (`importMap`, `emitPackage`, `include`)

Panda CSS provides three official monorepo extraction strategies. Choosing the right strategy depends on your team's deployment requirements, build times, and package boundaries.

### Comparison of Monorepo Strategies

| Strategy | Mechanism | Best For | Pros | Cons |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy 1: Shared Package (`emitPackage: true`)** | `styled-system` is generated once into a shared workspace package (`packages/styled-system`). | Monorepos where all apps share the exact same design tokens and recipes. | Single source of truth, zero duplicate types, clean imports (`@acme/styled-system`). | Requires re-running codegen in the shared package when tokens change. |
| **Strategy 2: App-Level `include` Scanning** | Each application scans shared UI source files via relative globs in `panda.config.ts`. | Teams that want dead-code elimination and single unified CSS bundles. | Guaranteed deduplicated CSS bundle containing only styles actually used by the app. | Slower build times as apps parse external package source files. |
| **Strategy 3: Pre-Built Distribution (`panda ship`)** | Shared UI packages run `panda emit --artifacts` and publish `panda.buildinfo.json`. | Large enterprise monorepos or multi-repo component libraries distributed via npm. | Consumer apps do not parse TypeScript ASTs of component libraries; instant extraction. | Requires a build step for the UI package before consumption. |

---

### Strategy 1: Workspace-Shared Package via `importMap` & `emitPackage`

In this strategy, `packages/styled-system` is an independent package in your pnpm workspace.

1. **Configure `packages/styled-system/package.json`**:
```json
{
  "name": "@acme/styled-system",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.js",
  "types": "./types/index.d.ts",
  "exports": {
    "./css": { "types": "./types/css/index.d.ts", "default": "./src/css/index.js" },
    "./jsx": { "types": "./types/jsx/index.d.ts", "default": "./src/jsx/index.js" },
    "./tokens": { "types": "./types/tokens/index.d.ts", "default": "./src/tokens/index.js" },
    "./recipes": { "types": "./types/recipes/index.d.ts", "default": "./src/recipes/index.js" },
    "./styles.css": "./styles.css"
  }
}
```

2. **Configure `panda.config.ts` in the workspace root or styled-system package**:
```ts
// packages/styled-system/panda.config.ts
import { defineConfig } from '@pandacss/dev';
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  presets: [acmePreset],
  emitPackage: true,
  outdir: '@acme/styled-system', // Matches package name
  include: [
    '../ui/src/**/*.{ts,tsx}',
    '../../apps/*/src/**/*.{ts,tsx}',
  ],
});
```

All packages and applications now import uniformly:
```tsx
import { css } from '@acme/styled-system/css';
import { Box, Flex } from '@acme/styled-system/jsx';
```

---

### Strategy 2: App-Level `include` Scanning

If each application has slightly different token overrides or needs strict CSS tree-shaking, each application runs its own Panda instance and points `include` at the shared UI package:

```ts
// apps/web/panda.config.ts
import { defineConfig } from '@pandacss/dev';
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  presets: [acmePreset],
  outdir: 'styled-system',
  include: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}', // Scan shared UI components
  ],
});
```

---

### Strategy 3: Production Pre-Packaging with `panda ship`

When distributing a UI library to external consumers or across isolated microfrontends, consumers should not be forced to scan raw `.tsx` files inside `node_modules`.

The shared UI package runs `panda emit --artifacts`:
```bash
# Inside packages/ui
panda emit --artifacts
```

This command generates `panda.buildinfo.json` alongside compiled JavaScript files. When consumer applications build, Panda reads the pre-compiled `panda.buildinfo.json` manifest directly, extracting all styles instantly without running AST traversal on the library's source code.

### ❌ Anti-Pattern vs ✅ Best Practice

```ts
// ❌ Anti-Pattern: Omitting shared package paths from app include globs
// In apps/web/panda.config.ts:
export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'], // Forgets packages/ui; styles used inside Button or Modal disappear from CSS!
});

// ✅ Best Practice: Explicitly include shared package source files or use panda ship manifests
export default defineConfig({
  include: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
});
```

---

## Lesson 12.3: Creating a Shared UI Component Library (`packages/ui`)

Building a shared UI package requires configuring `package.json` entry points, TypeScript project references, and exporting clean component primitives.

### Step 1: Configuring `packages/ui/package.json`

```json
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./button": {
      "types": "./src/button/index.ts",
      "default": "./src/button/index.ts"
    },
    "./card": {
      "types": "./src/card/index.ts",
      "default": "./src/card/index.ts"
    }
  },
  "dependencies": {
    "@acme/styled-system": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.6.0"
  }
}
```

### Step 2: Configuring `packages/ui/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@acme/styled-system/*": ["../styled-system/src/*"]
    }
  },
  "include": ["src"]
}
```

### Step 3: Implementing Shared Components

Author UI components importing from `@acme/styled-system`:

```tsx
// packages/ui/src/button/index.tsx
import React, { forwardRef } from 'react';
import { styled, type HTMLStyledProps } from '@acme/styled-system/jsx';
import { cva, type RecipeVariantProps } from '@acme/styled-system/css';

export const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'medium',
    rounded: 'md',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
  },
  variants: {
    variant: {
      primary: { bg: 'brand.primary', color: 'white', _hover: { opacity: 0.9 } },
      secondary: { bg: 'gray.100', color: 'gray.900', _hover: { bg: 'gray.200' } },
      outline: { borderWidth: '1px', borderColor: 'border.muted', _hover: { bg: 'bg.muted' } },
    },
    size: {
      sm: { h: '8', px: '3', textStyle: 'body.sm' },
      md: { h: '10', px: '4', textStyle: 'body.md' },
      lg: { h: '12', px: '6', textStyle: 'body.lg' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonVariantProps = RecipeVariantProps<typeof buttonRecipe>;
export interface ButtonProps extends HTMLStyledProps<'button'>, ButtonVariantProps {}

const StyledButton = styled('button', buttonRecipe);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <StyledButton ref={ref} {...props} />;
});
Button.displayName = 'Button';
```

```tsx
// packages/ui/src/index.ts
export * from './button';
```

### ❌ Anti-Pattern vs ✅ Best Practice

```tsx
// ❌ Anti-Pattern: Bundling a compiled styles.css inside packages/ui and importing it in consumer apps alongside app CSS
// Causes duplicate resets, bloated CSS payloads, and cascade layer conflicts.

// ✅ Best Practice: Let consumer applications or the shared styled-system package emit the single unified styles.css
// The UI package only exports raw or typed TypeScript components.
```

---

## Lesson 12.4: Customizing & Extending the Shared Preset in Consumer Apps

Different applications in a monorepo serve different audiences. For example, `apps/marketing` may require display fonts, hero keyframes, and wide layout containers, while `apps/dashboard` needs dense data tables, narrow form inputs, and muted background palettes. Both apps should extend the core `@acme/panda-preset` without polluting each other.

### Extending the Preset in `apps/marketing`

```ts
// apps/marketing/panda.config.ts
import { defineConfig } from '@pandacss/dev';
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  presets: [acmePreset],
  include: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  outdir: 'styled-system',
  theme: {
    extend: {
      tokens: {
        fonts: {
          display: { value: 'Cal Sans, Inter, sans-serif' },
        },
      },
      textStyles: {
        heroTitle: {
          value: {
            fontFamily: 'display',
            fontSize: { base: '5xl', md: '7xl' },
            lineHeight: 'tight',
            fontWeight: 'extrabold',
          },
        },
      },
    },
  },
});
```

### Extending the Preset in `apps/dashboard`

```ts
// apps/dashboard/panda.config.ts
import { defineConfig } from '@pandacss/dev';
import acmePreset from '@acme/panda-preset';

export default defineConfig({
  presets: [acmePreset],
  include: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  outdir: 'styled-system',
  theme: {
    extend: {
      tokens: {
        spacing: {
          tableRow: { value: '32px' },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: '{colors.gray.50}' },
          },
        },
      },
    },
  },
});
```

### Turborepo Caching Pipeline (`turbo.json`)

To prevent redundant static extraction and TypeScript compilation across monorepo builds, configure `turbo.json` with strict inputs and outputs for Panda codegen:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "codegen": {
      "inputs": [
        "panda.config.ts",
        "packages/panda-preset/src/**"
      ],
      "outputs": [
        "styled-system/**",
        "packages/styled-system/**"
      ],
      "cache": true
    },
    "build": {
      "dependsOn": ["^codegen", "^build"],
      "inputs": [
        "src/**",
        "panda.config.ts",
        "tsconfig.json"
      ],
      "outputs": [
        ".next/**",
        "dist/**"
      ],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^codegen"],
      "cache": false,
      "persistent": true
    }
  }
}
```

With this configuration:
- Running `pnpm turbo run codegen` executes Panda code generation across all packages in parallel.
- Turborepo caches the generated `styled-system` output based on hashes of `panda.config.ts` and the preset source code.
- If no token or config changes occur, subsequent builds complete instantaneously from cache.

### ❌ Anti-Pattern vs ✅ Best Practice

```json
// ❌ Anti-Pattern: Missing codegen task dependency in turbo.json
// "build": { "dependsOn": ["^build"] }
// Fails in clean CI environments because styled-system has not been generated yet!

// ✅ Best Practice: Explicitly declare ^codegen as a prerequisite for build and dev
{
  "pipeline": {
    "codegen": {
      "outputs": ["styled-system/**"],
      "cache": true
    },
    "build": {
      "dependsOn": ["^codegen", "^build"]
    }
  }
}
```
