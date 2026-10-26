/**
 * 01: TypeScript Essentials & Narrowing
 *
 * Demonstrates the core foundations of modern TypeScript:
 * - Discriminated unions and exhaustive pattern matching
 * - Type narrowing via typeof, instanceof, 'in', and array truthiness
 * - User-defined type guards and assertion functions
 * - `unknown` vs `any`
 * - The `satisfies` operator vs type annotations/assertions
 * - `as const` assertions and object-as-enum patterns
 *
 * Runnable via: `node examples/01-essentials-and-narrowing.ts`
 */

import {
  type Expect,
  type Equal,
  assert,
  assertEqual,
  assertDeepEqual,
} from "./utils/type-helpers.ts";

console.log("=== 01: Essentials and Narrowing ===");

// ============================================================================
// 1. Discriminated Unions & Exhaustiveness Checking
// ============================================================================

export interface UserCreatedEvent {
  type: "USER_CREATED";
  payload: { id: string; name: string; email: string };
}

export interface UserUpdatedEvent {
  type: "USER_UPDATED";
  payload: { id: string; name?: string; email?: string };
}

export interface UserDeletedEvent {
  type: "USER_DELETED";
  payload: { id: string; softDelete: boolean };
}

export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

/**
 * assertNever guarantees that all cases of a union have been handled.
 * If a new member is added to UserEvent and unhandled, TypeScript will flag a compile-time error.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled union member: ${JSON.stringify(value)}`);
}

export function handleUserEvent(event: UserEvent): string {
  switch (event.type) {
    case "USER_CREATED":
      return `Created: ${event.payload.name} (${event.payload.email})`;
    case "USER_UPDATED":
      return `Updated user ${event.payload.id}`;
    case "USER_DELETED":
      return `Deleted user ${event.payload.id} (soft: ${event.payload.softDelete})`;
    default:
      return assertNever(event);
  }
}

// Compile-time checks
type TestDiscriminator = Expect<Equal<UserEvent["type"], "USER_CREATED" | "USER_UPDATED" | "USER_DELETED">>;

// Runtime tests
assertEqual(
  handleUserEvent({ type: "USER_CREATED", payload: { id: "1", name: "Alice", email: "alice@example.com" } }),
  "Created: Alice (alice@example.com)"
);
assertEqual(
  handleUserEvent({ type: "USER_DELETED", payload: { id: "2", softDelete: true } }),
  "Deleted user 2 (soft: true)"
);

// ============================================================================
// 2. Control-Flow Narrowing (typeof, instanceof, 'in')
// ============================================================================

export function formatValue(val: string | number | boolean | Date): string {
  if (typeof val === "string") {
    // Narrowed to string
    return val.toUpperCase();
  }
  if (typeof val === "number") {
    // Narrowed to number
    return val.toFixed(2);
  }
  if (typeof val === "boolean") {
    // Narrowed to boolean
    return val ? "TRUE" : "FALSE";
  }
  if (val instanceof Date) {
    // Narrowed to Date
    return val.toISOString().slice(0, 10);
  }
  return assertNever(val);
}

assertEqual(formatValue("hello"), "HELLO");
assertEqual(formatValue(42.5), "42.50");
assertEqual(formatValue(true), "TRUE");
assertEqual(formatValue(new Date("2026-01-01T00:00:00Z")), "2026-01-01");

// Narrowing with 'in' operator
interface Admin {
  id: string;
  role: "admin";
  permissions: string[];
}

interface Member {
  id: string;
  role: "member";
  tier: "free" | "paid";
}

export type Account = Admin | Member;

export function describeAccount(account: Account): string {
  if ("permissions" in account) {
    // Narrowed to Admin
    return `Admin with ${account.permissions.length} perms`;
  } else {
    // Narrowed to Member
    return `Member on ${account.tier} tier`;
  }
}

assertEqual(describeAccount({ id: "1", role: "admin", permissions: ["read", "write"] }), "Admin with 2 perms");
assertEqual(describeAccount({ id: "2", role: "member", tier: "paid" }), "Member on paid tier");

// ============================================================================
// 3. User-Defined Type Guards & Array Filtering
// ============================================================================

export interface User {
  id: string;
  name: string;
}

/**
 * Type guard returning `val is User`
 */
export function isUser(val: unknown): val is User {
  return (
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    typeof (val as Record<string, unknown>).id === "string" &&
    "name" in val &&
    typeof (val as Record<string, unknown>).name === "string"
  );
}

const sampleUser: unknown = { id: "u-1", name: "Alice" };
assertEqual(isUser(sampleUser), true);
if (isUser(sampleUser)) {
  type TestNarrowedUser = Expect<Equal<typeof sampleUser, User>>;
}
assertEqual(isUser({ id: 123 }), false);

/**
 * Generic type guard for filtering nullish values
 */
export function isDefined<T>(val: T): val is NonNullable<T> {
  return val !== null && val !== undefined;
}

const rawList: (string | null | undefined)[] = ["a", null, "b", undefined, "c"];
const definedList: string[] = rawList.filter(isDefined);
assertDeepEqual(definedList, ["a", "b", "c"]);

type TestDefinedList = Expect<Equal<typeof definedList, string[]>>;

// ============================================================================
// 4. Assertion Functions (`asserts condition` & `asserts val is T`)
// ============================================================================

export function assertIsString(val: unknown, message = "Value must be a string"): asserts val is string {
  if (typeof val !== "string") {
    throw new TypeError(message);
  }
}

export function assertIsDefined<T>(val: T, message = "Expected value to be defined"): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new Error(message);
  }
}

const nullableValue: string | null = "defined-value";
assertIsDefined(nullableValue);
type TestAssertedDefined = Expect<Equal<typeof nullableValue, string>>;
assertEqual(nullableValue.toUpperCase(), "DEFINED-VALUE");

function processUnknownInput(input: unknown): number {
  assertIsString(input);
  // input is now statically known as string
  return input.length;
}

assertEqual(processUnknownInput("TotalTypeScript"), 15);

let caughtError = false;
try {
  processUnknownInput(12345);
} catch {
  caughtError = true;
}
assert(caughtError, "assertIsString threw successfully on non-string");

// ============================================================================
// 5. `unknown` vs `any`
// ============================================================================

// `any` disables all type checking (unsafe escape hatch)
const anyVal: any = { message: "hello" };
// anyVal.nonExistentMethod(); // Compiles, crashes at runtime!

// `unknown` is the type-safe counterpart. It requires narrowing before access.
const unknownVal: unknown = { message: "hello" };

function safePrintUnknown(val: unknown): string {
  if (typeof val === "object" && val !== null && "message" in val) {
    const record = val as { message: unknown };
    if (typeof record.message === "string") {
      return record.message;
    }
  }
  return "default";
}

assertEqual(safePrintUnknown(unknownVal), "hello");
assertEqual(safePrintUnknown(null), "default");

// ============================================================================
// 6. The `satisfies` Operator vs Type Annotation
// ============================================================================

type ThemeColors = "primary" | "secondary" | "accent";
type ColorPalette = Record<ThemeColors, string | [number, number, number]>;

// Problem with standard annotation:
// const palette: ColorPalette = { primary: "#0070f3", secondary: [255, 0, 0], accent: "#ffffff" };
// palette.primary.toUpperCase(); // Type error! string | [number, number, number] does not have toUpperCase!

// Solution: `satisfies` validates against ColorPalette while preserving literal types!
export const palette = {
  primary: "#0070f3",
  secondary: [255, 0, 0],
  accent: "#ffffff",
} satisfies ColorPalette;

// Compile-time checks: palette.primary is string (not string | [number, number, number]), palette.secondary is [number, number, number]
type TestPrimary = Expect<Equal<typeof palette.primary, string>>;
type TestSecondary = Expect<Equal<typeof palette.secondary, [number, number, number]>>;

assertEqual(palette.primary.toUpperCase(), "#0070F3");
assertEqual(palette.secondary[0], 255);

// ============================================================================
// 7. Const Assertions & The Total TypeScript Object-As-Enum Pattern
// ============================================================================

// Matt Pocock recommends avoiding TypeScript's runtime `enum` keyword in favor of:
// `const` object + derived union type.
export const Role = {
  Admin: "ADMIN",
  Editor: "EDITOR",
  Viewer: "VIEWER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

type TestRoleUnion = Expect<Equal<Role, "ADMIN" | "EDITOR" | "VIEWER">>;

export function canEdit(role: Role): boolean {
  return role === Role.Admin || role === Role.Editor;
}

assert(canEdit(Role.Admin));
assert(canEdit(Role.Editor));
assert(!canEdit(Role.Viewer));

// Readonly Tuples with `as const`
export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

type TestHttpMethod = Expect<Equal<HttpMethod, "GET" | "POST" | "PUT" | "DELETE" | "PATCH">>;

console.log("✓ All 01 Essentials & Narrowing tests passed successfully!\n");
