# 04: Effects, Refs & React 19 Cleanup

## 1. Formal Foundations: The Effect Lifecycle

Side effects in React represent escape hatches from the pure rendering model to interact with external, mutable systems (browser DOM, network sockets, timers).

### 1.1 Synchronization vs. Events

- **Render**: Pure computation mapping props and state to UI descriptions. Must produce no observable side effects.
- **Event Handlers**: Imperative logic responding to specific user actions (e.g., clicking a button).
- **Effects (`useEffect`)**: Imperative logic required to synchronize component state with an external system *regardless* of why the component re-rendered.

### 1.2 Layout Effects vs. Passive Effects

React separates effects into two execution lanes during the Commit Phase:

1. **`useLayoutEffect` (Synchronous / Pre-Paint)**: Executes immediately after React mutates the DOM, before the browser paints. Used for layout measurements (e.g., `getBoundingClientRect()`) to prevent visual flickering.
2. **`useEffect` (Passive / Post-Paint)**: Defers execution until after the browser has completed layout and paint, preventing long-running side effects from delaying the initial frame.

---

## 2. Multi-Tier Progression: React 19 Ref Callback Cleanup

Prior to React 19, ref callbacks were called with the DOM element upon mount, and with `null` upon unmount:

```tsx
// Legacy Pattern:
<div ref={(node) => {
  if (node) {
    attachObserver(node);
  } else {
    detachObserver();
  }
}} />
```

### 2.1 The React 19 Cleanup Return Specification

React 19 standardizes ref callbacks to match `useEffect` cleanup contracts: a ref callback may return a **cleanup function**:

```tsx
// React 19 Pattern:
<div ref={(node) => {
  if (!node) return;
  const observer = new ResizeObserver(handleResize);
  observer.observe(node);

  // Return cleanup function invoked on unmount or node reassignment:
  return () => {
    observer.disconnect();
  };
}} />
```

### 2.2 Operational Execution Rules

1. When a node changes or unmounts, React immediately invokes the returned cleanup function.
2. If a ref callback returns a value that is neither a function nor `undefined` (such as accidentally returning an object or number via an implicit arrow function return), React raises a runtime `TypeError`.

---

## 3. Strict Mode Double-Invocation & Resilience

In development mode under `<React.StrictMode>`, React mounts components, immediately unmounts them, and re-mounts them:

$$\text{Mount} \xrightarrow{} \text{Cleanup} \xrightarrow{} \text{Remount}$$

This intentional harness stress-tests whether effects and refs properly clean up resources (such as event listeners, timers, and WebSockets). If an effect fails to register a cleanup, resources leak during development, alerting developers before deployment.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [04-effects-and-ref-cleanup.ts](../examples/04-effects-and-ref-cleanup.ts) provides deterministic verification:
- **Ref Callback Cleanup**: Proves that replacing or unmounting elements invokes the registered cleanup callback.
- **Negative Proof of Invalid Returns**: Validates that non-function returns trigger `TypeError`.
- **Effect Sequencing**: Demonstrates that previous cleanups always execute prior to subsequent effect re-execution.
