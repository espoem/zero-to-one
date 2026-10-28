# 08: Server Actions & Optimistic UI

## 1. Formal Foundations: Progressive Enhancement & Actions

In React 19, mutations and asynchronous data submissions are formalized around the concept of **Actions**—asynchronous functions dispatched via forms or transitions that manage pending states, error recovery, and optimistic updates.

### 1.1 Progressive Enhancement via `<form action>`

React 19 native forms integrate directly with HTML standards. If JavaScript has not yet downloaded or hydrated:
1. The browser submits the form via native HTTP POST to the action URL.
2. The server processes the mutation and returns fresh HTML.

Once hydrated, React intercepts the form submission, serializes form fields into `FormData`, invokes the Server Action over Flight RPC, and streams revalidation updates back to the client without a full-page reload.

---

## 2. Multi-Tier Progression: `useActionState` and `useOptimistic`

### 2.1 The `useActionState` State Machine

`useActionState` wraps an async action function and manages its lifecycle:

```tsx
const [state, formAction, isPending] = useActionState(
  async (prevState: State, formData: FormData) => {
    return await updateItem(prevState.id, formData.get("title"));
  },
  initialState
);
```

- `isPending`: Becomes `true` synchronously when `formAction` is invoked and reverts to `false` when the async promise resolves.
- `state`: Holds the latest resolved value returned by the action function.

### 2.2 Speculative State via `useOptimistic`

Modern interactive UIs must update immediately on user input rather than waiting 200–500ms for a round-trip network response. `useOptimistic` applies speculative updates immediately while the transition is pending:

```tsx
const [optimisticTasks, setOptimisticTasks] = useOptimistic(
  committedTasks,
  (currentTasks, newTaskTitle: string) => [
    ...currentTasks,
    { id: "temp-id", title: newTaskTitle, status: "pending" }
  ]
);
```

### 2.3 The Mandatory Rollback Invariant

If the server action rejects (e.g., database constraint failure or validation error):
1. The action throws an error or returns an error state.
2. Because optimistic updates are tied to the transition lifecycle, React **automatically discards** the optimistic modifications and rolls the UI back to the current committed state.

---

## 3. Concurrency Edge Cases: Race Conditions & Monotonicity

When multiple actions are submitted rapidly (e.g. typing a rename query):
- Action A (sent at $t_1$, latency 500ms).
- Action B (sent at $t_2$, latency 100ms).

Action B finishes first at $t_2 + 100\text{ms}$. Action A finishes later at $t_1 + 500\text{ms}$. Without monotonic ordering, Action A overwrites the newer state with stale data (lost update anomaly). Applications must enforce monotonic version tokens or disable concurrent submissions via `useFormStatus().pending`.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [08-actions-and-optimistic-updates.ts](../examples/08-actions-and-optimistic-updates.ts) provides deterministic verification:
- **`useActionState` Lifecycle**: Verifies synchronous `isPending` transitions and resolution states.
- **`useOptimistic` Speculative Mutation & Rollback**: Proves that successful actions commit, while failed actions revert cleanly without phantom states.
- **Race Condition Proof**: Demonstrates how unordered concurrent mutations cause data loss, and verifies monotonic versioning fixes.
