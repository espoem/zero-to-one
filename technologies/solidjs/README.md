# SolidJS 2.0 Curriculum & Complete Reference

Welcome to the **SolidJS 2.0 Complete Learning Track** (`solid-js@2.0.0-rc.8`, `@solidjs/signals`, `@solidjs/web`). This repository module provides an end-to-end, zero-to-one curriculum covering modern fine-grained reactivity, native JSX compilation, draft-first reactive stores, colorless asynchronous data flow, transactional mutations, full-stack server functions, and comprehensive migration guidance from Solid 1.x.

Every concept in this curriculum is backed by a numerically ordered lesson in [modules/](./modules/) and a corresponding, self-contained runnable TypeScript test suite in [examples/](./examples/).

---

## 1. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into seven self-contained modules designed for progressive mastery:

### [Module 01 — Reactive Core and Signals](./modules/01-reactive-core-and-signals.md)
- **Concepts**: Fine-grained push-pull computational graph (`@solidjs/signals`), `createSignal`, lazy `createMemo`, writable derived `createSignal(fn)`, deterministic microtask batching, synchronous `flush()`, split two-phase `createEffect(compute, apply)`, `createRenderEffect`, ownership trees, and the `onSettled` lifecycle hook.
- **Runnable Example**: [`examples/01-reactive-core-and-signals.ts`](./examples/01-reactive-core-and-signals.ts) (`npm run test:01`)

### [Module 02 — DOM Templating and Control Flow](./modules/02-dom-templating-and-control-flow.md)
- **Concepts**: Native Oxc/Rust JSX compilation pipeline, getter-based component props, unified `<For>` (default `keyed={true}`, positional `keyed={false}`, and custom key extractors), positional `<Repeat>`, conditional `<Show>` and `<Switch>/<Match>`, Ref Directive Factories (`applyRef`), consolidated `class` and `style` bindings, providerless `<Context value={...}>`, `ContextNotFoundError`, and props utilities (`merge`, `omit`).
- **Runnable Example**: [`examples/02-dom-templating-and-control-flow.ts`](./examples/02-dom-templating-and-control-flow.ts) (`npm run test:02`)

### [Module 03 — Draft-First Stores and Projections](./modules/03-draft-first-stores-and-projections.md)
- **Concepts**: Proxy-based reactive data structures, draft-first setters (eliminating legacy `produce` wrappers), path-based mutation helpers (`storePath`), structural reconciliation (`reconcile`), fine-grained store projections (`createProjection`), untracked serialization (`snapshot`), deep dependency tracking (`deep`), and shallow stores.
- **Runnable Example**: [`examples/03-draft-first-stores-and-projections.ts`](./examples/03-draft-first-stores-and-projections.ts) (`npm run test:03`)

### [Module 04 — Colorless Async and Graph Consistency](./modules/04-colorless-async-and-graph-consistency.md)
- **Concepts**: Colorless asynchronous reactivity, async `createMemo` accepting Promises and `AsyncIterable` streams, `NotReadyError` control flow, initial readiness with `<Loading>`, non-suspending inspections via `isPending()` and `latest()`, sibling boundary coordination with `<Reveal>`, and self-healing error recovery with `<Errored>`.
- **Runnable Example**: [`examples/04-colorless-async-and-graph-consistency.ts`](./examples/04-colorless-async-and-graph-consistency.ts) (`npm run test:04`)

### [Module 05 — Transactional Writes and Optimistic State](./modules/05-transactional-writes-and-optimistic-state.md)
- **Concepts**: Transactional mutations using generator functions (`action(function* () {})`), checkpoint suspension across `yield` boundaries, `createOptimistic` signals and `createOptimisticStore`, automatic rollback upon network failure, target invalidation with `affects()`, authoritative revalidation with `refresh()`, and event-driven synchronization with `until()`.
- **Runnable Example**: [`examples/05-transactional-writes-and-optimistic-state.ts`](./examples/05-transactional-writes-and-optimistic-state.ts) (`npm run test:05`)

### [Module 06 — Full-Stack Start Mode and Server Functions](./modules/06-full-stack-start-mode-and-server-functions.md)
- **Concepts**: `@solidjs/vite-plugin` full-stack Start mode, `"use server"` RPC compilation, `@solidjs/web/server-functions` endpoint dispatch (`handleServerFunctionRequest`), request-scoped contexts (`RequestEvent`, `getRequestEvent`), response envelopes (`respond`, `redirect`), security boundaries with `markSafeError`/`isSafeError`, Standard Schema argument validation, and out-of-order streaming SSR (`renderToStream`).
- **Runnable Example**: [`examples/06-full-stack-start-mode-and-server-functions.ts`](./examples/06-full-stack-start-mode-and-server-functions.ts) (`npm run test:06`)

### [Module 07 — Migration from Solid 1.x to 2.0 & Architectural Deep Dives](./modules/07-migration-and-architectural-deep-dives.md)
- **Concepts**: Side-by-side Solid 1.x vs Solid 2.0 code comparison across all major APIs, React 19 vs Solid 2.0 mental model comparison, Deep Dive 1 (O(1) selection projections replacing `createSelector` over normalized state), and Deep Dive 2 (concurrent overlapping generator actions, out-of-order responses, and real-time WebSocket `until()` synchronization).
- **Runnable Example**: [`examples/07-solid1-vs-solid2-and-deep-dives.ts`](./examples/07-solid1-vs-solid2-and-deep-dives.ts) (`npm run test:07`)

---

## 2. Fast Reference Documents

- **[GLOSSARY.md](./GLOSSARY.md)**: Bilingual English ↔ Czech terminology reference strictly obeying repository conventions across all core domains (Signals, Compiler, Stores, Boundaries, Actions, Server Functions).
- **[CHEATSHEET.md](./CHEATSHEET.md)**: Fast-lookup desk reference providing exact TypeScript signatures, `<For>` keying matrix, compiler diagnostics repair instructions (`STRICT_READ_UNTRACKED`, `REACTIVE_WRITE_IN_OWNED_SCOPE`, etc.), and anti-pattern fixes.

---

## 3. Verification & Execution Instructions

This learning track installs the official published Release Candidate packages (`solid-js@2.0.0-rc.18`, `@solidjs/signals@2.0.0-rc.18`, and `@solidjs/web@2.0.0-rc.18`) directly in `package.json`. All example test suites run natively on Node (Node 22+) using the `browser` export condition (`node --conditions=browser ...`) to execute the reactive client graph. The companion [`examples/utils/solid2-runtime.ts`](./examples/utils/solid2-runtime.ts) serves as a direct facade over the official libraries, providing headless adapters (such as JSX-free control flow runners and in-process mock HTTP dispatch for server functions) for CLI execution without requiring a full browser or Vite dev server.

### Run All Test Suites
```bash
cd technologies/solidjs
npm test
```

### Run Individual Module Suites
```bash
npm run test:01 # Reactive Core & Signals
npm run test:02 # DOM Templating & Control Flow
npm run test:03 # Draft-First Stores & Projections
npm run test:04 # Colorless Async & Boundaries
npm run test:05 # Transactional Writes & Optimistic State
npm run test:06 # Full-Stack Start Mode & Server Functions
npm run test:07 # Migration & Architectural Deep Dives
```

### Typecheck Without Emitting Code
```bash
npm run typecheck
```

---

## 4. Primary Learning References & Authoritative Sources

The curriculum synthesized in this track is based on authoritative primary documentation, architectural design RFCs, and engineering walkthroughs from the SolidJS core team:

1. **Official SolidJS 2.0 Documentation Site**: [https://v2.solidjs.com](https://v2.solidjs.com) — Authoritative concepts, API reference, tutorials, and migration specifications.
2. **Ryan Carniato: "Solid 2.0 RC: The Big Reveal"**: [SolidJS Official Blog](https://www.solidjs.com/blog/solid-2-0-rc-the-big-reveal) — Core architectural announcement detailing `@solidjs/signals`, the Oxc/Rust compiler pipeline, and the new push-pull reactive core.
3. **Ryan Carniato: 3-Part "Async Solid" Series**:
   - *Part 1: "Fetch High, Block Low"*: [https://www.solidjs.com/blog/async-solid-fetch-high-block-low](https://www.solidjs.com/blog/async-solid-fetch-high-block-low) — Architectural deep dive into data fetching boundaries and `<Loading>` vs `<Suspense>`.
   - *Part 2: "Write Sync, Run Async"*: [https://www.solidjs.com/blog/async-solid-write-sync-run-async](https://www.solidjs.com/blog/async-solid-write-sync-run-async) — The design of microtask batching, synchronous transactions, and asynchronous graph resumption.
   - *Part 3: "One Graph, Two Machines"*: [https://www.solidjs.com/blog/async-solid-one-graph-two-machines](https://www.solidjs.com/blog/async-solid-one-graph-two-machines) — Full-stack reactive unification across client and server runtimes.
4. **GitHub Discussion #2425: "The Road to 2.0"**: [github.com/solidjs/solid/discussions/2425](https://github.com/solidjs/solid/discussions/2425) — Design RFC outlining major breaking changes, store refactors, and JSX improvements.
5. **Dennis Morello: "SolidJS 2.0 for React Developers: A First Look"**: [morello.dev/blog/solidjs-2-react-developers-first-look](https://morello.dev/blog/solidjs-2-react-developers-first-look) — Comparative exploration of execution models, dependency arrays vs push-pull signals, and actions.
6. **SolidJS V2 Agent Skill & API Reference (`khmm12/solidjs-v2-skills`)**: [github.com/khmm12/solidjs-v2-skills](https://github.com/khmm12/solidjs-v2-skills) / [skillsdirectory.com/skills/khmm12-solidjs-v2](https://www.skillsdirectory.com/skills/khmm12-solidjs-v2) — Type-verified API signatures and migration rules targeting `solid-js@2.0.0-rc.8`.
7. **Ryan Carniato: SolidJS 2.0 RC Walkthrough & Deep Dive**: [YouTube Video Stream](https://www.youtube.com/watch?v=sYvrPLcGznA) — Line-by-line runtime implementation review and live architectural Q&A.
