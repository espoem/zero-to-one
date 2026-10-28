/**
 * 02: Type Transformations
 *
 * Demonstrates intermediate-to-advanced type manipulation:
 * - Union extraction, indexed access, Extract and Exclude
 * - Template literal types and route parameter extraction
 * - Conditional types and `infer` (custom ReturnType, Parameters, Awaited)
 * - Distributive conditional types vs non-distributive tuples
 * - Mapped types, property modifiers, and key remapping (`as`)
 * - Deep transformations (DeepReadonly, DeepPartial, Prettify)
 *
 * Run: `node --test` on this file (see package.json)
 */

import {
  type Expect,
  type Equal,
  type Prettify,
  type DeepReadonly,
  type DeepPartial,
  assertEqual,
  assertDeepEqual,
} from "../utils/type-helpers.ts";

console.log("=== 02: Type Transformations ===");

// ============================================================================
// 1. Unions & Indexed Access
// ============================================================================

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// Extract keys and values from object
export type StatusCodeKey = keyof typeof STATUS_CODES;
export type StatusCodeValue = (typeof STATUS_CODES)[StatusCodeKey];

type TestKeys = Expect<Equal<StatusCodeKey, "OK" | "CREATED" | "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND" | "INTERNAL_ERROR">>;
type TestValues = Expect<Equal<StatusCodeValue, 200 | 201 | 400 | 401 | 404 | 500>>;

// Extract / Exclude
export type ErrorStatusCode = Exclude<StatusCodeValue, 200 | 201>;
export type SuccessStatusCode = Extract<StatusCodeValue, 200 | 201>;

type TestErrorStatus = Expect<Equal<ErrorStatusCode, 400 | 401 | 404 | 500>>;
type TestSuccessStatus = Expect<Equal<SuccessStatusCode, 200 | 201>>;

// Array element indexed access
const CONFIG_MODES = ["development", "staging", "production"] as const;
export type ConfigMode = (typeof CONFIG_MODES)[number];

type TestConfigMode = Expect<Equal<ConfigMode, "development" | "staging" | "production">>;

// ============================================================================
// 2. Template Literal Types & Route Parameter Extraction
// ============================================================================

// String manipulation intrinsics
type Action = "create" | "update" | "delete";
type Entity = "user" | "post" | "comment";

export type EventName = `${Entity}:${Action}`;
type TestEventName = Expect<
  Equal<
    EventName,
    | "user:create"
    | "user:update"
    | "user:delete"
    | "post:create"
    | "post:update"
    | "post:delete"
    | "comment:create"
    | "comment:update"
    | "comment:delete"
  >
>;

// Total TypeScript Classic: Route Parameter Parser
// Extracts `:param` segments from a path template like "/users/:id/posts/:postId"
export type ExtractRouteParams<TPath extends string> =
  TPath extends `${string}:${infer Rest}`
    ? Rest extends `${infer Param}/${infer Next}`
      ? { [K in Param | keyof ExtractRouteParams<`/${Next}`>]: string }
      : { [K in Rest]: string }
    : {};

type Route1 = ExtractRouteParams<"/users/:userId">;
type TestRoute1 = Expect<Equal<Route1, { userId: string }>>;

type Route2 = ExtractRouteParams<"/orgs/:orgId/teams/:teamId/members/:memberId">;
type TestRoute2 = Expect<Equal<Route2, { orgId: string; teamId: string; memberId: string }>>;

type Route3 = ExtractRouteParams<"/static/assets/logo.png">;
type TestRoute3 = Expect<Equal<Route3, {}>>;

// Runtime URL parser implementation matching the type signature
export function parseRouteParams<TPath extends string>(
  template: TPath,
  path: string
): ExtractRouteParams<TPath> {
  const templateParts = template.split("/");
  const pathParts = path.split("/");
  const params: Record<string, string> = {};

  for (let i = 0; i < templateParts.length; i++) {
    const tPart = templateParts[i];
    const pPart = pathParts[i];
    if (tPart && tPart.startsWith(":") && pPart) {
      params[tPart.slice(1)] = pPart;
    }
  }

  return params as ExtractRouteParams<TPath>;
}

const parsed = parseRouteParams("/orgs/:orgId/teams/:teamId", "/orgs/acme/teams/engineering");
assertDeepEqual(parsed, { orgId: "acme", teamId: "engineering" });

// ============================================================================
// 3. Conditional Types & `infer`
// ============================================================================

// Recreating standard utility types from scratch to demonstrate `infer`
export type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
export type MyParameters<T> = T extends (...args: infer P) => any ? P : never;
export type MyAwaited<T> = T extends Promise<infer U> ? MyAwaited<U> : T;

function sampleFn(name: string, count: number): { success: boolean } {
  return { success: true };
}

type TestMyReturn = Expect<Equal<MyReturnType<typeof sampleFn>, { success: boolean }>>;
type TestMyParams = Expect<Equal<MyParameters<typeof sampleFn>, [name: string, count: number]>>;
type TestMyAwaited = Expect<Equal<MyAwaited<Promise<Promise<string>>>, string>>;

// Distributive conditional types vs Non-distributive
// Bare type parameter T distributes over union (A | B) extends X ? ...
type ToArrayDistributive<T> = T extends any ? T[] : never;
type DistributiveResult = ToArrayDistributive<string | number>;
type TestDistributive = Expect<Equal<DistributiveResult, string[] | number[]>>;

// Non-distributive tuple wrapping [T] prevents distribution over unions
type ToArrayNonDistributive<T> = [T] extends [any] ? T[] : never;
type NonDistributiveResult = ToArrayNonDistributive<string | number>;
type TestNonDistributive = Expect<Equal<NonDistributiveResult, (string | number)[]>>;

// ============================================================================
// 4. Mapped Types, Modifiers & Key Remapping (`as`)
// ============================================================================

interface Product {
  readonly id: string;
  name: string;
  price: number;
  description?: string;
  calculateDiscount: (percent: number) => number;
}

// Removing readonly and making all required
export type MutableRequired<T> = {
  -readonly [K in keyof T]-?: T[K];
};

type TestMutable = Expect<
  Equal<
    MutableRequired<Product>,
    {
      id: string;
      name: string;
      price: number;
      description: string;
      calculateDiscount: (percent: number) => number;
    }
  >
>;

// Key remapping: Filter to function-only properties
export type FunctionPropertiesOnly<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

type TestFuncOnly = Expect<
  Equal<
    FunctionPropertiesOnly<Product>,
    {
      calculateDiscount: (percent: number) => number;
    }
  >
>;

// Key remapping: Generate typed getter methods (-readonly strips readonly, -? makes methods required)
export type Getters<T> = {
  -readonly [K in keyof T as T[K] extends Function
    ? never
    : `get${Capitalize<string & K>}`]-?: () => T[K];
};

type ProductGetters = Getters<Product>;
type TestGetters = Expect<
  Equal<
    ProductGetters,
    {
      getId: () => string;
      getName: () => string;
      getPrice: () => number;
      getDescription: () => string | undefined;
    }
  >
>;

// Implementation of a reactive getter proxy
export function createGetters<T extends Record<string, any>>(obj: T): Getters<T> {
  const result: Record<string, () => any> = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] !== "function") {
      const getterName = `get${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      result[getterName] = () => obj[key];
    }
  }
  return result as Getters<T>;
}

const sampleProduct: Product = {
  id: "p-100",
  name: "Keyboard",
  price: 120,
  calculateDiscount: (p) => 120 * (1 - p / 100),
};

const getters = createGetters(sampleProduct);
assertEqual(getters.getId(), "p-100");
assertEqual(getters.getName(), "Keyboard");
assertEqual(getters.getPrice(), 120);

// ============================================================================
// 5. Deep Transformations & Prettify
// ============================================================================

interface NestedConfig {
  database: {
    host: string;
    port: number;
    credentials: {
      user: string;
      pass: string;
    };
  };
  features: string[];
}

type ReadonlyConfig = DeepReadonly<NestedConfig>;
type PartialConfig = DeepPartial<NestedConfig>;

// Compile-time check that DeepReadonly freezes deep properties and nested arrays
type ExpectedReadonlyConfig = {
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly credentials: {
      readonly user: string;
      readonly pass: string;
    };
  };
  readonly features: readonly string[];
};
type TestDeepReadonly = Expect<Equal<ReadonlyConfig, ExpectedReadonlyConfig>>;

// Compile-time check that DeepPartial recursively makes nested properties optional
type ExpectedPartialConfig = {
  database?: {
    host?: string;
    port?: number;
    credentials?: {
      user?: string;
      pass?: string;
    };
  };
  features?: string[];
};
type TestDeepPartial = Expect<Equal<PartialConfig, ExpectedPartialConfig>>;

// Prettify utility flattens complex intersections for clean hover docs
type MessyUnion = { id: string } & { title: string } & { meta: { tags: string[] } };
type Cleaned = Prettify<MessyUnion>;
type TestPrettify = Expect<Equal<Cleaned, { id: string; title: string; meta: { tags: string[] } }>>;

console.log("✓ All 02 Type Transformations tests passed successfully!\n");
