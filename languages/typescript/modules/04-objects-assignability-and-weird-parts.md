## Lesson 4.1: Annotations vs Assertions & `satisfies`

### The Core Spectrum: `:` vs. `as` vs. `satisfies`

Developers often confuse the three primary ways to type an expression:

```typescript
type Color = "red" | "green" | "blue";
type Palette = Record<string, Color | [number, number, number]>;

// 1. Annotation (`:`): Validates conformance and WIDENS to the annotated type
const p1: Palette = {
  primary: "red",
  secondary: [0, 255, 0],
};
// p1.primary is typed as: Color | [number, number, number] (Lost exact literal "red"!)

// 2. Assertion (`as`): Bypasses safety, forces compiler to accept, does NOT validate typos
const p2 = {
  primary: "purplllle", // Typo! But TypeScript doesn't check!
} as Palette;

// 3. The `satisfies` operator (TS 4.9+): Validates conformance WITHOUT widening
const p3 = {
  primary: "red",
  secondary: [0, 255, 0],
} satisfies Palette;
// p3.primary is preserved as exact literal: "red"!
// p3.secondary is preserved as: [number, number, number]!
p3.primary.toUpperCase(); // OK! No union narrowing needed!
```

```typescript
// If you make a typo with `satisfies`, it errors immediately:
const p4 = {
  // @ts-expect-error Type '"yellowish"' is not assignable to type 'Color | [number, number, number]'.
  primary: "yellowish",
} satisfies Palette;
```

### The Limits of `as` and the Double Assertion Smell

TypeScript only allows a type assertion `A as B` if `A` sufficiently overlaps with `B` (one is a subtype of the other):

```typescript
const num = 42;
// @ts-expect-error Conversion of type 'number' to type 'string' may be a mistake.
const str = num as string;
```

To bypass this check, developers resort to the **double assertion escape hatch**:

```typescript
// Bypasses the type checker completely
const forcedStr = num as unknown as string;
```

> [!CAUTION]
> Double assertion (`expr as unknown as T`) is an explicit lie to the compiler. It disables static type safety and should only be used as a last resort at low-level library boundaries with third-party untyped code.

### Non-Null Assertion (`!`) and Compiler Directives

The non-null assertion operator (`!`) strips `null` and `undefined` from a type:

```typescript
const root = document.getElementById("root")!;
//    ^? const root: HTMLElement (stripped null)
```

Only use `!` when the runtime guarantee is physically verified by your architecture (e.g. an HTML template guaranteed to contain `#root`). Otherwise, use narrowing or runtime assertion guards.

#### `@ts-ignore` vs. `@ts-expect-error`
- `@ts-ignore`: Silences any error on the next line forever, even if the error is resolved later by a library update.
- `@ts-expect-error`: Suppresses the error **only if an error exists**. If the code becomes valid, TypeScript emits an error alerting you that the directive is unused!

```typescript
// BEST PRACTICE: Always prefer @ts-expect-error with a descriptive reason
// @ts-expect-error Testing invalid input for runtime defensive check
validateUser(null);
```

### Global Typing Traps: `JSON.parse` and `localStorage`

Standard TypeScript types `JSON.parse` and `localStorage.getItem` as `any` or `string | null`:

```typescript
const raw = JSON.parse('{"id": 1}');
//    ^? const raw: any (Dangerous! Contaminates downstream types)
```

**Fix:** Treat raw inputs as `unknown` and validate them using Zod, type guards, or `@total-typescript/ts-reset`:

```typescript
function parseJsonSafe(json: string): unknown {
  return JSON.parse(json);
}
```

---

## Lesson 4.2: The Weird Parts of TypeScript

### `{}` vs. `object` vs. `Record<string, unknown>` vs. `Record<PropertyKey, never>`

One of TypeScript's most misunderstood types is `{}`:

```typescript
// 1. `{}` means: "Any value that is NOT null or undefined"
const v1: {} = "hello";       // Valid!
const v2: {} = 42;            // Valid!
const v3: {} = { a: 1 };      // Valid!
// @ts-expect-error Type 'null' is not assignable to type '{}'.
const v4: {} = null;

// 2. `object` means: "Any non-primitive JavaScript value" (objects, arrays, functions)
const o1: object = { a: 1 };  // Valid
const o2: object = [1, 2, 3]; // Valid
// @ts-expect-error Type 'string' is not assignable to type 'object'.
const o3: object = "hello";

// 3. `Record<string, unknown>` means: "An object with arbitrary string keys"
const r1: Record<string, unknown> = { key: "val" };

// 4. `Record<PropertyKey, never>` means: "A truly empty object (no keys allowed)"
const empty: Record<PropertyKey, never> = {};
// @ts-expect-error Type 'string' is not assignable to type 'never'.
const notEmpty: Record<PropertyKey, never> = { key: "forbidden" };
```

### Excess Property Warnings & Object Freshness

TypeScript uses structural typing: if type `B` has all properties of `A`, `B` is assignable to `A`. However, object literals trigger **Excess Property Checks (Freshness)**:

```typescript
type Options = { title: string; width?: number };
function setup(opts: Options) {}

// Direct object literal is "fresh" -> excess properties trigger an immediate error:
// @ts-expect-error Object literal may only specify known properties, and 'extra' does not exist in type 'Options'.
setup({ title: "Main", extra: true });

// Stale object reference -> excess property checks are bypassed:
const staleConfig = { title: "Main", extra: true };
setup(staleConfig); // Compiles without error!
```
*Rationale:* When writing an inline object literal, typos in property names (`widht` instead of `width`) are almost certainly bugs. Intermediate variables may intentionally represent richer models.

### `Object.keys()` & `Object.entries()` Return `string[]`

Why does `Object.keys(user)` return `string[]` instead of `(keyof typeof user)[]`?

```typescript
type User = { id: string; name: string };
const user: User = { id: "u1", name: "Alice" };

const keys = Object.keys(user);
//    ^? const keys: string[]
```

*The Soundness Rationale:* TypeScript interfaces are open and extensible. At runtime, an object may be an instance of a subclass with extra properties or prototype properties. If TypeScript inferred `(keyof User)[]`, indexing an object with those keys would be unsound.

**Type-Safe Helper:**
```typescript
export function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}
```

### Evolving `any`

Variables declared without an initializer or type annotation begin as `any` and evolve their types on successive assignments:

```typescript
let value; // type: any
value = "hello";
// value is now treated as string
value.toUpperCase();

value = 100;
// value has evolved to number
value.toFixed(2);
```
Avoid evolving `any` by always initializing variables or providing explicit annotations.

### Callback Parameter Assignability

Why can a callback taking *fewer* parameters be assigned to a function type expecting *more* parameters?

```typescript
const numbers = [10, 20, 30];
// Array.prototype.map expects (value: number, index: number, array: number[]) => U
// But we can pass an arrow function accepting only 1 parameter:
numbers.map((n) => n * 2);
```

*Rationale:* JavaScript callbacks regularly discard unused trailing parameters (such as `index` and `array`). If TypeScript demanded exact parameter count equality, nearly every idiomatic JavaScript callback would fail type checking.

---


## Lesson 2.4: Object Types, `interface` vs `type`, and Extending Objects

### 2.4.1 `interface` vs `type`

| Feature | `interface` | `type` Alias |
| :--- | :--- | :--- |
| **Declaration Merging** | Yes: multiple interfaces with the same name merge their properties. | No: duplicate type declarations throw a duplicate identifier error. |
| **Primitives, Unions, Tuples**| No: can only define object shapes. | Yes: can alias primitives, unions, tuples, functions, intersections. |
| **Extending / Inheritance** | `interface B extends A {}` | `type B = A & {}` |
| **Property Collision Behavior**| Reports clear compile error if property types conflict. | Silently collapses conflicting primitive properties into `never`. |

### 2.4.2 Incompatible Property Extension: `interface` vs `&`

This is one of the most critical differences in TypeScript object architecture:

```typescript
interface BaseUser {
  id: string;
}

// 1. Interface extension collision:
// ❌ COMPILE ERROR: Interface 'NumericUser' incorrectly extends interface 'BaseUser'.
// Types of property 'id' are incompatible. Type 'number' is not assignable to type 'string'.
interface NumericUser extends BaseUser {
  id: number;
}

// 2. Type intersection collision:
// ⚠️ NO IMMEDIATE ERROR! But id becomes string & number = never:
type CollisionUser = BaseUser & {
  id: number;
};

// When you attempt to create the object:
// ❌ Error: Type 'string' is not assignable to type 'never'.
const impossible: CollisionUser = {
  id: "123", // Can NEVER be satisfied!
};
```

> **Recommendation**: Prefer `interface extends` when defining domain entities with inheritance so conflicting property types are flagged immediately at the definition site rather than creating silent `never` traps at instantiation sites.

### 2.4.3 Dynamic Keys, Index Signatures, and `PropertyKey`

```typescript
// Index signature allowing arbitrary string keys:
type ConfigDictionary = {
  [key: string]: string | number;
};

// Record<Keys, Values> utility helper:
type UserPermissions = Record<string, boolean>;

// PropertyKey covers string | number | symbol:
type DynamicCache = Record<PropertyKey, unknown>;

// Allowing arbitrary keys while auto-completing known common keys:
type KnownHeaders = "Content-Type" | "Authorization" | (string & {});

const header: KnownHeaders = "Content-Type"; // Autocompletes, but accepts any custom string!
```

### 2.4.4 Essential Object Utilities

```typescript
interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  isVerified: boolean;
}

// 1. Pick<T, Keys>: Select only specific fields
type UserHeader = Pick<UserProfile, "username" | "avatarUrl">;

// 2. Omit<T, Keys>: Exclude specific fields
type CreateUserPayload = Omit<UserProfile, "id" | "isVerified">;

// 3. Partial<T>: Make all fields optional (ideal for PATCH payloads)
type UpdateUserDto = Partial<UserProfile>;

// 4. Required<T>: Make all optional fields strictly required
type StrictConfig = Required<{ port?: number; host?: string }>;
```

#### Quirk of `Omit` with Discriminated Unions
Standard `Omit<T, K>` does not distribute over unions. Running `Omit<NetworkState, "latencyMs">` will strip all union variants into a single flattened object, destroying the discriminant tag. To safely omit from a union, use a distributive conditional type helper:

```typescript
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
```

---


## Anti-Patterns vs. Best Practices

| Anti-Pattern | Best Practice | Rationale |
| :--- | :--- | :--- |
| `val as MyType` for objects | `val satisfies MyType` | `satisfies` validates the shape while keeping literal types un-widened. |
| `@ts-ignore` to suppress errors | `@ts-expect-error` with comment | Fails automatically when the underlying issue is fixed, preventing dead suppressions. |
| Using `{}` as generic object | `Record<string, unknown>` | `{}` accepts strings, numbers, and booleans; only rejects null/undefined. |
| Blindly accessing `items[0].id` | Enable `noUncheckedIndexedAccess` | Prevents runtime `TypeError: Cannot read properties of undefined`. |
| Unsafe double cast `x as any as Y` | Runtime validation or Zod schema | Ensures runtime payload matches type expectations. |
| Throwing arbitrary untyped exceptions | Return `Result<T, E>` | Explicit, typesafe error handling that forces caller to handle failures. |

```typescript
// Comparison Example:
// BAD: Type assertion masks missing properties and errors
const config = { host: "localhost" } as { host: string; port: number };
// Compiles, but config.port is undefined at runtime!

// GOOD: satisfies checks properties without widening
// @ts-expect-error Property 'port' is missing in type '{ host: string; }'
const safeConfig = { host: "localhost" } satisfies { host: string; port: number };
```

---

## Hands-On Exercises & Step-by-Step Solutions

```typescript
// Total TypeScript verification test helpers
export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
```


### Exercise 2.3: Entity Schema Transformation with Utility Types

#### Problem Description
Given an authoritative `DatabaseUser` interface:
1. Derive `CreateUserInput` which omits `"id"`, `"createdAt"`, and `"updatedAt"`.
2. Derive `UpdateUserInput` where all fields of `CreateUserInput` are optional.
3. Derive `UserSummary` which picks only `"id"`, `"email"`, and `"role"`.
4. Create a dictionary type `UserLookupTable` keyed by string ID mapping to `DatabaseUser`.

#### Starter Code
```typescript
interface DatabaseUser {
  id: string;
  email: string;
  role: "admin" | "member" | "guest";
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

// TODO: Implement using Pick, Omit, Partial, and Record
type CreateUserInput = any;
type UpdateUserInput = any;
type UserSummary = any;
type UserLookupTable = any;

// Tests:
type TestCreate = Expect<Equal<CreateUserInput, { email: string; role: "admin" | "member" | "guest"; fullName: string }>>;
type TestSummary = Expect<Equal<UserSummary, { id: string; email: string; role: "admin" | "member" | "guest" }>>;
type TestLookup = Expect<Equal<UserLookupTable, Record<string, DatabaseUser>>>;
```

#### Hints
1. `Omit<Type, Keys>` strips specified keys.
2. `Partial<Type>` makes all keys optional.
3. `Record<KeyType, ValueType>` builds lookup tables.

#### Step-by-Step Solution

```typescript
interface DatabaseUser {
  id: string;
  email: string;
  role: "admin" | "member" | "guest";
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

// 1. Omit system-managed metadata:
type CreateUserInput = Omit<DatabaseUser, "id" | "createdAt" | "updatedAt">;

// 2. Make update fields optional:
type UpdateUserInput = Partial<CreateUserInput>;

// 3. Pick specific summary fields:
type UserSummary = Pick<DatabaseUser, "id" | "email" | "role">;

// 4. Dictionary lookup table:
type UserLookupTable = Record<string, DatabaseUser>;

// Verification:
type TestCreate = Expect<Equal<CreateUserInput, { email: string; role: "admin" | "member" | "guest"; fullName: string }>>;
type TestSummary = Expect<Equal<UserSummary, { id: string; email: string; role: "admin" | "member" | "guest" }>>;
type TestLookup = Expect<Equal<UserLookupTable, Record<string, DatabaseUser>>>;
type TestUpdate = Expect<Equal<UpdateUserInput, { email?: string; role?: "admin" | "member" | "guest"; fullName?: string }>>;
```

---


### Exercise 4.1: Type-Safe Config Loader with `satisfies` and `as const`
**Problem:** Construct an application route configuration where route paths are strictly checked against a known route schema, while preserving exact literal types for navigation helpers.

```typescript
type RouteConfig = Record<string, { path: string; requiresAuth: boolean }>;

// Solution:
export const ROUTES = {
  home: { path: "/", requiresAuth: false },
  dashboard: { path: "/dashboard", requiresAuth: true },
  settings: { path: "/settings", requiresAuth: true },
} as const satisfies RouteConfig;

export type RouteName = keyof typeof ROUTES;
export type DashboardPath = (typeof ROUTES)["dashboard"]["path"];

// Type verification tests:
type test_Name = Expect<Equal<RouteName, "home" | "dashboard" | "settings">>;
type test_Path = Expect<Equal<DashboardPath, "/dashboard">>;
```

---

### Exercise 4.2: Handling the "Weird Parts": Truly Empty Objects & `typedKeys`
**Problem:** Write a helper function that checks if an object is truly empty (rejecting primitives and non-empty objects) and a `typedKeys` utility.

```typescript
// Solution:
export type EmptyObject = Record<PropertyKey, never>;

export function isObjectEmpty(obj: Record<string, unknown>): obj is EmptyObject {
  return Object.keys(obj).length === 0;
}

export function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

// Type verification tests:
const user = { id: "u1", active: true };
const keys = typedKeys(user);
type test_Keys = Expect<Equal<typeof keys, ("id" | "active")[]>>;

const validEmpty: EmptyObject = {};
// @ts-expect-error Type 'number' is not assignable to type 'never'.
const invalidEmpty: EmptyObject = { a: 1 };
```

---

