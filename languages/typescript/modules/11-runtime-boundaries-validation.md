## Lesson 9.1: Runtime Type Checking & Schema Design with Zod

### 9.1.1 The Runtime Boundary Problem

Casting unknown runtime responses with `as` bypasses the type checker without verifying values:

```typescript
// ❌ UNSAFE: Type assertion hides API mismatches
async function fetchUser(id: string): Promise<{ id: string; age: number }> {
  const response = await fetch(`/api/users/${id}`);
  return (await response.json()) as { id: string; age: number };
}
```

If the API returns `{ id: 101, age: "thirty" }`, code relying on `user.age.toFixed()` throws a runtime `TypeError`. Zod eliminates this vulnerability by parsing payloads at runtime.

### 9.1.2 Primitives, Objects, Arrays, and Tuples

```typescript
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(20),
  age: z.number().int().positive(),
  isActive: z.boolean(),
  tags: z.array(z.string()),
  coordinates: z.tuple([z.number(), z.number()]), // [latitude, longitude]
});

type InferredUser = z.infer<typeof UserSchema>;
//   ^? type InferredUser = { id: string; username: string; age: number; isActive: boolean; tags: string[]; coordinates: [number, number]; }
```

### 9.1.3 Enums, Unions, and Discriminated Unions

```typescript
// 1. Literal Enums
export const RoleSchema = z.enum(["admin", "editor", "viewer"]);
type Role = z.infer<typeof RoleSchema>;
//   ^? type Role = "admin" | "editor" | "viewer"

// 2. Discriminated Unions (O(1) matching and superior error messages)
export const TextMessageSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
});

export const MediaMessageSchema = z.object({
  type: z.literal("media"),
  mediaUrl: z.string().url(),
  sizeBytes: z.number().nonnegative(),
});

export const MessageSchema = z.discriminatedUnion("type", [
  TextMessageSchema,
  MediaMessageSchema,
]);

type Message = z.infer<typeof MessageSchema>;
//   ^? type Message = { type: "text"; content: string; } | { type: "media"; mediaUrl: string; sizeBytes: number; }
```

### 9.1.4 Modifiers: Optional, Nullable, Defaults, and Catch

```typescript
export const ProfileSchema = z.object({
  bio: z.string().optional(),                 // string | undefined
  website: z.string().url().nullable(),       // string | null
  avatarUrl: z.string().url().nullish(),      // string | null | undefined
  theme: z.enum(["light", "dark"]).default("light"), // Fallback when undefined
  loginAttempts: z.number().int().catch(0),   // Fallback when invalid
});

type Profile = z.infer<typeof ProfileSchema>;
//   ^? type Profile = { theme: "light" | "dark"; loginAttempts: number; bio?: string | undefined; website: string | null; avatarUrl?: string | null | undefined; }
```

---

## Lesson 9.2: Type Inference & Data Transformations in Zod

### 9.2.1 Input vs. Output Types

Transformations decouple the incoming wire shape from the internal domain shape:

```typescript
export const TimestampSchema = z.string().transform((val) => new Date(val));

type InputTimestamp = z.input<typeof TimestampSchema>;
//   ^? type InputTimestamp = string

type OutputTimestamp = z.output<typeof TimestampSchema>;
//   ^? type OutputTimestamp = Date

type tests = [
  Expect<Equal<z.input<typeof TimestampSchema>, string>>,
  Expect<Equal<z.infer<typeof TimestampSchema>, Date>>
];
```

### 9.2.2 Validation: `.parse()` vs. `.safeParse()`

```typescript
// .parse() throws ZodError upon failure
try {
  const timestamp = TimestampSchema.parse("2026-10-25T12:00:00Z");
} catch (err) {
  if (err instanceof z.ZodError) console.error(err.issues);
}

// .safeParse() returns a Discriminated Union
const result = TimestampSchema.safeParse("invalid-date-string");
if (result.success) {
  console.log("Parsed Date:", result.data);
  //                                 ^? (property) data: Date
} else {
  console.error("Zod Issues:", result.error.issues);
  //                                  ^? (property) error: z.ZodError<string>
}
```

### 9.2.3 Custom Validation: `.refine()` and `.superRefine()`

```typescript
export const ChangePasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"], // Attach error to confirmPassword field
  });

export const QuantityDiscountSchema = z
  .object({
    quantity: z.number().int().positive(),
    hasDiscount: z.boolean(),
    discountPercent: z.number().min(0).max(100),
  })
  .superRefine((data, ctx) => {
    if (data.hasDiscount && data.discountPercent === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active discount requires a positive discount percentage",
        path: ["discountPercent"],
      });
    }
  });
```

### 9.2.4 Schema Composition and Derivation

```typescript
const BaseEntity = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
});

// .extend() adds new fields
const PostSchema = BaseEntity.extend({
  title: z.string().min(1),
  body: z.string(),
});

// .omit() and .pick()
const CreatePostInput = PostSchema.omit({ id: true, createdAt: true });
const PostHeader = PostSchema.pick({ id: true, title: true });

// .partial() makes all properties optional
const UpdatePostInput = CreatePostInput.partial();
```

### 9.2.5 Real-World Fetcher Pattern with Zod

```typescript
export async function fetchWithSchema<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema,
  init?: RequestInit
): Promise<z.output<TSchema>> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }
  const json: unknown = await response.json();
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(`Validation Error: ${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
}
```

---


## Hands-On Exercises

### Exercise 9.1: Zod E-Commerce Checkout Schema with Discriminated Payments

#### Problem Statement
Build an e-commerce checkout schema using Zod:
1. `payment` must be a `z.discriminatedUnion("method", [...])` supporting:
   - `credit_card`: requires `cardNumber` (16 digits), `cvv` (3-4 digits), `expiry` (`MM/YY`).
   - `paypal`: requires `paypalEmail` (valid email).
   - `crypto`: requires `walletAddress` (starts with `0x`, 42 characters).
2. `items` array must parse `unitPrice` from a string (e.g. `"$19.99"`) into integer cents (`1999`).

#### Starter Code & Type Tests
```typescript
import { z } from "zod";
import type { Equal, Expect } from "../examples/utils/type-helpers";

// TODO: Define Payment schemas and CheckoutPayloadSchema
```

#### Complete Solution & Explanation

```typescript
import { z } from "zod";
import type { Equal, Expect } from "../examples/utils/type-helpers";

export const CreditCardPaymentSchema = z.object({
  method: z.literal("credit_card"),
  cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV must be 3 or 4 digits"),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiry must be MM/YY"),
});

export const PayPalPaymentSchema = z.object({
  method: z.literal("paypal"),
  paypalEmail: z.string().email(),
});

export const CryptoPaymentSchema = z.object({
  method: z.literal("crypto"),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address"),
});

export const PaymentMethodSchema = z.discriminatedUnion("method", [
  CreditCardPaymentSchema,
  PayPalPaymentSchema,
  CryptoPaymentSchema,
]);

export const CheckoutItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.string().transform((str, ctx) => {
    const cleaned = str.replace(/^\$/, "");
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid price" });
      return z.NEVER;
    }
    return Math.round(parsed * 100);
  }),
});

export const CheckoutPayloadSchema = z.object({
  orderId: z.string().uuid(),
  customerEmail: z.string().email(),
  items: z.array(CheckoutItemSchema).min(1),
  payment: PaymentMethodSchema,
});

export type CheckoutInput = z.input<typeof CheckoutPayloadSchema>;
export type CheckoutOutput = z.output<typeof CheckoutPayloadSchema>;

// Type Verifications
type tests = [
  Expect<Equal<CheckoutOutput["payment"]["method"], "credit_card" | "paypal" | "crypto">>,
  Expect<Equal<CheckoutOutput["items"][number]["unitPrice"], number>>,
  Expect<Equal<CheckoutInput["items"][number]["unitPrice"], string>>
];
```

---

### Exercise 9.2: Multi-Field Form Validator with Zod `superRefine`

#### Problem Statement
Create a registration schema that:
1. Validates that `password` has at least 8 chars, 1 digit, and 1 uppercase letter.
2. Validates that `confirmPassword` strictly equals `password`.
3. If `accountType` is `"business"`, requires `taxId` (9 digits). If `"personal"`, `taxId` must be undefined.

#### Complete Solution & Explanation

```typescript
import { z } from "zod";

export const RegistrationSchema = z
  .object({
    username: z.string().min(3),
    accountType: z.enum(["personal", "business"]),
    taxId: z.string().optional(),
    password: z
      .string()
      .min(8)
      .regex(/[0-9]/, "Must include digit")
      .regex(/[A-Z]/, "Must include uppercase letter"),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }

    if (data.accountType === "business" && (!data.taxId || !/^\d{9}$/.test(data.taxId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business accounts require a 9-digit Tax ID",
        path: ["taxId"],
      });
    }

    if (data.accountType === "personal" && data.taxId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Personal accounts cannot provide Tax ID",
        path: ["taxId"],
      });
    }
  });

export type RegistrationData = z.infer<typeof RegistrationSchema>;
```

---

