# Module 11: Expert Interviews, Modern TypeScript & JavaScript Mastery, and Advanced Addenda
**Weeks 27–28 | Capstone & Beyond | Total TypeScript Complete Volume**

---

## Overview & Mental Model

TypeScript is an evolving type system shaped by ecosystem creators, standards committees, and enterprise engineering demands. Moving from application developer to library architect requires designing zero-overhead public APIs, resilient contracts, and leveraging modern ECMAScript runtimes.

This capstone module unifies three advanced dimensions:
1. **Architectural Lessons from Ecosystem Creators**: Design insights and patterns from the creators of tRPC, Zod, TanStack Query, Redux Toolkit, and ts-pattern, alongside the TypeScript compiler team and enterprise migration leaders.
2. **Modern JavaScript & TypeScript 5.x–7.0 Mastery**: Cutting-edge runtime capabilities: Explicit Resource Management (`using`), Stage-3 Decorators, ES2023–ES2025 collections, `Promise.withResolvers`, Iterator Helpers, and `--isolatedDeclarations`.
3. **Complete Pro Essentials & Edge-Case Addenda**: Critical real-world techniques—the `(string & {})` autocomplete preservation quirk, `switch (true)` narrowing, generic higher-order components, array inclusion predicates, and type-safe HTTP route handlers.

```
                          Total TypeScript Capstone Architecture
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │                                  Ecosystem Design                                 │
   │   tRPC (Phantom State)  •  Zod (In/Out Phantoms)  •  TanStack (DataTag Overloads) │
   │   Redux (Slice Tuples)  •  ts-pattern (Exclude Narrowing)  •  Enterprise Staged   │
   └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
┌─────────────────────────────┐                             ┌─────────────────────────────┐
│  Modern TS 5.x–7.0 Runtime  │                             │  Advanced Edge-Case Addenda │
│  • using & DisposableStack  │                             │  • (string & {}) Autocompl  │
│  • Stage-3 Typed Decorators │                             │  • switch (true) Narrowing  │
│  • ES2023–25 (toSorted, Set)│                             │  • Generic HOCs & Lifecycles│
│  • Promise.withResolvers    │                             │  • includes Type Predicate  │
│  • --isolatedDeclarations   │                             │  • Zod Express Route Bridges│
└─────────────────────────────┘                             └─────────────────────────────┘
```

### Type Testing Helpers

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Lesson 11.1: TypeScript Expert Interviews — Architectural Lessons from Ecosystem Creators

### 11.1.1 Daniel Rosenwasser (TypeScript Program Manager): Erasable Types & Compiler Evolution

Daniel Rosenwasser leads TypeScript at Microsoft. A central tenet of modern TypeScript is the **Erasable Types** standard: TypeScript syntax should function as pure annotations strippable byte-for-byte without altering runtime evaluation.

#### Principles & `tsgo`
1. **Erasable Syntax vs. Code Generation**: Early constructs (`enum`, `namespace`, parameter properties) emitted runtime JS. Modern TypeScript favors native ECMAScript (`as const` objects, `#private` fields).
2. **`--erasableSyntaxOnly` & Native Execution**: Node.js (v22.6+ with `--experimental-strip-types`), Bun, and Deno strip types without a compiler. `--erasableSyntaxOnly` forbids non-erasable syntax.
3. **Compiler Performance (`tsgo`)**: High-throughput parallel declaration emit requires clean type boundaries, paving the way for the native Go-based TypeScript compiler architecture (`tsgo`).

```typescript
// ❌ NON-ERASABLE: Generates JS output; incompatible with type-stripping
enum LegacyRole { Admin = "ADMIN", User = "USER" }
class LegacyAccount { constructor(public readonly id: string) {} }

// ✅ ERASABLE: 100% compliant with --erasableSyntaxOnly and native type-stripping
export const Role = { Admin: "ADMIN", User: "USER" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export class ModernAccount {
  readonly id: string;
  #token: string; // ECMAScript native private field
  constructor(id: string, token: string) { this.id = id; this.#token = token; }
}

type testRole = Expect<Equal<Role, "ADMIN" | "USER">>;
```

---

### 11.1.2 Alex / KATT (tRPC Creator): End-to-End Zero-Codegen Type Safety

Alex created tRPC to eliminate code-generation in full-stack applications. Sharing TypeScript types directly between server and client without intermediate schemas gives instantaneous type synchronization.

#### Architectural Mechanics
- **Phantom Generics (`_def`)**: Types carry metadata in type parameters without runtime object storage.
- **Immutable Builder Accumulation**: Methods (`.input()`, `.use()`, `.query()`) return new instances with accumulated type parameters.
- **Client Inference Helpers**: Clients infer procedures via `inferRouterInputs` and `inferRouterOutputs` without importing server runtime code.

```typescript
interface ProcedureDef<TIn, TOut> { _input: TIn; _output: TOut; }

export class Procedure<TInput = void, TOutput = unknown> {
  declare readonly _def: ProcedureDef<TInput, TOutput>; // Phantom generic
  constructor(private readonly fn?: (input: TInput) => Promise<TOutput> | TOutput) {}

  input<TNewIn>(): Procedure<TNewIn, TOutput> { return new Procedure(); }
  query<TNewOut>(fn: (opts: { input: TInput }) => Promise<TNewOut> | TNewOut): Procedure<TInput, TNewOut> {
    return new Procedure(fn as any);
  }
}

export const router = {
  getUser: new Procedure().input<{ id: string }>().query(({ input }) => ({ id: input.id, name: "Alice" })),
};
export type AppRouter = typeof router;

export type inferRouterOutputs<TR> = { [K in keyof TR]: TR[K] extends Procedure<any, infer O> ? O : never };
export type inferRouterInputs<TR> = { [K in keyof TR]: TR[K] extends Procedure<infer I, any> ? I : never };

type UserOut = inferRouterOutputs<AppRouter>["getUser"]; // { id: string; name: string }
type UserIn = inferRouterInputs<AppRouter>["getUser"];   // { id: string }
type testOut = Expect<Equal<UserOut, { id: string; name: string }>>;
type testIn = Expect<Equal<UserIn, { id: string }>>;
```

---

### 11.1.3 Colin McDonnell (Zod Creator): Parse-Don't-Validate & Dual Phantoms

Colin McDonnell based Zod on Alexis King's **Parse, Don't Validate** philosophy. Validating checks invariants and returns booleans; parsing transforms unstructured input into strongly typed models.

#### Architectural Mechanics
- **Dual Phantoms (`_input` vs. `_output`)**: In `ZodType<Output, Def, Input>`, transformations separate raw incoming types from refined output types (e.g., ISO string to `Date`).
- **Explicit Schema Classes**: Explicit classes (`ZodObject`, `ZodString`) scale linearly with AST size compared to recursive conditional inference.

```typescript
export abstract class BaseSchema<TOutput, TInput = TOutput> {
  declare readonly _input: TInput;
  declare readonly _output: TOutput;
  abstract parse(input: unknown): TOutput;

  transform<TNewOut>(fn: (val: TOutput) => TNewOut): BaseSchema<TNewOut, TInput> {
    const parent = this;
    return new (class extends BaseSchema<TNewOut, TInput> {
      parse(raw: unknown): TNewOut { return fn(parent.parse(raw)); }
    })();
  }
}

class StringToDateSchema extends BaseSchema<Date, string> {
  parse(raw: unknown): Date {
    if (typeof raw !== "string") throw new Error("Expected string");
    const d = new Date(raw);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    return d;
  }
}

const dateParser = new StringToDateSchema();
type InType = (typeof dateParser)["_input"];   // string
type OutType = (typeof dateParser)["_output"]; // Date
type testIn = Expect<Equal<InType, string>>;
type testOut = Expect<Equal<OutType, Date>>;
```

---

### 11.1.4 Tanner Linsley (TanStack): `DataTag` Key Tagging & Overload Design

Tanner Linsley architected TanStack Query and Router. To carry return types through arbitrary query key tuples without manual generic arguments at call sites, TanStack tags key arrays with phantom symbols.

#### Architectural Mechanics
- **`DataTag` Symbol Branding**: Intersects query key arrays with `DataTag<TKey, TData>` carrying payload types.
- **Narrowing Overloads on `initialData`**: Providing `initialData` narrows `data` to `TData`; omitting it narrows `data` to `TData | undefined`.
- **Search-Param & Route-Tree Typing**: Route trees encode path patterns, loaders, and search parameters into deeply checked recursive route definitions.

```typescript
declare const dataTagSymbol: unique symbol;
export type DataTag<TKey, TData> = { [dataTagSymbol]: { key: TKey; data: TData } };
export type QueryKeyWithData<TData> = readonly unknown[] & DataTag<string, TData>;

export function queryOptions<TData>(opts: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
}): { queryKey: QueryKeyWithData<TData>; queryFn: () => Promise<TData> } { return opts as any; }

export function useQuery<TData>(opts: { queryKey: QueryKeyWithData<TData>; queryFn: () => Promise<TData>; initialData: TData }): { data: TData };
export function useQuery<TData>(opts: { queryKey: QueryKeyWithData<TData>; queryFn: () => Promise<TData>; initialData?: undefined }): { data: TData | undefined };
export function useQuery(opts: any): any { return { data: opts.initialData }; }

const userOpts = queryOptions({ queryKey: ["user", "1"], queryFn: async () => ({ id: "1", name: "Alice" }) });
const q1 = useQuery({ ...userOpts, initialData: { id: "0", name: "Guest" } });
const q2 = useQuery({ ...userOpts });

type testQ1 = Expect<Equal<typeof q1.data, { id: string; name: string }>>;
type testQ2 = Expect<Equal<typeof q2.data, { id: string; name: string } | undefined>>;
```

---

### 11.1.5 Mark Erikson (Redux Maintainer): Public API Contracts & Tuple Accumulation

Mark Erikson maintains Redux Toolkit (RTK). Library authors must ensure internal refactors never break public type contracts.

#### Architectural Mechanics
- **Public API Type Testing**: Runtime tests miss type regressions. Assertion suites (`Expect<Equal<...>>`, `tsd`, `attw`) in CI detect accidental type widening or breaking changes.
- **Dynamic Slice State Accumulation**: `combineSlices` accumulates dynamically injected slices into a growing state contract.

```typescript
export interface Slice<TName extends string, TState> {
  name: TName;
  reducer: (state: TState) => TState;
}

export class SliceRegistry<TState = {}> {
  private slices: Record<string, Slice<string, any>> = {};

  inject<TName extends string, TSliceState>(
    slice: Slice<TName, TSliceState>
  ): SliceRegistry<TState & Record<TName, TSliceState>> {
    this.slices[slice.name] = slice;
    return this as any;
  }
  getState(): TState { return {} as TState; }
}

const usersSlice: Slice<"users", { list: string[] }> = { name: "users", reducer: (s) => s };
const postsSlice: Slice<"posts", { count: number }> = { name: "posts", reducer: (s) => s };
const registry = new SliceRegistry().inject(usersSlice).inject(postsSlice);

type RegisteredState = ReturnType<typeof registry.getState>;
//   ^? { users: { list: string[] } } & { posts: { count: number } }
type testReg = Expect<Equal<RegisteredState, { users: { list: string[] } } & { posts: { count: number } }>>;
```

---

### 11.1.6 Gabriel Vergnaud (ts-pattern Creator): Type-Level Pattern Matching & Exhaustiveness

Gabriel Vergnaud created `ts-pattern` to bring functional pattern matching to TypeScript.

#### Architectural Mechanics
- **State Machine Narrowing with `Exclude`**: With each pattern branch, remaining types narrow via `Exclude<TRemaining, TMatched>`.
- **Compile-Time Exhaustiveness**: Calling `.exhaustive()` asserts that the remaining type parameter is constrained to `never`.

```typescript
export class PatternMatcher<TInput, TOutput = never> {
  constructor(private readonly value: TInput) {}
  with<TPattern extends Partial<TInput>, TResult>(
    pattern: TPattern,
    handler: (value: Extract<TInput, TPattern>) => TResult
  ): PatternMatcher<Exclude<TInput, TPattern>, TOutput | TResult> { return this as any; }

  exhaustive(...args: [TInput] extends [never] ? [] : [never]): TOutput { return null as any; }
}
export function match<T>(val: T): PatternMatcher<T> { return new PatternMatcher(val); }

type NetState = { status: "idle" } | { status: "loading" } | { status: "success"; data: string };

function render(state: NetState): string {
  return match(state)
    .with({ status: "idle" }, () => "Ready")
    .with({ status: "loading" }, () => "Loading...")
    .with({ status: "success" }, ({ data }) => `Data: ${data}`)
    .exhaustive(); // OK: All cases handled
}

function incomplete(state: NetState) {
  return match(state)
    .with({ status: "idle" }, () => "Ready")
    // @ts-expect-error Expected 1 arguments, but got 0 (remaining variants unhandled!)
    .exhaustive();
}
```

---

### 11.1.7 Shaundai Person (Netflix) & Tejas Kumar: Enterprise TypeScript Migration Strategies

Migrating large enterprise JavaScript codebases requires incremental, boundary-first strategies rather than all-or-nothing rewrites.

#### Strategic Migration Roadmap
1. **Phase 1: Ambient Inspection (`allowJs: true`, `checkJs: true`)**: Enable type checking on legacy `.js` files using JSDoc annotations without modifying build pipelines.
2. **Phase 2: Boundary-First Typing**: Type public API endpoints, network transport boundaries, database schemas, and shared utilities before internal business logic.
3. **Phase 3: Incremental Strictness Ratcheting**: Enable compiler strictness flags progressively: `noImplicitAny` -> `strictNullChecks` -> `strictFunctionTypes` -> `noUncheckedIndexedAccess`.

```typescript
// Strict boundary guard for migrated enterprise modules
export interface EnterpriseUser {
  readonly id: string;
  readonly email: string;
  readonly status: "active" | "suspended";
}

export function assertValidUser(input: unknown): asserts input is EnterpriseUser {
  if (typeof input !== "object" || input === null) throw new Error("Invalid payload: expected object");
  const c = input as Record<string, unknown>;
  if (typeof c["id"] !== "string" || typeof c["email"] !== "string") throw new Error("Invalid user fields");
  if (c["status"] !== "active" && c["status"] !== "suspended") throw new Error("Invalid status");
}
```

---

## Lesson 11.2: Complete Modern JavaScript & TypeScript 5.x–6.x/7.0 Feature Mastery

### 11.2.1 Explicit Resource Management (`using` & `await using`)

Standardized in ECMAScript and TypeScript 5.2+, Explicit Resource Management provides deterministic lifetime cleanup for DB connections, file handles, locks, and telemetry spans without `try ... finally` boilerplate.

#### Mechanics & Interfaces
- **`Symbol.dispose` & `Disposable`**: Synchronous cleanup triggered automatically when scope exits.
- **`Symbol.asyncDispose` & `AsyncDisposable`**: Asynchronous cleanup awaited when scope exits.
- **`DisposableStack` / `AsyncDisposableStack`**: LIFO container managing multiple disposable handles.

```typescript
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}

export class DatabaseTransaction implements AsyncDisposable {
  constructor(public readonly txId: string) {}
  async commit(): Promise<void> { console.log(`Transaction ${this.txId} committed`); }
  async [Symbol.asyncDispose](): Promise<void> { console.log(`Transaction ${this.txId} closed`); }
}

export class TelemetrySpan implements Disposable {
  constructor(public readonly name: string) {}
  [Symbol.dispose](): void { console.log(`Span '${this.name}' flushed`); }
}

export async function processOrder() {
  using span = new TelemetrySpan("process-order");
  await using tx = new DatabaseTransaction("tx-101");
  await tx.commit();
  // span and tx clean up deterministically on return or throw
}
```

---

### 11.2.2 Standard ECMAScript Stage-3 Decorators (TS 5.0+)

TypeScript 5.0 implements standard ECMAScript Stage-3 Decorators. Decorators are strictly typed via decorator context interfaces without mutating class shape unsafely.

```typescript
export function logged<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
) {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
    console.log(`[START] ${name}`, args);
    const result = target.call(this, ...args);
    console.log(`[END] ${name}`, result);
    return result;
  };
}

export class PaymentGateway {
  @logged
  charge(amount: number, currency: string): boolean {
    return amount > 0 && currency === "USD";
  }
}
const success = new PaymentGateway().charge(100, "USD");
```

---

### 11.2.3 Immutable Array & Collection Methods (ES2023–ES2025)

Modern ECMAScript provides non-mutating array operations, grouping utilities, and mathematical Set methods:

```typescript
// 1. Immutable Array Methods (ES2023)
const nums: readonly number[] = [3, 1, 4, 1, 5, 9];
const sorted = nums.toSorted((a, b) => a - b);  // [1, 1, 3, 4, 5, 9] (nums unchanged)
const reversed = nums.toReversed();              // [9, 5, 1, 4, 1, 3]
const spliced = nums.toSpliced(1, 2, 99);       // [3, 99, 1, 5, 9]
const updated = nums.with(0, 42);                // [42, 1, 4, 1, 5, 9]

// 2. Object.groupBy & Map.groupBy (ES2024)
interface User { id: string; role: "admin" | "member"; }
const users: User[] = [{ id: "u1", role: "admin" }, { id: "u2", role: "member" }];
const grouped = Object.groupBy(users, (u) => u.role);
type TestGroup = Expect<Equal<typeof grouped, Partial<Record<"admin" | "member", User[]>>>>;

// 3. Mathematical Set Methods (ES2025)
const setA = new Set(["a", "b", "c"]);
const setB = new Set(["b", "c", "d"]);
const union = setA.union(setB);                       // Set {"a", "b", "c", "d"}
const intersect = setA.intersection(setB);            // Set {"b", "c"}
const diff = setA.difference(setB);                  // Set {"a"}
const symmDiff = setA.symmetricDifference(setB);      // Set {"a", "d"}
const isDisjoint = setA.isDisjointFrom(new Set(["z"])); // true
```

---

### 11.2.4 Modern Async & Iterator Primitives

```typescript
// 1. Promise.withResolvers<T>() (ES2024)
export function createTimeoutGate<T>(timeoutMs: number) {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  return { promise, resolve, reject };
}

// 2. Typed Synchronous & Asynchronous Generators
function* numberStream(): Generator<number, string, boolean> {
  const cont: boolean = yield 1;
  return cont ? "ok" : "aborted";
}
async function* asyncBatcher<T>(items: T[], size: number): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

// 3. Iterator Helpers & Typed RegExp Capture Groups (ES2025)
function* naturals(): Generator<number, void, unknown> { let n = 1; while (true) yield n++; }
const evens = naturals().filter((n) => n % 2 === 0).take(4).toArray(); // [2, 4, 6, 8]

const matchResult = /(?<year>\d{4})-(?<month>\d{2})/.exec("2026-10");
if (matchResult?.groups) {
  const { year, month } = matchResult.groups; // string, string
}
```

---

### 11.2.5 Isolated Declarations (`--isolatedDeclarations`)

TypeScript 5.5's `--isolatedDeclarations` enables ultra-fast parallel `.d.ts` generation by tools like `oxc`, `swc`, and `tsgo`. Exported entities must have explicit type annotations so tools need not inspect AST dependencies.

```typescript
// ❌ FAILS with --isolatedDeclarations: Missing explicit return type
// export function createMetric(val: number) { return { val, valid: val > 0 }; }

// ✅ BEST PRACTICE: Explicit return types unlock parallel declaration emit
export interface Metric { val: number; valid: boolean; }
export function createMetric(val: number): Metric { return { val, valid: val > 0 }; }
```

---

## Lesson 11.3: Complete Pro Essentials & Advanced Patterns Deep-Dive Addenda

### 11.3.1 The `switch (true)` Narrowing Pattern

`switch (true)` allows sequential multi-condition and range evaluation with block scoping:

```typescript
type Priority = "urgent" | "high" | "normal";

export function evaluatePriority(latencyMs: number, queueDepth: number): Priority {
  switch (true) {
    case latencyMs > 1000 || queueDepth > 500: return "urgent";
    case latencyMs > 300 || queueDepth > 100:  return "high";
    default: return "normal";
  }
}
```

---

### 11.3.2 The Partial Autocompletion Quirk: The `(string & {})` Trick

A naive union `string | "primary" | "secondary"` widens and collapses to `string`, losing IDE autocompletion. Intersecting with `{}` prevents union collapse:

```typescript
// ❌ Collapses to string: loses autocomplete suggestions
type BadButton = "primary" | "secondary" | string;

// ✅ Preserves literal IDE autocomplete while allowing arbitrary string values
export type ButtonVariant = "primary" | "secondary" | "danger" | (string & {});

const v1: ButtonVariant = "primary";      // Suggested by autocomplete
const v2: ButtonVariant = "custom-brand"; // Allowed without error
type testVariant = Expect<Equal<ButtonVariant, "primary" | "secondary" | "danger" | (string & {})>>;
```

---

### 11.3.3 Typing Higher-Order Components & Legacy Class Components

```tsx
import React, { Component, ComponentType } from "react";

// 1. Higher-Order Component Props Injection
export interface WithUserProps { currentUser: { id: string; role: string } }

export function withUser<P extends object>(
  Wrapped: ComponentType<P>
): ComponentType<Omit<P, keyof WithUserProps>> {
  return function Authenticated(props: Omit<P, keyof WithUserProps>) {
    return <Wrapped {...(props as P)} currentUser={{ id: "u1", role: "admin" }} />;
  };
}

// 2. Generic Legacy Class Component with Props and State
export interface ListProps<T> { items: T[]; renderItem: (item: T) => React.ReactNode; }
export interface ListState { activeIndex: number; }

export class GenericList<T> extends Component<ListProps<T>, ListState> {
  override state: ListState = { activeIndex: 0 };
  override render() {
    return (
      <ul>
        {this.props.items.map((item, idx) => (
          <li key={idx} onClick={() => this.setState({ activeIndex: idx })}>
            {this.props.renderItem(item)}
          </li>
        ))}
      </ul>
    );
  }
}
```

---

### 11.3.4 Advanced Workshop Challenges

```typescript
// 1. Narrowing with an Array (isOneOf Type Guard)
export function isOneOf<const T extends readonly unknown[]>(arr: T, item: unknown): item is T[number] {
  return arr.includes(item);
}
const LOCALES = ["en-US", "fr-FR", "de-DE"] as const;
function setLocale(loc: string) {
  if (isOneOf(LOCALES, loc)) {
    type TestLoc = Expect<Equal<typeof loc, (typeof LOCALES)[number]>>;
  }
}

// 2. Merging Dynamic Objects with Global Declarations
declare global {
  namespace NodeJS {
    interface ProcessEnv { DATABASE_URL: string; NODE_ENV: "development" | "production" | "test"; }
  }
  interface Window { __DEBUG_INFO__: Record<string, unknown>; }
}

// 3. Type-Safe Request Handler with Zod & Express
import type { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

export function validate<P, Q, B>(schema: { params?: ZodType<P>; query?: ZodType<Q>; body?: ZodType<B> }) {
  return (req: Request<P, any, B, Q>, res: Response, next: NextFunction) => {
    try {
      if (schema.params) req.params = schema.params.parse(req.params);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.body) req.body = schema.body.parse(req.body);
      next();
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  };
}

// 4. Custom JSX Elements & Intrinsic Augmentation
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "metric-tile": { label: string; count: number; children?: React.ReactNode };
    }
  }
}
export const Metric = () => <metric-tile label="Visits" count={100} />;
```

---

## Anti-Patterns vs. Best Practices

| Domain | ❌ Anti-Pattern | ✅ Total TypeScript Best Practice |
| :--- | :--- | :--- |
| **Erasable Runtime** | Using `enum` or constructor `public` parameter properties. | Using `as const` dictionaries and native `#private` fields. |
| **Autocomplete Unions** | `type Size = "sm" \| "md" \| string` (collapses to `string`). | `type Size = "sm" \| "md" \| (string & {})` (preserves autocomplete). |
| **Resource Cleanup** | Manual `try { ... } finally { res.close(); }` chains prone to leaks. | Explicit Resource Management with `using` / `Disposable`. |
| **Schema Transforms** | Conflating input and output types in an ad-hoc parser. | Separating `_input` and `_output` phantom generics across schemas. |
| **Array Inclusion** | `arr.includes(x)` returning bare un-narrowed `boolean`. | A custom type guard `isOneOf(arr, item): item is (typeof arr)[number]`. |
| **Public API Contracts** | Relying solely on runtime tests to prevent breaking type changes. | Using `Expect<Equal<...>>` compile-time suites and `--isolatedDeclarations`. |

---

## Hands-On Exercises & Complete Solutions

### Exercise 11.1: End-to-End Type-Safe RPC Procedure Builder

#### Problem Statement
Inspired by Alex / KATT's tRPC architecture, implement a type-safe procedure builder:
1. Start with an empty procedure via `createProcedure()`.
2. Provide `.input<TInput>()` to record required input shapes in phantom types.
3. Provide `.use<TNewCtx>(middlewareFn)` to augment accumulated context.
4. Provide `.query(resolverFn)` returning a callable caller `({ ctx, input }) => Promise<TOutput>`.

#### Complete Solution & Explanation

```typescript
export interface BaseContext { userId?: string; }

export class ProcedureBuilder<TContext extends object, TInput = void> {
  constructor(private readonly middlewares: Array<(ctx: any) => Promise<any> | any> = []) {}

  input<TNewInput>(): ProcedureBuilder<TContext, TNewInput> {
    return new ProcedureBuilder<TContext, TNewInput>(this.middlewares);
  }

  use<TNewCtx extends object>(
    fn: (opts: { ctx: TContext }) => Promise<TNewCtx> | TNewCtx
  ): ProcedureBuilder<TContext & TNewCtx, TInput> {
    return new ProcedureBuilder<TContext & TNewCtx, TInput>([...this.middlewares, fn]);
  }

  query<TOutput>(resolver: (opts: { ctx: TContext; input: TInput }) => Promise<TOutput> | TOutput) {
    const middlewares = this.middlewares;
    return async (callOpts: { ctx: TContext; input: TInput }): Promise<TOutput> => {
      let currentCtx = { ...callOpts.ctx };
      for (const mw of middlewares) {
        const additions = await mw({ ctx: currentCtx });
        currentCtx = { ...currentCtx, ...additions };
      }
      return resolver({ ctx: currentCtx, input: callOpts.input });
    };
  }
}

export function createProcedure<TCtx extends object = BaseContext>() {
  return new ProcedureBuilder<TCtx>();
}

// Verification:
const authMiddleware = async ({ ctx }: { ctx: BaseContext }) => {
  if (!ctx.userId) throw new Error("Unauthorized");
  return { auth: { user: ctx.userId, role: "admin" as const } };
};

const getSecretData = createProcedure<BaseContext>()
  .use(authMiddleware)
  .input<{ projectId: string }>()
  .query(({ ctx, input }) => ({
    owner: ctx.auth.user,
    role: ctx.auth.role,
    project: input.projectId,
  }));

async function runTest() {
  const result = await getSecretData({ ctx: { userId: "u_42" }, input: { projectId: "p_99" } });
  type TestResult = Expect<Equal<typeof result, { owner: string; role: "admin"; project: string }>>;
}
```

---

### Exercise 11.2: Deterministic Unit-of-Work Manager using `using`

#### Problem Statement
Build an explicit resource manager `TransactionScope` implementing `Disposable`:
1. `TransactionScope` manages active state (`isActive: boolean`).
2. Calling `scope.commit()` sets `isCommitted = true` and closes the transaction.
3. When exiting scope via `[Symbol.dispose]()`, if uncommitted, it automatically rolls back.

#### Complete Solution & Explanation

```typescript
export class TransactionScope implements Disposable {
  public isActive = true;
  public isCommitted = false;
  public isRolledBack = false;

  constructor(public readonly name: string) {}

  commit(): void {
    if (!this.isActive) throw new Error("Cannot commit inactive transaction");
    this.isCommitted = true;
    this.isActive = false;
  }

  rollback(): void {
    if (this.isActive) {
      this.isRolledBack = true;
      this.isActive = false;
    }
  }

  [Symbol.dispose](): void {
    if (this.isActive && !this.isCommitted) this.rollback();
  }
}

// Verification
export function runCommitTransaction(): boolean {
  using tx = new TransactionScope("order-creation");
  tx.commit();
  return tx.isCommitted && !tx.isRolledBack;
}

export function runFailedTransaction(): { committed: boolean; rolledBack: boolean } {
  let txRef: TransactionScope;
  try {
    using tx = new TransactionScope("order-failure");
    txRef = tx;
    throw new Error("Database timeout");
  } catch (err) {
    // Catches after [Symbol.dispose]() executes
  }
  return { committed: txRef!.isCommitted, rolledBack: txRef!.isRolledBack };
}

const res = runFailedTransaction();
console.assert(res.committed === false && res.rolledBack === true, "Must be rolled back automatically");
```

---

### Exercise 11.3: Pattern Matching State Machine with Compile-Time Exhaustiveness

#### Problem Statement
Inspired by Gabriel Vergnaud's `ts-pattern`, build a pattern matching helper `matchState`:
1. Narrow a discriminated union `UIState`.
2. Each `.on(type, handler)` branch narrows the remaining state with `Exclude<Remaining, Matched>`.
3. Provide an `.exhaustive()` terminator that only compiles when all variants are processed.

#### Complete Solution & Explanation

```typescript
export type UIState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready"; data: string[] };

export class StateMatcher<TCurrent, TResult = never> {
  constructor(private readonly state: TCurrent) {}

  on<TType extends (TCurrent extends { type: string } ? TCurrent["type"] : never), TReturn>(
    type: TType,
    handler: (state: Extract<TCurrent, { type: TType }>) => TReturn
  ): StateMatcher<Exclude<TCurrent, { type: TType }>, TResult | TReturn> {
    return this as any;
  }

  exhaustive(...args: [TCurrent] extends [never] ? [] : [missingVariant: TCurrent]): TResult {
    return null as any;
  }
}

export function matchState<T extends { type: string }>(state: T): StateMatcher<T> {
  return new StateMatcher(state);
}

// Verification
export function renderUI(state: UIState): string {
  return matchState(state)
    .on("loading", () => "Spinner...")
    .on("error", (e) => `Error: ${e.message}`)
    .on("ready", (r) => `Items: ${r.data.join(", ")}`)
    .exhaustive(); // OK: [TCurrent] is narrowed to [never]
}

export function renderIncompleteUI(state: UIState) {
  return matchState(state)
    .on("loading", () => "Spinner...")
    // @ts-expect-error Expected 1 arguments, but got 0. Missing variants!
    .exhaustive();
}
```

---

### Exercise 11.4: Overloaded Query Options Hook with `DataTag` & `initialData` Narrowing

#### Problem Statement
Inspired by Tanner Linsley's TanStack Query architecture, build a typed `executeQuery`:
1. Use a branded symbol `DataTag<TKey, TData>` on query keys.
2. Overload `executeQuery` such that supplying `initialData: TData` narrows return data to non-nullable `TData`.
3. When `initialData` is absent, return data must be `TData | undefined`.

#### Complete Solution & Explanation

```typescript
declare const tag: unique symbol;

export type TaggedQueryKey<TKey extends string, TData> = readonly [TKey, ...unknown[]] & {
  readonly [tag]: TData;
};

export function defineQuery<TKey extends string, TData>(
  key: TaggedQueryKey<TKey, TData>,
  fetcher: () => Promise<TData>
) {
  return { key, fetcher };
}

export interface QueryConfig<TKey extends string, TData> {
  query: { key: TaggedQueryKey<TKey, TData>; fetcher: () => Promise<TData> };
}

// Overload 1: with initialData -> data is TData
export function executeQuery<TKey extends string, TData>(
  config: QueryConfig<TKey, TData> & { initialData: TData }
): { data: TData; status: "success" };

// Overload 2: without initialData -> data is TData | undefined
export function executeQuery<TKey extends string, TData>(
  config: QueryConfig<TKey, TData> & { initialData?: undefined }
): { data: TData | undefined; status: "pending" | "success" };

// Implementation
export function executeQuery<TKey extends string, TData>(config: any): any {
  return {
    data: config.initialData ?? undefined,
    status: config.initialData !== undefined ? "success" : "pending",
  };
}

// Verification:
type User = { id: string; email: string };
const userKey = ["user", 123] as unknown as TaggedQueryKey<"user", User>;
const userQuery = defineQuery(userKey, async () => ({ id: "123", email: "user@corp.com" }));

// 1. With initialData -> User
const withInit = executeQuery({ query: userQuery, initialData: { id: "0", email: "fallback@corp.com" } });
type TestWithInit = Expect<Equal<typeof withInit.data, User>>;

// 2. Without initialData -> User | undefined
const withoutInit = executeQuery({ query: userQuery });
type TestWithoutInit = Expect<Equal<typeof withoutInit.data, User | undefined>>;
```

---

## Module 11 Summary & Cheat Sheet

1. **Erasable Types Standard**: Write code compatible with `--erasableSyntaxOnly`. Prefer `as const` dictionaries and native `#private` class fields over `enum` and parameter properties.
2. **Phantom Generics**: Encode compile-time metadata into classes and objects (e.g., `_def`, `_input`, `_output`, `DataTag`) with zero runtime memory allocation.
3. **Chainable State Accumulation**: Methods like `.input()`, `.use()`, and `.query()` return immutable new instances that progressively accumulate type parameter tuples.
4. **Compile-Time Exhaustiveness**: Use `Exclude<TUnion, THandled>` to track unhandled variants, asserting `[TUnion] extends [never]` at `.exhaustive()`.
5. **Deterministic Cleanup**: Replace `try ... finally` with ECMAScript Explicit Resource Management (`using` and `await using`) backed by `Symbol.dispose` and `Disposable`.
6. **Stage-3 Decorators**: Type method decorators with `<This, Args extends unknown[], Return>` and `ClassMethodDecoratorContext` to guarantee signature fidelity.
7. **Autocomplete Preservation**: Use `(string & {})` to preserve literal IDE autocompletion when mixing known strings with arbitrary strings.
8. **Parallel Declarations**: Enable `--isolatedDeclarations` and provide explicit return types on exported module boundaries to allow instant parallel `.d.ts` compilation.
