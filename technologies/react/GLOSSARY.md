# React 19 & Modern React Architecture Glossary

This glossary defines standard technical terms used throughout the `technologies/react/` learning track. All definitions, headings, and explanations are written in English; each term provides its canonical English name, established Czech equivalent, concise definition, and primary authoritative reference. Terminology adheres to official React 19 specifications (`react.dev`), React source code (`packages/react-reconciler`, `react-server`), React RFCs, and foundational academic literature.

---

## 1. Core Architecture, Fiber & Reconciler

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Fiber** | **Fiber (vlákno usmiřování)** | A persistent work-unit node forming React's incremental reconciler tree; double-buffered via `alternate` to isolate interruptible rendering from atomic commit. | React Source (`ReactFiber.js`), React Docs |
| **Reconciler** | **Usmiřovač (reconciler)** | The recursive tree-diffing engine (`beginWork`/`completeWork`) that maps element descriptions onto the Fiber tree and computes minimal DOM mutations. | `react-reconciler` Specification |
| **Double Buffering** | **Dvojité bufferování** | A memory technique where React maintains a `current` fiber tree (mounted screen state) and a `workInProgress` fiber tree (speculative background render), swapping them via pointer assignment on commit. | React Fiber Architecture |
| **Lane (Priority Mask)** | **Prioritní pruh (lane)** | A bit in a 31-bit priority bitmask encoding update urgency and batch identity; scheduling decisions are computed via bitwise set algebra (`&`, `\|`). | React Source (`ReactFiberLane.js`) |
| **Concurrent Rendering** | **Souběžné vykreslování** | An interruptible, time-sliced rendering mode where urgent user events preempt non-urgent background render passes without blocking the main browser thread. | React 18/19 Architecture |
| **Time Slicing** | **Časové dělení (time slicing)** | Breaking long rendering calculations into 5ms execution chunks interleaved with the browser event loop via `MessageChannel` / `postMessage`. | React Scheduler Package |
| **Tearing** | **Roztržení (nekonzistentní čtení / tearing)** | A visual defect where different parts of the UI display values from different snapshots of mutable external state within the same continuous frame. | React Working Group (useSyncExternalStore) |
| **Render Phase** | **Fáze vykreslení** | The pure, interruptible phase where components are evaluated, fiber trees constructed, and effect tags collected without mutating the DOM. | React Docs (Render and Commit) |
| **Commit Phase** | **Fáze potvrzení** | The synchronous, uninterruptible phase where DOM mutations, layout measurements (`useLayoutEffect`), and passive effects (`useEffect`) are executed. | React Docs (Render and Commit) |

---

## 2. Hooks, State & Synchronization

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Stale Closure** | **Zastaralý uzávěr** | A bug where an asynchronous callback or event listener captures variable bindings from an earlier render pass, failing to observe current component state. | ECMAScript Lexical Environments, React Docs |
| **Transition (`startTransition`)** | **Přechod (transition)** | A non-urgent state update marked to yield to urgent inputs (typing, clicking), retaining the current UI view until the next screen is ready. | React Docs (`startTransition`) |
| **Action State (`useActionState`)** | **Stav akce (`useActionState`)** | A React 19 hook managing form and mutation lifecycle (`[state, formAction, isPending]`), returning progressive enhancement status and latest action output. | React 19 Docs (`useActionState`) |
| **Optimistic State (`useOptimistic`)** | **Optimistický stav (`useOptimistic`)** | A hook applying speculative local UI updates immediately during async transitions, with automatic rollback upon action completion or rejection. | React 19 Docs (`useOptimistic`) |
| **Form Status (`useFormStatus`)** | **Stav formuláře (`useFormStatus`)** | A context-free consumer hook providing `{ pending, data, method, action }` for the parent `<form>` container. | React 19 Docs (`useFormStatus`) |
| **Resource Unwrapping (`use`)** | **Rozbalení prostředku (`use`)** | A React 19 primitive that unrolls Promises or reads Context conditionally within render functions, suspending the component when promises are pending. | React 19 RFC, React Docs (`use`) |
| **Ref Cleanup Function** | **Úklidová funkce pro ref** | A callback returned from a ref attachment function executed when the node is unmounted or reassigned, replacing manual null-checks. | React 19 Release Notes |

---

## 3. Streaming, Server Components & Full-Stack Architecture

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **React Server Component (RSC)** | **Serverová komponenta (RSC)** | A stateless component executing exclusively on the server at request time or build time, emitting zero JavaScript bundle overhead to the client browser. | React RFC #0188 |
| **Client Component** | **Klientská komponenta** | An interactive component marked with `"use client"` that compiles and hydrates on the client browser with full access to hooks and DOM APIs. | React RFC #0188 |
| **Server Action** | **Serverová akce** | An async function marked with `"use server"` that can be dispatched from forms or client transitions, running securely on the backend with RPC routing. | React RFC #0227 |
| **Flight Protocol** | **Protokol Flight** | The compact streaming wire format used by React Server Components to serialize component trees, client references, suspense boundaries, and props to the browser. | React Source (`react-server`) |
| **Hydration** | **Hydratace** | The process where client-side React attaches event listeners and instantiates fiber trees over server-rendered HTML markup without re-creating DOM nodes. | React Docs (`hydrateRoot`) |
| **Selective Hydration** | **Selektivní hydratace** | Streaming hydration that prioritizes activating the specific Suspense boundaries a user interacts with (e.g., clicks) before hydrating non-focused elements. | React 18 Architecture |
| **Hydration Mismatch** | **Neshoda při hydrataci** | An error triggered when the initial client render tree differs from the server-rendered HTML markup, causing client fallback or layout shifts. | React Docs |
| **Suspense Boundary** | **Suspense hranice** | A declarative component (`<Suspense fallback={...}>`) that catches thrown promises or streaming flight chunks and displays placeholder UI until settled. | React RFC #0213 |
| **Error Boundary** | **Chybová hranice** | A boundary catching JavaScript errors thrown during render or lifecycle in child subtrees, rendering fallback UI and offering recovery mechanisms. | React Docs (Error Boundaries) |

---

## 4. Compilation, Memoization & Static Analysis

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **React Compiler** | **Překladač Reactu (React Compiler)** | An optimizing Babel/Rollup compiler that analyzes JavaScript/TypeScript ASTs and automatically lowers fine-grained memoization caches into component functions. | React Compiler Documentation |
| **High-Level Intermediate Representation (HIR)** | **Vysokoúrovňová mezireprezentace (HIR)** | The typed control-flow graph utilized by React Compiler to perform alias analysis, variable lifetime tracking, and effect dependency inference. | React Compiler Internals |
| **Reactive Scope** | **Reaktivní rozsah (reactive scope)** | A continuous block of instructions identified by the compiler whose inputs and outputs are tracked and wrapped in memoization cache slots. | React Compiler Specification |
| **Compiler Memoization** | **Memoizace překladačem** | The automatic caching of component elements, props, and computations, replacing manual `useMemo`, `useCallback`, and `React.memo`. | React Compiler Specification |
| **Escape Directive (`"use no memo"`)** | **Direktiva pro vynechání memoizace** | An explicit opt-out directive signaling the compiler to skip automatic memoization transforms for a specific function or file. | React Compiler Manual Overrides |
