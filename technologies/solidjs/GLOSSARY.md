# SolidJS 2.0 Glossary (EN ↔ CZ)

Technology-specific terms for the `technologies/solidjs` track. General computer-science terms (pure function, side effect, hydration, idempotence, …) live in the [root glossary](../../GLOSSARY.md); where a term appears in both, the root definition is reused verbatim. Czech equivalents are the established technical Czech terms; where Czech practice keeps the English API name, the table says so (*anglický termín*) rather than inventing a translation.

References: *RFC NN* = `documentation/solid-2.0/NN-*.md` in the `solidjs/solid` repository (`next` branch); *CS* = `node_modules/solid-js/CHEATSHEET.md` (rc.19); *M NN* = this track's module.

## 1. Reactive core

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Fine-grained reactivity** | jemnozrnná reaktivita | Updates propagate from a changed value to exactly the computations and DOM bindings that read it; components are not re-executed and no virtual DOM is diffed. | M 01 |
| **Signal** | signál | A reactive source holding one value, read through an accessor and written through a setter; reads inside tracking scopes subscribe. | RFC 02, M 01 |
| **Accessor** | přístupová funkce (*accessor*) | The zero-argument getter `() => T` returned by `createSignal`/`createMemo`. | CS, M 01 |
| **Setter** | nastavovací funkce (*setter*) | The function that stages a new value or an updater `(prev) => next`; the value becomes visible at the next commit. | CS, M 01 |
| **Memo** | memo (memoizovaná hodnota) | A cached derived value recomputed when its dependencies change; stops propagation when its result is `equals` to the previous one. | RFC 01, M 01 |
| **Writable derived signal** (writable memo) | zapisovatelná odvozená hodnota | `createSignal(fn)`: derives like a memo, can be overwritten; a source change re-runs `fn` with the write as `prev`. | RFC 02, M 01 |
| **Tracking scope** | sledovací kontext | Code during whose execution reads are recorded as dependencies: memo bodies, effect compute halves, JSX expressions. | RFC 01, M 01 |
| **Owner** | vlastník (*owner*) | The node in the ownership tree under which primitives are created and by which they are disposed. | RFC 02, M 01 |
| **Owned scope** | vlastněný kontext | Component bodies, memos, effect compute halves and root bodies; writes there are forbidden in dev. | RFC 01, M 01 |
| **Root** | kořen (*root*) | An owner created by `render()` or `createRoot`; in 2.0 owned by its parent unless created under `runWithOwner(null, …)`. | RFC 02, M 01 |
| **Push-pull evaluation** | vyhodnocování push-pull | Writes push dirty/check marks down the graph; nodes are recomputed (pulled) in topological order at the commit. | M 01 |
| **Glitch freedom** | absence glitchů (konzistence) | Every run of a computation observes inputs from one committed state, never a mix of old and new values. | M 01 |
| **Commit (flush)** | potvrzení změn (*flush*) | The point at which staged writes become visible and dirty nodes are recomputed; scheduled on a microtask or forced with `flush()`. | RFC 01, M 01 |
| **Microtask batching** | dávkování v mikroúlohách | All writes made before the commit are applied together in one flush. | RFC 01, M 01 |
| **Equality cut-off** | přerušení šíření při rovnosti | A recomputed value equal to the previous one does not notify subscribers. | M 01 |
| **Lazy memo** | líné memo | `createMemo(fn, { lazy: true })`: computes on first read and autodisposes when unobserved. | RFC 01, M 01 |

## 2. Effects and lifecycle

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Split effect** | rozdělený efekt | `createEffect(compute, apply)`: a tracked pure compute half and an untracked apply half that performs side effects and may return a cleanup. | RFC 01, M 02 |
| **Compute half / apply half** | výpočetní fáze / aplikační fáze | The two halves of a split effect; all compute halves of a flush run before any apply half. | RFC 01, M 02 |
| **Render effect** | vykreslovací efekt | `createRenderEffect`: split effect applied during the render phase (synchronously at creation); used by compiled DOM bindings. | RFC 01, M 02 |
| **User effect** | uživatelský efekt | An effect created with `createEffect`, applied after render effects in the flush. | M 02 |
| **Cleanup** | úklidová funkce (*cleanup*) | A function run before the next apply and on disposal. | M 02 |
| **Settle** | ustálení | The state in which pending async work under an owner has resolved and the queue has flushed; `onSettled` runs then. | RFC 01, M 02 |
| **Diagnostic code** | diagnostický kód | A stable identifier (e.g. `STRICT_READ_UNTRACKED`) attached to each dev-mode error, warning or info finding. | RFC 08, M 02 |
| **Reactivity halt** | zastavení reaktivity | `REACTIVITY_HALTED`: an error escaped every boundary and the scheduler stopped processing updates. | RFC 08, M 02 |

## 3. Components and DOM

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Component** | komponenta | A function that runs once to create DOM and reactive bindings. | M 03 |
| **Props** | vlastnosti (*props*) | The component's input object; dynamic props are getters, so they must be read, not destructured. | CS, M 03 |
| **Template cloning** | klonování šablon | Compiled static HTML parsed once by `template()` and cloned per instance. | M 03 |
| **Binding** | vazba | A compiled reactive connection from an expression to a DOM text node, attribute or property. | M 03 |
| **Event delegation** | delegace událostí | One listener per event type on the render root dispatches to handlers stored on elements. | RFC 07, M 03 |
| **Ref** | reference (*ref*) | Access to a created element via a variable or callback; runs before the element is attached. | RFC 07, M 03 |
| **Directive factory** | továrna direktiv | A function returning a ref callback (`ref={tooltip(opts)}`), replacing 1.x `use:`. | RFC 07, M 03 |
| **Control-flow component** | komponenta řízení toku | `<Show>`, `<Switch>/<Match>`, `<For>`, `<Repeat>` and boundaries: memos that create and dispose owned subtrees. | RFC 03, M 04 |
| **Keyed list** | klíčovaný seznam | A list whose rows are preserved by item identity or an extracted key across updates. | RFC 03, M 04 |
| **Context** | kontext | A value provided down the owner tree; `<Ctx value>` is the provider. | RFC 02, M 04 |
| **Portal** | portál | Renders children into another DOM node while keeping them in the owner tree. | M 04 |

## 4. Stores

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Store** | úložiště stavu (*store*) | A proxy over a nested object/array with per-property subscriptions, written through a setter. | RFC 04, M 05 |
| **Draft** | koncept (pracovní kopie, *draft*) | The mutable view a store setter or projection derive receives; mutations commit as one transaction. | RFC 04, M 05 |
| **Reconciliation** | rekonciliace (sladění) | Diffing new data into an existing store tree, reusing records by key so identity survives. | RFC 04, M 05 |
| **Projection** | projekce | `createProjection(fn, seed)`: a read-only derived store driven by draft mutation or returned data. | RFC 04, M 05 |
| **Snapshot** | snímek (*snapshot*) | `snapshot(store)`: a plain, untracked copy of a store. | RFC 04, M 05 |
| **Shallow store** | mělký store | `createStore(v, { shallow: true })`: reactive root keys with plain records replaced by reference. | RFC 04, M 05 |

## 5. Async, transactions, optimistic state

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Colorless async** | asynchronie bez „barvení“ funkcí | Async values flow through ordinary computations and accessors, without `async` spreading through callers or `T \| undefined` loading holes. | RFC 05, M 06 |
| **Not ready** (`NotReadyError`) | nepřipravená hodnota | The state of an async value that has not produced its first answer; reads propagate it to boundaries. | RFC 05, M 06 |
| **Loading boundary** | hranice načítání | `<Loading>`: shows a fallback while its subtree has not yet produced content. | RFC 03/05, M 06 |
| **Error boundary** | chybová hranice | `<Errored>`: renders a fallback with the error and a `reset` action; heals automatically. | RFC 03, M 06 |
| **Hold** | pozdržení | Keeping a write uncommitted while async work it started is pending, so the screen shows a consistent old frame. | RFC 05, M 06 |
| **Transition** | přechod | A set of writes and their async work committed together; built into the scheduler. | RFC 05, M 06 |
| **Pending state** | stav probíhající změny | `isPending(fn)`: true while a change to a read's value is in flight. | RFC 05, M 06 |
| **Action** | akce | `action(function*)`: a transaction that interleaves writes, yielded async work and refreshes. | RFC 06, M 07 |
| **Optimistic update** | optimistická aktualizace | A guess shown during a transaction that reverts when it settles. | RFC 06, M 07 |
| **Overlay (lane)** | překryvná vrstva (*lane*) | The per-transaction layer holding optimistic values above committed state. | RFC 06, M 07 |
| **Acknowledgement** (`until`) | potvrzení | Waiting for a reactive predicate to settle truthy, e.g. a live-channel echo. | RFC 06, M 07 |

## 6. Full stack and tooling

| English term | Czech term | Definition | Reference |
|---|---|---|---|
| **Start mode** | režim start | The serving layer of `@solidjs/vite-plugin` (`start: true`) that replaces SolidStart for Solid 2. | Plugin README, M 08 |
| **Streaming SSR** | streamované vykreslování na serveru | Sending the shell first and each resolved boundary later in the same response. | RFC 12, M 08 |
| **Hydration** | hydratace | The process where a client runtime attaches reactive state, event listeners, and data structures to server-rendered markup without destroying or recreating the existing DOM tree. (root definition) | root glossary, M 08 |
| **Request event** | událost požadavku | The per-request object (`getRequestEvent()`) carrying the `Request`, `locals` and response head. | RFC 12, M 08 |
| **Request isolation** | izolace požadavků | Keeping per-request state out of module scope so concurrent requests cannot see each other's data. | M 08 |
| **Server function** | serverová funkce | A function marked `"use server"`, executed on the server and called from the client over HTTP. | RFC 10, M 08 |
| **Export condition** | exportní podmínka | A `package.json` `exports` key (`browser`, `node`, `development`, `observe`) that selects a build variant. | M 09 |
| **Observe build** | sledovací (observe) sestavení | Production-speed build that keeps the diagnostics and attribution channels. | Plugin README, M 09 |
| **Attribution** | atribuce (vysvětlení běhů) | The opt-in engine that explains why each computation re-ran and reports cost findings. | RFC 08, M 09 |
