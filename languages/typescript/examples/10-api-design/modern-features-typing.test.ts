/**
 * 07: Modern TypeScript & JavaScript Language Features
 *
 * Demonstrates high-signal modern TS/JS language features:
 * - TC39 Explicit Resource Management (`Disposable`, `AsyncDisposable`, `using`, `await using`, custom `DisposableScope`)
 * - Stage-3 Class Method Decorator context types (`ClassMethodDecoratorContext`, `withLoggedMethod`)
 * - Autocomplete-preserving `(string & {})` loose autocomplete union helper
 * - `switch (true)` multi-condition narrowing & TypeScript 5.4 `NoInfer<T>`
 * - tRPC-style phantom-type router builder & client type inference (`inferRouterInputs`, `inferRouterOutputs`)
 * - `ts-pattern`-style exhaustive pattern matcher using `Exclude<T, Matched>`
 * - Immutable ES2023–ES2025 array & grouping helpers (`Object.groupBy`, `toSorted`, `Promise.withResolvers`)
 *
 * Run: `node --test` on this file (see package.json)
 */

import {
  type Expect,
  type Equal,
  type NotEqual,
  type Extends,
  assertEqual,
  assertDeepEqual,
} from "../utils/type-helpers.ts";

console.log("=== 07: Modern TypeScript & JavaScript Features ===");

// ============================================================================
// 1. Explicit Resource Management (Disposable, AsyncDisposable, using)
// ============================================================================

/**
 * Disposable resource representing an open file handle.
 * When exiting a block with `using file = ...`, `[Symbol.dispose]()` is automatically invoked.
 */
export class TempFileResource implements Disposable {
  public isDisposed = false;
  public readonly filename: string;

  constructor(filename: string) {
    this.filename = filename;
  }

  public write(content: string): string {
    if (this.isDisposed) {
      throw new Error(`Cannot write to disposed file: ${this.filename}`);
    }
    return `Wrote "${content}" to ${this.filename}`;
  }

  [Symbol.dispose](): void {
    this.isDisposed = true;
  }
}

/**
 * AsyncDisposable resource representing an asynchronous database session.
 * Exiting an async block with `await using db = ...` triggers `[Symbol.asyncDispose]()`.
 */
export class AsyncDbSession implements AsyncDisposable {
  public isClosed = false;
  public readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  public async query(sql: string): Promise<{ rows: number; sql: string }> {
    if (this.isClosed) {
      throw new Error(`Database session ${this.connectionString} is already closed`);
    }
    return { rows: 1, sql };
  }

  async [Symbol.asyncDispose](): Promise<void> {
    // Simulates async teardown (flushing buffers, closing socket)
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.isClosed = true;
  }
}

/**
 * Educational DisposableScope simulating the official TC39 `DisposableStack`.
 * Demonstrates managing multiple resources and deferred callbacks with LIFO disposal order.
 */
export class DisposableScope implements Disposable {
  private readonly stack: (() => void)[] = [];
  public isDisposed = false;

  public use<T extends Disposable>(resource: T): T {
    this.stack.push(() => resource[Symbol.dispose]());
    return resource;
  }

  public defer(cleanup: () => void): void {
    this.stack.push(cleanup);
  }

  [Symbol.dispose](): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    while (this.stack.length > 0) {
      const cleanup = this.stack.pop()!;
      cleanup();
    }
  }
}

// Compile-time checks for resource management types
type TestTempFileIsDisposable = Expect<Extends<TempFileResource, Disposable>>;
type TestAsyncDbIsAsyncDisposable = Expect<Extends<AsyncDbSession, AsyncDisposable>>;
type TestScopeIsDisposable = Expect<Extends<DisposableScope, Disposable>>;

// Runtime verification: synchronous `using`
let fileInstance: TempFileResource;
{
  using file = new TempFileResource("audit.log");
  fileInstance = file;
  assertEqual(file.write("event"), 'Wrote "event" to audit.log');
  assertEqual(file.isDisposed, false);
}
// Out of block scope: file is guaranteed disposed!
assertEqual(fileInstance.isDisposed, true);

// Runtime verification: custom DisposableScope LIFO order
const cleanupOrder: number[] = [];
{
  using scope = new DisposableScope();
  scope.defer(() => cleanupOrder.push(1));
  scope.defer(() => cleanupOrder.push(2));
  scope.defer(() => cleanupOrder.push(3));
}
// LIFO: last deferred item (3) executes first!
assertDeepEqual(cleanupOrder, [3, 2, 1]);

// Runtime verification: asynchronous `await using`
async function runAsyncResourceTest() {
  let dbSessionInstance: AsyncDbSession;
  {
    await using db = new AsyncDbSession("postgres://localhost:5432/app");
    dbSessionInstance = db;
    const result = await db.query("SELECT 1");
    assertEqual(result.rows, 1);
    assertEqual(db.isClosed, false);
  }
  assertEqual(dbSessionInstance.isClosed, true);
}
await runAsyncResourceTest();

// ============================================================================
// 2. Stage-3 Method Decorator Signatures
// ============================================================================

export const decoratorLogs: string[] = [];

/**
 * Typed Stage-3 Class Method Decorator wrapper.
 * Conforms strictly to TC39 `ClassMethodDecoratorContext`.
 */
export function withLoggedMethod<This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
): (this: This, ...args: Args) => Return {
  const methodName = String(context.name);
  return function (this: This, ...args: Args): Return {
    decoratorLogs.push(`enter:${methodName}:${JSON.stringify(args)}`);
    const result = target.apply(this, args);
    decoratorLogs.push(`exit:${methodName}:${JSON.stringify(result)}`);
    return result;
  };
}

// Compile-time verification of Stage-3 decorator type signature
type MethodDecoratorContract = <This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
) => (this: This, ...args: Args) => Return;

type TestDecoratorSignature = Expect<Extends<typeof withLoggedMethod, MethodDecoratorContract>>;

// Runtime application:
// In pure ECMAScript (without experimental flags), Stage-3 decorators can be applied directly
// using the typed context descriptor to ensure zero Node.js syntax errors:
class MathEngine {
  public multiply(a: number, b: number): number {
    return a * b;
  }
}

const mathEngine = new MathEngine();
const mockMethodContext: ClassMethodDecoratorContext<
  MathEngine,
  (this: MathEngine, a: number, b: number) => number
> = {
  kind: "method",
  name: "multiply",
  static: false,
  private: false,
  access: {
    has: (obj) => "multiply" in obj,
    get: (obj) => obj.multiply,
  },
  addInitializer: () => {},
  metadata: {},
};

const decoratedMultiply = withLoggedMethod(mathEngine.multiply, mockMethodContext);
const multResult = decoratedMultiply.call(mathEngine, 6, 7);
assertEqual(multResult, 42);
assertDeepEqual(decoratorLogs, [
  "enter:multiply:[6,7]",
  "exit:multiply:42",
]);

// ============================================================================
// 3. Autocomplete-Preserving Union (`string & {}`)
// ============================================================================

/**
 * LooseAutocomplete allows string literal recommendations in IDE completions
 * while still accepting any arbitrary string without compiler complaints.
 *
 * Why this works:
 * Normally, `"primary" | "secondary" | string` simplifies directly to `string`
 * because literal types are subtypes of `string`.
 * Intersecting with `{}` prevents TypeScript's eager union reduction,
 * keeping `"primary" | "secondary"` visible to Language Server autocomplete!
 */
export type LooseAutocomplete<T extends string> = T | (string & {});

export type ThemePreset = LooseAutocomplete<"light" | "dark" | "solarized" | "nord">;

// Compile-time checks
type TestAcceptsPreset = Expect<Extends<"solarized", ThemePreset>>;
type TestAcceptsCustom = Expect<Extends<"cyberpunk-neon-custom", ThemePreset>>;
type TestNotSimplifiedToString = Expect<NotEqual<ThemePreset, string>>;

export function renderThemeBanner(theme: ThemePreset): string {
  if (theme === "light") return "Light Theme (Default)";
  if (theme === "dark") return "Dark Theme (Night Mode)";
  if (theme === "nord") return "Nordic Theme";
  return `Custom Palette (${theme})`;
}

assertEqual(renderThemeBanner("light"), "Light Theme (Default)");
assertEqual(renderThemeBanner("retro-synth"), "Custom Palette (retro-synth)");

// ============================================================================
// 4. `switch (true)` Type Narrowing & `NoInfer<T>` (TS 5.4+)
// ============================================================================

/**
 * `NoInfer<T>` (TS 5.4+) prevents TypeScript from using a specific argument position
 * to infer generic parameter `T`.
 *
 * Here, `T` MUST be inferred from `allowedOptions`.
 * `defaultOption: NoInfer<T>` prevents TypeScript from widening `T` to include invalid defaults!
 */
export function createConfig<T extends string>(
  allowedOptions: readonly T[],
  defaultOption: NoInfer<T>
): { allowedOptions: readonly T[]; defaultOption: T } {
  return { allowedOptions, defaultOption };
}

// `validConfig` infers T as "light" | "dark" from allowedOptions.
export const validConfig = createConfig(["light", "dark"] as const, "light");

type TestConfigDefault = Expect<Equal<typeof validConfig.defaultOption, "light" | "dark">>;

// Without NoInfer<T>, `createConfig(["light", "dark"] as const, "blue")` would inadvertently
// widen T to "light" | "dark" | "blue"! With NoInfer<T>, TypeScript flags a compile-time error:
// @ts-expect-error - "blue" is not assignable to "light" | "dark"
export const invalidConfig = createConfig(["light", "dark"] as const, "blue");

/**
 * Multi-condition narrowing using `switch (true)`.
 */
export function classifyCreditScore(score: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  switch (true) {
    case score >= 750:
      return "EXCELLENT";
    case score >= 650:
      return "GOOD";
    case score >= 550:
      return "FAIR";
    default:
      return "POOR";
  }
}

assertEqual(classifyCreditScore(780), "EXCELLENT");
assertEqual(classifyCreditScore(670), "GOOD");
assertEqual(classifyCreditScore(580), "FAIR");
assertEqual(classifyCreditScore(450), "POOR");

// ============================================================================
// 5. tRPC-Style Phantom-Type Router Builder & Client Type Inference
// ============================================================================

export interface Procedure<TInput, TOutput> {
  // Phantom type carriers (not instantiated at runtime)
  readonly _input: TInput;
  readonly _output: TOutput;
  resolve: (input: TInput) => Promise<TOutput> | TOutput;
}

export function procedure<TInput, TOutput>() {
  return {
    query(resolver: (input: TInput) => Promise<TOutput> | TOutput): Procedure<TInput, TOutput> {
      return {
        _input: undefined as any,
        _output: undefined as any,
        resolve: resolver,
      };
    },
    mutation(resolver: (input: TInput) => Promise<TOutput> | TOutput): Procedure<TInput, TOutput> {
      return {
        _input: undefined as any,
        _output: undefined as any,
        resolve: resolver,
      };
    },
  };
}

export interface Router<TProcedures extends Record<string, Procedure<any, any>>> {
  readonly _procedures: TProcedures;
  createCaller(): {
    [K in keyof TProcedures]: (input: TProcedures[K]["_input"]) => Promise<TProcedures[K]["_output"]>;
  };
}

export function createRouter<TProcedures extends Record<string, Procedure<any, any>>>(
  procedures: TProcedures
): Router<TProcedures> {
  return {
    _procedures: procedures,
    createCaller() {
      const caller: any = {};
      for (const [key, proc] of Object.entries(procedures)) {
        caller[key] = async (input: any) => proc.resolve(input);
      }
      return caller;
    },
  };
}

export type inferRouterInputs<TRouter extends Router<any>> = {
  [K in keyof TRouter["_procedures"]]: TRouter["_procedures"][K]["_input"];
};

export type inferRouterOutputs<TRouter extends Router<any>> = {
  [K in keyof TRouter["_procedures"]]: TRouter["_procedures"][K]["_output"];
};

// Define an example tRPC-style application router
export const appRouter = createRouter({
  getUser: procedure<{ id: string }, { id: string; username: string }>().query(async ({ id }) => {
    return { id, username: `user_${id}` };
  }),
  updateEmail: procedure<
    { id: string; email: string },
    { success: boolean; updatedAt: number }
  >().mutation(async ({ id, email }) => {
    return { success: true, updatedAt: 1700000000 };
  }),
});

// Compile-time checks for router input and output type extraction
export type AppInputs = inferRouterInputs<typeof appRouter>;
export type AppOutputs = inferRouterOutputs<typeof appRouter>;

type TestGetUserInput = Expect<Equal<AppInputs["getUser"], { id: string }>>;
type TestGetUserOutput = Expect<Equal<AppOutputs["getUser"], { id: string; username: string }>>;
type TestUpdateEmailInput = Expect<Equal<AppInputs["updateEmail"], { id: string; email: string }>>;
type TestUpdateEmailOutput = Expect<
  Equal<AppOutputs["updateEmail"], { success: boolean; updatedAt: number }>
>;

// Runtime caller verification
const caller = appRouter.createCaller();
const user = await caller.getUser({ id: "101" });
assertEqual(user.username, "user_101");

const emailResult = await caller.updateEmail({ id: "101", email: "test@example.com" });
assertEqual(emailResult.success, true);

// ============================================================================
// 6. ts-pattern Style Exhaustive Pattern Matcher
// ============================================================================

export class PatternMatcher<TInput, TOutput = never, TRemaining = TInput> {
  private readonly value: TInput;
  private readonly isMatched: boolean;
  private readonly matchResult?: TOutput;

  constructor(
    value: TInput,
    isMatched: boolean,
    matchResult?: TOutput
  ) {
    this.value = value;
    this.isMatched = isMatched;
    this.matchResult = matchResult;
  }

  public with<
    TPattern extends Partial<TRemaining> | ((val: TRemaining) => boolean),
    TResult
  >(
    pattern: TPattern,
    handler: (
      val: TPattern extends (...args: any[]) => boolean
        ? TRemaining
        : Extract<TRemaining, TPattern>
    ) => TResult
  ): PatternMatcher<
    TInput,
    TOutput | TResult,
    TPattern extends (...args: any[]) => boolean
      ? TRemaining
      : Exclude<TRemaining, TPattern>
  > {
    if (this.isMatched) {
      return this as any;
    }

    let matches = false;
    if (typeof pattern === "function") {
      matches = (pattern as (val: any) => boolean)(this.value);
    } else if (typeof pattern === "object" && pattern !== null) {
      matches = Object.entries(pattern).every(
        ([key, expectedVal]) => (this.value as any)?.[key] === expectedVal
      );
    } else {
      matches = this.value === (pattern as any);
    }

    if (matches) {
      const res = handler(this.value as any);
      return new PatternMatcher<TInput, TOutput | TResult, any>(this.value, true, res);
    }

    return this as any;
  }

  /**
   * `.exhaustive()` can only be called when all possible union branches have been
   * matched, driving `TRemaining` to `never`!
   */
  public exhaustive(this: PatternMatcher<any, TOutput, never>): TOutput {
    if (!this.isMatched) {
      throw new Error(`Non-exhaustive pattern match on: ${JSON.stringify(this.value)}`);
    }
    return this.matchResult!;
  }
}

export function match<const TInput>(value: TInput): PatternMatcher<TInput, never, TInput> {
  return new PatternMatcher(value, false);
}

// Compile-time & Runtime tests for `match`
export type AuthState =
  | { status: "anonymous" }
  | { status: "authenticating"; attempt: number }
  | { status: "authenticated"; user: { name: string } };

export function formatAuthState(state: AuthState): string {
  return match(state)
    .with({ status: "anonymous" }, () => "Guest User")
    .with({ status: "authenticating" }, (s) => `Logging in (attempt ${s.attempt})...`)
    .with({ status: "authenticated" }, (s) => `Welcome, ${s.user.name}!`)
    .exhaustive();
}

assertEqual(formatAuthState({ status: "anonymous" }), "Guest User");
assertEqual(formatAuthState({ status: "authenticating", attempt: 2 }), "Logging in (attempt 2)...");
assertEqual(
  formatAuthState({ status: "authenticated", user: { name: "Alice" } }),
  "Welcome, Alice!"
);

// ============================================================================
// 7. Immutable ES2023–ES2025 Array & Grouping Helpers
// ============================================================================

// 1. Object.groupBy
const inventory = [
  { name: "Bananas", category: "Fruit", quantity: 5 },
  { name: "Carrots", category: "Vegetable", quantity: 10 },
  { name: "Apples", category: "Fruit", quantity: 2 },
];

const grouped = Object.groupBy(inventory, (item) => item.category);
assertEqual(grouped.Fruit?.length, 2);
assertEqual(grouped.Vegetable?.length, 1);
assertEqual(grouped.Fruit?.[0]?.name, "Bananas");

// 2. Array.prototype.toSorted (non-mutating sort)
const numbers = [30, 10, 50, 20];
const sorted = numbers.toSorted((a, b) => a - b);
assertDeepEqual(sorted, [10, 20, 30, 50]);
assertDeepEqual(numbers, [30, 10, 50, 20]); // Original remains unmodified!

// 3. Array.prototype.toReversed (non-mutating reverse)
const letters = ["a", "b", "c"];
const reversed = letters.toReversed();
assertDeepEqual(reversed, ["c", "b", "a"]);
assertDeepEqual(letters, ["a", "b", "c"]);

// 4. Array.prototype.toSpliced (non-mutating splice)
const months = ["Jan", "Mar", "Apr"];
const spliced = months.toSpliced(1, 0, "Feb");
assertDeepEqual(spliced, ["Jan", "Feb", "Mar", "Apr"]);
assertDeepEqual(months, ["Jan", "Mar", "Apr"]);

// 5. Array.prototype.with (non-mutating index replacement)
const originalArr = ["zero", "one", "wrong", "three"];
const correctedArr = originalArr.with(2, "two");
assertDeepEqual(correctedArr, ["zero", "one", "two", "three"]);
assertDeepEqual(originalArr, ["zero", "one", "wrong", "three"]);

// 6. Promise.withResolvers (ES2024 standardized deferred promise)
const { promise, resolve } = Promise.withResolvers<string>();
resolve("Standardized deferred resolution!");
const promiseVal = await promise;
assertEqual(promiseVal, "Standardized deferred resolution!");

console.log("✓ All 07 Modern TS & JS Features tests passed successfully!\n");
