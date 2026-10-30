# React Glossary (EN ↔ CZ)

Technology-specific terms for `technologies/react`. General CS terms live in the [root glossary](../../GLOSSARY.md); where a term appears there, its English definition and Czech term are reused verbatim (marked ↑). Czech practice keeps many React API names in English; such terms are listed as *(nepřekládá se)* — "not translated" — rather than given invented Czech equivalents. Sources: react.dev Learn/Reference, React blog posts cited in the modules, and the React source (`react/react` on GitHub).

| English term | Czech term | Definition | Source | Module |
|---|---|---|---|---|
| **Element (React element)** | **Element (React element)** | Immutable plain object `{ $$typeof, type, key, props }` describing what to render; creating one does not call the component. | react.dev — Render and Commit | 01 |
| **Component** | **Komponenta** | A function (or class) from props, state and context to a description of UI. | react.dev — Your First Component | 01 |
| **JSX** | **JSX** *(nepřekládá se)* | Syntax extension lowered by a compiler to `jsx()`/`jsxs()` calls from `react/jsx-runtime` (automatic runtime). | JSX draft spec; react.dev — Writing Markup with JSX | 01 |
| **Props** | **Props / vlastnosti komponenty** | Read-only inputs passed to a component by its parent. | react.dev — Passing Props | 01 |
| **Key** | **Klíč (key)** | Sibling-unique identity used by reconciliation to match children across renders; not visible as a prop. | react.dev — Rendering Lists | 01, 02 |
| **Pure Function** ↑ | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. | Church (Lambda Calculus), Functional Programming Standards | 01 |
| **Strict Mode** | **Strict Mode** *(nepřekládá se)* | Development-only harness that double-invokes renders, effects and ref callbacks to expose impurity and missing cleanup (on hydration too since 19.3). | react.dev — StrictMode | 01, 04 |
| **Render phase** | **Fáze vykreslení (render)** | Pure, interruptible phase in which components are called and fibers reconciled; no host mutations. | react.dev — Render and Commit | 01, 02 |
| **Commit phase** | **Fáze potvrzení (commit)** | Synchronous phase applying host mutations, attaching refs and running layout effects. | react.dev — Render and Commit | 02 |
| **Reconciliation** | **Rekonciliace** | Matching the new element tree against existing fibers to decide what to reuse, update, insert or delete. | react.dev — Preserving and Resetting State; `ReactChildFiber.js` | 02 |
| **Fiber** | **Fiber** *(nepřekládá se)* | Mutable record for one component instance and its pending work, linked by `child`/`sibling`/`return`. | React source `ReactFiber.js` | 02 |
| **Double buffering** | **Dvojité bufferování** | Keeping a current and a work-in-progress version of each fiber (`alternate`) and swapping them on commit. | React source; graphics literature | 02 |
| **Bailout** | **Bailout (přeskočení vykreslení)** | Skipping the render of a fiber or subtree whose inputs are unchanged. | React source `ReactFiberBeginWork.js` | 02 |
| **Hook** | **Hook** *(nepřekládá se)* | Function starting with `use` that reads React state/context/effects; state is matched by call order. | react.dev — Rules of Hooks | 03 |
| **Closure** ↑ | **Uzávěr (lexikální uzávěr)** | The combination of a function bundled together with references to its surrounding lexical environment, allowing access to outer scope variables. | Landin (The Mechanical Evaluation of Expressions) | 03 |
| **Stale closure** | **Zastaralý uzávěr** | A callback that reads values from the render that created it after newer renders happened. | react.dev — State as a Snapshot | 03, 04 |
| **Batching** | **Dávkování (batching)** | Processing several state updates in one render and commit (automatic everywhere since 18). | react.dev — Queueing a Series of State Updates | 03 |
| **Reducer** | **Reducer** *(nepřekládá se)* | Pure function `(state, action) → state` used by `useReducer`. | react.dev — useReducer | 03 |
| **Tearing** | **Tearing** *(nepřekládá se)* | A committed UI showing the same external source at different versions in one commit. | React 18 Working Group discussion #69 | 03 |
| **Context** | **Kontext** | Value provided by an ancestor and read by descendants without props; `<Context value>` is the provider in 19. | react.dev — createContext | 03 |
| **Effect** | **Efekt** | Synchronisation with an external system declared during render and run after commit; setup ∘ cleanup ∘ setup ≡ setup. | react.dev — Synchronizing with Effects | 04 |
| **Idempotence / Idempotency** ↑ | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) | 04, 08 |
| **Effect Event** | **Effect Event** *(nepřekládá se)* | Function from `useEffectEvent` (19.2) that reads the latest props/state and is not an effect dependency. | react.dev — useEffectEvent | 04 |
| **Ref** | **Ref (reference)** | Mutable `{ current }` box or callback attached to a host node or instance; a regular prop in 19. | react.dev — useRef | 01, 04 |
| **Lane** | **Lane** *(nepřekládá se)* | One bit of the 31-bit priority mask attached to every update. | React source `ReactFiberLane.js` | 05 |
| **Transition** | **Přechod (transition)** | Non-blocking update that may be interrupted and never replaces visible content with a fallback. | react.dev — startTransition | 05 |
| **Concurrent rendering** | **Souběžné vykreslování** | Interleaving and interrupting renders by priority on a single thread. | react.dev — React 18 release | 05 |
| **Time slicing** | **Time slicing** *(nepřekládá se)* | Splitting render work into ~5 ms slices, yielding to the browser between fibers. | `scheduler` package | 05 |
| **Activity** | **Activity** *(nepřekládá se)* | `<Activity mode>` (19.2): hides a subtree while keeping its state and DOM, unmounting its effects. | react.dev — Activity | 05 |
| **Suspense boundary** | **Hranice Suspense** | Component that shows a fallback while descendants suspend and reveals them together. | react.dev — Suspense | 06 |
| **Streaming SSR** | **Streamované vykreslování na serveru** | Sending HTML progressively: shell first, Suspense segments later. | react.dev — renderToPipeableStream | 06 |
| **Hydration** ↑ | **Hydratace** | The process where a client runtime attaches reactive state, event listeners, and data structures to server-rendered markup without destroying or recreating the existing DOM tree. | Web Architecture Specifications | 06 |
| **Hydration mismatch** | **Neshoda při hydrataci** | Client render output differing from server HTML; React client-renders the nearest boundary. | react.dev — hydrateRoot | 06 |
| **Partial pre-rendering (PPR)** | **Částečné předvykreslení** | Pre-rendering a static shell and resuming dynamic holes per request (`prerender` → `postponed` → `resume`, 19.2). | React 19.2 blog | 06 |
| **Server Component** | **Serverová komponenta** | Component that runs only in the server module graph, may be async, and ships no JavaScript. | react.dev — Server Components | 07 |
| **Client Component** | **Klientská komponenta** | Component in a `"use client"` module graph; server-rendered to HTML and hydrated. | react.dev — 'use client' | 07 |
| **Server Function** | **Serverová funkce** | `"use server"` function callable from the client through an HTTP endpoint with serialised arguments. | react.dev — Server Functions | 07, 08 |
| **Flight** | **Flight** *(nepřekládá se)* | React's streaming serialisation format for Server Component trees (rows of references and values). | `react-server` source | 07 |
| **Client reference** | **Klientská reference** | Opaque stand-in for an export of a client module inside the server graph. | `react-server-dom-*` | 07 |
| **Deserialisation vulnerability** | **Zranitelnost deserializace** | Flaw where decoding untrusted structured input leads to code execution or resource exhaustion (CVE-2025-55182). | React security advisory 2025-12-03 | 07 |
| **Action** | **Akce (Action)** | Function run inside a transition whose pending state, ordering and optimistic updates React tracks (19). | react.dev — useActionState | 08 |
| **Optimistic update** | **Optimistická aktualizace** | Showing the expected result before the server confirms; discarded when the Action settles. | react.dev — useOptimistic | 08 |
| **Progressive enhancement** | **Progresivní vylepšení** | A page works without JavaScript and gains behaviour once scripts load. | W3C/web architecture practice | 08 |
| **Memoisation** | **Memoizace** | Caching a computation's result keyed by its inputs. | Michie (1968) | 09 |
| **React Compiler** | **React Compiler** *(nepřekládá se)* | Build-time Babel plugin (1.0, 2025-10-07) that memoises components and hooks automatically. | react.dev — React Compiler | 09 |
| **Reactive scope** | **Reaktivní rozsah (scope)** | Group of values computed together and recomputed when its inferred dependencies change. | React Compiler source | 09 |
| **Error boundary** | **Hranice chyb (error boundary)** | Class component that renders a fallback when a descendant throws during render, effects or lifecycles. | react.dev — Component (catching errors) | 10 |
| **View transition** | **View transition** *(nepřekládá se)* | Browser API animating between DOM snapshots; integrated by `<ViewTransition>` (19.3). | CSS View Transitions Module; React 19.3 blog | 11 |
| **Portal** | **Portál** | Rendering children into another DOM node while keeping their React tree position. | react.dev — createPortal | 11 |
| **Trusted Types** | **Trusted Types** *(nepřekládá se)* | Browser API requiring typed values for DOM-XSS sinks under CSP. | W3C Trusted Types spec | 11 |
| **Virtualisation (windowing)** | **Virtualizace seznamu** | Rendering only list items that intersect the viewport. | Industry practice (react-window, TanStack Virtual) | 12 |
| **Code splitting** | **Dělení kódu** | Loading parts of the bundle on demand (`lazy` + dynamic `import()`). | react.dev — lazy | 12 |
