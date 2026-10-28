## Lesson 1.3: Basic Types, Primitive Annotations & Function Signatures

### 1.3.1 Primitives and the Implicit `any` Error

TypeScript includes the standard JavaScript primitives: `string`, `number`, `boolean`, `symbol`, `bigint`, `null`, and `undefined`.

With `"noImplicitAny": true` in `tsconfig.json`, TypeScript refuses to compile functions whose parameters lack annotations:

```typescript
// ❌ Error: Parameter 'message' implicitly has an 'any' type.
function logMessage(message) {
  console.log(message.toUpperCase());
}

// ✅ Explicit parameter annotation:
function logMessageExplicit(message: string): void {
  console.log(message.toUpperCase());
}
```

The `any` type disables type checking entirely for that symbol, turning off safety checks and auto-completion.

### 1.3.2 Parameter vs. Return Type Annotations

TypeScript has exceptional return type inference. In application code, annotating return types on simple functions is often unnecessary:

```typescript
// Inferred return type: number
function multiply(x: number, y: number) {
  return x * y;
}
// multiply(2, 4)
// ^? function multiply(x: number, y: number): number
```

**When SHOULD you explicitly annotate return types?**
1. **Public APIs / Library Boundaries**: Prevents unintentional breaking contract changes.
2. **Complex Functions with Multiple Branches**: Ensures every branch returns the intended shape.
3. **Recursive Functions**: TypeScript often cannot infer recursive return types without assistance.

### 1.3.3 Optional, Default, and Rest Parameters

```typescript
// 1. Optional parameters with '?' (type becomes T | undefined)
function formatUser(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}

// 2. Default parameters (type inferred from default value)
function createRequest(url: string, timeoutMs = 5000) {
  //                                ^? (parameter) timeoutMs: number
  return { url, timeoutMs };
}

// 3. Rest parameters (annotated as an array)
function sumValues(...values: number[]): number {
  return values.reduce((acc, curr) => acc + curr, 0);
}
```

### 1.3.4 Function Types & Callback Signatures

Functions are first-class values in JavaScript. In TypeScript, their types are expressed using arrow syntax `(params) => ReturnType`:

```typescript
// Function type alias:
type TransformFn = (input: string) => string;

function applyTransform(value: string, transformer: TransformFn): string {
  return transformer(value);
}

// Typing event listeners:
type EventCallback = (event: { timestamp: number; payload: string }) => void;

function registerHandler(event: string, cb: EventCallback): void {
  cb({ timestamp: Date.now(), payload: `Event: ${event}` });
}
```

> **Note on `void` vs. `undefined`**: A function returning `void` signals that the caller should ignore its return value. A callback typed as `() => void` can return any value at runtime, but TypeScript prevents callers from using that return value.

---

## Lesson 1.4: Arrays, Tuples, `Set`, `Map`, and `JSON.parse`

### 1.4.1 Arrays: `T[]` vs. `Array<T>`

Both syntaxes are functionally identical:
```typescript
const scores: number[] = [90, 85, 92];
const names: Array<string> = ["Alice", "Bob"];

// Arrays of objects:
type UserSummary = { id: string; name: string };
const users: UserSummary[] = [
  { id: "u_1", name: "Alice" },
  { id: "u_2", name: "Bob" },
];
```

### 1.4.2 Tuples: Fixed-Length and Position-Sensitive Arrays

A tuple is an array with a fixed number of elements where each position has a specific type:

```typescript
// Fixed tuple:
type KeyValuePair = [string, number];
const entry: KeyValuePair = ["port", 8080];

// Named tuple elements (great for documentation in hovers!):
type LatLng = [latitude: number, longitude: number];
const london: LatLng = [51.5074, -0.1278];

// Optional tuple elements:
type RequestConfig = [endpoint: string, retries?: number];
const req1: RequestConfig = ["/api/v1/users"];
const req2: RequestConfig = ["/api/v1/users", 3];

// Rest elements in tuples:
type CommandWithFlags = [command: string, ...flags: string[]];
const gitCmd: CommandWithFlags = ["git", "commit", "-m", "Initial commit"];
```

### 1.4.3 Sets and Maps

`Set` and `Map` accept generic type arguments:

```typescript
// Set<T>: Restricting collection items
const allowedRoles = new Set<"admin" | "editor" | "viewer">();
allowedRoles.add("admin");
// @ts-expect-error: "guest" is not assignable to allowed roles
allowedRoles.add("guest");

// Map<K, V>: Strongly-typed key/value lookups
const cache = new Map<string, { data: string; timestamp: number }>();
cache.set("cache_key_1", { data: "cached data", timestamp: Date.now() });

const cachedItem = cache.get("cache_key_1");
//    ^? { data: string; timestamp: number } | undefined
```
Notice that `.get(...)` on a `Map` always returns `V | undefined` because keys may not exist at runtime.

### 1.4.4 The Danger of `JSON.parse`

`JSON.parse` is typed in the TypeScript standard library as returning `any`:

```typescript
const rawData = '{"id": 1, "name": "Jane"}';
const result = JSON.parse(rawData);
//    ^? any
```

Because `result` is `any`, TypeScript permits calling non-existent methods like `result.nonExistentMethod()`, causing runtime crashes. The best practice is to immediately annotate the result as `unknown` and validate:

```typescript
const safeResult: unknown = JSON.parse(rawData);
```

---

## Lesson 1.5: Typing Async Functions, Promises & Network Requests

### 1.5.1 Promises and `async` Functions

An `async` function **always** wraps its return value in a `Promise`:

```typescript
// Return type is Promise<number>, not number:
async function fetchUserScore(userId: string): Promise<number> {
  return 42;
}

// Awaited type extraction:
type ScorePromise = ReturnType<typeof fetchUserScore>;
//   ^? Promise<number>
type UnwrappedScore = Awaited<ScorePromise>;
//   ^? number
```

### 1.5.2 Concurrent Promises: `Promise.all` and `Promise.allSettled`

`Promise.all` infers a tuple of results if passed a tuple of promises:

```typescript
async function fetchDashboard() {
  const [profile, settings] = await Promise.all([
    Promise.resolve({ name: "Alice" }),
    Promise.resolve({ theme: "dark" as const }),
  ]);
  // profile: { name: string }
  // settings: { theme: "dark" }
}

// Promise.allSettled discriminates fulfilled vs rejected results:
async function loadMetrics() {
  const results = await Promise.allSettled([
    Promise.resolve(100),
    Promise.reject(new Error("Network failure")),
  ]);

  for (const res of results) {
    if (res.status === "fulfilled") {
      console.log("Success value:", res.value);
      //                            ^? (property) value: number
    } else {
      console.error("Reason:", res.reason);
      //                       ^? (property) reason: any
    }
  }
}
```

### 1.5.3 Typing `fetch` Responses Safely

`response.json()` returns `Promise<any>`. To handle API responses safely without relying on reckless type casting:

```typescript
type UserDto = {
  id: string;
  email: string;
};

// Defensive async fetch wrapper:
async function fetchUser(userId: string): Promise<UserDto> {
  const response = await fetch(`/api/users/${userId}`);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data: unknown = await response.json();

  // Validate shape before asserting or returning:
  if (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "email" in data &&
    typeof (data as Record<string, unknown>).id === "string" &&
    typeof (data as Record<string, unknown>).email === "string"
  ) {
    return data as UserDto;
  }

  throw new Error("Invalid response payload received from server");
}
```

---

## Anti-Patterns vs. Best Practices

| Anti-Pattern | Best Practice | Why |
| :--- | :--- | :--- |
| **Over-annotating inferred variables**<br>`const count: number = 0;`<br>`const name: string = "Alice";` | **Rely on natural inference**<br>`const count = 0;`<br>`const name = "Alice";` | Redundant annotations clutter code and prevent TypeScript from inferring precise literal types (`"Alice"` vs `string`). |
| **Blunt casting with `as T` on `JSON.parse`**<br>`const user = JSON.parse(str) as User;` | **Cast to `unknown` and validate**<br>`const raw: unknown = JSON.parse(str);`<br>`const user = validateUser(raw);` | `as User` suppresses all type safety; invalid JSON will crash at runtime when accessing non-existent fields. |
| **Blocking Dev Server on `tsc` Errors**<br>Halting Vite/Next.js dev server on type errors. | **Run `tsc --noEmit` in CI/watch mode**<br>Fast bundler transpiles; `tsc` runs in separate terminal / CI. | Keeps Hot Module Replacement instantaneous while guaranteeing type verification before production deployment. |
| **Using `Function` or `object`**<br>`function run(cb: Function) {}` | **Specific callable types**<br>`function run(cb: (id: string) => void) {}` | `Function` is completely untyped and permits calling with any parameters, returning `any`. |

```typescript
// ❌ Anti-pattern: Untyped callback
function processBad(callback: Function) {
  callback("something", 123); // No compile error if caller expected no args!
}

// ✅ Best practice: Precise callback type
function processGood(callback: (message: string, code: number) => void) {
  callback("ready", 200);
}
```

---

## Hands-On Exercises & Step-by-Step Solutions

```typescript
// Shared test helpers for exercises:
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

### Exercise 1.1: The Typed Event Bus

#### Problem Description
Implement a type-safe `EventBus` class or helper object that allows subscribing to events and dispatching them with arbitrary payload arguments. The listener must support optional listener tags for debugging.

#### Starter Code
```typescript
// TODO: Define the Listener type and event registration signature
type Listener = unknown;

interface EventBus {
  on(event: string, listener: Listener, tag?: string): void;
  emit(event: string, ...args: unknown[]): void;
}

// Target test assertion:
type TestListenerType = Listener extends (event: string, ...args: any[]) => void ? true : false;
type Test1 = Expect<Equal<TestListenerType, true>>;
```

#### Hints
1. Functions in TypeScript can take rest parameters `...args: any[]`.
2. The return type should indicate that the caller does not consume the callback's result.

#### Step-by-Step Solution

```typescript
// 1. Define the listener as a callable function accepting the event name and rest parameters:
type Listener = (event: string, ...args: any[]) => void;

// 2. Define the EventBus interface with proper optional parameters and rest arguments:
interface EventBus {
  on(event: string, listener: Listener, tag?: string): void;
  emit(event: string, ...args: any[]): void;
}

// 3. Verification:
type TestListenerType = Listener extends (event: string, ...args: any[]) => void ? true : false;
type Test1 = Expect<Equal<TestListenerType, true>>;

// Implementation verification:
const bus: EventBus = {
  on(event, listener, tag) {
    console.log(`Registered ${tag ?? "anonymous"} on ${event}`);
  },
  emit(event, ...args) {
    console.log(`Emitting ${event} with`, args);
  },
};
```

---

### Exercise 1.2: Immutable Geo-Coordinate Cache

#### Problem Description
You are building an in-memory geo-location cache.
1. Define a named tuple `GeoPoint` representing `[latitude: number, longitude: number, altitude?: number]`.
2. Type a `Map` that maps a string cache key (e.g. `"berlin"`) to a `GeoPoint`.
3. Type a `Set` of allowed region codes: `"EU" | "US" | "APAC"`.

#### Starter Code
```typescript
// TODO: Replace any with proper types
type GeoPoint = any;
type RegionCode = any;

const coordinateCache = new Map();
const activeRegions = new Set();

// Tests:
type TestGeoPoint = Expect<Equal<GeoPoint, [latitude: number, longitude: number, altitude?: number]>>;
type TestCache = Expect<Equal<typeof coordinateCache, Map<string, GeoPoint>>>;
type TestRegions = Expect<Equal<typeof activeRegions, Set<"EU" | "US" | "APAC">>>;
```

#### Hints
1. In named tuples, optional elements are designated with `name?: type`.
2. `new Map<KeyType, ValueType>()` accepts type arguments directly.

#### Step-by-Step Solution

```typescript
// 1. Declare the named tuple with an optional third element:
type GeoPoint = [latitude: number, longitude: number, altitude?: number];

// 2. Declare the union of allowed regions:
type RegionCode = "EU" | "US" | "APAC";

// 3. Instantiate the generic Map and Set:
const coordinateCache = new Map<string, GeoPoint>();
const activeRegions = new Set<RegionCode>();

// 4. Verification:
type TestGeoPoint = Expect<Equal<GeoPoint, [latitude: number, longitude: number, altitude?: number]>>;
type TestCache = Expect<Equal<typeof coordinateCache, Map<string, GeoPoint>>>;
type TestRegions = Expect<Equal<typeof activeRegions, Set<"EU" | "US" | "APAC">>>;

// Usage test:
coordinateCache.set("berlin", [52.5200, 13.4050]);
coordinateCache.set("zugspitze", [47.4210, 10.9853, 2962]);
activeRegions.add("EU");
```

---

### Exercise 1.3: Safe Async Batch Loader

#### Problem Description
Implement a typed function `batchFetchResults` that takes an array of URL endpoints, executes them concurrently using `Promise.allSettled`, and returns an object separating successful responses from failed errors.

#### Starter Code
```typescript
type BatchFetchOutput<T> = {
  fulfilled: T[];
  rejected: string[];
};

// TODO: Type and implement batchFetchResults
async function batchFetchResults<T>(
  urls: string[],
  fetcher: (url: string) => Promise<T>
): Promise<BatchFetchOutput<T>> {
  // Implement here
  throw new Error("Not implemented");
}
```

#### Hints
1. Use `await Promise.allSettled(urls.map(url => fetcher(url)))`.
2. Inspect `item.status === "fulfilled"` to narrow the union to `PromiseFulfilledResult<T>`.

#### Step-by-Step Solution

```typescript
type BatchFetchOutput<T> = {
  fulfilled: T[];
  rejected: string[];
};

async function batchFetchResults<T>(
  urls: string[],
  fetcher: (url: string) => Promise<T>
): Promise<BatchFetchOutput<T>> {
  const settled = await Promise.allSettled(urls.map(url => fetcher(url)));

  const fulfilled: T[] = [];
  const rejected: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      fulfilled.push(result.value);
    } else {
      const errorMessage =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      rejected.push(errorMessage);
    }
  }

  return { fulfilled, rejected };
}

// Verification test:
async function testBatch() {
  const result = await batchFetchResults(["/a", "/b"], async (u) => ({ url: u, data: 123 }));
  type TestResult = Expect<Equal<typeof result, BatchFetchOutput<{ url: string; data: number }>>>;
}
```

---

### Exercise 1.4: Safe JSON Parser with Runtime Fallback

#### Problem Description
Write a helper function `parseJsonWithFallback<T>` that parses a raw JSON string. If parsing fails or returns invalid non-object data, it returns a provided default fallback value. The return type must be guaranteed to be `T`.

#### Starter Code
```typescript
// TODO: Annotate and implement parseJsonWithFallback
function parseJsonWithFallback(jsonString: any, fallback: any): any {
  // Implementation
}

// Tests:
const parsed = parseJsonWithFallback('{"port": 3000}', { port: 8080 });
type TestParsed = Expect<Equal<typeof parsed, { port: number }>>;
```

#### Hints
1. Avoid typing the parameter or return as `any`.
2. Catch errors in a `try...catch` block.
3. Use a type predicate or validation check before casting or returning.

#### Step-by-Step Solution

```typescript
function parseJsonWithFallback<T>(jsonString: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(jsonString);

    // If both fallback and parsed are objects, verify compatibility:
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof fallback === "object" &&
      fallback !== null
    ) {
      return parsed as T;
    }

    if (typeof parsed === typeof fallback) {
      return parsed as T;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

// Verification:
const parsedConfig = parseJsonWithFallback('{"port": 3000}', { port: 8080 });
type TestParsed = Expect<Equal<typeof parsedConfig, { port: number }>>;

const parsedNumber = parseJsonWithFallback("42", 0);
type TestNumber = Expect<Equal<typeof parsedNumber, number>>;
```

