/**
 * 03: Generics and Overloads
 *
 * Demonstrates the mechanics of generic abstraction in TypeScript:
 * - Generic constraints (`extends`), default type parameters, and dependent parameters
 * - Function overloads vs conditional types (tradeoffs, pitfalls, refactoring)
 * - TypeScript 5.0+ `const` type parameters (`<const T>`)
 * - Generic builders and fluent immutable state accumulation
 * - Type-safe Event Emitter pattern
 *
 * Runnable via: `node examples/03-generics-and-overloads.ts`
 */

import {
  type Expect,
  type Equal,
  type NotEqual,
  type Prettify,
  assert,
  assertEqual,
  assertDeepEqual,
} from "./utils/type-helpers.ts";

console.log("=== 03: Generics and Overloads ===");

// ============================================================================
// 1. Generic Constraints & Dependent Type Parameters
// ============================================================================

/**
 * getProperty extracts a property from an object while preserving the exact return type.
 * TKey is constrained to `keyof TObj`.
 */
export function getProperty<TObj, TKey extends keyof TObj>(obj: TObj, key: TKey): TObj[TKey] {
  return obj[key];
}

const userProfile = { id: "usr_123", username: "pocock", karma: 9000, active: true };
const karma = getProperty(userProfile, "karma");
const username = getProperty(userProfile, "username");

type TestKarma = Expect<Equal<typeof karma, number>>;
type TestUsername = Expect<Equal<typeof username, string>>;

assertEqual(karma, 9000);
assertEqual(username, "pocock");

/**
 * Generic with default type parameter and object constraint
 */
export function createRecord<TData = Record<string, unknown>>(data: TData): { data: TData; createdAt: number } {
  return { data, createdAt: Date.now() };
}

const defaultRecord = createRecord({ foo: "bar" });
type TestDefaultRecord = Expect<Equal<typeof defaultRecord.data, { foo: string }>>;

// ============================================================================
// 2. Function Overloads vs Conditional Types
// ============================================================================

// Traditional Function Overloads:
// Defines multiple signatures followed by an implementation signature.
export function parseInput(input: string): string[];
export function parseInput(input: number): number[];
export function parseInput(input: boolean): [boolean];
export function parseInput(input: string | number | boolean): (string | number | boolean)[] {
  if (typeof input === "string") return input.split("");
  if (typeof input === "number") return [input, input * 2];
  return [input];
}

const strOutput = parseInput("ts");
const numOutput = parseInput(10);
const boolOutput = parseInput(true);

type TestOverloadStr = Expect<Equal<typeof strOutput, string[]>>;
type TestOverloadNum = Expect<Equal<typeof numOutput, number[]>>;
type TestOverloadBool = Expect<Equal<typeof boolOutput, [boolean]>>;

assertDeepEqual(strOutput, ["t", "s"]);
assertDeepEqual(numOutput, [10, 20]);
assertDeepEqual(boolOutput, [true]);

// The Pitfall of Overloads:
// Overloads fail when called with a union of input types!
// e.g. function callWithUnion(x: string | number) { parseInput(x); } // Error! No overload matches!
// Total TypeScript Best Practice: Use Conditional Types or Discriminated Arguments instead!

export function parseInputConditional<T extends string | number | boolean>(
  input: T
): T extends string ? string[] : T extends number ? number[] : [boolean] {
  if (typeof input === "string") return input.split("") as any;
  if (typeof input === "number") return [input, input * 2] as any;
  return [input] as any;
}

function handleUnion(x: string | number) {
  // Returns string[] | number[] cleanly without overload compilation errors!
  return parseInputConditional(x);
}
type TestUnionResult = Expect<Equal<ReturnType<typeof handleUnion>, string[] | number[]>>;

// ============================================================================
// 3. TypeScript 5.0+ `const` Type Parameters
// ============================================================================

// Without `const` type parameter:
// function getRoutesOld<T extends string[]>(routes: T): T { return routes; }
// const r = getRoutesOld(["/home", "/about"]); // r is string[] !

// With TS 5.0+ `<const T>`:
// Infers literal tuple types without requiring the caller to add `as const`!
export function defineRoutes<const TRoutes extends readonly string[]>(routes: TRoutes): TRoutes {
  return routes;
}

const appRoutes = defineRoutes(["/home", "/dashboard", "/settings"]);
// appRoutes is inferred as readonly ["/home", "/dashboard", "/settings"], NOT string[]!
type TestConstParam = Expect<Equal<typeof appRoutes, readonly ["/home", "/dashboard", "/settings"]>>;

assertEqual(appRoutes[0], "/home");
assertEqual(appRoutes.length, 3);

// Object inference with `const` type parameter:
export function defineEventCatalog<const TCatalog extends Record<string, { payload: unknown }>>(
  catalog: TCatalog
): TCatalog {
  return catalog;
}

const catalog = defineEventCatalog({
  LOGIN: { payload: { userId: "123" } },
  LOGOUT: { payload: { reason: "timeout" } },
});

type TestCatalogLiteral = Expect<
  Equal<
    typeof catalog,
    {
      readonly LOGIN: { readonly payload: { readonly userId: "123" } };
      readonly LOGOUT: { readonly payload: { readonly reason: "timeout" } };
    }
  >
>;

// ============================================================================
// 4. Generic Builder with Immutable Type State Accumulation
// ============================================================================

export class QueryBuilder<TSelected extends Record<string, any> = {}> {
  private readonly state: TSelected;

  constructor(state: TSelected = {} as TSelected) {
    this.state = state;
  }

  select<TKey extends string, TValue>(
    key: TKey,
    value: TValue
  ): QueryBuilder<Prettify<TSelected & Record<TKey, TValue>>> {
    return new QueryBuilder({
      ...this.state,
      [key]: value,
    } as Prettify<TSelected & Record<TKey, TValue>>);
  }

  build(): TSelected {
    return { ...this.state };
  }
}

const query = new QueryBuilder()
  .select("id", "q-42")
  .select("limit", 100)
  .select("enabled", true)
  .build();

type TestBuilder = Expect<Equal<typeof query, { id: string; limit: number; enabled: boolean }>>;

assertEqual(query.id, "q-42");
assertEqual(query.limit, 100);
assertEqual(query.enabled, true);

// ============================================================================
// 5. Type-Safe Generic Event Emitter
// ============================================================================

export type Listener<T> = (data: T) => void;

export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private listeners: { [K in keyof TEvents]?: Set<Listener<TEvents[K]>> } = {};

  on<K extends keyof TEvents & string>(event: K, listener: Listener<TEvents[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(listener);

    // Return unbind function
    return () => {
      this.listeners[event]?.delete(listener);
    };
  }

  emit<K extends keyof TEvents & string>(event: K, data: TEvents[K]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }
}

// Interface defining event map
interface AppEvents {
  "user:login": { userId: string; timestamp: number };
  "user:logout": { userId: string };
  "error": { code: number; message: string };
}

const emitter = new TypedEventEmitter<AppEvents>();

let loggedInUser = "";
const unsubscribe = emitter.on("user:login", (payload) => {
  loggedInUser = payload.userId;
});

emitter.emit("user:login", { userId: "u-999", timestamp: Date.now() });
assertEqual(loggedInUser, "u-999");

unsubscribe();
emitter.emit("user:login", { userId: "u-1000", timestamp: Date.now() });
assertEqual(loggedInUser, "u-999"); // Did not change because unsubscribed

console.log("✓ All 03 Generics & Overloads tests passed successfully!\n");
