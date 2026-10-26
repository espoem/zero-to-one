# SolidJS 2.0 Glossary

This glossary defines standard technical terms used throughout the `technologies/solidjs/` learning track. All definitions, headings, and explanations are written in English; each term provides its canonical English name, established Czech equivalent, concise definition, and primary authoritative reference. Terminology adheres to the official SolidJS 2.0 specification (`v2.solidjs.com`), `@solidjs/signals`, `@solidjs/web`, TC39 JavaScript standards, and computer science literature.

---

## 1. Reactivity & Push-Pull Signals

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Fine-Grained Reactivity** | **Jemnozrnná reaktivita** | A computational paradigm where reactive state nodes connect directly to dependent DOM bindings, computations, and side effects without intermediate Virtual DOM diffing or whole-component function re-renders. | SolidJS Architecture, Carniato |
| **Push-Pull Reactivity** | **Reaktivita typu push-pull** | A hybrid notification and execution model where changed signals push invalidation marks down the dependency graph, while dependent computations pull (evaluate) values lazily upon access, eliminating redundant calculations. | `@solidjs/signals`, TC39 Signals Proposal |
| **Signal (`createSignal`)** | **Signál** | The foundational atomic reactive primitive holding a committed value, exposing a parameterless read accessor and a setter function, and tracking active observers on access. | `@solidjs/signals` |
| **Accessor** | **Přístupová funkce (accessor)** | A zero-argument getter function (`() => T`) that establishes a dynamic reactive dependency when invoked inside a tracking computation scope. | SolidJS Handbook |
| **Setter** | **Nastavovací funkce (setter)** | A function (`(value: T \| ((prev: T) => T)) => T`) used to update a signal's value, enqueuing the modification into the microtask batch. | SolidJS Handbook |
| **Writable Derived Signal** | **Zapisovatelný odvozený signál** | A signal created with a derivation function (`createSignal(() => source())`) that automatically follows upstream dependencies while permitting local manual overrides via its setter. | SolidJS 2.0 Reactivity Reference |
| **Deterministic Microtask Batching** | **Deterministické dávkování v mikrotasku** | The execution mechanism where signal mutations are queued and deferred to the JavaScript microtask queue, ensuring consistent graph snapshots and eliminating intermediate observer thrashing. | SolidJS 2.0 Specifications |
| **Synchronous Flush (`flush`)** | **Synchronní vyprázdnění fronty zápisů (flush)** | An imperative escape hatch that immediately drains all queued microtask writes, executes render and user effect lanes, and runs pending settled callbacks. | SolidJS 2.0 Core API |
| **Split Effect (`createEffect(compute, apply)`)** | **Rozdělený (dvoufázový) efekt** | A two-phase side-effect primitive that cleanly isolates synchronous dependency tracking (`compute`) from untracked execution and cleanup management (`apply`). | SolidJS 2.0 Architecture |
| **Render Effect (`createRenderEffect`)** | **Vykreslovací efekt (render effect)** | A split effect variant executing within the pre-paint render lane ahead of user effects, specifically designed for DOM layout measurements and renderer bindings. | SolidJS 2.0 Architecture |
| **Reaction (`createReaction`)** | **Reakce (reaction)** | A low-level primitive providing a tracked execution callback that triggers an untracked notification exactly once when tracked dependencies change. | SolidJS Reactivity API |
| **Untrack (`untrack`)** | **Nesledované čtení (untrack)** | An execution wrapper that reads signals and memos without establishing subscriptions in the currently active reactive observer. | SolidJS Reactivity API |
| **Reactive Ownership (`Owner`, `createRoot`)** | **Reaktivní vlastnictví** | The hierarchical lifecycle tree that binds cleanups, context maps, and sub-computations to their parent scopes, ensuring deterministic resource disposal. | SolidJS Runtime Engine |
| **Settled Lifecycle (`onSettled`)** | **Životní cyklus po ustálení (`onSettled`)** | An async-aware lifecycle hook replacing `onMount`, executing after DOM mounting and asynchronous dependencies have settled, and natively supporting returned cleanup functions. | SolidJS 2.0 Specifications |

---

## 2. Compiler, JSX & DOM Primitives

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Native JSX Transform** | **Nativní JSX transformace** | The high-performance compilation pipeline (built on Rust/Oxc in `@solidjs/vite-plugin`) compiling JSX into direct DOM element creation and fine-grained property binding expressions. | `@solidjs/vite-plugin` |
| **Fine-Grained DOM Updates** | **Jemnozrnné aktualizace DOMu** | The browser update mechanism where signal mutations target exact DOM text nodes and element properties without diffing a synthetic Virtual DOM tree. | SolidJS Core Architecture |
| **Providerless Context** | **Kontext bez poskytovatele (providerless context)** | A context design where the context object directly serves as the provider component (`<ThemeContext value={...}>`) without requiring a separate `.Provider` property. | SolidJS 2.0 Component Model |
| **Context Not Found Error (`ContextNotFoundError`)** | **Chyba nenalezeného kontextu** | A runtime error thrown when `useContext` is invoked on a default-less context outside the scope of its corresponding provider component. | SolidJS 2.0 Context API |
| **Keyed List (`<For keyed={true}>`)** | **Klíčovaný seznam** | The default collection rendering mode mapping each item by object identity, providing the raw item value and a reactive index accessor to child templates. | SolidJS 2.0 Control Flow |
| **Non-Keyed Positional List (`<For keyed={false}>`)** | **Neklíčovaný poziční seznam** | The positional list mode (replacing `<Index>`) maintaining fixed DOM slots for array indices, providing a reactive item accessor and a plain index number. | SolidJS 2.0 Control Flow |
| **Positional Repeat (`<Repeat>`)** | **Poziční opakovač** | A dedicated control flow primitive rendering a fixed numeric count of positional slots without array diffing or allocation overhead. | SolidJS 2.0 Control Flow |
| **Ref Directive Factory** | **Továrna na direktivy přes ref** | A reusable DOM attachment pattern replacing legacy `use:*` compiler transforms, structured as composable functions returning element callbacks with optional cleanups. | SolidJS 2.0 DOM Bindings |
| **Unified Class Binding** | **Sjednocená vazba tříd (class binding)** | The consolidated `class` attribute accepting strings, class name arrays, boolean record objects, and nested structures without requiring `classList`. | `@solidjs/web` |
| **Props Merge (`merge`)** | **Sloučení vlastností (props merge)** | A reactive property merger combining multiple source objects where later properties—including explicit `undefined`—override earlier defaults. | SolidJS Props Utilities |
| **Props Omission (`omit`)** | **Vyloučení vlastností (props omit)** | A reactive rest helper returning a new proxy object omitting specified property keys while retaining live reactivity for remaining fields. | SolidJS Props Utilities |

---

## 3. Stores, Mutations & Projections

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Draft-First Store (`createStore`)** | **Úložiště s přímou mutací návrhu (draft-first store)** | A proxy-backed reactive store whose update setter provides a direct mutable draft argument by default, eliminating manual `produce` wrappers. | SolidJS 2.0 Stores Reference |
| **Store Proxy** | **Proxy úložiště (store proxy)** | The recursive JavaScript `Proxy` tree intercepting property reads to record fine-grained path subscriptions and intercepting writes to notify exact sub-paths. | SolidJS Store Architecture |
| **Path Setter (`storePath`)** | **Cestový nastavovač** | A declarative helper function enabling path-based updates and predicate-based element targeting across nested stores. | SolidJS Store Advanced |
| **Structural Reconciliation (`reconcile`)** | **Strukturální rekonciliace (reconciliation)** | An intelligent diffing algorithm merging incoming external or server data into an existing store, mutating only changed fields to preserve object identity. | SolidJS Store Utilities |
| **Store Projection (`createProjection`)** | **Projekce úložiště** | A derived, read-only reactive store computed by a draft mutation function that updates downstream subscribers with O(1) leaf precision. | SolidJS 2.0 Stores Architecture |
| **Store Snapshot (`snapshot`)** | **Snímek úložiště (store snapshot)** | An untracked operation generating a plain, unproxied JavaScript clone of a store tree for external serialization or network transmission. | SolidJS Store Utilities |
| **Deep Store Traversal (`deep`)** | **Hluboký průchod úložištěm** | A traversal helper that recursively touches all nested properties within a store to register comprehensive tracking in an effect or memo compute phase. | SolidJS Store Utilities |
| **Shallow Store** | **Mělké úložiště (shallow store)** | A store configured with `{ shallow: true }` that limits proxy wrapping and reactive notification strictly to its root-level properties. | SolidJS Store Options |

---

## 4. Colorless Async & Boundaries

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Colorless Async Reactivity** | **Bezpříznaková asynchronní reaktivita (colorless async)** | A unified reactive model where asynchronous operations (promises and async iterables) flow through standard synchronous-like primitives (`createMemo`) without specialized wrappers. | SolidJS 2.0 Async Architecture |
| **Async Computation** | **Asynchronní výpočet** | A derived memo returning a `Promise<T>` or `AsyncIterable<T>`, pausing downstream consumers out-of-band until its first value settles. | SolidJS 2.0 Async Reference |
| **Not Ready Error (`NotReadyError`)** | **Chyba nepřipraveného stavu** | A specialized internal control-flow signal thrown when an unready asynchronous computation is read, directing execution to the nearest `<Loading>` boundary. | SolidJS Async Internals |
| **Initial Readiness (`<Loading>`)** | **Počáteční připravenost** | The boundary component displaying a fallback exclusively during initial asynchronous preparation, holding established UI during subsequent background refreshes. | SolidJS 2.0 Boundaries |
| **Stale-While-Revalidate** | **Zobrazení původních dat během obnovy** | An asynchronous UI pattern where previously resolved content remains visible on screen while a background revalidation or query refresh is in flight. | SolidJS Async Patterns |
| **In-Flight Pending State (`isPending`)** | **Stav probíhajícího požadavku** | A non-suspending reactive inspector checking whether an asynchronous memo, store, or signal has an unresolved background transition in flight. | SolidJS Core Reactivity |
| **Latest In-Flight Value (`latest`)** | **Nejnovější zpracovávaná hodnota** | A non-suspending accessor reading the most recently initiated or resolved value of an async source, bypassing `<Loading>` suspension. | SolidJS Core Reactivity |
| **Reveal Coordination (`<Reveal>`)** | **Koordinace odhalení (reveal)** | A boundary coordinator (replacing `<SuspenseList>`) managing the display order (`together`, `sequential`, `natural`) of nested `<Loading>` regions. | SolidJS 2.0 Boundaries |
| **Self-Healing Error Boundary (`<Errored>`)** | **Samoopravná chybová hranice** | An error boundary catching render and async errors that automatically heals and restores its content when upstream dependencies transition back to valid states. | SolidJS 2.0 Boundaries |

---

## 5. Transactional Actions & Optimistic State

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Transactional Action (`action`)** | **Transakční akce** | A managed mutation wrapper converting generator functions into discrete transactional workflows with automated rollback and dependency revalidation. | SolidJS 2.0 Mutations Reference |
| **Generator Action (`action(function* () {})`)** | **Generátorová akce** | A mutation procedure using `yield` statements as transaction checkpoints to execute optimistic writes, await network responses, and trigger graph refreshes. | SolidJS 2.0 Mutations |
| **Optimistic Store (`createOptimisticStore`)** | **Optimistické úložiště** | A specialized store maintaining an optimistic draft overlay that renders immediate local modifications and automatically rolls back if the server rejects. | SolidJS 2.0 Mutations Reference |
| **Optimistic Signal (`createOptimistic`)** | **Optimistický signál** | A single-value reactive signal supporting transient optimistic overrides that revert upon transaction completion or error. | SolidJS 2.0 Mutations |
| **Optimistic Reversion** | **Vrácení optimistického stavu (reversion / rollback)** | The automatic restoration of authoritative confirmed state when a mutation fails, aborts, or is superseded by a newer authoritative server update. | SolidJS Mutation Architecture |
| **Target Invalidation Tracking (`affects`)** | **Sledování ovlivněných cílů (affects tracking)** | An action-scoped registration marking external signals or projections as pending during the lifetime of a transactional operation. | SolidJS Mutations Reference |
| **Explicit Revalidation (`refresh`)** | **Explicitní znovunačtení (revalidation)** | A function instructing an asynchronous memo or projection store to re-evaluate its source and settle with authoritative server state. | SolidJS Core API |
| **Reactive Condition Acknowledgment (`until`)** | **Čekání na splnění reaktivní podmínky (until)** | A promise-based synchronization utility pausing an action until a reactive predicate evaluates to true, with built-in timeout and abort signal support. | SolidJS Async Synchronization |

---

## 6. Full-Stack Start Mode & Server Functions

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Server Function (`"use server"` / `registerServerFunction`)** | **Serverová funkce** | An RPC endpoint defined in application code compiled into a secure network dispatch handler callable from the client via HTTP POST or GET. | `@solidjs/web/server-functions` |
| **Request Event Context (`RequestEvent`, `getRequestEvent`)** | **Kontext požadavku události** | The per-request execution environment providing access to the native Fetch `Request`, response headers, and request-scoped metadata during SSR. | `@solidjs/web` Server Context |
| **Response Envelope (`respond`, `ResponseEnvelope`)** | **Obálka odpovědi** | A structured server return structure encapsulating HTTP status codes, custom headers, and cache revalidation tags alongside payload data. | `@solidjs/web` |
| **Safe Error (`markSafeError`, `isSafeError`)** | **Bezpečná chyba** | An intentional error explicitly marked as safe to expose over the network to the client, preventing unintended leakage of server internals. | `@solidjs/web` |
| **Standard Schema Validation** | **Validace dle standardního schématu (Standard Schema)** | The practice of validating untrusted server function arguments at the network boundary using Standard Schema-compliant libraries (e.g., Zod, Valibot). | SolidJS Security Guidance |
| **Progressive Enhancement** | **Postupné vylepšování (progressive enhancement)** | The ability of server functions and forms to function natively via HTTP form submissions when client-side JavaScript is absent or loading. | `@solidjs/web` Architecture |
| **Streaming HTML SSR (`renderToStream`)** | **Proudové SSR renderování do HTML** | Server-side rendering that streams early HTML shells immediately and out-of-order flushes deferred `<Loading>` chunks as async data resolves. | `@solidjs/web` SSR Engine |
