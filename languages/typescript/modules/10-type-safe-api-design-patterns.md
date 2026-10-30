# Module 10: Type-Safe API Design Patterns

> Examples and tests: [`examples/10-api-design/advanced-patterns.test.ts`](../examples/10-api-design/advanced-patterns.test.ts) (brands, predicates, assertion functions, builders), [`resource-management-typing.test.ts`](../examples/10-api-design/resource-management-typing.test.ts) (`Disposable` typing), [`decorators-typing.ts`](../examples/10-api-design/decorators-typing.ts) (TC39 decorator typing, type-checked only) and [`modern-features-typing.test.ts`](../examples/10-api-design/modern-features-typing.test.ts) (router inference, `string & {}`, `switch (true)`).
> Run: `mise exec -- node --test examples/10-api-design/` and `mise exec -- npm run typecheck`.
>
> Prerequisites: [Module 07](./07-generics-and-inference.md) (inference) and [Module 09](./09-conditional-mapped-and-recursive-types.md) (conditional and mapped types). Augmenting globals and third-party modules is in [Module 06](./06-modules-declarations-and-tsconfig.md).

---

## Overview & Mental Model

While everyday TypeScript focuses on typing functions and objects, library authors and infrastructure engineers encounter higher-order challenges: **enforcing domain semantics that structural typing allows**, **augmenting runtime environments without collision**, **accumulating compile-time state across chained calls**, and **directing the compiler's inference engine**.

```mermaid
flowchart TD
    subgraph NominalDomain["1. Nominal Typing (Branded Types)"]
        RawStr["raw: string"] --> SmartConst["Smart Constructor / Validation"]
        SmartConst --> Brand["Brand<string, 'UserId'>"]
    end

    subgraph ControlFlow["2. Custom Narrowing"]
        Pred["Type Predicate: x is T"]
        Assert["Assertion Function: asserts x is T"]
    end

    subgraph StateAccumulation["3. Type-State Accumulation"]
        Builder["Builder Pattern: query.select().where()"]
        TypeState["QueryBuilder<TSelected, TWhere>"]
        Builder --> TypeState
    end

    subgraph InferenceControl["4. Inference Steering"]
        NoInfer["NoInfer<T>"]
        Reverse["Reverse Mapped Types"]
        Ident["Identity Functions (defineConfig)"]
    end
```

```ts
// Type-test helpers (see examples/utils/type-helpers.ts)
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Lesson 10.1: Branded Types (Nominal Typing in a Structural System)

### 10.1.1 Structural Typing and Primitive Obsession

TypeScript's type system is **structural**: if two types share the same shape, they are interchangeable. This creates a severe design flaw with primitives—commonly called **Primitive Obsession**:

```ts
function transferFunds(senderId: string, recipientId: string, amount: number) {
  // Logic
}

const userId = "usr_999";
const orderId = "ord_123";

// ❌ Bug passes compilation: arguments accidentally swapped!
transferFunds(orderId, userId, 500);
```

### 10.1.2 Creating Zero-Cost Branded Types

To achieve nominal typing (types distinguished by identity/name rather than structure), attach a phantom property keyed by a `unique symbol`. The symbol is erased at runtime, introducing **zero runtime overhead**:

```ts
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & {
  readonly [brand]: TBrand;
};

export type UserId = Brand<string, "UserId">;
export type PostId = Brand<string, "PostId">;
export type OrderId = Brand<string, "OrderId">;

let uId = "usr_100" as UserId;
//  ^? let uId: UserId
let pId = "pst_200" as PostId;
//  ^? let pId: PostId

type testUid = Expect<Equal<typeof uId, UserId>>;

// @ts-expect-error - PostId is not assignable to UserId!
uId = pId;
```

### 10.1.3 Validated Strings & Numbers

Branded types prevent unvalidated primitives from flowing into sensitive domain operations:

```ts
export type ValidEmail = Brand<string, "ValidEmail">;
export type PositiveNumber = Brand<number, "PositiveNumber">;

function sendVerificationEmail(email: ValidEmail): void {
  console.log(`Sending token to ${email}`);
}

// ❌ Cannot pass raw unvalidated string
const rawInput = "alice@example.com";
// @ts-expect-error - raw string is not ValidEmail
sendVerificationEmail(rawInput);
```

### 10.1.4 Smart Constructors & Validation Boundaries

A **smart constructor** validates input at the boundary and casts it to the branded type once verified:

```ts
function parseEmail(raw: string): ValidEmail {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(raw)) {
    throw new Error(`Invalid email address: "${raw}"`);
  }
  return raw as ValidEmail;
}

function makePositive(num: number): PositiveNumber {
  if (num <= 0 || !Number.isFinite(num)) {
    throw new Error(`Value must be positive: ${num}`);
  }
  return num as PositiveNumber;
}

const verifiedEmail = parseEmail("user@domain.com");
//    ^? const verifiedEmail: ValidEmail
type testEmail = Expect<Equal<typeof verifiedEmail, ValidEmail>>;
sendVerificationEmail(verifiedEmail); // ✅ Compiles cleanly
```

### 10.1.5 Index Signatures with Branded Types

Branded types make dictionary lookups resilient against passing the wrong ID key:

```ts
interface UserProfile {
  name: string;
  role: "admin" | "member";
}

type UserCache = Record<UserId, UserProfile>;

const cache: UserCache = {
  ["usr_1" as UserId]: { name: "Alice", role: "admin" },
};

function getUser(id: UserId, store: UserCache): UserProfile | undefined {
  return store[id];
}

const postId = "pst_9" as PostId;
// @ts-expect-error - Argument of type 'PostId' is not assignable to 'UserId'
getUser(postId, cache);
```

---


## Lesson 10.2: Type Predicates, Assertion Functions & Classes

### 10.2.1 Type Predicates (`x is T`)

A type predicate is a special return type annotation that instructs the compiler's control flow analyzer to narrow a variable when the function returns `true`:

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function processValue(val: unknown) {
  if (isString(val)) {
    // val is narrowed to string
    console.log(val.toUpperCase());
  }
}
```

### 10.2.2 Filtering Arrays with Type Predicates

Default `.filter(Boolean)` does not remove `null` or `undefined` at the type level. A predicate-typed filter helper preserves strictness:

```ts
const mixed = ["apple", null, "banana", undefined, "cherry"];

// ❌ Standard filter: still (string | null | undefined)[]
const badFiltered = mixed.filter(Boolean);

// ✅ Type predicate filter
function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

const clean = mixed.filter(isNonNullable);
//    ^? const clean: string[]

type testClean = Expect<Equal<typeof clean, string[]>>;
```

### 10.2.3 Assertion Functions (`asserts x is T`)

Assertion functions verify a condition and throw an exception if invalid. Unlike predicates (which return a boolean for `if` branches), assertion functions terminate the current flow:

```ts
function assertIsString(value: unknown, message?: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(message ?? `Expected string, received ${typeof value}`);
  }
}

function handlePayload(payload: unknown) {
  assertIsString(payload);
  // payload is narrowed to string for all following lines
  console.log(payload.trim());
}
```

### 10.2.4 Avoiding TS2775 ("Assertions require every name...")

> [!WARNING]
> **TypeScript Error TS2775**:  
> *"Assertions require every name in the call target to be declared with an explicit type annotation."*  
> If an assertion function is assigned to an unannotated variable or arrow function, TypeScript refuses to narrow:

```ts
// ❌ FAILS with TS2775 when invoked:
const assertDefinedBad = (val: unknown): asserts val is object => {
  if (!val) throw new Error("Null");
};

// ✅ BEST PRACTICE: Use function declarations OR explicit function type annotations
type AssertDefinedFn = (val: unknown) => asserts val is object;
const assertDefinedGood: AssertDefinedFn = (val) => {
  if (!val) throw new Error("Null");
};
```

### 10.2.5 Combining Brands with Predicates & Assertions

```ts
function isValidEmail(val: string): val is ValidEmail {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function assertValidEmail(val: string): asserts val is ValidEmail {
  if (!isValidEmail(val)) {
    throw new Error(`Invalid email: ${val}`);
  }
}
```

### 10.2.6 Predicates and Assertion Methods on Classes

Methods on classes can narrow `this` using polymorphic `this is ...` guards:

```ts
interface AuthenticatedState {
  token: string;
  userId: string;
}

class ApiSdk {
  private authState: AuthenticatedState | null = null;

  public authenticate(token: string, userId: string): void {
    this.authState = { token, userId };
  }

  // Type predicate method on class instance
  public isAuthenticated(): this is this & { authState: AuthenticatedState } {
    return this.authState !== null;
  }

  // Assertion method on class instance
  public assertAuthenticated(): asserts this is this & { authState: AuthenticatedState } {
    if (!this.isAuthenticated()) {
      throw new Error("SDK must be authenticated before performing this request.");
    }
  }

  public getSecretData(): string {
    this.assertAuthenticated();
    // this.authState is guaranteed non-null here
    return `Secret for ${this.authState.userId}`;
  }
}
```

---

## Lesson 10.3: The Builder Pattern & External Libraries

### 10.3.1 Classes as Types and Values

In TypeScript, a `class` statement produces two distinct symbols:
1. A **Value**: The constructor function and prototype executed at runtime.
2. A **Type**: The interface representing instances created by `new Class()`.

### 10.3.2 Type-State Accumulation in the Builder Pattern

The Builder pattern accumulates static types across method chaining without mutating underlying generic variables:

```ts
class QueryBuilder<TSelected extends string = never> {
  private selectedColumns: string[] = [];

  // Each chain returns a new type instance with accumulated selected keys
  public select<TCol extends string>(
    column: TCol
  ): QueryBuilder<TSelected | TCol> {
    const next = new QueryBuilder<TSelected | TCol>();
    next.selectedColumns = [...this.selectedColumns, column];
    return next;
  }

  public execute(): Record<TSelected, unknown> {
    const row = {} as Record<TSelected, unknown>;
    for (const col of this.selectedColumns) {
      row[col as TSelected] = null;
    }
    return row;
  }
}

const query = new QueryBuilder()
  .select("id")
  .select("email")
  .select("createdAt");
//    ^? const query: QueryBuilder<"id" | "email" | "createdAt">

const result = query.execute();
//    ^? const result: Record<"id" | "email" | "createdAt", unknown>
type testQuery = Expect<Equal<typeof result, Record<"id" | "email" | "createdAt", unknown>>>;
```

### 10.3.3 tRPC-Style Procedure Builders

Modern libraries like tRPC accumulate input validation schemas and context middleware:

```ts
type MiddlewareFn<TContextIn, TContextOut> = (ctx: TContextIn) => Promise<TContextOut>;

class ProcedureBuilder<TContext = {}> {
  private middlewares: MiddlewareFn<any, any>[] = [];

  public use<TNewContext>(
    fn: MiddlewareFn<TContext, TNewContext>
  ): ProcedureBuilder<TContext & TNewContext> {
    const builder = new ProcedureBuilder<TContext & TNewContext>();
    builder.middlewares = [...this.middlewares, fn];
    return builder;
  }

  public query<TOutput>(
    resolver: (ctx: TContext) => Promise<TOutput>
  ): (ctx: any) => Promise<TOutput> {
    return async (initialCtx: any) => {
      let currentCtx = initialCtx;
      for (const mw of this.middlewares) {
        const next = await mw(currentCtx);
        currentCtx = { ...currentCtx, ...next };
      }
      return resolver(currentCtx);
    };
  }
}

const proc = new ProcedureBuilder()
  .use(async () => ({ user: { id: "u42", name: "Alice" } }))
  .use(async (ctx) => ({ permissions: ["read", "write"] as const }))
  .query(async (ctx) => {
    // ctx has both user and permissions fully typed
    return `Welcome ${ctx.user.name}, permissions: ${ctx.permissions.join(", ")}`;
  });
```

### 10.3.4 Module Augmentation for External Libraries

When third-party libraries (e.g. Express, Fastify) don't include your domain properties on requests, use `declare module` to augment their internal interface:

```ts
// Augmenting Express Request
import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: "admin" | "user";
    };
    correlationId: string;
  }
}
```

---

## Lesson 10.4: Identity Functions, `const T`, `NoInfer<T>`, & Reverse Mapped Types

### 10.4.1 Identity Functions as an Ergonomic Alternative to `as const`

Identity functions validate a configuration against a broad contract while preserving literal inference without forcing callers to append `as const`:

```ts
interface RouteConfig {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
}

// Without helper: property types widen to string
const r1 = { path: "/users", method: "GET" };
// r1.method is string

// With identity helper
function defineConfig<const T extends RouteConfig>(config: T): T {
  return config;
}

const route = defineConfig({
  path: "/users",
  method: "GET",
});
//    ^? const route: { readonly path: "/users"; readonly method: "GET"; }

type testRoute = Expect<Equal<typeof route.method, "GET">>;
```

### 10.4.2 Specifying Where Inference Should NOT Happen: `NoInfer<T>` 

TypeScript normally infers `T` from every occurrence in a signature. When passing a default value or secondary parameter, you frequently want `T` inferred *only* from the primary source:

```ts
// Without NoInfer: default value widens T to ("red" | "blue" | "purple")
function createThemeBad<T extends string>(options: T[], defaultOption: T): T {
  return defaultOption;
}

// ❌ Desired: error because "purple" is not in the array.
// Reality: T is inferred as "red" | "blue" | "purple", so no error!
createThemeBad(["red", "blue"], "purple");

// ✅ With NoInfer<T>: T is ONLY inferred from options!
function createTheme<T extends string>(options: T[], defaultOption: NoInfer<T>): T {
  return defaultOption;
}

// @ts-expect-error - "purple" is not assignable to "red" | "blue"
createTheme(["red", "blue"], "purple");
```

### 10.4.3 Reverse Mapped Types

Reverse mapped types allow the keys and values of an object argument to constrain each other simultaneously:

```ts
type EventHandlers<TState> = {
  [K in keyof TState]: (current: TState[K]) => TState[K];
};

function createStore<TState>(initialState: TState, handlers: EventHandlers<TState>) {
  return { initialState, handlers };
}

const counterStore = createStore(
  { count: 0, label: "counter" },
  {
    count: (c) => c + 1,       // c is inferred as number
    label: (l) => l.trim(),    // l is inferred as string
  }
);
```

### 10.4.4 Dynamic Reducer Pattern

```ts
type ReducerMap<TState, TPayloads extends Record<string, any>> = {
  [K in keyof TPayloads]: (state: TState, payload: TPayloads[K]) => TState;
};

function createReducer<TState, TPayloads extends Record<string, any>>(
  handlers: ReducerMap<TState, TPayloads>
) {
  return (state: TState, action: { [K in keyof TPayloads]: { type: K; payload: TPayloads[K] } }[keyof TPayloads]): TState => {
    const handler = handlers[action.type];
    return handler(state, action.payload);
  };
}

interface AppState { value: number }
interface AppActions {
  INCREMENT: { amount: number };
  RESET: undefined;
}

const reducer = createReducer<AppState, AppActions>({
  INCREMENT: (s, p) => ({ value: s.value + p.amount }),
  RESET: (s) => ({ value: 0 }),
});
```

---

## Lesson 10.5: Typing Explicit Resource Management

The runtime semantics of `using`/`await using` (disposal order, `SuppressedError` aggregation, `DisposableStack` move semantics) are owned by `languages/javascript`. This lesson covers what the *types* give you.

- `using x = expr` requires `expr` to be `Disposable | null | undefined`, where `interface Disposable { [Symbol.dispose](): void }`. Anything else is a compile error, and the runtime throws a `TypeError` for the same value (the example asserts both).
- `await using` accepts `AsyncDisposable | Disposable | null | undefined` and is only allowed where `await` is.
- Declaring a resource-returning API as `(…) => Connection` with `interface Connection extends Disposable` lets callers choose `using` (scoped) or manual disposal; returning a bare object with a `close()` method gives them no compiler help.
- `DisposableStack.adopt<T>(value: T, onDispose: (value: T) => void): T` returns the value with its type intact, so non-disposable handles (file descriptors, timers) can be scoped without wrapper classes.
- Library setup: the types live in `lib.esnext.disposable.d.ts` (included by `lib: ["esnext"]`; not part of `es2025` in TS 7.0.2's lib list). `target` below `es2025`/`esnext` makes `tsc` lower `using` to `try`/`finally` with helpers; Node 26 runs it natively.

**Design rule.** Make the resource type itself `Disposable` rather than returning a separate disposer: a `Disposable` value cannot be forgotten in a `using` block, while a returned `() => void` is easy to drop (lint for floating disposables where your linter supports it).

## Lesson 10.6: Typing Decorators

### 10.6.1 Standard (TC39) decorators

A standard decorator is a function `(value, context) => replacement | void`. TypeScript types the `context` argument with one interface per decorated element kind: `ClassMethodDecoratorContext<This, Value>`, `ClassFieldDecoratorContext<This, Value>`, `ClassGetterDecoratorContext`, `ClassSetterDecoratorContext`, `ClassAccessorDecoratorContext` and `ClassDecoratorContext<Class>`. Making the decorator **generic in `This`, `Args` and `R`** lets it preserve the decorated method's signature and restrict where it applies:

```ts
export function retry<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => Promise<R>,
  _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<R>>,
) {
  return async function (this: This, ...args: Args): Promise<R> { /* … */ };
}

class Service {
  @retry async load(id: number): Promise<string> { /* ok */ }
  @retry sync(): string { /* error: not a Promise-returning method */ }
}
```

A field decorator returns an **initializer transformer** `(initial: V) => V`; its type is checked against the field type through `ClassFieldDecoratorContext<This, V>`. Decorator metadata (`context.metadata`, `Symbol.metadata`) is typed by `lib.esnext.decorators`. Evaluation order, `addInitializer`, and the `accessor` keyword at runtime belong to `languages/javascript`.

Decorators are **not erasable syntax**: they compile to helper calls. Node 26's type stripping rejects them, and V8 does not yet run them natively, so decorated code needs `tsc` or a bundler transform (the example file is type-checked only).

### 10.6.2 Then vs now: legacy (`experimentalDecorators`) vs standard decorators

| | Legacy (`experimentalDecorators`, TS 1.5–today) | Standard (TS 5.0+, TC39 stage 3) |
|---|---|---|
| Signature | `(target, propertyKey, descriptor) => descriptor \| void` | `(value, context) => replacement \| void` |
| Parameter decorators | Yes (used by Angular, NestJS DI) | No |
| Type metadata | `emitDecoratorMetadata` emits `design:type`/`design:paramtypes` via `reflect-metadata` | No type metadata; `context.metadata` is a plain object you fill |
| Status in TS 7.0.2 | **Still supported** (a fixture with both flags compiles and emits `__decorate`/`__metadata`; the 7.0 post does not mention them) | Default when the flag is off |

**Why it changed.** The legacy proposal was never standardised; the TC39 design has different semantics (decorators receive the original value and a context object, and cannot see parameter types). **Migration:** frameworks that rely on parameter decorators or `design:paramtypes` (NestJS, Angular, TypeORM, InversifyJS) still need the legacy mode; new code should use standard decorators. **Pitfall:** the two modes cannot be mixed in one project; flipping `experimentalDecorators` changes the meaning of every `@` in the program, and esbuild/Node stripping cannot emit legacy metadata at all.

## Lesson 10.7: Case Studies in Public API Typing

These distil the design lessons that used to be the "expert interviews" lesson (old 11.1); the publishing and performance side is in [Module 13](./13-library-authoring-performance-and-type-tests.md).

**Inference across a router object (tRPC style).** The server's router *value* is the single source of truth; the client type is `typeof router`, transformed by a mapped type into callable procedures. No code generation is needed because types flow through `import type`. The trade-off is that every consumer instantiates the whole router type; large routers need splitting or explicit annotations.

```ts
type Procedure<I, O> = { _input: I; _output: O };            // phantom fields
type Client<R> = { [K in keyof R]: R[K] extends Procedure<infer I, infer O> ? (input: I) => Promise<O> : never };
```

**Phantom-tagged keys (TanStack Query `DataTag`).** A key type carries the data type as a phantom property, so `getQueryData(key)` needs no type argument:

```ts
type DataTag<K, TData> = K & { [dataTagSymbol]: TData };
declare function queryKey<const K extends readonly unknown[], TData>(key: K): DataTag<K, TData>;
declare function getQueryData<K extends DataTag<readonly unknown[], unknown>>(key: K): K[typeof dataTagSymbol] | undefined;
```

**Tuple accumulation (Redux Toolkit middleware).** Each `.concat(middleware)` returns a builder whose type parameter is the tuple so far (`[...Ms, M]`), so `dispatch` is the intersection of every middleware's extension. Variadic tuple types make this linear and inference-friendly.

**Exhaustive pattern matching (ts-pattern).** The matcher's type tracks the *remaining* cases: each `.with(pattern, handler)` excludes what the pattern covers (`Exclude`-like on the input union), and `.exhaustive()` exists only when the remainder is `never`. The same idea in plain TypeScript is the `const x: never = value` check ([Module 03](./03-unions-narrowing-and-control-flow.md)). Cost: deep unions make this a common source of TS2589.

## Anti-Patterns vs. Best Practices

| Category | ❌ Anti-Pattern | ✅ Best Practice |
| :--- | :--- | :--- |
| **Type Predicates** | `function isUser(x: any): x is User { return true; }` (Unchecked assertion) | Exhaustively check all required properties runtime before returning `true` |
| **Global Scope** | Declaring variables in `.d.ts` without `declare global` and `export {}` | Scope augmentations inside `declare global` in explicit modules |
| **Builder Pattern** | Mutating `this` without returning new generic type instance | Return immutable copies with accumulated phantom type state |
| **Inference Leaks** | Forcing users to pass explicit generics where `NoInfer<T>` or `<const T>` solves it | Use `NoInfer<T>` to isolate inference sources |

---

## Hands-On Exercises & Solutions

### Exercise 1: Nominal Branded ID System with Zod Smart Constructors

**Objective**: Create `UserId` and `TenantId` brands and smart constructor functions that validate UUID formatting.

```ts
// Solution
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type UserId = Brand<string, "UserId">;
type TenantId = Brand<string, "TenantId">;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUserId(id: string): UserId {
  if (!UUID_REGEX.test(id)) throw new Error(`Invalid UserId: ${id}`);
  return id as UserId;
}

function parseTenantId(id: string): TenantId {
  if (!UUID_REGEX.test(id)) throw new Error(`Invalid TenantId: ${id}`);
  return id as TenantId;
}

const uid = parseUserId("123e4567-e89b-12d3-a456-426614174000");
//    ^? const uid: UserId
const tid = parseTenantId("789e0123-e45b-67d8-a901-426614174111");
//    ^? const tid: TenantId

type testEx1Uid = Expect<Equal<typeof uid, UserId>>;

// @ts-expect-error - Mismatched nominal brands
const mismatched: UserId = tid;
```

### Exercise 2: Express / Fastify Request Augmentation & Type Predicate Guard

**Objective**: Augment a request interface to support authenticated user sessions and write a type predicate guard to verify session validity.

```ts
// Solution
interface AuthSession {
  userId: string;
  role: "admin" | "user";
  tokenExpires: number;
}

interface CustomRequest {
  url: string;
  headers: Record<string, string>;
  session?: AuthSession;
}

function isAuthenticatedRequest(
  req: CustomRequest
): req is CustomRequest & { session: AuthSession } {
  return (
    req.session !== undefined &&
    typeof req.session.userId === "string" &&
    req.session.tokenExpires > Date.now()
  );
}

function handleAdminDashboard(req: CustomRequest) {
  if (isAuthenticatedRequest(req)) {
    // req.session is strictly AuthSession
    console.log(`Access granted to ${req.session.userId}`);
  }
}
```

### Exercise 3: Type-State SQL Query Builder

**Objective**: Implement a chained query builder `SqlBuilder<TTable, TSelected>` that only allows `.where()` against columns that actually exist on `TTable`, and whose `.execute()` returns only `Pick<TTable, TSelected>`.

```ts
// Solution
class SqlBuilder<TTable extends Record<string, unknown>, TSelected extends keyof TTable = never> {
  private selected: (keyof TTable)[] = [];
  private whereClauses: string[] = [];

  public select<K extends keyof TTable>(column: K): SqlBuilder<TTable, TSelected | K> {
    const next = new SqlBuilder<TTable, TSelected | K>();
    next.selected = [...this.selected, column];
    next.whereClauses = [...this.whereClauses];
    return next;
  }

  public where<K extends keyof TTable>(column: K, value: TTable[K]): this {
    this.whereClauses.push(`${String(column)} = ${value}`);
    return this;
  }

  public execute(): Pick<TTable, TSelected>[] {
    return [] as Pick<TTable, TSelected>[];
  }
}

interface UsersTable { id: number; username: string; email: string; karma: number }

const userQuery = new SqlBuilder<UsersTable>()
  .select("id")
  .select("username")
  .where("karma", 100);

const rows = userQuery.execute();
//    ^? const rows: Pick<UsersTable, "id" | "username">[]

type testSql = Expect<Equal<typeof rows, { id: number; username: string }[]>>;
```

### Exercise 4: Reverse-Mapped Event Reducer with `NoInfer<T>`

**Objective**: Build a typed state machine with initial state and action transitions where state transitions cannot infer arbitrary wider types.

```ts
// Solution
type StateMachineConfig<TState, TEvents extends string> = {
  initial: TState;
  events: TEvents[];
  transitions: {
    [E in TEvents]: (state: TState) => TState;
  };
};

function defineStateMachine<TState, TEvents extends string>(
  config: {
    initial: TState;
    events: TEvents[];
    transitions: {
      [E in TEvents]: (state: NoInfer<TState>) => NoInfer<TState>;
    };
  }
) {
  return config;
}

const machine = defineStateMachine({
  initial: { status: "idle" as const, retries: 0 },
  events: ["FETCH", "SUCCESS", "RETRY"],
  transitions: {
    FETCH: (s) => ({ ...s, status: "idle" }),
    SUCCESS: (s) => ({ ...s, retries: 0 }),
    RETRY: (s) => ({ ...s, retries: s.retries + 1 }),
  },
});
```

---

## Interview Drill

<details><summary>1. How do you get nominal typing in a structural type system, and what does it cost at runtime?</summary>

Intersect the base type with a phantom property (`string & { readonly __brand: "UserId" }`, or a `unique symbol` key to prevent forgery by object literals). Values get the brand only through a smart constructor or parser. Runtime cost is zero: the brand is erased; the value is still a plain string.
</details>

<details><summary>2. Type predicate vs assertion function: when do you use each?</summary>

A predicate `(x): x is T` returns a boolean and narrows in the true branch; use it in conditions and `filter`. An assertion `(x): asserts x is T` returns `void` and narrows the rest of the scope or throws; use it for invariants. Both are unchecked promises to the compiler: a wrong predicate body is not caught.
</details>

<details><summary>3. Why does calling an assertion function sometimes give TS2775?</summary>

Assertion signatures only take effect when the call target has an explicit type annotation (every name in the call target must be declared with an explicit type), because control-flow analysis must know the assertion signature without inferring it. Declare the function with `function` syntax or annotate the `const`.
</details>

<details><summary>4. What is a type-state builder, and what is its main pitfall?</summary>

A builder whose type parameters record which steps have run (`QueryBuilder<Selected, HasWhere>`), so that `.execute()` is only available when the state is complete. Each call returns a new type. Pitfall: long chains create deep instantiations and confusing errors; keep the state small and the method set per state explicit.
</details>

<details><summary>5. What does <code>NoInfer&lt;T&gt;</code> do?</summary>

It marks a position as *not* an inference site, so `T` is inferred from other arguments and this argument is only checked against it. Example: `createFSM<S extends string>(states: S[], initial: NoInfer<S>)` makes `initial: "typo"` an error instead of widening `S`.
</details>

<details><summary>6. How do you type a method decorator that only applies to async methods?</summary>

Make it generic in `This`, `Args`, `R`, and type the target as `(this: This, ...args: Args) => Promise<R>` with `ClassMethodDecoratorContext<This, typeof target>`. Applying it to a synchronous method is then a type error, and the replacement preserves the signature.
</details>

<details><summary>7. Why prefer making a resource type <code>Disposable</code> over returning a disposer function?</summary>

`using` requires a `Disposable` and disposes it at scope exit even on exceptions; the type system rejects non-disposables. A returned `() => void` can be ignored without any error, leaking the resource.
</details>
