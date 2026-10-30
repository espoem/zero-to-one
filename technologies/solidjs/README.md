# SolidJS 2.0

A zero-to-one track on **Solid 2.0** (release candidate): fine-grained reactivity, the 2.0 async and transaction model, full-stack rendering with `@solidjs/vite-plugin` start mode, and migration from Solid 1.x. It is also the repository's single home of the **React vs Solid** comparison.

> **Release-candidate track.** Solid 2.0 has no GA date; the official docs (<https://v2.solidjs.com>) say "APIs may change before the stable release". Everything here is pinned to `2.0.0-rc.19` and re-verified on each bump.

**Verified against** `solid-js` / `@solidjs/signals` / `@solidjs/web` / `@solidjs/compiler` **2.0.0-rc.19**, `@solidjs/vite-plugin` **3.0.0-next.52**, `@solidjs/testing-library` **1.0.0-rc.2**, `solid-js` **1.9.17** (comparison only), Vite **8.3.5**, Vitest **5.0.5**, jsdom **30.1.3**, TypeScript **7.0.2**, Node **26.12.1** on **2026-10-28**.

## Prerequisites

- JavaScript: closures, promises and the microtask queue, generators, Proxy, ESM `exports` (owned by `languages/javascript`).
- TypeScript basics; typing Solid components is covered in [TypeScript module 13](../../languages/typescript/modules/13-solidjs-2-with-typescript.md) (moving to TS M12).
- Helpful: one component framework (the [React track](../react/README.md) links back to Module 10 here).

## Syllabus

| # | Module | Covers | Proof |
|---|---|---|---|
| 01 | [Reactive core](./modules/01-reactive-core.md) | graph model, push-pull, glitch freedom, microtask commits, `flush`, lazy and writable memos, ownership, the owned-write invariant | [`01-reactive-core.test.ts`](./examples/typescript/01-reactive-core.test.ts) |
| 02 | [Effects, lifecycle & invariants](./modules/02-effects-and-lifecycle.md) | split effects, render vs user effects, error arm, `createReaction`, deprecated `createTrackedEffect`, `onSettled`/`onCleanup`/`onFlush`, diagnostics codes | [`02-…test.tsx`](./examples/typescript/02-effects-and-lifecycle.test.tsx) |
| 03 | [Components, props & DOM](./modules/03-components-props-and-dom.md) | compiler output, props as getters, `merge`/`omit`, attributes/class/style, root-owned events, refs and directive factories, form inputs | [`03-…test.tsx`](./examples/typescript/03-components-props-and-dom.test.tsx) |
| 04 | [Control flow & composition](./modules/04-control-flow-and-composition.md) | `<For>` keying modes, `<Repeat>`, `<Show>`/`<Switch>`, `dynamic()`, `children`, `Portal`, context | [`04-…test.tsx`](./examples/typescript/04-control-flow-and-composition.test.tsx) |
| 05 | [Stores & projections](./modules/05-stores-and-projections.md) | draft setters, `reconcile`, projections and O(1) selection, `snapshot`/`deep`, shallow stores | [`05-…test.ts`](./examples/typescript/05-stores-and-projections.test.ts) |
| 06 | [Colorless async](./modules/06-colorless-async.md) | async computations, `<Loading>`/`on`/holds, `<Reveal>`, `isPending`/`latest`/`createDeferred`, cancellation, `<Errored>` | [`06-…test.tsx`](./examples/typescript/06-colorless-async.test.tsx) |
| 07 | [Actions & optimistic state](./modules/07-actions-and-optimistic-state.md) | transactions, generator actions, optimistic primitives, `refresh`/`affects`/`until`, races | [`07-…test.tsx`](./examples/typescript/07-actions-and-optimistic-state.test.tsx) |
| 08 | [SSR, start mode & server functions](./modules/08-ssr-and-start-mode.md) | start mode, `renderToStream`, hydration policy, `httpStatus`, request isolation, server-function wire and security | [`08-…server.test.tsx`](./examples/typescript/08-ssr-and-server-functions.server.test.tsx) |
| 09 | [Testing, debugging & performance](./modules/09-testing-debugging-performance.md) | Vitest postures, test patterns, build variants, attribution, performance tracks | [`09-…test.tsx`](./examples/typescript/09-testing-debugging-performance.test.tsx) |
| 10 | [Migration & React comparison](./modules/10-migration-and-react-comparison.md) | 1.x → 2.0 map and procedure, version history, ecosystem status, React 19 vs Solid 2 | [`10-solid1-vs-solid2.test.ts`](./examples/typescript/10-solid1-vs-solid2.test.ts) |

Reference: [GLOSSARY.md](./GLOSSARY.md) (EN ↔ CZ) · [CHEATSHEET.md](./CHEATSHEET.md) · [exams/](./exams/README.md).

## Run it

```bash
cd technologies/solidjs
mise install            # node 26 (see .mise.toml)
npm ci
npm test                # all suites: client (jsdom, dev build) + server (node, SSR build)
npm run test:client     # or: npm run test:server
npm test -- 06          # one module
npm run typecheck       # tsc (TypeScript 7)
npm run versions        # installed versions, for the "Verified against" line
```

Every test runs against the **real published packages**: there is no shim layer. `vitest.config.ts` uses `@solidjs/vite-plugin`'s two test postures; the server project runs `*.server.test.tsx`. All async tests settle hand-made deferreds, so the suite has no timing dependence. `solid-js-1` is an npm alias of `solid-js@1.9.17`, used only by the Module 10 comparison.

## Certifications & Exams

**No official SolidJS certification exists** (checked 2026-10-28). Following the repository rules, the track prepares for the recognised substitute, the **senior frontend interview loop** for a Solid role (knowledge screen, live coding, frontend system design, migration discussion):

| Exam / format | Vendor | Guide | Targets | Status | Format |
|---|---|---|---|---|---|
| Senior frontend interview (Solid) | none (industry format) | [exams/README.md](./exams/README.md) | Solid 2.0 RC (answers name 1.x equivalents) | n/a | 60-question bank (single, multi, scenario, hands-on with test verification), 25-question / 45-minute mock screen + 20-minute hands-on, scoring key |

## Sources

- Solid 2.0 RFCs and migration guide: <https://github.com/solidjs/solid/tree/next/documentation/solid-2.0>
- Package cheatsheet and skills shipped in `solid-js@2.0.0-rc.19` (`CHEATSHEET.md`, `skills/solid-2.0`, `skills/reactivity-diagnostics`, `diagnostics.json`)
- Solid 2.0 docs (RC): <https://v2.solidjs.com>; Solid 1.x docs: <https://docs.solidjs.com>
- `@solidjs/vite-plugin` README (start mode, SSR, testing, diagnostics)
- TC39 Signals proposal (Stage 1): <https://github.com/tc39/proposal-signals>
