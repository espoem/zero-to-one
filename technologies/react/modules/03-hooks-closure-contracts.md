# 03: Hooks, State & Closure Mechanics

## 1. Formal Foundations: The Hook Linked-List Model

React Hooks do not rely on proxy interception or compiler magic; they are stored as a singly linked list attached directly to the active fiber's `memoizedState` property.

### 1.1 Internal Hook Memory Structure

Each invocation of a hook (`useState`, `useReducer`, `useEffect`) creates or traverses a `Hook` record:

```typescript
interface Hook {
  memoizedState: any;      // The resolved state value or effect record
  baseState: any;          // The base state prior to pending queue updates
  baseQueue: Update | null;// Pending updates retained due to lane priority
  queue: UpdateQueue | null; // Circular linked list of dispatched actions
  next: Hook | null;       // Pointer to the next hook called in this component
}
```

During component evaluation:
1. **Mount Dispatcher (`HooksDispatcherOnMount`)**: Allocates new `Hook` nodes and links them via `hook.next`.
2. **Update Dispatcher (`HooksDispatcherOnUpdate`)**: Traverses the existing linked list in strict call sequence:

$$\text{Hook}_0 \xrightarrow{\text{next}} \text{Hook}_1 \xrightarrow{\text{next}} \text{Hook}_2 \dots$$

### 1.2 Mathematical Proof of the "Rules of Hooks"

Because hooks are indexed purely by order of invocation ($i \in \{0, 1, \dots, n-1\}$), wrapping a hook call in a conditional statement or early return shifts indices:

$$\text{If render } t \text{ calls } [h_0, h_1, h_2] \text{ and render } t+1 \text{ skips } h_1 \implies h_2 \text{ reads } \text{State}(h_1)$$

This causes subsequent hooks to read mismatched state slots, leading to runtime data corruption or unrecoverable type errors.

---

## 2. Multi-Tier Progression: Stale Closures and Functional Updaters

### 2.1 The Stale Closure Dilemma

In JavaScript, a closure captures variable bindings from its lexical environment at the moment of function definition. In a React component:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setTimeout(() => {
      // Stale closure: captures `count` at render time (e.g. 0)
      setCount(count + 1);
    }, 1000);
  }
}
```

If the user clicks three times rapidly, three timeouts are queued. Each callback captures `count === 0`. When they resolve:
- Callback 1 sets `count = 0 + 1 = 1`.
- Callback 2 sets `count = 0 + 1 = 1`.
- Callback 3 sets `count = 0 + 1 = 1`.

Two increments are completely lost due to stale state capture.

### 2.2 Resolution: Reducer Semantics & Functional Updaters

When state updates depend on previous state, developers must use the **functional updater** form:

```tsx
setCount((prevCount) => prevCount + 1);
```

Functional updaters are queued into the hook's `queue` without reading lexical state. During reconciliation, React drains the update queue sequentially:

$$\text{State}_{t+1} = f_3(f_2(f_1(\text{State}_t)))$$

---

## 3. Automatic Batching Across Async Contexts

In React 18 and React 19, state updates triggered inside promises, timeouts, and native event listeners are automatically batched into a single render pass by default. This prevents intermediate inconsistent renders without requiring manual `unstable_batchedUpdates`.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [03-hooks-closure-contracts.ts](../examples/03-hooks-closure-contracts.ts) provides deterministic verification:
- **Linked-List State Traversal**: Proves sequential dispatch and queue drainage across renders.
- **Negative Proof of Call-Order Violation**: Demonstrates how conditionally skipping a hook shifts slot mappings and assigns wrong state values.
- **Lost Update Proof**: Proves that three rapid stale-closure updates yield a count of 1, whereas functional updaters correctly yield 3.
