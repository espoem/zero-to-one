# 06: Suspense, Streaming SSR & Hydration

## 1. Formal Foundations: Algebraic Effects & `use(Promise)`

React Suspense is a practical implementation of **algebraic effect handlers** in JavaScript. When a component requires asynchronous data that has not yet resolved, it "suspends" by interrupting its own synchronous execution.

### 1.1 The Suspension Protocol

In React 19, the `use(promise)` API formalizes this mechanism:
1. If the Promise is **pending**, `use()` attaches internal resolution callbacks to the promise and throws the Promise object itself.
2. The nearest ancestor `<Suspense>` boundary catches the thrown Promise in its render loop.
3. React renders the boundary's `fallback` UI without failing the rest of the application tree.
4. When the Promise settles (resolves or rejects), React retries rendering the suspended component.

```
Component: use(dataPromise)
      |
      +---> Pending? Throws Promise ---> Caught by <Suspense fallback={<Loading />} />
      |                                              |
      |                                              v
      |                                      Renders <Loading />
      v
Promise Resolves ---> React Retries Render ---> Renders Component Content
```

---

## 2. Multi-Tier Progression: Streaming SSR & Selective Hydration

### 2.1 The Traditional SSR Bottleneck

In legacy SSR, the server must fetch all data for all components before emitting any HTML to the browser (`renderToString`). If one slow database query takes 2 seconds, the user sees a blank white screen for 2 full seconds (Time To First Byte bottleneck).

### 2.2 Streaming HTML via `<Suspense>`

With React 19 Streaming SSR (`renderToPipeableStream`):
1. React immediately emits the main application shell and Suspense fallback placeholders in the initial HTML chunk.
2. The browser renders the shell and displays the fallback skeletons immediately (near-zero TTFB).
3. When the slow server query resolves, React streams an inline `<template>` chunk containing the resolved HTML, followed by an inline `<script>` that swaps the fallback with the resolved content in the DOM without waiting for full client hydration.

### 2.3 Selective Hydration

Selective hydration allows users to interact with critical page components before the entire page has finished loading. If a user clicks on an unhydrated button inside a Suspense boundary, React pauses ongoing background hydration and prioritizes hydrating that clicked boundary immediately.

---

## 3. Hydration Invariants & Mismatch Detection

**Hydration** is the process where client React traverses server-rendered DOM elements and binds fiber nodes and event listeners directly without re-creating DOM elements.

### 3.1 Hydration Mismatch Failure Mode

If the server HTML differs from the initial client render (e.g. due to using `new Date().toLocaleTimeString()` or `window.innerWidth` during initial render):
1. React detects that DOM attributes or text content do not match the virtual tree.
2. In development, React logs a descriptive hydration mismatch warning.
3. React discards the mismatched server subtree and falls back to client-side rendering for that boundary, resulting in visual flashing and performance penalties.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [06-suspense-and-streaming-ssr.ts](../examples/06-suspense-and-streaming-ssr.ts) provides deterministic verification:
- **`use(Promise)` Protocol**: Proves that pending promises throw to Suspense and fulfilled promises return synchronous values.
- **Suspense Fallback Activation**: Verifies that unresolved resources render fallback UI, then update cleanly once resolved.
- **Hydration Mismatch Detection**: Demonstrates deterministic error capture when server markup diverges from client tree output.
