# Module 02: Unions, Literals, Narrowing, & Objects
**Week 3 | Intermediate Track**

---

## Overview & Mental Model

In TypeScript, **types are sets of allowable runtime values**:

- Primitive `number` represents the infinite set of all valid JavaScript numbers.
- String literal `"pending"` represents a singleton set containing exactly the string `"pending"`.
- The Union Operator (`|`) represents the **set union**: a value belongs to `A | B` if it belongs to set `A`, set `B`, or both.
- The Intersection Operator (`&`) represents the **set intersection**: a value belongs to `A & B` only if it simultaneously satisfies the contracts of both `A` and `B`.
- The bottom type `never` represents the **empty set** (zero allowable values).

```
         Set A: { "read" }          Set B: { "write" }
                  \                /
                   \              /
            Union (A | B): { "read", "write" }
                    (either permission)

         Type Admin: { id: string; role: "admin" }
         Type Audited: { createdAt: Date }
                    \            /
                     \          /
         Intersection (Admin & Audited):
         { id: string; role: "admin"; createdAt: Date }
                    (must satisfy both)
```

### The Total TypeScript Type Testing Helper

We verify compile-time behavior using Matt Pocock's standard Total TypeScript assertions:

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Lesson 2.1: Union Types, Literal Types & Assignability

### 2.1.1 Sets of Values and Type Assignability

Type assignability answers a single question: *Is set A a subset of set B?*

If `A` is assignable to `B` (`target: B = sourceA`), every possible value in `A` is legally accepted wherever `B` is expected:

```typescript
type Direction = "north" | "south" | "east" | "west";

const move = "north";
const dir: Direction = move; // ✅ OK: "north" is in Direction

const anyString = "up";
// @ts-expect-error: Type '"up"' is not assignable to type 'Direction'
const invalidDir: Direction = anyString;
```

Because `"north"` is a subset of `string`, you can pass a `Direction` to a function expecting `string`. But you cannot pass a general `string` to a parameter expecting `Direction`.

### 2.1.2 Literal Types and Type Widening

When you declare a variable with `let`, TypeScript infers a **widened** mutable primitive type. When you declare with `const`, TypeScript infers the exact **literal** type:

```typescript
let statusLet = "loading";
//  ^? let statusLet: string (can be reassigned to any string)

const statusConst = "loading";
//    ^? const statusConst: "loading" (can never change)
```

For objects and arrays, `const` only freezes the variable reference, not the internal properties. To preserve literal types on object fields, use the `as const` assertion:

```typescript
// Without as const: properties widen to string
const buttonConfig1 = {
  theme: "dark",
  size: "large",
};
// buttonConfig1.theme: string

// With as const: deeply read-only literal types
const buttonConfig2 = {
  theme: "dark",
  size: "large",
} as const;
// buttonConfig2.theme: "dark"
// buttonConfig2.size: "large"
```

### 2.1.3 Handling `null` and `undefined` with `strictNullChecks`

Without `"strictNullChecks": true`, `null` and `undefined` are automatically assignable to every type in the language. With `strictNullChecks` enabled (standard in all modern TypeScript projects), they form distinct sets:

```typescript
function findUserById(id: string): { id: string; name: string } | null {
  if (id === "root") return { id: "root", name: "Administrator" };
  return null;
}

const user = findUserById("guest");
// ❌ Error: 'user' is possibly 'null'.
console.log(user.name);

// ✅ Correct handling via narrowing:
if (user !== null) {
  console.log(user.name); // user: { id: string; name: string }
}
```

> **Warning on `!` (Non-null assertion)**: The non-null assertion operator (`user!.name`) silences compiler warnings without adding any runtime check. If `user` is actually `null`, the program crashes at runtime. Avoid `!` in production code.

### 2.1.4 Combining Unions & Combinatorial Limits

Unions combine cleanly using type aliases and template literal types:

```typescript
type Status = "pending" | "resolved" | "rejected";
type Stage = "dev" | "staging" | "prod";

type DeploymentKey = `${Stage}_${Status}`;
//   ^? "dev_pending" | "dev_resolved" | "dev_rejected" |
//      "staging_pending" | "staging_resolved" | "staging_rejected" |
//      "prod_pending" | "prod_resolved" | "prod_rejected"
```

> **How Big Can a Union Be?** TypeScript permits thousands of union members, but excessive combinatorial Cartesian products (such as nesting five 10-member unions together into `10^5 = 100,000` permutations) will trigger compiler error `TS2590: Expression produces a union type that is too complex to represent`. Keep generated unions bounded.

---

## Lesson 2.2: Control-Flow Narrowing

TypeScript uses **control-flow analysis** to inspect conditional statements, loops, and branching logic, refining broad types into narrower subtypes.

### 2.2.1 Primitive Narrowing: `typeof`, `instanceof`, and `"prop" in obj`

```typescript
// 1. typeof narrowing:
function padLeft(value: string, padding: string | number): string {
  if (typeof padding === "number") {
    // padding is narrowed to number:
    return " ".repeat(padding) + value;
  }
  // padding is narrowed to string:
  return padding + value;
}

// 2. instanceof narrowing:
function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

// 3. "in" operator narrowing:
type EmailUser = { email: string };
type PhoneUser = { phone: string };

function contactUser(user: EmailUser | PhoneUser) {
  if ("email" in user) {
    console.log("Sending email to:", user.email);
    //                                ^? (property) email: string
  } else {
    console.log("Calling phone:", user.phone);
    //                            ^? (property) phone: string
  }
}
```

### 2.2.2 Truthiness, Equality, and Narrowing Pitfalls

#### Trap 1: `typeof null === "object"`
In JavaScript, `typeof null` evaluates to `"object"`. A check for `typeof val === "object"` will still include `null`:
```typescript
function processData(val: { count: number } | null) {
  // ❌ Bug: val could be null!
  if (typeof val === "object") {
    // val is still { count: number } | null
  }

  // ✅ Correct guard:
  if (typeof val === "object" && val !== null) {
    console.log(val.count); // val: { count: number }
  }
}
```

#### Trap 2: Truthiness Narrowing Eliminates `0` and `""`
```typescript
function printLength(text: string | undefined) {
  // ❌ Dangerous if "" is a valid string:
  if (text) {
    console.log(text.length);
  }

  // ✅ Explicit undefined check:
  if (text !== undefined) {
    console.log(text.length); // Works for empty string "" as well!
  }
}
```

#### Trap 3: Narrowing Maps Does Not Propagate to `map.get()`
```typescript
const map = new Map<string, number>();
map.set("counter", 1);

if (map.has("counter")) {
  const count = map.get("counter");
  //    ^? const count: number | undefined
  // Even though map.has() was true, map.get() is STILL number | undefined!
  // TypeScript does not track side effects across method calls on Map.
}

// ✅ Correct pattern: Store the lookup result in a local variable:
const count = map.get("counter");
if (count !== undefined) {
  console.log(count + 1); // count: number
}
```

### 2.2.3 Narrowing by Throwing Errors (Guard Clauses)

When a branch throws an error or calls a function returning `never`, TypeScript eliminates that branch from the downstream control flow:

```typescript
function processTransaction(id: string | null) {
  if (id === null) {
    throw new Error("Transaction ID is required");
  }

  // Downstream, id is strictly string:
  id.toUpperCase();
  // ^? (parameter) id: string
}
```

### 2.2.4 The `unknown` Type in Catch Clauses

Under `useUnknownInCatchVariables` (default in modern TS), `catch` variables are typed as `unknown` instead of `any`:

```typescript
try {
  JSON.parse("{ invalid json }");
} catch (error: unknown) {
  // ❌ Error: 'error' is of type 'unknown'.
  // console.log(error.message);

  // ✅ Narrow before accessing properties:
  if (error instanceof Error) {
    console.error("Caught error message:", error.message);
  } else {
    console.error("Unknown error caught:", String(error));
  }
}
```

### 2.2.5 Narrowing Scope in Closures

TypeScript intentionally resets narrowed types inside nested callbacks if the variable is declared with `let`, because callbacks can execute asynchronously after the outer variable has been modified:

```typescript
let selectedId: string | null = "abc";

if (selectedId !== null) {
  // selectedId is string here

  setTimeout(() => {
    // ❌ Inside closure, selectedId reverts to string | null!
    // selectedId.toUpperCase();
  }, 100);
}

// ✅ Fix: Bind to a const local before entering closure:
if (selectedId !== null) {
  const currentId = selectedId; // const never reassigns
  setTimeout(() => {
    console.log(currentId.toUpperCase()); // currentId: string
  }, 100);
}
```

---

## Lesson 2.3: Discriminated Unions & Exhaustiveness Checking

A **Discriminated Union** (also called a Tagged Union or Algebraic Data Type) consists of variants that all share a single literal property—known as the **discriminant** or **tag**.

### 2.3.1 Defining Discriminated Unions

```typescript
type NetworkState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "success"; data: string[]; latencyMs: number }
  | { status: "error"; error: Error };
```

Every variant has `status`, but the literal value of `status` uniquely identifies which other fields exist.

### 2.3.2 Narrowing with `switch`

```typescript
function renderState(state: NetworkState): string {
  switch (state.status) {
    case "idle":
      return "Ready to load";
    case "loading":
      return `Loading since ${state.startedAt}...`;
    case "success":
      return `Loaded ${state.data.length} items in ${state.latencyMs}ms`;
    case "error":
      return `Failed: ${state.error.message}`;
  }
}
```

### 2.3.3 The Destructuring Trap

> **Critical Gotcha**: Do **not** destructure properties before narrowing!

```typescript
// ❌ WRONG: Destructuring before narrowing
function badRender(state: NetworkState) {
  const { status, data, error } = state;
  //              ^? Property 'data' does not exist on type 'NetworkState'
}

// ✅ CORRECT: Narrow first on the parent, then destructure inside each branch:
function goodRender(state: NetworkState) {
  switch (state.status) {
    case "success": {
      const { data, latencyMs } = state; // Safe!
      return data.join(", ");
    }
  }
}
```

### 2.3.4 Exhaustiveness Checking with `never`

What happens when someone adds `{ status: "cancelled"; reason: string }` to `NetworkState` in the future? Without exhaustive checking, downstream `switch` statements silently miss the new case.

The `assertNever` helper guarantees at compile-time that all cases are handled:

```typescript
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

function handleState(state: NetworkState): string {
  switch (state.status) {
    case "idle":
      return "Idle";
    case "loading":
      return "Loading";
    case "success":
      return "Success";
    case "error":
      return "Error";
    default:
      // If any variant is omitted above, state is NOT never here,
      // producing an immediate compile-time error!
      return assertNever(state);
  }
}
```

### 2.3.5 Discriminated Booleans and Tuples

Discriminants don't have to be strings; booleans and tuple indices work as well:

```typescript
// Discriminated Boolean:
type ValidationResult =
  | { isValid: true; sanitizedValue: string }
  | { isValid: false; failureReason: string };

// Discriminated Tuple (Result pattern):
type TaskResult<T> =
  | [status: "ok", data: T]
  | [status: "error", error: Error];

function handleTask(res: TaskResult<number>) {
  if (res[0] === "ok") {
    console.log("Success value:", res[1]); // res[1]: number
  } else {
    console.error("Error occurred:", res[1].message); // res[1]: Error
  }
}
```

---


## Anti-Patterns vs. Best Practices

| Anti-Pattern | Best Practice | Why |
| :--- | :--- | :--- |
| **"The Bag of Optionals" State**<br>`{ status: string; data?: T; error?: Error; isLoading: boolean }` | **Discriminated Union**<br>`{ status: "loading" } \| { status: "success"; data: T } \| { status: "error"; error: Error }` | Eliminates impossible states (e.g. `isLoading: true` while `error` and `data` are both defined). |
| **Blind Truthiness Guard**<br>`if (item.count) { ... }` | **Explicit Null/Undefined Guard**<br>`if (item.count !== undefined) { ... }` | Truthiness checks fail when `count === 0`, causing hard-to-detect bugs. |
| **Typing Catch Variables as `any`**<br>`catch (err: any) { console.log(err.message); }` | **Type as `unknown` and narrow**<br>`catch (err: unknown) { if (err instanceof Error) ... }` | Thrown values in JS can be anything (strings, numbers, null, plain objects). |
| **Collapsing types with `&` blindly**<br>`type Bad = TypeA & TypeB;` with conflicting field types. | **Use `interface extends` or verify collision** | Prevents silent `never` properties on intersections. |

```typescript
// ❌ Anti-pattern: The Bag of Optionals allows impossible states:
type BadHttpState<T> = {
  isLoading: boolean;
  isError: boolean;
  data?: T;
  error?: Error;
};
// This allows an impossible state:
const buggyState: BadHttpState<string> = {
  isLoading: true,
  isError: true,
  data: "hello",
  error: new Error("failed"),
};

// ✅ Best practice: Discriminated Union makes impossible states unrepresentable:
type GoodHttpState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
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


### Exercise 2.1: The Resilient Async State Machine

#### Problem Description
Design a discriminated union `AsyncData<T>` that represents four distinct states:
1. `"idle"`: No additional fields.
2. `"loading"`: Has `progress: number` (0 to 100).
3. `"success"`: Has `data: T` and `timestamp: number`.
4. `"error"`: Has `error: Error`.

Write an exhaustive message formatter `getDisplayMessage<T>(state: AsyncData<T>): string` utilizing an `assertNever` check in the default branch.

#### Starter Code
```typescript
// TODO: Define AsyncData<T>
type AsyncData<T> = any;

// TODO: Implement getDisplayMessage<T>
function getDisplayMessage<T>(state: AsyncData<T>): string {
  throw new Error("Not implemented");
}

// Tests:
type TestIdle = AsyncData<string> extends { status: "idle" } ? true : false;
type Test2 = Expect<Equal<TestIdle, true>>;
```

#### Hints
1. Each variant must contain `status: "idle" | "loading" | "success" | "error"`.
2. In the `switch`, handle every case and call `assertNever(state)` in the `default` branch.

#### Step-by-Step Solution

```typescript
// 1. Define the discriminated union:
type AsyncData<T> =
  | { status: "idle" }
  | { status: "loading"; progress: number }
  | { status: "success"; data: T; timestamp: number }
  | { status: "error"; error: Error };

// 2. Helper for exhaustiveness checking:
function assertNever(value: never): never {
  throw new Error(`Unhandled state: ${JSON.stringify(value)}`);
}

// 3. Exhaustive switch function:
function getDisplayMessage<T>(state: AsyncData<T>): string {
  switch (state.status) {
    case "idle":
      return "System idle";
    case "loading":
      return `Loading... ${state.progress}%`;
    case "success":
      return `Success at ${state.timestamp}`;
    case "error":
      return `Error: ${state.error.message}`;
    default:
      return assertNever(state);
  }
}

// Verification:
type TestIdle = AsyncData<string> extends { status: "idle" } ? true : false;
type TestSuccess = AsyncData<number> extends { status: "success"; data: number; timestamp: number } ? true : false;
type Test1 = Expect<Equal<TestIdle, true>>;
type Test2 = Expect<Equal<TestSuccess, true>>;
```

---

### Exercise 2.2: Normalized Pipeline Error Handler

#### Problem Description
Write a utility function `normalizeError` that takes an `unknown` error caught in a try/catch block and normalizes it into a standardized `{ message: string; statusCode: number }` object:
- If the error is an instance of `HttpError` (a custom class with `status: number`), return its status and message.
- If the error is a standard `Error`, return `statusCode: 500` and its message.
- If the error is a string, return `statusCode: 500` and the string.
- For all other unknown types, return `statusCode: 500` and `"An unexpected error occurred"`.

#### Starter Code
```typescript
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

type NormalizedError = {
  message: string;
  statusCode: number;
};

// TODO: Implement normalizeError(error: unknown): NormalizedError
function normalizeError(error: unknown): NormalizedError {
  throw new Error("Not implemented");
}
```

#### Hints
1. Order your checks: test `error instanceof HttpError` before `error instanceof Error`.
2. Check `typeof error === "string"` for string errors.

#### Step-by-Step Solution

```typescript
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

type NormalizedError = {
  message: string;
  statusCode: number;
};

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof HttpError) {
    return {
      message: error.message,
      statusCode: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      statusCode: 500,
    };
  }

  return {
    message: "An unexpected error occurred",
    statusCode: 500,
  };
}

// Verification:
const httpErr = normalizeError(new HttpError(404, "User not found"));
type TestHttp = Expect<Equal<typeof httpErr, NormalizedError>>;

const standardErr = normalizeError(new Error("Disk full"));
const stringErr = normalizeError("Database connection lost");
const unknownErr = normalizeError({ random: 123 });
```

---


### Exercise 2.4: Type-Safe Result Tuple Unwrapper

#### Problem Description
In functional programming, operations often return a Result tuple:
```typescript
type Result<T, E = Error> = [ok: true, value: T] | [ok: false, error: E];
```
Write a helper function `unwrapResult<T, E>(result: Result<T, E>): T` that:
- If `result[0]` is `true`, returns the unwrapped value `result[1]`.
- If `result[0]` is `false`, throws `result[1]` (if it is an `Error`) or throws a new `Error` wrapping the string representation of `result[1]`.

#### Starter Code
```typescript
type Result<T, E = Error> = [ok: true, value: T] | [ok: false, error: E];

// TODO: Implement unwrapResult
function unwrapResult<T, E>(result: Result<T, E>): T {
  throw new Error("Not implemented");
}

// Tests:
const successResult: Result<number, string> = [true, 42];
const unwrapped = unwrapResult(successResult);
type TestUnwrapped = Expect<Equal<typeof unwrapped, number>>;
```

#### Hints
1. Check `if (result[0] === true)`. Inside this branch, `result[1]` is narrowed to `T`.
2. In the `false` branch, narrow `result[1]` with `instanceof Error`.

#### Step-by-Step Solution

```typescript
type Result<T, E = Error> = [ok: true, value: T] | [ok: false, error: E];

function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result[0] === true) {
    return result[1];
  }

  const err = result[1];
  if (err instanceof Error) {
    throw err;
  }

  throw new Error(String(err));
}

// Verification:
const successResult: Result<number, string> = [true, 42];
const unwrapped = unwrapResult(successResult);
type TestUnwrapped = Expect<Equal<typeof unwrapped, number>>;

const failureResult: Result<string, Error> = [false, new Error("Not found")];
try {
  unwrapResult(failureResult);
} catch (e) {
  console.log("Properly caught:", e);
}
```

