/**
 * 05: Schema Validation & Official Zod Engine
 *
 * Demonstrates how Zod and runtime schema validators model TypeScript types:
 * - Phantom types for tracking input vs output (`_input`, `_output`)
 * - Schema definition for primitives, literals, enums, arrays, and objects
 * - Schema composition: .optional(), .nullable(), .default(), .refine(), .transform()
 * - Discriminated unions with automatic type inference
 * - Runtime parsing with .parse() and .safeParse()
 *
 * Run: `node --test` on this file (see package.json)
 */

import {
  type Expect,
  type Equal,
  assert,
  assertEqual,
  assertDeepEqual,
} from "../utils/type-helpers.ts";

import {
  z,
  type infer as zInfer,
  type input as zInput,
  type output as zOutput,
} from "zod";

console.log("=== 05: Zod and Schema Validation ===");

// ============================================================================
// 1. Primitive & Literal Validation
// ============================================================================

const NameSchema = z.string().min(2);
const AgeSchema = z.number().positive();
const IsAdminSchema = z.boolean();
const StatusLiteralSchema = z.literal("ACTIVE");

// Type inference verification
type NameType = zInfer<typeof NameSchema>;
type AgeType = zInfer<typeof AgeSchema>;
type IsAdminType = zInfer<typeof IsAdminSchema>;
type StatusLiteralType = zInfer<typeof StatusLiteralSchema>;

type TestName = Expect<Equal<NameType, string>>;
type TestAge = Expect<Equal<AgeType, number>>;
type TestIsAdmin = Expect<Equal<IsAdminType, boolean>>;
type TestStatus = Expect<Equal<StatusLiteralType, "ACTIVE">>;

// Runtime parsing tests
assertEqual(NameSchema.parse("Alice"), "Alice");
assertEqual(AgeSchema.parse(25), 25);
assertEqual(IsAdminSchema.parse(false), false);
assertEqual(StatusLiteralSchema.parse("ACTIVE"), "ACTIVE");

// SafeParse failure tests
const invalidNameResult = NameSchema.safeParse("A");
assert(!invalidNameResult.success, "Single character should fail min(2)");

const invalidStatusResult = StatusLiteralSchema.safeParse("INACTIVE");
assert(!invalidStatusResult.success, "Non-matching literal should fail");

// ============================================================================
// 2. Enums and Arrays
// ============================================================================

const RoleSchema = z.enum(["admin", "editor", "viewer"] as const);
type RoleType = zInfer<typeof RoleSchema>;
type TestRole = Expect<Equal<RoleType, "admin" | "editor" | "viewer">>;

assertEqual(RoleSchema.parse("editor"), "editor");
assert(!RoleSchema.safeParse("superadmin").success);

const TagsSchema = z.array(z.string());
type TagsType = zInfer<typeof TagsSchema>;
type TestTags = Expect<Equal<TagsType, string[]>>;

assertDeepEqual(TagsSchema.parse(["typescript", "zod"]), ["typescript", "zod"]);
assert(!TagsSchema.safeParse(["ok", 123]).success);

// ============================================================================
// 3. Object Schemas, Optionality, and Defaults
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  username: z.string().min(3),
  email: z.string().email(),
  bio: z.string().optional(),
  avatarUrl: z.string().nullable(),
  role: RoleSchema.default("viewer"),
});

export type UserOutput = zOutput<typeof UserSchema>;
export type UserInput = zInput<typeof UserSchema>;

// Compile-time checks:
// - bio can be undefined in both input and output
// - avatarUrl can be null in both input and output
// - role is OPTIONAL in input (defaults to "viewer"), but REQUIRED in output!
type ExpectedOutput = {
  id: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  bio?: string | undefined;
  avatarUrl: string | null;
};

type ExpectedInput = {
  id: string;
  username: string;
  email: string;
  bio?: string | undefined;
  avatarUrl: string | null;
  role?: "admin" | "editor" | "viewer" | undefined;
};

type TestOutput = Expect<Equal<UserOutput, ExpectedOutput>>;
type TestInput = Expect<Equal<UserInput, ExpectedInput>>;

// Parsing valid object with default applied
const rawPayload = {
  id: "usr_42",
  username: "mattpocock",
  email: "matt@totaltypescript.com",
  avatarUrl: null,
};

const parsedUser = UserSchema.parse(rawPayload);
assertEqual(parsedUser.role, "viewer"); // Default was injected!
assertEqual(parsedUser.bio, undefined);
assertEqual(parsedUser.avatarUrl, null);

// ============================================================================
// 4. Transforms and Refinements (Input vs Output Asymmetry)
// ============================================================================

/**
 * Transforms change the parsed output type while preserving the input type.
 * e.g., String to Number parser (common in query string and env var validation)
 */
export const StringToNumberSchema = z
  .string()
  .refine((val) => !Number.isNaN(Number(val)), "String must be numeric")
  .transform((val) => Number(val));

type StrToNumIn = zInput<typeof StringToNumberSchema>;
type StrToNumOut = zOutput<typeof StringToNumberSchema>;

type TestTransformIn = Expect<Equal<StrToNumIn, string>>;
type TestTransformOut = Expect<Equal<StrToNumOut, number>>;

assertEqual(StringToNumberSchema.parse("123"), 123);
assertEqual(StringToNumberSchema.parse("3.14"), 3.14);
assert(!StringToNumberSchema.safeParse("abc").success);

// Custom date transform
export const IsoToDateSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid ISO timestamp")
  .transform((s) => new Date(s));

const parsedDate = IsoToDateSchema.parse("2026-10-25T12:00:00Z");
assert(parsedDate instanceof Date, "Transformed output is a Date instance");
assertEqual(parsedDate.toISOString(), "2026-10-25T12:00:00.000Z");

// ============================================================================
// 5. Discriminated Unions
// ============================================================================

export const WebhookEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("payment_received"),
    amount: z.number().positive(),
    currency: z.enum(["USD", "EUR", "GBP"] as const),
  }),
  z.object({
    event: z.literal("subscription_cancelled"),
    userId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    event: z.literal("invoice_failed"),
    invoiceId: z.string(),
    attemptCount: z.number(),
  }),
]);

export type WebhookEvent = zInfer<typeof WebhookEventSchema>;

type ExpectedWebhook =
  | {
      event: "payment_received";
      amount: number;
      currency: "USD" | "EUR" | "GBP";
    }
  | {
      event: "subscription_cancelled";
      userId: string;
      reason?: string | undefined;
    }
  | {
      event: "invoice_failed";
      invoiceId: string;
      attemptCount: number;
    };

type TestWebhook = Expect<Equal<WebhookEvent, ExpectedWebhook>>;

// Test valid events
const event1 = WebhookEventSchema.parse({
  event: "payment_received",
  amount: 4999,
  currency: "USD",
});

if (event1.event === "payment_received") {
  assertEqual(event1.amount, 4999);
  assertEqual(event1.currency, "USD");
} else {
  throw new Error("Discriminated union failed to narrow event type");
}

const event2 = WebhookEventSchema.parse({
  event: "subscription_cancelled",
  userId: "usr_99",
});
if (event2.event === "subscription_cancelled") {
  assertEqual(event2.userId, "usr_99");
  assertEqual(event2.reason, undefined);
}

// Test invalid discriminator
const invalidEvent = WebhookEventSchema.safeParse({
  event: "unknown_event_type",
  amount: 100,
});
assert(!invalidEvent.success, "Unknown event type must fail validation");

console.log("✓ All 05 Zod & Schema Validation tests passed successfully!\n");
