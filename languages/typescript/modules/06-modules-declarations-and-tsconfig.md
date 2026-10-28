## Lesson 4.3: Modules, Scripts, Declaration Files & Ambient Types

### Modules vs. Scripts & `moduleDetection`

In JavaScript and TypeScript, any file without a top-level `import` or `export` is treated as an ambient **Script**. All variables declared in a script pollute the global scope across the entire project!

```typescript
// In a file without import/export:
const appName = "GlobalApp"; // Conflicts with any other file declaring `appName`!
```

To prevent this, modern projects configure:
```json
{
  "compilerOptions": {
    "moduleDetection": "force"
  }
}
```
Setting `moduleDetection: "force"` guarantees every `.ts` file is treated as an isolated module, even if it lacks import/export statements.

### Declaration Files (`.d.ts`)

Declaration files contain only type information; they emit zero JavaScript code. They describe JavaScript libraries or ambient environments:

```typescript
// math.d.ts
export declare function add(a: number, b: number): number;
```

### Global Scope Augmentation (`declare global`)

Inside a module file, you can augment the global scope using `declare global`:

```typescript
// globals.d.ts
export {}; // Ensure this file is treated as a module

declare global {
  interface Window {
    __FEATURE_FLAGS__: Record<string, boolean>;
  }

  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      PORT?: string;
    }
  }
}
```

Now `window.__FEATURE_FLAGS__` and `process.env.DATABASE_URL` are strongly typed throughout your project!

### Ambient Module Declarations for Non-Code Assets

When importing SVG icons, CSS modules, or images in Vite/Webpack, TypeScript needs ambient module declarations:

```typescript
// custom-assets.d.ts
declare module "*.svg" {
  import React from "react";
  const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module "*.png" {
  const src: string;
  export default src;
}
```

### The `lib` Compiler Option

The `lib` array tells TypeScript which built-in JavaScript API declarations to include. For modern web applications:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```
`DOM.Iterable` is essential for running `for...of` loops over `NodeList` and `HTMLCollection`.

---

## Lesson 4.4: Recommended `tsconfig.json` & Designing Core Utility Types

### Matt Pocock's Total TypeScript Recommended `tsconfig.json` Matrix

Below is the definitive, production-tested `tsconfig.json` standard:

```json
{
  "compilerOptions": {
    /* Base Language & Environment */
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",

    /* Module Resolution */
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,

    /* Strictness Rules */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,

    /* Transpilation & Emission */
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    /* Performance & Interop */
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

#### Critical Compiler Options Explained:
- **`moduleResolution: "Bundler"`**: Designed for modern tools (Vite, Next.js, esbuild). Matches how bundlers resolve package exports. (For Node.js library packages, use `"NodeNext"`).
- **`noUncheckedIndexedAccess: true`**: Treats array lookups (`arr[0]`) and record lookups as `T | undefined`, eliminating out-of-bounds runtime crashes.
- **`exactOptionalPropertyTypes: true`**: Differentiates `{ prop?: string }` from `{ prop: string | undefined }`. You cannot pass `undefined` unless explicitly annotated.
- **`isolatedModules: true`**: Ensures single-file transpilers (Vite, SWC, Babel) can safely compile every file without cross-file type resolution.
- **`verbatimModuleSyntax: true`**: Replaces deprecated import flags. Enforces `import type` for type-only imports so runtime bundlers don't emit empty imports.

---

### Designing Core Utility Types for the `utils/` Folder

Every production project requires a rock-solid `utils/` library containing error models, type guards, and assertion utilities.

#### 1. The Generic `Result<T, E>` Algebraic Data Type
Avoid throwing exceptions for anticipated domain errors:

```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

#### 2. Reusable Type Predicates & Assertion Functions
```typescript
// Type Guard for Non-Nullable values
export function isDefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined;
}

// Type Guard for Non-Empty Arrays (guarantees at least 1 element)
export function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

// Assertion Function (throws at runtime, narrows type downstream)
export function assertIsDefined<T>(
  val: T,
  message: string = "Value must be defined"
): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new Error(message);
  }
}
```

---


## Lesson 8.2: Understanding & Augmenting Global Scope

### 8.2.1 TypeScript's Scope Model: Scripts vs. Modules

A file with no `import` or `export` statements is treated as a **script** in global scope. Any variable declared in it leaks into every other file. Conversely, any file containing `import` or `export` is a **module** with its own isolated scope.

### 8.2.2 The `declare global` Block

When inside a module, you must explicitly use `declare global` to augment the global scope:

```ts
// Ensure file is treated as a module
export {};

declare global {
  // Augmenting NodeJS process.env
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      PORT: string;
      DATABASE_URL: string;
    }
  }

  // Augmenting global browser Window
  interface Window {
    __APP_CONFIG__: {
      apiUrl: string;
      featureFlags: Record<string, boolean>;
    };
  }
}
```

Now `process.env.DATABASE_URL` is statically known, and `window.__APP_CONFIG__` autocompletes throughout the project.

### 8.2.3 Colocating Types for Global Interfaces

> [!TIP]
> Keep global augmentations colocated with the feature code that depends on them, rather than dumped into a single unstructured `globals.d.ts`. Always include `export {}` at the top of the file.

```ts
// analytics.ts
export interface AnalyticsClient {
  track(event: string, properties?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    analytics?: AnalyticsClient;
  }
}

export function trackEvent(name: string) {
  window.analytics?.track(name);
}
```

---


### Exercise 4.3: Declaration Merging & Ambient Module Definition
**Problem:** Augment Node's `ProcessEnv` to strongly type environment variables and declare an ambient module for SVG image imports.

```typescript
// env-and-assets.d.ts
export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      PORT: string;
      API_SECRET: string;
    }
  }
}

declare module "*.svg" {
  const content: string;
  export default content;
}

// Verification:
const env = process.env.NODE_ENV;
type test_Env = Expect<Equal<typeof env, "development" | "production" | "test">>;
```

---

### Exercise 4.4: Crafting the Production `utils/` Toolkit
**Problem:** Implement the `Result<T, E>` pattern along with `assertIsDefined` and `isNonEmpty` type helpers, verifying them with strict type assertions.

```typescript
// Solution:
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

export function assertIsDefined<T>(val: T, msg?: string): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new Error(msg ?? "Value must be defined");
  }
}

// Verification tests:
function processList(items: string[]) {
  if (isNonEmpty(items)) {
    const first = items[0];
    type test_First = Expect<Equal<typeof first, string>>;
  }
}

function processId(id: string | null) {
  assertIsDefined(id);
  type test_Narrowed = Expect<Equal<typeof id, string>>;
}
```

---

## Module Summary & Cheat Sheet

### Annotations vs Assertions
- `:` validates and widens. `as` forces a type without validation.
- `satisfies` validates conformance without widening literal types.
- Always prefer `@ts-expect-error` over `@ts-ignore`.

### The Weird Parts
- `{}` = any non-nullish value (including primitives).
- `object` = any non-primitive value.
- `Record<PropertyKey, never>` = truly empty object.
- Excess property checks only run on "fresh" inline object literals.
- `Object.keys()` returns `string[]` to protect against open subtypes.

### Modules & Ambient Types
- Use `"moduleDetection": "force"` to prevent global script pollution.
- Use `declare global { ... }` in modules to augment `Window` or `ProcessEnv`.
- Use `declare module "*.ext"` for asset imports.

### TSConfig Best Practices
- `moduleResolution: "Bundler"` for frontend/fullstack; `"NodeNext"` for Node libraries.
- `noUncheckedIndexedAccess: true` prevents out-of-bounds array crashes.
- `verbatimModuleSyntax: true` enforces explicit `import type`.
- `isolatedModules: true` guarantees safety with Vite, esbuild, SWC, and Babel.

