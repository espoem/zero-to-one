# Module 05: Type Transformations Part 1 — Inference, Unions, Template Literals, & Type Helpers

> **Weeks 12–13 | Type Transformations Fundamentals**
> 
> *Prerequisites*: Solid understanding of TypeScript basic types, interfaces, object shapes, and standard narrowing (Modules 01–04).

---

## The Type Transformation Mindset

In TypeScript, types are not merely static annotations; **the type system is a pure, compile-time functional programming language**. Just as runtime JavaScript functions take values as inputs and compute new values as outputs, TypeScript's type system provides language constructs to take types as inputs, inspect their structures, filter their components, and compute entirely new types as outputs.

```
┌────────────────────────────────────────────────────────┐
│                   RUNTIME JAVASCRIPT                   │
│   Values  ───[ Pure Functions / Transformations ]───►  │ New Values
└────────────────────────────────────────────────────────┘
                           ▲
                           │ typeof (The Bridge)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   COMPILE-TIME TYPES                   │
│   Types   ───[ Type Helpers / Transformations ]────►   │ New Types
└────────────────────────────────────────────────────────┘
```

When building modern libraries, design systems, API clients, or large-scale web applications, duplicating type definitions across boundaries leads to synchronization bugs. If a backend schema, route table, or UI action definition changes, manually updating types across five files invites drift.

By mastering type transformations, you establish a **single source of truth**: you derive types directly from runtime values, slice unions with mathematical precision, synthesize strings with template literal permutations, and encapsulate reusable logic in composable type helpers.

### Learning Objectives

By the end of this module, you will be able to:
1. Extract types from runtime values, functions, class constructors, and async Promises using `typeof`, `ReturnType<T>`, `Parameters<T>`, `ConstructorParameters<T>`, and `Awaited<T>`.
2. Differentiate union categories and transform unions using `Extract<T, U>`, `Exclude<T, U>`, and indexed access (`T[K]`, `T[number]`, `keyof`).
3. Construct dynamic, strictly validated string types using Template Literal Types, string utility helpers (`Capitalize`, `Uppercase`, etc.), and cartesian product unions.
4. Author reusable, battle-tested generic Type Helpers with parameter constraints (`extends`), default types, and tuple spreads.

---

## Lesson 5.1: Inference Basics from Values & Functions

### Value Space vs. Type Space

TypeScript exists across two parallel worlds: **Value Space** and **Type Space**. Value space contains everything that survives compilation and executes at runtime: variables, object instances, classes, and closures. Type space contains interfaces, type aliases, and type operators that disappear completely during compilation (`tsc` emit).

The `typeof` operator is the primary bridge from Value Space into Type Space:

```typescript
// Value Space
const appConfig = {
  endpoint: "https://api.totaltypescript.com",
  timeoutMs: 5000,
  retries: 3,
  headers: {
    "X-Client-Version": "2.4.0",
  },
} as const;

// Type Space (bridged via typeof)
type AppConfig = typeof appConfig;
//   ^? type AppConfig = { readonly endpoint: "https://api.totaltypescript.com"; ... }
```

Without `as const`, TypeScript widens `"https://api.totaltypescript.com"` to `string` and `5000` to `number`. With `as const`, TypeScript preserves exact literal values and marks every nested property `readonly`.

### Extracting Function Return Types (`ReturnType<T>`)

When working with factory functions, Redux action creators, or library hooks, you frequently need the return type of a function without manually typing a parallel interface.

`ReturnType<T>` takes a function type `T` and yields its return value:

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

function createUserSession(userId: string, role: "admin" | "member") {
  return {
    sessionId: `sess_${Math.random().toString(36).slice(2)}`,
    user: {
      userId,
      role,
      permissions: role === "admin" ? ["read", "write", "delete"] : ["read"],
    },
    createdAt: new Date(),
  };
}

// Extract the return type:
type UserSession = ReturnType<typeof createUserSession>;
//   ^? type UserSession = { sessionId: string; user: { userId: string; role: "admin" | "member"; permissions: string[]; }; createdAt: Date; }

type TestUserSession = Expect<
  Equal<
    UserSession,
    {
      sessionId: string;
      user: {
        userId: string;
        role: "admin" | "member";
        permissions: string[];
      };
      createdAt: Date;
    }
  >
>;
```

> [!WARNING]
> You cannot write `ReturnType<createUserSession>`. `createUserSession` is a value identifier! You must bridge into type space using `typeof createUserSession`.

### Extracting Function Parameters (`Parameters<T>`)

`Parameters<T>` extracts a function's arguments as a tuple type:

```typescript
function processPayment(
  transactionId: string,
  amount: number,
  currency: "USD" | "EUR" | "GBP",
  options?: { notifyCustomer?: boolean; idempotencyKey?: string }
): boolean {
  return true;
}

type ProcessPaymentParams = Parameters<typeof processPayment>;
//   ^? type ProcessPaymentParams = [transactionId: string, amount: number, currency: "USD" | "EUR" | "GBP", options?: { notifyCustomer?: boolean; idempotencyKey?: string; } | undefined]

// Indexing into the tuple to extract specific parameters:
type TransactionId = ProcessPaymentParams[0]; // string
type PaymentCurrency = ProcessPaymentParams[2]; // "USD" | "EUR" | "GBP"
type PaymentOptions = ProcessPaymentParams[3]; // { notifyCustomer?: boolean; idempotencyKey?: string; } | undefined
```

### Constructor Parameters and Instance Types

For classes or constructible functions, use `ConstructorParameters<T>` and `InstanceType<T>`:

```typescript
class DatabaseConnection {
  constructor(
    public readonly host: string,
    public readonly port: number,
    private readonly auth: { user: string; pass: string }
  ) {}

  connect(): void {}
}

type ConnectionArgs = ConstructorParameters<typeof DatabaseConnection>;
//   ^? type ConnectionArgs = [host: string, port: number, auth: { user: string; pass: string; }]

type ConnectionInstance = InstanceType<typeof DatabaseConnection>;
//   ^? type ConnectionInstance = DatabaseConnection
```

### Extracting from Async Functions: `Awaited<T>`

Async functions always return a `Promise<T>`. If you use `ReturnType<typeof fetchUser>`, you receive `Promise<{ id: string; name: string }>`. To unwrap the inner value of a Promise (or nested Promises), TypeScript 4.5 introduced `Awaited<T>`:

```typescript
async function fetchUserProfile(userId: string) {
  return {
    id: userId,
    displayName: "Alex Rivera",
    email: "alex@example.com",
    lastLogin: new Date(),
  };
}

// Naive ReturnType leaves the Promise wrapper:
type RawReturn = ReturnType<typeof fetchUserProfile>;
//   ^? type RawReturn = Promise<{ id: string; displayName: string; email: string; lastLogin: Date; }>

// Awaited strips the Promise wrapper recursively:
type UserProfile = Awaited<ReturnType<typeof fetchUserProfile>>;
//   ^? type UserProfile = { id: string; displayName: string; email: string; lastLogin: Date; }

type TestUserProfile = Expect<
  Equal<
    UserProfile,
    {
      id: string;
      displayName: string;
      email: string;
      lastLogin: Date;
    }
  >
>;
```

---

## Lesson 5.2: Unions, Discriminated Unions & Indexed Access Transformations

### Union Terminology: Primitives vs. Objects vs. Discriminated Unions

A union type represents a value that can be one of several possibilities:

1. **Union of Primitives**: `"GET" | "POST" | "PUT" | "DELETE"` or `string | number`.
2. **Union of Objects (Untagged)**: `{ id: string; name: string } | { sku: string; price: number }`. Here, TypeScript cannot easily differentiate them at runtime without inspecting structural properties using `'id' in obj`.
3. **Discriminated Union (Tagged Union)**: Every member object shares a common literal property (the **discriminant**):

```typescript
type AppNotification =
  | { type: "email"; recipientEmail: string; subject: string; body: string }
  | { type: "sms"; phoneNumber: string; message: string }
  | { type: "push"; deviceToken: string; badgeCount: number; payload: Record<string, string> };
```

### Extracting the Discriminator

To extract the set of all possible tags from a discriminated union, index into the discriminant key:

```typescript
type NotificationType = AppNotification["type"];
//   ^? type NotificationType = "email" | "sms" | "push"

type TestNotificationType = Expect<Equal<NotificationType, "email" | "sms" | "push">>;
```

### Filtering Unions with `Extract<T, U>` and `Exclude<T, U>`

Under the hood, TypeScript provides two fundamental union filtering utilities:

- `Extract<T, U>`: Keeps only members of `T` that are assignable to `U`.
- `Exclude<T, U>`: Removes members of `T` that are assignable to `U`.

```typescript
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "keydown"; key: string; code: number }
  | { type: "focus" }
  | { type: "blur" };

// Extract only the keydown event
type KeyEvent = Extract<Event, { type: "keydown" }>;
//   ^? type KeyEvent = { type: "keydown"; key: string; code: number; }

// Extract all mouse/pointer events (if multiple had { type: "click" | "hover" })
type ClickOrFocus = Extract<Event, { type: "click" | "focus" }>;
//   ^? type ClickOrFocus = { type: "click"; x: number; y: number; } | { type: "focus"; }

// Exclude focus and blur events
type ActiveInteraction = Exclude<Event, { type: "focus" | "blur" }>;
//   ^? type ActiveInteraction = { type: "click"; x: number; y: number; } | { type: "keydown"; key: string; code: number; }
```

### Indexed Access Types: Objects and Tuples

Indexed access types (`T[K]`) allow you to look up property types on another type, behaving like property lookups in JavaScript:

```typescript
interface UserAccount {
  id: string;
  profile: {
    avatarUrl: string;
    bio: string;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
  };
}

// 1. Direct key lookup
type Profile = UserAccount["profile"];
//   ^? type Profile = { avatarUrl: string; bio: string; }

// 2. Nested lookup
type Bio = UserAccount["profile"]["bio"]; // string

// 3. Union key lookup (extracting multiple property types into a union)
type AccountAttributes = UserAccount["id" | "profile"];
//   ^? type AccountAttributes = string | { avatarUrl: string; bio: string; }

// 4. Extracting ALL values of an object type: Obj[keyof Obj]
type AllUserAccountValues = UserAccount[keyof UserAccount];
//   ^? type AllUserAccountValues = string | { avatarUrl: string; ... } | { canEdit: boolean; ... }
```

### Converting Arrays and Tuples to Unions

To convert a tuple or array to a union of its elements, index by `number`:

```typescript
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// typeof HTTP_METHODS is: readonly ["GET", "POST", "PUT", "PATCH", "DELETE"]
type HttpMethod = typeof HTTP_METHODS[number];
//   ^? type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type TestMethod = Expect<Equal<HttpMethod, "GET" | "POST" | "PUT" | "PATCH" | "DELETE">>;
```

### Converting Object Values to a Union

To extract all values of an `as const` object dictionary:

```typescript
const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Step 1: get union of keys
type StatusCodeKey = keyof typeof HTTP_STATUS_CODES;
//   ^? type StatusCodeKey = "OK" | "CREATED" | "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR"

// Step 2: index the object type by its keys
type StatusCode = typeof HTTP_STATUS_CODES[StatusCodeKey];
//   ^? type StatusCode = 200 | 201 | 400 | 401 | 404 | 500

type TestStatusCode = Expect<Equal<StatusCode, 200 | 201 | 400 | 401 | 404 | 500>>;
```

---

## Lesson 5.3: Template Literal Types

Introduced in TypeScript 4.1, **Template Literal Types** bring JavaScript's backtick string interpolation syntax directly into type space. They can constrain strings to dynamic patterns, generate permutations, and parse string structures.

### Restricting Strings to Dynamic Patterns

Template literals allow you to enforce structural requirements on strings without regex runtime overhead:

```typescript
// Must begin with a slash
type AbsolutePath = `/${string}`;

const validPath: AbsolutePath = "/api/v1/users";
// @ts-expect-error - Missing leading slash
const invalidPath: AbsolutePath = "api/v1/users";

// Specific URL protocols
type HttpsUrl = `https://${string}`;
type S3Uri = `s3://${string}/${string}`;

const assetUri: S3Uri = "s3://production-bucket/avatars/user-99.png";
// @ts-expect-error - Must follow s3://<bucket>/<key>
const badAsset: S3Uri = "s3://just-a-bucket";
```

### Cartesian Product / Permutations of Template Literal Unions

When you interpolate multiple unions into a template literal, TypeScript computes the full **cartesian product** of all possible combinations:

```typescript
type Size = "sm" | "md" | "lg";
type Variant = "primary" | "secondary" | "danger";

type ButtonClass = `btn-${Variant}-${Size}`;
//   ^? type ButtonClass = "btn-primary-sm" | "btn-primary-md" | "btn-primary-lg" | "btn-secondary-sm" | ...

type TestButtonClass = Expect<
  Equal<
    ButtonClass,
    | "btn-primary-sm"
    | "btn-primary-md"
    | "btn-primary-lg"
    | "btn-secondary-sm"
    | "btn-secondary-md"
    | "btn-secondary-lg"
    | "btn-danger-sm"
    | "btn-danger-md"
    | "btn-danger-lg"
  >
>;
```

### Built-in String Manipulation Utilities

TypeScript includes four intrinsic type helpers specifically for transforming string literals:

1. `Uppercase<StringType>`: Converts all characters to uppercase.
2. `Lowercase<StringType>`: Converts all characters to lowercase.
3. `Capitalize<StringType>`: Converts first character to uppercase.
4. `Uncapitalize<StringType>`: Converts first character to lowercase.

```typescript
type Entity = "user" | "order" | "invoice";

// Action string creators
type Action = `create_${Entity}`; // "create_user" | "create_order" | "create_invoice"
type UpperAction = Uppercase<Action>; // "CREATE_USER" | "CREATE_ORDER" | "CREATE_INVOICE"

// Event handler names
type EventHandlerName = `on${Capitalize<Entity>}Changed`;
//   ^? type EventHandlerName = "onUserChanged" | "onOrderChanged" | "onInvoiceChanged"

type TestHandlers = Expect<
  Equal<EventHandlerName, "onUserChanged" | "onOrderChanged" | "onInvoiceChanged">
>;
```

### Filtering Union Strings with Pattern Matching

You can combine `Extract` with template literals to slice a subset of routes or event keys:

```typescript
type AppRoutes =
  | "/home"
  | "/about"
  | "/admin/dashboard"
  | "/admin/settings"
  | "/admin/users"
  | "/api/v1/health"
  | "/api/v1/posts";

type AdminRoutes = Extract<AppRoutes, `/admin/${string}`>;
//   ^? type AdminRoutes = "/admin/dashboard" | "/admin/settings" | "/admin/users"

type ApiRoutes = Extract<AppRoutes, `/api/${string}`>;
//   ^? type ApiRoutes = "/api/v1/health" | "/api/v1/posts"
```

### Deriving Objects with `Record<TemplateUnion, Value>`

Template literal unions integrate seamlessly with `Record<K, V>` to construct strictly typed configuration maps:

```typescript
type Direction = "top" | "right" | "bottom" | "left";
type SpacingToken = `margin${Capitalize<Direction>}`;
//   ^? type SpacingToken = "marginTop" | "marginRight" | "marginBottom" | "marginLeft"

type MarginConfig = Record<SpacingToken, number>;
//   ^? type MarginConfig = { marginTop: number; marginRight: number; marginBottom: number; marginLeft: number; }

const cardMargin: MarginConfig = {
  marginTop: 16,
  marginRight: 24,
  marginBottom: 16,
  marginLeft: 24,
};
```

---

## Lesson 5.4: Building Reusable Type Helpers

A **Type Helper** is a generic type alias that functions like a pure function in type space: it accepts types as type parameters and returns a newly constructed type.

### Designing `Maybe<T>`

A common utility is wrapping values that may be missing:

```typescript
type Maybe<T> = T | null | undefined;

type NullableString = Maybe<string>; // string | null | undefined
```

### Constraining Type Parameters with `extends`

Unconstrained generics accept `any` type, including primitives, `unknown`, or `void`. To ensure type safety, constrain type arguments using `extends`:

```typescript
// Unconstrained (Unsafe):
// type GetId<T> = T["id"]; // ❌ Error: Type '"id"' cannot be used to index type 'T'.

// Constrained (Safe):
type GetId<T extends { id: string | number }> = T["id"];

type UserId = GetId<{ id: string; name: string }>; // string
type OrderId = GetId<{ id: number; total: number }>; // number

// @ts-expect-error - Argument has no 'id' property
type Invalid = GetId<{ name: "Item without ID" }>;
```

### Non-Empty Arrays

Standard arrays `T[]` can be empty `[]`. To represent arrays guaranteed to contain at least one element:

```typescript
type NonEmptyArray<T> = [T, ...T[]];

function processBatch<T>(items: NonEmptyArray<T>): T {
  // Guaranteed to exist without undefined checks!
  const firstItem = items[0];
  return firstItem;
}

processBatch(["item1", "item2"]); // OK

// @ts-expect-error - Empty array is not assignable to NonEmptyArray<string>
processBatch<string>([]);
```

### Default Type Parameters

Just as JavaScript functions support default arguments, type helpers support default type parameters:

```typescript
type ApiResponse<TData = unknown, TError = { message: string; statusCode: number }> =
  | { success: true; data: TData; error: null }
  | { success: false; data: null; error: TError };

// Using defaults:
type DefaultResponse = ApiResponse;
//   ^? type DefaultResponse = { success: true; data: unknown; error: null; } | { success: false; data: null; error: { message: string; statusCode: number; }; }

// Specifying custom data type:
type UserResponse = ApiResponse<{ id: string; username: string }>;
//   ^? type UserResponse = { success: true; data: { id: string; username: string; }; error: null; } | ...
```

### Constraining to Functions or Non-Nullable Types

To ensure a type helper only operates on callable functions:

```typescript
type AnyFunction = (...args: any[]) => any;

type SafeParameters<T extends AnyFunction> = Parameters<T>;
type SafeReturnType<T extends AnyFunction> = ReturnType<T>;
```

To reject `null` and `undefined` at the type parameter level, constrain to `{}`:

```typescript
// In TypeScript, {} represents "any value except null or undefined"
type EnsureNotNull<T extends {}> = T;

type ValidNumber = EnsureNotNull<number>; // OK
type ValidObject = EnsureNotNull<{ foo: string }>; // OK

// @ts-expect-error - null is not allowed
type NullNotAllowed = EnsureNotNull<null>;

// @ts-expect-error - undefined is not allowed
type UndefinedNotAllowed = EnsureNotNull<undefined>;
```

### Composing Type Helpers

Complex type transformations are built by piping simpler type helpers together:

```typescript
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type StrictOmit<T, K extends keyof T> = Prettify<Pick<T, Exclude<keyof T, K>>>;

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: Date;
}

type PublicUser = StrictOmit<UserRecord, "passwordHash" | "salt">;
//   ^? type PublicUser = { id: string; email: string; createdAt: Date; }

type TestPublicUser = Expect<
  Equal<
    PublicUser,
    {
      id: string;
      email: string;
      createdAt: Date;
    }
  >
>;
```

---

## Anti-Patterns vs. Best Practices

| Anti-Pattern | Best Practice | Why it Matters |
| :--- | :--- | :--- |
| **Manual Type Duplication**<br>`interface User { ... }`<br>`const defaultUser: User = ...` | **Deriving from Source of Truth**<br>`const defaultUser = { ... } as const;`<br>`type User = typeof defaultUser;` | Prevents synchronization drift between runtime configuration and type definitions. |
| **Loose String Types**<br>`type Route = string;`<br>`type Event = string;` | **Template Literal Constraints**<br>`type Route = \`/${string}\`;`<br>`type Event = \`${Entity}:${Action}\`;` | Catch malformed paths, IDs, or event strings at compile-time instead of runtime. |
| **Unconstrained Generics**<br>`type ValueOf<T> = T[keyof T];`<br>*(fails if T is primitive)* | **Constrained Generic Parameters**<br>`type ValueOf<T extends object> = T[keyof T];` | Produces clear error messages at the call site rather than cryptic internal compiler errors. |
| **Index Signatures for Enums**<br>`const STATUS: Record<string, string> = { ... }` | **`as const` Object with Key/Value Unions**<br>`const STATUS = { ... } as const;`<br>`type Status = typeof STATUS[keyof typeof STATUS];` | Preserves exact literal types without losing autocomplete or enabling invalid keys. |
| **Unfiltered Big Unions**<br>Passing massive unions down component trees | **`Extract` / `Exclude` Slicing**<br>`type AdminSubNav = Extract<NavItems, { role: "admin" }>;` | Keeps sub-components cleanly bounded to only the variants they handle. |

---

## Hands-On Exercises & Type Tests

Put your knowledge into practice. In each exercise, examine the requirements and verify your solution against the `Expect<Equal<...>>` type assertions.

### Exercise 1: Extracting Async Function Signature & Config Schema

#### Scenario
You are integrating an external microservice SDK. The SDK provides a function `fetchServiceConfig` that returns an async configuration payload. Without modifying the SDK source code, derive the concrete unpacked configuration type and the type of its first parameter.

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

// The SDK function (pretend this comes from node_modules)
declare function fetchServiceConfig(
  serviceId: `svc_${string}`,
  options: { timeoutMs: number; debug?: boolean }
): Promise<{
  endpoint: string;
  cluster: "us-east-1" | "eu-central-1" | "ap-southeast-1";
  features: {
    enableMetrics: boolean;
    rateLimitPerSec: number;
  };
}>;

// TODO: Define ServiceConfig (the awaited return type of fetchServiceConfig)
type ServiceConfig = Awaited<ReturnType<typeof fetchServiceConfig>>;

// TODO: Define ServiceId (the type of the first parameter)
type ServiceId = Parameters<typeof fetchServiceConfig>[0];

// Type Tests:
type TestServiceConfig = Expect<
  Equal<
    ServiceConfig,
    {
      endpoint: string;
      cluster: "us-east-1" | "eu-central-1" | "ap-southeast-1";
      features: {
        enableMetrics: boolean;
        rateLimitPerSec: number;
      };
    }
  >
>;

type TestServiceId = Expect<Equal<ServiceId, `svc_${string}`>>;
```

---

### Exercise 2: Discriminated Union Slicing & Value Extraction

#### Scenario
Given an analytics event stream consisting of multiple event variants, create type helpers to:
1. Extract only checkout-related events (`"checkout_start"` and `"checkout_complete"`).
2. Extract the payload type of the `"error"` event without manual re-declaration.
3. Exclude `"session_heartbeat"` from the stream.

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

type AnalyticsEvent =
  | { name: "checkout_start"; cartId: string; totalAmount: number }
  | { name: "checkout_complete"; cartId: string; transactionId: string; timestamp: number }
  | { name: "page_view"; path: string; referrer: string }
  | { name: "session_heartbeat"; activeSeconds: number }
  | { name: "error"; code: number; message: string; stack?: string };

// TODO: Implement CheckoutEvents
type CheckoutEvents = Extract<AnalyticsEvent, { name: "checkout_start" | "checkout_complete" }>;

// TODO: Implement ErrorPayload (the object shape of the "error" event)
type ErrorPayload = Extract<AnalyticsEvent, { name: "error" }>;

// TODO: Implement UserInitiatedEvents (exclude "session_heartbeat")
type UserInitiatedEvents = Exclude<AnalyticsEvent, { name: "session_heartbeat" }>;

// Type Tests:
type TestCheckoutEvents = Expect<
  Equal<
    CheckoutEvents,
    | { name: "checkout_start"; cartId: string; totalAmount: number }
    | { name: "checkout_complete"; cartId: string; transactionId: string; timestamp: number }
  >
>;

type TestErrorPayload = Expect<
  Equal<ErrorPayload, { name: "error"; code: number; message: string; stack?: string }>
>;

type TestUserInitiatedEvents = Expect<
  Equal<
    UserInitiatedEvents,
    | { name: "checkout_start"; cartId: string; totalAmount: number }
    | { name: "checkout_complete"; cartId: string; transactionId: string; timestamp: number }
    | { name: "page_view"; path: string; referrer: string }
    | { name: "error"; code: number; message: string; stack?: string }
  >
>;
```

---

### Exercise 3: Array & Const Object to Union Conversion

#### Scenario
A frontend team maintains design system token constants. Derive:
1. `BrandColor`: union of all values in the `BRAND_COLORS` array.
2. `Breakpoint`: union of all keys in `BREAKPOINTS`.
3. `BreakpointValue`: union of all pixel values in `BREAKPOINTS`.

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

const BRAND_COLORS = ["indigo", "emerald", "amber", "rose", "cyan"] as const;

const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
  widescreen: 1440,
} as const;

// TODO: Define BrandColor from BRAND_COLORS
type BrandColor = typeof BRAND_COLORS[number];

// TODO: Define Breakpoint from BREAKPOINTS keys
type Breakpoint = keyof typeof BREAKPOINTS;

// TODO: Define BreakpointValue from BREAKPOINTS values
type BreakpointValue = typeof BREAKPOINTS[keyof typeof BREAKPOINTS];

// Type Tests:
type TestBrandColor = Expect<
  Equal<BrandColor, "indigo" | "emerald" | "amber" | "rose" | "cyan">
>;

type TestBreakpoint = Expect<
  Equal<Breakpoint, "mobile" | "tablet" | "desktop" | "widescreen">
>;

type TestBreakpointValue = Expect<
  Equal<BreakpointValue, 375 | 768 | 1024 | 1440>
>;
```

---

### Exercise 4: Dynamic Event Handler Generator with Template Literals

#### Scenario
Build a type helper `EventHandlers<Events>` that takes a union of event names (e.g. `"click" | "hover" | "submit"`) and generates an object type where keys are prefixed with `"on"` and capitalized, and each value is an event handler callback function `(event: EventName) => void`.

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

type DomEvents = "click" | "change" | "focus";

// TODO: Implement EventHandlerMap
type EventHandlerMap<TEvents extends string> = {
  [K in TEvents as `on${Capitalize<K>}`]: (event: K) => void;
};

type ResultHandlers = EventHandlerMap<DomEvents>;

// Type Tests:
type TestResultHandlers = Expect<
  Equal<
    ResultHandlers,
    {
      onClick: (event: "click") => void;
      onChange: (event: "change") => void;
      onFocus: (event: "focus") => void;
    }
  >
>;
```

---

### Exercise 5: Robust Generic Entity Store Helper

#### Scenario
Create a reusable type helper `EntityState<TEntity, TStatus = "idle">` representing normalized state.
Requirements:
1. `TEntity` must be constrained to an object possessing an `id` of type `string | number`.
2. `TStatus` must be constrained to string literals, defaulting to `"idle" | "loading" | "success" | "error"`.
3. The helper returns an object containing:
   - `ids`: array of `TEntity["id"]`.
   - `entities`: `Record<TEntity["id"], TEntity>`.
   - `status`: `TStatus`.
   - `selectedId`: `TEntity["id"] | null`.

```typescript
import type { Equal, Expect } from "../examples/utils/type-helpers";

type DefaultStatus = "idle" | "loading" | "success" | "error";

// TODO: Implement EntityState
type EntityState<
  TEntity extends { id: string | number },
  TStatus extends string = DefaultStatus
> = {
  ids: Array<TEntity["id"]>;
  entities: Record<TEntity["id"], TEntity>;
  status: TStatus;
  selectedId: TEntity["id"] | null;
};

// Test entity
interface User {
  id: string;
  name: string;
  email: string;
}

type UserState = EntityState<User>;

type TestUserState = Expect<
  Equal<
    UserState,
    {
      ids: string[];
      entities: Record<string, User>;
      status: "idle" | "loading" | "success" | "error";
      selectedId: string | null;
    }
  >
>;

// Custom status override:
type StrictState = EntityState<User, "pending" | "resolved">;

type TestStrictState = Expect<
  Equal<
    StrictState,
    {
      ids: string[];
      entities: Record<string, User>;
      status: "pending" | "resolved";
      selectedId: string | null;
    }
  >
>;
```

---

## Summary & Next Steps

In this module, you mastered the fundamental building blocks of type transformations:
- Bridging value space and type space using `typeof`, `as const`, `ReturnType`, and `Awaited`.
- Slicing and refining unions using `Extract`, `Exclude`, and indexed access lookups (`T[keyof T]`, `T[number]`).
- Dynamically constructing and validating string unions using Template Literal Types and string intrinsic utilities.
- Encapsulating generic logic with constrained type helpers.

In **Module 06: Conditional and Mapped Types**, we will unlock TypeScript's advanced logic engine: pattern matching using `infer`, distributive conditional types, mapped types with key remapping (`as`), and solve the capstone challenge problems.
