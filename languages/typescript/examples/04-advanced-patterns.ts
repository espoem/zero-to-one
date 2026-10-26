/**
 * 04: Advanced TypeScript Patterns
 *
 * Demonstrates high-leverage advanced patterns from Total TypeScript:
 * - Nominal typing & branding (UserId, PostId, currency safety)
 * - Loose autocomplete (`(string & {})` literal preservation)
 * - Union to intersection conversion via function parameter contravariance
 * - Deep dot-notation path traversal (`Get<T, "a.b.c">`)
 * - Global and module declaration merging
 *
 * Runnable via: `node examples/04-advanced-patterns.ts`
 */

import {
  type Expect,
  type Equal,
  type NotEqual,
  type Prettify,
  type UnionToIntersection,
  assertEqual,
  assertDeepEqual,
} from "./utils/type-helpers.ts";

console.log("=== 04: Advanced Patterns ===");

// ============================================================================
// 1. Nominal Typing & Branding
// ============================================================================

// TypeScript uses a structural type system ("duck typing").
// Branding introduces nominal distinctions to prevent passing incompatible primitives.
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

export type UserId = Brand<string, "UserId">;
export type PostId = Brand<string, "PostId">;
export type EmailAddress = Brand<string, "EmailAddress">;
export type UsdCents = Brand<number, "UsdCents">;
export type EurCents = Brand<number, "EurCents">;

// Constructor / Validator functions
export function makeUserId(id: string): UserId {
  if (!id.startsWith("usr_")) {
    throw new Error(`Invalid user ID format: ${id}`);
  }
  return id as UserId;
}

export function makePostId(id: string): PostId {
  if (!id.startsWith("pst_")) {
    throw new Error(`Invalid post ID format: ${id}`);
  }
  return id as PostId;
}

export function makeEmail(raw: string): EmailAddress {
  if (!raw.includes("@")) {
    throw new Error(`Invalid email: ${raw}`);
  }
  return raw.toLowerCase() as EmailAddress;
}

export function makeUsd(dollars: number, cents: number): UsdCents {
  return (dollars * 100 + cents) as UsdCents;
}

// Compile-time checks: UserId and PostId must NOT be interchangeable
type TestBrandMismatch = Expect<NotEqual<UserId, PostId>>;

function fetchUserPosts(userId: UserId): string {
  return `Fetched posts for ${userId}`;
}

const aliceId = makeUserId("usr_100");
const post1Id = makePostId("pst_999");
const aliceEmail = makeEmail("Alice@Example.com");

assertEqual(fetchUserPosts(aliceId), "Fetched posts for usr_100");
assertEqual(aliceEmail, "alice@example.com" as EmailAddress);

// Currency addition safety
function addUsd(a: UsdCents, b: UsdCents): UsdCents {
  return (a + b) as UsdCents;
}

const wallet1 = makeUsd(10, 50); // 1050 cents
const wallet2 = makeUsd(5, 25);  // 525 cents
assertEqual(addUsd(wallet1, wallet2), 1575 as UsdCents);

// ============================================================================
// 2. Loose Autocomplete (`string & {}`)
// ============================================================================

/**
 * Standard Union Problem:
 * type Color = "primary" | "secondary" | string;
 * In TypeScript, ("primary" | "secondary" | string) collapses immediately to `string`!
 * The IDE loses all autocompletion for "primary" and "secondary".
 *
 * Total TypeScript Solution:
 * Intersect `string` with `{}`: `(string & {})`.
 * TypeScript cannot collapse the literal union with `(string & {})`, preserving
 * IDE autocomplete hints while still permitting any arbitrary string!
 */
export type LooseColor = "primary" | "secondary" | "accent" | "danger" | (string & {});

// Compile-time tests
type TestLooseColor1 = Expect<"primary" extends LooseColor ? true : false>;
type TestLooseColor2 = Expect<"#ff00aa" extends LooseColor ? true : false>;

function getThemeColor(color: LooseColor): string {
  switch (color) {
    case "primary":
      return "#0070f3";
    case "secondary":
      return "#7928ca";
    case "accent":
      return "#f5a623";
    case "danger":
      return "#ee0000";
    default:
      return color; // Custom color string allowed
  }
}

assertEqual(getThemeColor("primary"), "#0070f3");
assertEqual(getThemeColor("#123456"), "#123456");

// ============================================================================
// 3. UnionToIntersection via Contravariance
// ============================================================================

/**
 * How it works:
 * 1. Distribute U over function argument position: `(k: U) => void`
 * 2. In TypeScript, function arguments are CONTRAVARIANT.
 * 3. Inferring a type from a contravariant position across multiple union branches
 *    forces TypeScript to find a type assignable to ALL branches simultaneously: INTERSECTION!
 */
type UnionOfObjects = { id: string } | { title: string } | { tags: string[] };
type IntersectedObject = Prettify<UnionToIntersection<UnionOfObjects>>;

type TestIntersection = Expect<
  Equal<
    IntersectedObject,
    { id: string; title: string; tags: string[] }
  >
>;

// Merging multiple partial objects into an intersection safely
export function mergeObjects<T extends object[]>(
  ...objects: T
): Prettify<UnionToIntersection<T[number]>> {
  return Object.assign({}, ...objects);
}

const merged = mergeObjects({ id: "1" }, { title: "Course" }, { tags: ["ts"] });
assertEqual(merged.id, "1");
assertEqual(merged.title, "Course");
assertDeepEqual(merged.tags, ["ts"]);

// ============================================================================
// 4. Deep Dot-Notation Path Traversal (`Get<T, "a.b.c">`)
// ============================================================================

export type DeepGet<T, TPath extends string> =
  TPath extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? DeepGet<T[Key], Rest>
      : never
    : TPath extends keyof T
    ? T[TPath]
    : never;

interface AppState {
  user: {
    profile: {
      firstName: string;
      lastName: string;
      address: {
        city: string;
        zip: number;
      };
    };
    settings: {
      theme: "dark" | "light";
    };
  };
  version: number;
}

type CityType = DeepGet<AppState, "user.profile.address.city">;
type ThemeType = DeepGet<AppState, "user.settings.theme">;
type VersionType = DeepGet<AppState, "version">;

type TestCity = Expect<Equal<CityType, string>>;
type TestTheme = Expect<Equal<ThemeType, "dark" | "light">>;
type TestVersion = Expect<Equal<VersionType, number>>;

export function getDeepValue<T extends object, TPath extends string>(
  obj: T,
  path: TPath
): DeepGet<T, TPath> {
  const segments = path.split(".");
  let current: any = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined as any;
    }
    current = current[segment];
  }

  return current as DeepGet<T, TPath>;
}

const state: AppState = {
  user: {
    profile: {
      firstName: "Martin",
      lastName: "Smid",
      address: {
        city: "Prague",
        zip: 11000,
      },
    },
    settings: {
      theme: "dark",
    },
  },
  version: 2,
};

assertEqual(getDeepValue(state, "user.profile.address.city"), "Prague");
assertEqual(getDeepValue(state, "user.settings.theme"), "dark");
assertEqual(getDeepValue(state, "version"), 2);

// ============================================================================
// 5. Ambient Declarations & Augmentation Mechanics
// ============================================================================

// TypeScript allows extending existing interfaces via declaration merging
export interface UserExtensionRegistry {
  base: { id: string };
}

// Augmenting UserExtensionRegistry in the same or separate scope
export interface UserExtensionRegistry {
  permissions: { roles: string[] };
}

type CombinedRegistry = Prettify<UserExtensionRegistry>;
type TestAugmentation = Expect<
  Equal<
    CombinedRegistry,
    {
      base: { id: string };
      permissions: { roles: string[] };
    }
  >
>;

console.log("✓ All 04 Advanced Patterns tests passed successfully!\n");
