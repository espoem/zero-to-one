# React 19 & Architecture Cheatsheet

Fast lookup reference for React 19 syntax, concurrent primitives, compiler behavior, server actions, and runtime mechanics.

---

## 1. React 19 Primitives & Hooks Reference

| Hook / API | Signature | Primary Purpose | Key Gotcha / Semantic Rule |
| :--- | :--- | :--- | :--- |
| `useActionState` | `[state, formAction, isPending] = useActionState(fn, initial, permalink?)` | Form action submission & async mutation handling. | Action function signature is `(prevState, formData) => Promise<nextState>`. |
| `useOptimistic` | `[optimistic, setOptimistic] = useOptimistic(passthrough, updateFn)` | Speculative immediate UI updates during pending transitions. | Must be triggered inside a transition or form action; reverts automatically on settlement. |
| `useFormStatus` | `{ pending, data, method, action } = useFormStatus()` | Subtree access to parent `<form>` submission state. | Must be called inside a component rendered *as a child* of `<form>`, not in the same component. |
| `use(Promise \| Context)` | `val = use(resource)` | Conditional unrolling of Promises or React Context in render. | Can be invoked inside loops and conditions; throws the Promise to `<Suspense>` if unresolved. |
| `ref` prop | `<input ref={(el) => { ... return () => cleanup(); }} />` | Direct ref passing to function components; callback cleanup. | `forwardRef` is deprecated; returning non-function from ref callback triggers compiler error. |
| `startTransition` | `startTransition(() => setState(newVal))` | Non-urgent background state dispatch yielding to user events. | Updates wrapped in transition do not trigger fallback of already-suspended interfaces. |

---

## 2. Server Components vs. Client Components

| Feature | React Server Component (Default) | Client Component (`"use client"`) |
| :--- | :--- | :--- |
| **Execution Environment** | Server only (Build time or per-request) | Client browser (plus SSR prerender) |
| **Bundle Impact** | 0 KB JavaScript sent to browser | Shipped to browser bundle |
| **Direct File/DB Access** | Yes (`fs`, database drivers, ORMs) | No (throws error or leaks secrets) |
| **State & Lifecycle Hooks** | No (`useState`, `useEffect` not permitted) | Yes (`useState`, `useEffect`, events) |
| **Passing Props Across Boundary** | Props must be Flight-serializable (JSON, Promises, JSX, Arrays, Maps, Sets) | Functions must be Server Actions marked `"use server"` |

---

## 3. Server Actions & Mutations

```tsx
// actions.ts
"use server";

export async function updateUsername(prevState: { error?: string }, formData: FormData) {
  const name = formData.get("name") as string;
  if (!name || name.length < 3) {
    return { error: "Name must be at least 3 characters." };
  }
  await db.user.update({ where: { id: 1 }, data: { name } });
  return { error: undefined };
}

// UserForm.tsx ("use client")
import { useActionState, useOptimistic } from "react";
import { useFormStatus } from "react-dom";
import { updateUsername } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</button>;
}

export function UserForm({ currentName }: { currentName: string }) {
  const [state, formAction, isPending] = useActionState(updateUsername, {});
  const [optimisticName, setOptimisticName] = useOptimistic(
    currentName,
    (_current, next: string) => next
  );

  return (
    <form action={async (formData) => {
      setOptimisticName(formData.get("name") as string);
      await formAction(formData);
    }}>
      <p>Display Name: {optimisticName}</p>
      <input name="name" defaultValue={currentName} />
      {state.error && <span role="alert">{state.error}</span>}
      <SubmitButton />
    </form>
  );
}
```

---

## 4. Priority Lanes Bitmask Quick Reference

| Lane Name | Bitmask Value | Usage & Urgency Level |
| :--- | :--- | :--- |
| **SyncLane** | `0b0000000000000000000000000000001` | Discrete synchronous inputs (click, input, keydown). |
| **InputContinuousLane** | `0b0000000000000000000000000000100` | Continuous interactions (scroll, drag, mousemove). |
| **DefaultLane** | `0b0000000000000000000000010000000` | Standard state updates without transition wrapping. |
| **TransitionLanes** | `0b0000000000001111111111100000000` | Non-urgent updates (`startTransition`, `useDeferredValue`). |
| **IdleLane** | `0b0100000000000000000000000000000` | Off-screen speculative work, background pre-rendering. |

---

## 5. React Compiler & Rules of React

```tsx
// Rule 1: Never mutate component props or state directly
function BadMutation({ items }: { items: string[] }) {
  items.push("new"); // ❌ Bails out compiler memoization
  return <div>{items.length}</div>;
}

function GoodPure({ items }: { items: readonly string[] }) {
  const next = [...items, "new"]; // ✅ Immutable clone; preserves memoization
  return <div>{next.length}</div>;
}

// Rule 2: Never read or write ref.current in render
function BadRefRender() {
  const countRef = useRef(0);
  countRef.current += 1; // ❌ Unstable render behavior under concurrent mode
  return <span>{countRef.current}</span>;
}

// Rule 3: Opt-out directive for rare legacy exceptions
"use no memo"; // Placed at function or file header to disable compiler lowering
```
