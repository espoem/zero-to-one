# Module 12: React 19 & Modern React with TypeScript — Types Overhaul, Actions, RSC, & Compiler
**Bonus Module / Next-Gen React | Total TypeScript Professional Course**

---

## Overview & Mental Model

React 19 represents the most radical evolution of React's type system and architecture since hooks in React 16.8. For years, TypeScript developers struggled with historical friction points: generic erasure inside `React.forwardRef`, complex `fixedForwardRef` workarounds, rules of hooks forbidding conditional context, uncoordinated async states requiring manual `isLoading`/`error` boilerplate, and opaque boundaries between client and server execution contexts.

React 19, paired with TypeScript 5+, transforms these patterns into first-class, type-safe primitives:
1. **Type System Overhaul**: `ref` is now a standard prop on function components, generic components accept `ref` naturally, ref callbacks support cleanup functions, `ComponentProps<"element">` includes `ref`, and `useRef` enforces explicit initial values under `React.JSX.Element`.
2. **The `use()` API & Modern Context**: First-class unwrapping of `PromiseLike<T>` and `Context<T>`, conditional context consumption inside control-flow branches, and rendering `<Context value={...}>` directly without `.Provider`.
3. **Async Transitions & Modern Actions**: First-class `<form action={...}>`, `useActionState<State, Payload>`, `useFormStatus()`, and type-safe optimistic mutations with `useOptimistic<State, Action>`.
4. **React Server Components (RSC) & Boundaries**: Typing async server components, strict type-level serialization boundaries (`Serializable<T>`), and end-to-end type-safe Server Actions validated with Zod.
5. **React Compiler & Invariant Contracts**: Protecting compiler auto-memoization invariants via `readonly` types, typing non-reactive callbacks with `useEffectEvent`, and native document metadata hoisting.

```
                      ┌─────────────────────────────────────────────────────────┐
                      │             React 19 Modern Type Architecture           │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
          ┌───────────────────────┬────────────────┴────────────────┬───────────────────────┐
          ▼                       ▼                                 ▼                       ▼
 ┌─────────────────┐     ┌─────────────────┐               ┌─────────────────┐     ┌─────────────────┐
 │ First-Class Ref │     │ use() Resource  │               │ Modern Actions  │     │ RSC & Boundary  │
 │ & Generic Props │     │ & Context Value │               │ & Optimistic UI │     │ Type Validation │
 │ (No forwardRef) │     │ (Conditional)   │               │ useActionState  │     │ Serializable<T> │
 └─────────────────┘     └─────────────────┘               └─────────────────┘     └─────────────────┘
```

### Type Testing Helpers

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Lesson 12.1: React 19 Type System Overhaul — Goodbye `forwardRef`, Hello `ref` as a Prop & Ref Cleanup

### 12.1.1 Why `forwardRef` Broke Generic Components in React 18

In React 18, `ref` was a reserved keyword. Function components had to be wrapped in `React.forwardRef`. However, `forwardRef` erased generic parameters `<T>`, collapsing them to `unknown`:

```tsx
import React, { forwardRef } from "react";

interface LegacySelectProps<T> { items: T[]; renderItem: (item: T) => React.ReactNode }

// ❌ In React 18, forwardRef erases generic parameter <T>:
const LegacySelect = forwardRef(function LegacySelect<T>(
  props: LegacySelectProps<T>,
  ref: React.ForwardedRef<HTMLSelectElement>
) {
  return <select ref={ref} />;
});

// Consumer usage fails type inference in React 18:
// <LegacySelect items={[1, 2, 3]} renderItem={(item) => item.toFixed()} />
//                                                ^? (parameter) item: unknown

// Deprecated React 18 workaround:
export const fixedForwardRef = <T, P = {}>(render: (props: P, ref: React.Ref<T>) => React.ReactNode) =>
  forwardRef(render as any) as any;
```

### 12.1.2 First-Class `ref` as a Regular Prop in React 19

In React 19, `forwardRef` is deprecated. Function components declare `ref` directly in their props interface:

```tsx
import React from "react";

interface TextInputProps { label: string; placeholder?: string; ref?: React.Ref<HTMLInputElement>; }

export function TextInput({ label, placeholder, ref }: TextInputProps): React.JSX.Element {
  return (
    <label>{label}<input ref={ref} placeholder={placeholder} type="text" /></label>
  );
}
```

### 12.1.3 `ComponentProps<"input">` vs `ComponentPropsWithRef` vs `ComponentPropsWithoutRef`

In React 18, `ComponentProps<"input">` omitted `ref`. In React 19:
- `ComponentProps<"input">` **includes `ref?: React.Ref<HTMLInputElement>`** by default.
- `ComponentPropsWithRef<"input">` is aliased to `ComponentProps<"input">`.
- `ComponentPropsWithoutRef<"input">` strictly strips `ref`.

```tsx
import React from "react";
import type { Expect, Equal } from "./type-helpers";

type NativeProps = React.ComponentProps<"input">;
type WithoutRefProps = React.ComponentPropsWithoutRef<"input">;

type Test_HasRef = Expect<NativeProps extends { ref?: React.Ref<HTMLInputElement> } ? true : false>;
type Test_NoRef = Expect<"ref" extends keyof WithoutRefProps ? false : true>;
```

### 12.1.4 Typing Generic Components with `ref` Directly in React 19

Generic components no longer need `fixedForwardRef`. Simply pass `ref?: React.Ref<...>` in the generic props:

```tsx
import React from "react";
import type { Expect, Equal } from "./type-helpers";

export interface SelectProps<TItem> {
  items: readonly TItem[];
  selectedItem: TItem;
  getKey: (item: TItem) => string | number;
  getLabel: (item: TItem) => string;
  onSelect: (item: TItem) => void;
  ref?: React.Ref<HTMLSelectElement>;
}

export function Select<TItem>({ items, selectedItem, getKey, getLabel, onSelect, ref }: SelectProps<TItem>): React.JSX.Element {
  return (
    <select ref={ref} value={String(getKey(selectedItem))} onChange={(e) => {
      const match = items.find((it) => String(getKey(it)) === e.target.value);
      if (match) onSelect(match);
    }}>
      {items.map((it) => <option key={getKey(it)} value={String(getKey(it))}>{getLabel(it)}</option>)}
    </select>
  );
}

// Verification: Generics are fully inferred!
interface User { id: string; name: string }
export function UserSelect({ users, current }: { users: User[]; current: User }) {
  const ref = React.useRef<HTMLSelectElement | null>(null);
  return (
    <Select
      ref={ref}
      items={users}
      selectedItem={current}
      getKey={(u) => u.id}
      getLabel={(u) => u.name}
      onSelect={(sel) => {
        //      ^? (parameter) sel: User
        type Test_Preserved = Expect<Equal<typeof sel, User>>;
      }}
    />
  );
}
```

### 12.1.5 Ref Callback Cleanup Functions in React 19

Ref callbacks can now return an explicit cleanup function `() => void`, executed when the element unmounts or changes:

```tsx
import React from "react";

export function AutoResizeTextarea(): React.JSX.Element {
  const refCallback: React.RefCallback<HTMLTextAreaElement> = (node) => {
    if (!node) return;
    const observer = new ResizeObserver(() => console.log("Resized"));
    observer.observe(node);
    // ✅ React 19: Return cleanup function
    return () => observer.disconnect();
  };
  return <textarea ref={refCallback} />;
}
```

#### TypeScript Rejection of Implicit Assignment Returns

In JS, assignment `(myRef.current = node)` evaluates to `node`. In React 19, returning a DOM node triggers a compile error because React expects a cleanup function or `void`:

```tsx
import React from "react";

export function RefAssignmentDemo() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // ❌ Compile Error in React 19: Type 'HTMLInputElement' is not assignable to 'void | (() => void)'
  // return <input ref={(node) => (inputRef.current = node)} />;

  // ✅ Best Practice: Use block statement with void return
  return <input ref={(node) => { inputRef.current = node; }} />;
}
```

### 12.1.6 Strict `useRef<T>` and the `React.JSX.Element` Namespace

1. **Strict `useRef<T>`**: `useRef<number>()` without arguments is now a TypeScript error (`Expected 1 arguments, but got 0`). You must provide an initial argument: `useRef<number>(0)` or `useRef<number | undefined>(undefined)`.
2. **`React.JSX.Element`**: Scoped under `React.JSX` to prevent collisions across multiple JSX runtimes.

```typescript
import React from "react";
const countRef = React.useRef<number | undefined>(undefined);
const domRef = React.useRef<HTMLDivElement | null>(null);
type ElementType = React.JSX.Element;
```

---

## Lesson 12.2: Typing the `use()` API, Suspense, and Context as a Provider

### 12.2.1 Typing the `use()` API Signature

React 19 introduces `use()`, a universal primitive to unwrap asynchronous resources and Context:

```typescript
export type Usable<T> = PromiseLike<T> | React.Context<T>;
export function use<T>(usable: Usable<T>): T;
```

Unwrapping a `Promise<T>` suspends the component until resolution; unwrapping `Context<T>` reads the context value:

```tsx
import React, { use, createContext } from "react";
import type { Expect, Equal } from "./type-helpers";

interface UserProfile { id: string; username: string }
const UserContext = createContext<UserProfile | null>(null);

function ProfileCard() {
  const user = use(UserContext);
  //    ^? const user: UserProfile | null
  type Test_User = Expect<Equal<typeof user, UserProfile | null>>;
  return <div>{user?.username}</div>;
}
```

### 12.2.2 Conditional Context Consumption with `use()`

Unlike `useContext`, `use()` does not follow traditional hook ordering rules and can be called inside `if` statements, ternary branches, or after early returns:

```tsx
import React, { use, createContext } from "react";

interface Theme { primary: string }
const AdminTheme = createContext<Theme>({ primary: "red" });
const PublicTheme = createContext<Theme>({ primary: "blue" });

export function Navbar({ isAdmin, enabled }: { isAdmin: boolean; enabled: boolean }) {
  if (!enabled) return <nav>Static Nav</nav>;
  // ✅ React 19: use() called conditionally inside control-flow
  const theme = isAdmin ? use(AdminTheme) : use(PublicTheme);
  //    ^? const theme: Theme
  return <nav style={{ background: theme.primary }}>Navbar</nav>;
}
```

### 12.2.3 Streaming Promises from Server Components into Client Components

Server Components can initiate async fetches and pass unresolved promises down to Client Components:

```tsx
// ClientAnalytics.tsx
"use client";
import React, { use, Suspense } from "react";

export interface Analytics { pageViews: number; bounceRate: number }

export function AnalyticsDisplay({ promise }: { promise: Promise<Analytics> }): React.JSX.Element {
  const data = use(promise); // Suspends until promise resolves!
  //    ^? const data: Analytics
  return <div>Views: {data.pageViews} | Bounce: {data.bounceRate}%</div>;
}

export function AnalyticsWidget({ promise }: { promise: Promise<Analytics> }) {
  return (
    <Suspense fallback={<p>Streaming analytics data...</p>}>
      <AnalyticsDisplay promise={promise} />
    </Suspense>
  );
}
```

### 12.2.4 Direct Context Rendering (`<Context value={...}>`)

In React 19, `<Context.Provider>` is deprecated. Render the `Context` object directly as a JSX provider:

```tsx
import React, { createContext, useState } from "react";

export interface AuthContextValue { token: string | null; logout: () => void }
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [token, setToken] = useState<string | null>("jwt-xyz");
  const value: AuthContextValue = { token, logout: () => setToken(null) };
  // ✅ React 19: <AuthContext value={value}> directly
  return <AuthContext value={value}>{children}</AuthContext>;
}
```

---

## Lesson 12.3: Async Transitions, Form Actions, `useActionState`, `useFormStatus`, and `useOptimistic`

### 12.3.1 Async Transitions with `startTransition`

`startTransition` accepts async callbacks `async () => Promise<void>`, managing pending state across the asynchronous duration:

```tsx
import React, { useTransition, useState } from "react";

export function AsyncTransitionDemo() {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState("Initial");

  const handleUpdate = () => {
    startTransition(async () => {
      const res = await fetch("/api/status");
      const json = (await res.json()) as { message: string };
      setData(json.message);
    });
  };

  return <button onClick={handleUpdate} disabled={isPending}>{isPending ? "Loading..." : data}</button>;
}
```

### 12.3.2 Native `<form action={...}>` and `<button formAction={...}>`

Form elements accept async action functions `(formData: FormData) => void | Promise<void>` directly:

```tsx
import React from "react";

export function NewsletterSignup(): React.JSX.Element {
  async function subscribe(formData: FormData): Promise<void> {
    const email = formData.get("email");
    if (typeof email === "string") {
      await fetch("/api/subscribe", { method: "POST", body: JSON.stringify({ email }) });
    }
  }

  return (
    <form action={subscribe}>
      <input name="email" type="email" required />
      <button type="submit">Subscribe</button>
      <button formAction={async (fd) => console.log("Draft:", fd.get("email"))}>Save Draft</button>
    </form>
  );
}
```

### 12.3.3 Deep Dive into `useActionState<State, Payload>`

`useActionState` manages stateful actions, replacing `useFormState`:

```typescript
export function useActionState<State, Payload = FormData>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string
): [state: Awaited<State>, dispatchAction: (payload: Payload) => void, isPending: boolean];
```

#### Discriminated Union Action State

```tsx
import React, { useActionState } from "react";

export interface Project { id: string; title: string; budget: number }

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; data: Project };

async function createProjectAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const title = formData.get("title");
  const budget = Number(formData.get("budget"));
  if (!title || typeof title !== "string") {
    return { status: "error", message: "Validation Failed", fieldErrors: { title: ["Title required"] } };
  }
  return { status: "success", data: { id: "p1", title, budget } };
}

export function CreateProjectForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(createProjectAction, { status: "idle" });
  return (
    <form action={formAction}>
      <input name="title" required />
      {state.status === "error" && state.fieldErrors?.title && <span>{state.fieldErrors.title.join(", ")}</span>}
      <button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create"}</button>
      {state.status === "success" && <p>Created: {state.data.title}</p>}
    </form>
  );
}
```

### 12.3.4 Form State Introspection with `useFormStatus()`

`useFormStatus` lets descendant components inspect enclosing `<form>` status without prop drilling:

```typescript
export type FormStatus =
  | { pending: true; data: FormData; method: string; action: string | ((formData: FormData) => void | Promise<void>) }
  | { pending: false; data: null; method: null; action: null };
export function useFormStatus(): FormStatus;
```

```tsx
import React from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ label }: { label: string }): React.JSX.Element {
  const status = useFormStatus();
  return <button type="submit" disabled={status.pending} aria-busy={status.pending}>{status.pending ? "Saving..." : label}</button>;
}
```

### 12.3.5 Optimistic Updates with `useOptimistic<State, Action>`

`useOptimistic` provides instant UI updates while an asynchronous transition completes:

```typescript
export function useOptimistic<State, Action>(
  passthrough: State,
  updateFn: (currentState: State, optimisticValue: Action) => State
): [optimisticState: State, setOptimistic: (action: Action) => void];
```

```tsx
import React, { useOptimistic, useRef } from "react";

export interface TodoItem { id: string; text: string; optimistic?: boolean }

export function TodoApp({ items, saveTodo }: { items: TodoItem[]; saveTodo: (fd: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [optimisticItems, addOptimistic] = useOptimistic<TodoItem[], { text: string; tempId: string }>(
    items,
    (state, newItem) => [...state, { id: newItem.tempId, text: newItem.text, optimistic: true }]
  );

  async function handleAction(formData: FormData) {
    const text = formData.get("todoText");
    if (typeof text !== "string" || !text.trim()) return;
    formRef.current?.reset();
    addOptimistic({ text, tempId: `temp-${Date.now()}` });
    await saveTodo(formData);
  }

  return (
    <div>
      <form ref={formRef} action={handleAction}><input name="todoText" required /><button type="submit">Add</button></form>
      <ul>{optimisticItems.map((it) => <li key={it.id} style={{ opacity: it.optimistic ? 0.5 : 1 }}>{it.text}</li>)}</ul>
    </div>
  );
}
```

---

## Lesson 12.4: React Server Components (RSC), `"use server"`, `"use client"`, and Serialization Boundaries

### 12.4.1 Typing Async Server Components

Server Components execute exclusively on the server and are typed as `async` functions returning `Promise<React.JSX.Element>`:

```tsx
import React from "react";

export interface UserDashboardProps {
  // In Next.js 15+ / React 19, route params are typed as Promises for streaming
  params: Promise<{ orgId: string }>;
}

export async function UserDashboard({ params }: UserDashboardProps): Promise<React.JSX.Element> {
  const { orgId } = await params;
  const data = await fetch(`https://api.internal/orgs/${orgId}`).then((r) => r.json());
  return <section><h1>Org: {orgId}</h1><pre>{JSON.stringify(data)}</pre></section>;
}
```

### 12.4.2 Enforcing Serialization Boundaries at the Type Level

Props passed to `"use client"` components serialize over the Flight protocol. Allowed: primitives, plain objects, arrays, `Date`, `Map`, `Set`, `BigInt`, `FormData`. Disallowed: functions, DOM nodes, Symbols, classes:

```typescript
import type { Expect, Equal } from "./type-helpers";

export type FlightPrimitive = string | number | boolean | null | undefined | bigint;

export type Serializable<T> =
  T extends FlightPrimitive | Date ? T :
  T extends Map<infer K, infer V> ? Map<Serializable<K>, Serializable<V>> :
  T extends Set<infer M> ? Set<Serializable<M>> :
  T extends readonly (infer U)[] ? readonly Serializable<U>[] :
  T extends (...args: any[]) => any ? never :
  T extends object ? { [K in keyof T]: Serializable<T[K]> } : never;

type ValidProps = { id: string; createdAt: Date; tags: string[] };
type InvalidProps = { id: string; onClick: () => void };

type Test_Valid = Expect<Equal<Serializable<ValidProps>, ValidProps>>;
type Test_InvalidFunction = Expect<Equal<Serializable<InvalidProps>["onClick"], never>>;
```

### 12.4.3 Type-Safe Server Actions with Zod + `useActionState`

Wrap Zod validation into a reusable action factory:

```tsx
import { z } from "zod";

export type ActionValidationResult<TData> =
  | { success: true; data: TData }
  | { success: false; errors: Record<string, string[]> };

export function createValidatedAction<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  handler: (validated: z.infer<TSchema>) => Promise<TResult>
) {
  return async (_prev: ActionValidationResult<TResult>, formData: FormData): Promise<ActionValidationResult<TResult>> => {
    const raw: Record<string, unknown> = {};
    formData.forEach((val, key) => { raw[key] = val; });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join(".");
        errors[k] = [...(errors[k] ?? []), issue.message];
      }
      return { success: false, errors };
    }
    const data = await handler(parsed.data);
    return { success: true, data };
  };
}

const UserSchema = z.object({ email: z.string().email(), age: z.coerce.number().min(18) });
export const registerUser = createValidatedAction(UserSchema, async (input) => {
  // input is fully inferred: { email: string; age: number }
  return { userId: "u_1", email: input.email };
});
```

---

## Lesson 12.5: React Compiler (React Forget), `useEffectEvent`, `<Activity>`, and Document Metadata

### 12.5.1 React Compiler & TypeScript Immutability Contracts

The React Compiler automatically memoizes components and hooks by building a fine-grained reactivity graph. It relies on **immutability invariants**. Mutating props or state in place breaks memoization:

```typescript
// ❌ Violates Compiler Invariants: In-place mutation
function BadList({ items }: { items: string[] }) {
  items.sort(); // Mutates prop in place! Bails out React Compiler.
  return <div>{items.join(", ")}</div>;
}

// ✅ Preserves Invariants: Enforce with readonly types
function PureList({ items }: { readonly items: readonly string[] }) {
  // items.sort(); // ❌ Compile error on readonly array!
  const sorted = [...items].sort(); // ✅ Immutable copy
  return <div>{sorted.join(", ")}</div>;
}
```

### 12.5.2 Typing `useEffectEvent` for Non-Reactive Callbacks

`useEffectEvent` defines non-reactive logic inside effects without triggering re-runs:

```tsx
import React, { useEffect } from "react";

export declare function useEffectEvent<T extends (...args: any[]) => any>(fn: T): T;

interface ChatProps { roomId: string; theme: string }

export function ChatRoom({ roomId, theme }: ChatProps): React.JSX.Element {
  const onConnected = useEffectEvent((room: string) => {
    console.log(`Connected to ${room} with theme ${theme}`);
  });

  useEffect(() => {
    const socket = { connect: () => onConnected(roomId), close: () => {} };
    socket.connect();
    return () => socket.close();
    // ✅ Only roomId is a dependency; onConnected and theme are omitted safely!
  }, [roomId]);

  return <div>Room: {roomId}</div>;
}
```

### 12.5.3 Native Document Metadata & Resource Preloading

React 19 natively hoists metadata tags to `<head>` and manages stylesheet precedence:

```tsx
import React from "react";

export function ArticlePage({ title, author }: { title: string; author: string }): React.JSX.Element {
  return (
    <article>
      <title>{title}</title>
      <meta name="author" content={author} />
      <link rel="stylesheet" href="/article.css" precedence="default" />
      <h1>{title}</h1>
    </article>
  );
}
```

---

## Anti-Patterns vs. Best Practices in React 19

| Category | ❌ React 18 / Outdated Pattern | ✅ React 19 Best Practice |
| :--- | :--- | :--- |
| **Component Refs** | `forwardRef<Ref, Props>(...)` (erases generics, requires `fixedForwardRef`). | Direct `ref?: React.Ref<T>` in component props. |
| **Ref Callbacks** | Implicit return assignment `ref={el => (ref.current = el)}` (runtime crash). | Void block body `ref={el => { ref.current = el; }}` or cleanup `() => void`. |
| **Context Providers** | `<ThemeContext.Provider value={theme}>` provider nesting. | Render `<ThemeContext value={theme}>` directly. |
| **Conditional Context** | Dummy wrapper components to satisfy strict Rules of Hooks. | Call `use(Context)` conditionally inside `if` or loops. |
| **Form Async State** | Manual `useState(loading)` + `try/catch/finally` boilerplate. | `useActionState(action, initial)` with automatic pending tracking. |
| **Optimistic UI** | Manual optimistic array state and rollback management. | `useOptimistic(state, updateFn)` for coordinated transitions. |
| **Compiler Safety** | In-place mutations (`array.push`, `props.x = 1`) corrupting caches. | `readonly` types and immutable functional updates. |

---

## Hands-On Exercises & Step-by-Step Solutions

### Exercise 12.1: Generic Dropdown with Direct `ref` & Cleanup Callback

#### Problem Statement
Build a generic `<Dropdown<TItem>>` component:
1. Accepts `items: readonly TItem[]`, `selectedItem: TItem`, `onSelect: (item: TItem) => void`, and `getLabel: (item: TItem) => string`.
2. Accepts `ref?: React.Ref<HTMLDivElement>` directly as a prop (no `forwardRef`).
3. Uses a ref callback internally to attach an `IntersectionObserver`, returning an explicit cleanup function.
4. Preserves full generic type inference.

#### Complete Solution & Explanation

```tsx
import React, { useRef } from "react";
import type { Expect, Equal } from "./type-helpers";

export interface DropdownProps<TItem> {
  items: readonly TItem[];
  selectedItem: TItem;
  onSelect: (item: TItem) => void;
  getLabel: (item: TItem) => string;
  onVisibilityChange?: (visible: boolean) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function Dropdown<TItem>({
  items, selectedItem, onSelect, getLabel, onVisibilityChange, ref
}: DropdownProps<TItem>): React.JSX.Element {
  const handleRef: React.RefCallback<HTMLDivElement> = (node) => {
    if (!node || !onVisibilityChange) return;
    const observer = new IntersectionObserver(([entry]) => onVisibilityChange(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect(); // React 19 cleanup function
  };

  return (
    <div
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref && "current" in ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        handleRef(node);
      }}
    >
      <ul>{items.map((it, i) => <li key={i} onClick={() => onSelect(it)}>{getLabel(it)}</li>)}</ul>
    </div>
  );
}

// Verification:
interface Product { id: number; title: string }
export function TestDropdown() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const products: Product[] = [{ id: 1, title: "Desk" }];
  return (
    <Dropdown
      ref={containerRef}
      items={products}
      selectedItem={products[0]}
      getLabel={(p) => p.title}
      onSelect={(sel) => {
        //      ^? (parameter) sel: Product
        type Test_Inference = Expect<Equal<typeof sel, Product>>;
      }}
    />
  );
}
```

---

### Exercise 12.2: Conditional Context & Streaming Promise Consumer with `use()`

#### Problem Statement
Implement `<UserProfileView>`:
1. Receives `userPromise: Promise<{ name: string; email: string }>` and `optionalOrgId?: string`.
2. Unwraps `userPromise` with `use(userPromise)`.
3. If `optionalOrgId` is provided, conditionally consumes `OrgContext` with `use(OrgContext)`.
4. Wrap with Suspense boundary.

#### Complete Solution & Explanation

```tsx
import React, { use, Suspense, createContext } from "react";
import type { Expect, Equal } from "./type-helpers";

export interface UserData { name: string; email: string }
export interface OrgData { id: string; orgName: string }
export const OrgContext = createContext<OrgData | null>(null);

interface ProfileProps { userPromise: Promise<UserData>; optionalOrgId?: string }

function ProfileContent({ userPromise, optionalOrgId }: ProfileProps): React.JSX.Element {
  const user = use(userPromise);
  //    ^? const user: UserData
  type Test_User = Expect<Equal<typeof user, UserData>>;
  const org = optionalOrgId ? use(OrgContext) : null;

  return <div><h3>{user.name}</h3>{org && <p>Org: {org.orgName}</p>}</div>;
}

export function UserProfileView(props: ProfileProps): React.JSX.Element {
  return (
    <Suspense fallback={<p>Loading stream...</p>}>
      <ProfileContent {...props} />
    </Suspense>
  );
}
```

---

### Exercise 12.3: Type-Safe Action Form with `useActionState`, `useFormStatus`, & `useOptimistic`

#### Problem Statement
Build an issue creation form:
1. Define discriminated union `IssueState`:
   `| { status: "idle" } | { status: "error"; message: string } | { status: "success"; issue: Issue }`.
2. Dispatch action with `useActionState`.
3. Display optimistic issue with `useOptimistic` and `optimistic?: boolean`.
4. Include a `<SubmitBtn>` child component reading `useFormStatus()`.

#### Complete Solution & Explanation

```tsx
import React, { useActionState, useOptimistic, useRef } from "react";
import { useFormStatus } from "react-dom";

export interface Issue { id: string; title: string; optimistic?: boolean }

export type IssueState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; issue: Issue };

function SubmitBtn(): React.JSX.Element {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Saving..." : "Create"}</button>;
}

export function CreateIssueForm({
  issues,
  onServerCreate,
}: { issues: Issue[]; onServerCreate: (prev: IssueState, fd: FormData) => Promise<IssueState> }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction] = useActionState<IssueState, FormData>(onServerCreate, { status: "idle" });

  const [optimisticIssues, addOptimistic] = useOptimistic<Issue[], string>(
    issues,
    (curr, title) => [...curr, { id: `temp-${Date.now()}`, title, optimistic: true }]
  );

  async function handleSubmit(fd: FormData) {
    const title = fd.get("title");
    if (typeof title === "string" && title.trim()) addOptimistic(title);
    formRef.current?.reset();
    formAction(fd);
  }

  return (
    <div>
      <form ref={formRef} action={handleSubmit}><input name="title" required /><SubmitBtn /></form>
      {state.status === "error" && <p className="error">{state.message}</p>}
      <ul>{optimisticIssues.map((it) => <li key={it.id}>{it.title} {it.optimistic && "(Saving...)"}</li>)}</ul>
    </div>
  );
}
```

---

### Exercise 12.4: Type-Level RSC Serialization Boundary Validator

#### Problem Statement
Create a type utility `ValidateFlightBoundary<TProps>` ensuring all properties cross the RSC boundary safely:
1. Allows primitives, `Date`, `Map`, `Set`, arrays, and plain objects.
2. Evaluates non-serializable properties (functions, DOM nodes, Symbols) to `"Invalid Flight Prop: Non-serializable"`.
3. Verify with `Expect<Equal<...>>`.

#### Complete Solution & Explanation

```typescript
import type { Expect, Equal } from "./type-helpers";

export type FlightBase = string | number | boolean | null | undefined | bigint;

type IsDisallowedFlight<T> =
  T extends (...args: any[]) => any ? true :
  T extends symbol ? true :
  T extends Node ? true : false;

export type ValidateProp<T> =
  IsDisallowedFlight<T> extends true ? "Invalid Flight Prop: Non-serializable" :
  T extends FlightBase | Date ? T :
  T extends Map<infer K, infer V> ? Map<ValidateProp<K>, ValidateProp<V>> :
  T extends Set<infer M> ? Set<ValidateProp<M>> :
  T extends readonly (infer U)[] ? readonly ValidateProp<U>[] :
  T extends object ? { [K in keyof T]: ValidateProp<T[K]> } :
  "Invalid Flight Prop: Non-serializable";

export type ValidateFlightBoundary<TProps> = {
  [K in keyof TProps]: ValidateProp<TProps[K]>;
};

// Verification:
interface ValidProps { id: string; date: Date; tags: string[] }
interface InvalidProps { id: string; onClick: () => void }

type Test_Valid = Expect<Equal<ValidateFlightBoundary<ValidProps>, ValidProps>>;
type ExpectedInvalid = { id: string; onClick: "Invalid Flight Prop: Non-serializable" };
type Test_Invalid = Expect<Equal<ValidateFlightBoundary<InvalidProps>, ExpectedInvalid>>;
```

---

## Module 12 Summary & Cheat Sheet

1. **Ref as a Prop**: `ref?: React.Ref<T>` is a standard prop. `forwardRef` is deprecated.
2. **Generic Components with Ref**: Preserves type parameters without `fixedForwardRef` casting.
3. **Ref Callback Cleanup**: Callbacks can return cleanup `() => void`. Implicit assignment returns (`ref={el => (ref.current = el)}`) fail typecheck to prevent bugs.
4. **Strict `useRef`**: `useRef<T>()` without arguments is an error; supply initial value or `undefined`.
5. **Universal `use()` Primitive**: Unwraps Promises and Context. Callable conditionally in `if` branches.
6. **Direct Context Provider**: Render `<Context value={val}>` directly instead of `<Context.Provider>`.
7. **`useActionState`**: Stateful action management: `[state, dispatch, isPending] = useActionState(action, initial)`.
8. **`useFormStatus`**: Introspects parent form submission state inside child components.
9. **`useOptimistic`**: Instant optimistic UI feedback during async transitions.
10. **RSC Serialization Boundary**: Validate props crossing to `"use client"` with recursive `Serializable<T>`.
11. **React Compiler Immutability**: Use `readonly` types to guarantee compiler purity invariants.
