# Module 09: Runtime Checking with Zod & React with TypeScript Foundations
**Weeks 21–23 | Total TypeScript Professional Course**

---

## Overview & Mental Model

TypeScript types exist strictly at compile time; transpilers strip them entirely during build. When your software communicates across external boundaries—network endpoints, browser storage, form submissions, third-party webhooks, or environment variables—static types cannot prevent malformed runtime payloads from crashing your application.

This module bridges that gap in two integrated phases:
1. **Zod Runtime Validation**: Define runtime schemas as the single source of truth, infer static types via `z.infer`, transform raw input into structured domain types, and build resilient network clients.
2. **React with TypeScript Foundations**: Master modern React component typings without outdated `React.FC` wrappers, distinguish JSX return types, inherit and override native HTML element attributes, type synthetic events, and work with core hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useReducer`).

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 External Runtime Data                  │
                  │        (Fetch API, LocalStorage, Form Inputs)          │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │       Zod Runtime Schema        │
                             │  Validates, Parses & Transforms │
                             └────────────────┬────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
     ┌─────────────────────────────────┐             ┌─────────────────────────────────┐
     │       Static TypeScript Type    │             │       Sanitized Runtime Value   │
     │      z.infer<typeof Schema>     │             │     schema.parse(rawPayload)    │
     └────────────────┬────────────────┘             └────────────────┬────────────────┘
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │       React Component Tree      │
                             │  Props, Synthetic Events, Hooks │
                             └─────────────────────────────────┘
```

### Type Testing Helpers

Throughout this module, we verify type safety with Total TypeScript assertion utilities:

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

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

## Lesson 9.3: React with TypeScript Foundations — JSX, Components & Props

### 9.3.1 Component Signatures: Modern Direct Typing vs. `React.FC`

`React.FC` has historical drawbacks: it injected implicit `children?: React.ReactNode` in React 17 and earlier, broke generic parameters, and complicated default props. Modern React uses direct parameter typing:

```tsx
// ❌ HISTORICAL: React.FC with implicit children
// const Header: React.FC<{ title: string }> = ({ title }) => <h1>{title}</h1>;

// ✅ MODERN: Explicit function signature with explicit children if accepted
interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps): React.JSX.Element {
  return (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
```

### 9.3.2 React Node vs. JSX.Element vs. ReactElement

| Type | Definition | Usage Context |
| :--- | :--- | :--- |
| `React.ReactNode` | `string \| number \| boolean \| null \| undefined \| ReactElement \| Iterable<ReactNode>` | Prop types for `children`, slots, or icons. |
| `React.JSX.Element` | Result of JSX element instantiation (`<div />`). | Component return types. |
| `React.ReactElement` | Object created by `React.createElement`. | Factory functions and clones. |

```tsx
interface LayoutProps {
  sidebar: React.ReactNode; // Flexible: accepts strings, JSX, or arrays
  children: React.ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps): React.JSX.Element {
  return (
    <div className="layout">
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}
```

### 9.3.3 HTML Props Inheritance and Overrides

Use React's built-in `ComponentPropsWithoutRef` to inherit native attributes without manually writing dozens of props. When overriding a prop signature, pair with `Omit`:

```tsx
import React, { ComponentPropsWithoutRef } from "react";

// Standard Button inheriting all HTML button attributes
interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}

export function Button({ variant = "primary", isLoading, children, disabled, ...rest }: ButtonProps): React.JSX.Element {
  return (
    <button disabled={disabled || isLoading} className={`btn btn-${variant}`} {...rest}>
      {isLoading ? "Loading..." : children}
    </button>
  );
}

// Input overriding native onChange to provide string directly
interface TextInputProps extends Omit<ComponentPropsWithoutRef<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function TextInput({ value, onChange, label, id, ...rest }: TextInputProps): React.JSX.Element {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
```

---

## Lesson 9.4: Typing React Events & Core Hooks

### 9.4.1 React Synthetic Events

```tsx
import React, { useState } from "react";

export function FormExample(): React.JSX.Element {
  const [value, setValue] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={value} onChange={handleChange} />
      <button type="submit" onClick={handleClick}>Submit</button>
    </form>
  );
}
```

### 9.4.2 Core Hooks: `useState`, `useEffect`, `useCallback`, and `useMemo`

```tsx
import { useState, useEffect, useCallback, useMemo } from "react";

interface User {
  id: string;
  name: string;
}

export function UserProfile({ userId }: { userId: string }): React.JSX.Element {
  // Explicit union for nullable state
  const [user, setUser] = useState<User | null>(null);

  // useEffect must return void or a cleanup function (never a Promise!)
  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch(`/api/users/${userId}`);
      const data: User = await res.json();
      if (active) setUser(data);
    }
    load();
    return () => {
      active = false; // Cleanup returns void
    };
  }, [userId]);

  // useCallback infers signature from arguments
  const handleAction = useCallback((actionName: string): void => {
    console.log(`Action: ${actionName}`);
  }, []);

  // useMemo computes cached values
  const uppercaseName = useMemo(() => {
    return user ? user.name.toUpperCase() : "ANONYMOUS";
  }, [user]);

  return <div>{uppercaseName}</div>;
}
```

### 9.4.3 Core Hooks: `useRef` Overloads

`useRef` has two distinct behaviors depending on initialization:

```tsx
import { useRef, useEffect } from "react";

export function RefDemo(): React.JSX.Element {
  // 1. DOM Ref: passing null creates RefObject<HTMLInputElement> (read-only .current)
  const inputRef = useRef<HTMLInputElement>(null);

  // 2. Mutable Ref: passing non-null creates MutableRefObject<number> (read/write .current)
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
    inputRef.current?.focus();
  });

  return <input ref={inputRef} />;
}
```

### 9.4.4 Core Hooks: `useReducer` with Discriminated Unions

```tsx
import { useReducer } from "react";

interface CounterState {
  count: number;
}

type CounterAction =
  | { type: "increment"; step: number }
  | { type: "decrement"; step: number }
  | { type: "reset" };

function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case "increment":
      return { count: state.count + action.step };
    case "decrement":
      return { count: state.count - action.step };
    case "reset":
      return { count: 0 };
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}
```

---

## Anti-Patterns vs. Best Practices

### 1. External Network Payloads

```typescript
// ❌ ANTI-PATTERN: Blind cast
const data = (await res.json()) as UserProfile;

// ✅ BEST PRACTICE: Runtime schema validation
const data = UserProfileSchema.parse(await res.json());
```

### 2. Component Type Signatures

```tsx
// ❌ ANTI-PATTERN: React.FC wrapper
const Card: React.FC<{ title: string }> = ({ title }) => <div>{title}</div>;

// ✅ BEST PRACTICE: Direct parameter typing
function Card({ title }: { title: string }): React.JSX.Element {
  return <div>{title}</div>;
}
```

### 3. Event Handler Prop Typing

```tsx
// ❌ ANTI-PATTERN: Generic untyped function
interface BadProps {
  onClick: Function;
}

// ✅ BEST PRACTICE: Specific SyntheticEvent or domain callback
interface GoodProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
```

### 4. Overriding Component Props

```tsx
// ❌ ANTI-PATTERN: Direct interface inheritance creates conflicting definitions
interface BadProps extends React.ComponentPropsWithoutRef<"input"> {
  onChange: (value: string) => void; // Conflicts with ChangeEventHandler!
}

// ✅ BEST PRACTICE: Omit native prop before redefining
interface GoodProps extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange"> {
  onChange: (value: string) => void;
}
```

### 5. Async Effects

```tsx
// ❌ ANTI-PATTERN: Async callback passed to useEffect
useEffect(async () => { await loadData(); }, []);

// ✅ BEST PRACTICE: Inner async function invoked inside effect
useEffect(() => {
  let mounted = true;
  async function run() {
    const data = await loadData();
    if (mounted) setData(data);
  }
  run();
  return () => { mounted = false; };
}, []);
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

### Exercise 9.3: Accessible `LabeledInput` Component with Overridden Props and Ref Forwarding

#### Problem Statement
Implement an accessible `<LabeledInput />` component:
1. Inherit all native `<input>` attributes except `onChange` and `value`.
2. Provide a clean `onChange: (value: string) => void`.
3. Accept `label: string` and optional `error?: string`.
4. Forward ref to the underlying `HTMLInputElement`.

#### Complete Solution & Explanation

```tsx
import React, { forwardRef, useId } from "react";

export interface LabeledInputProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const LabeledInput = forwardRef<HTMLInputElement, LabeledInputProps>(
  function LabeledInput(
    { label, value, onChange, error, id, className = "", ...rest },
    ref
  ): React.JSX.Element {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className={`field ${error ? "has-error" : ""} ${className}`}>
        <label htmlFor={inputId}>{label}</label>
        <input
          ref={ref}
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {error && <span id={errorId} role="alert" className="error-text">{error}</span>}
      </div>
    );
  }
);
```

---

### Exercise 9.4: Strict `useCart` Reducer with Discriminated Action Unions

#### Problem Statement
Build a complete reducer for a cart with actions:
- `ADD`: `{ id: string; name: string; price: number }`
- `UPDATE_QTY`: `{ id: string; quantity: number }` (removes if quantity <= 0)
- `REMOVE`: `{ id: string }`
- `CLEAR`: no payload
Enforce compile-time exhaustiveness in the `default` switch branch.

#### Complete Solution & Explanation

```typescript
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

export type CartAction =
  | { type: "ADD"; payload: { id: string; name: string; price: number } }
  | { type: "UPDATE_QTY"; payload: { id: string; quantity: number } }
  | { type: "REMOVE"; payload: { id: string } }
  | { type: "CLEAR" };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...action.payload, quantity: 1 }] };
    }
    case "UPDATE_QTY": {
      if (action.payload.quantity <= 0) {
        return { items: state.items.filter((i) => i.id !== action.payload.id) };
      }
      return {
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.payload.id) };
    case "CLEAR":
      return { items: [] };
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}
```

---

## Module 09 Summary & Cheat Sheet

1. **Zod as Truth Source**: Derive static types using `z.infer<typeof Schema>`.
2. **Discriminated Unions**: Prefer `z.discriminatedUnion("key", [...])` for `O(1)` dispatch and clean errors.
3. **Safe Parsing**: Use `schema.safeParse(data)` for untrusted inputs to inspect `{ success, data } | { success, error }`.
4. **Direct Component Props**: Avoid `React.FC`. Use `function Comp(props: Props): React.JSX.Element`.
5. **Component Props Helpers**: Use `ComponentPropsWithoutRef<"element">` and `Omit` when overriding native props.
6. **Synthetic Events**: Type handlers with `React.ChangeEvent<T>`, `React.MouseEvent<T>`, `React.FormEvent<T>`.
7. **useRef Overloads**: Pass `null` (`useRef<HTMLDivElement>(null)`) for DOM refs; pass value for mutable refs.
8. **useReducer Exhaustiveness**: Always check `const _exhaustive: never = action` in the default case.
