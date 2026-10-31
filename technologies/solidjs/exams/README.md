# SolidJS — Certifications, Exams and Interview Preparation

## Certification status

**No official SolidJS certification exists** (checked 2026-10-28: the SolidJS project, docs.solidjs.com and v2.solidjs.com publish none, and the OpenJS Foundation / Linux Foundation catalogues list no Solid exam). Following AGENTS.md § Certification and Exam Coverage (priority 3), this track prepares for the recognised substitute: the **senior frontend interview loop** as applied to a Solid role.

| Format element | What it usually contains | How this track prepares |
|---|---|---|
| Knowledge screen (30–60 min) | framework internals, rendering model, async, state management, SSR, testing | [interview.md](./interview.md) question bank (60 questions) |
| Live coding (45–60 min) | build or fix a component; reason about reactivity bugs | hands-on tasks (`hands-on` type), each verified by a test in `examples/` |
| Frontend system design (45–60 min) | data flow, caching, SSR/streaming, optimistic UX, performance | scenario questions in D4–D7 |
| Migration / architecture discussion | Solid 1 → 2, React vs Solid trade-offs | D7 |

There is no published passing score or domain weighting for interview loops; the weights below are this track's own, chosen to match how often each area appears in Solid interview hot topics (brief §3). There is therefore no exam-version delta to report; the track and the bank both target **Solid 2.0 RC (`solid-js@2.0.0-rc.19`)**.

> **Version delta (interviews).** Many interviewers still think in Solid 1.x (`createResource`, `batch`, `onMount`, `<Suspense>`, path setters). Every 2.0 answer in the bank names the 1.x equivalent so you can answer in either vocabulary, and Module 10 maps all of them.

## Domain → module coverage matrix

| ID | Domain / objectives | Weight | Modules | Examples (proof) | Questions | Status |
|---|---|---|---|---|---|---|
| D1 | Reactive core & effects: push-pull graph, glitch freedom, microtask commits, `flush`, lazy/writable memos, ownership, owned-write invariant, split effects, lifecycle, diagnostics | 20 % | [01](../modules/01-reactive-core.md), [02](../modules/02-effects-and-lifecycle.md) | `01-reactive-core.test.ts`, `02-effects-and-lifecycle.test.tsx` | 12 | ✅ |
| D2 | Components, DOM & control flow: compiler output, props as getters, `merge`/`omit`, attributes/class/events/refs/directives, form inputs, `<For>`/`<Repeat>`/`<Show>`, `dynamic`, context | 15 % | [03](../modules/03-components-props-and-dom.md), [04](../modules/04-control-flow-and-composition.md) | `03-…test.tsx`, `04-…test.tsx` | 9 | ✅ |
| D3 | Stores & projections: draft setters, reconcile, projections and O(1) selection, snapshot/deep, shallow stores | 10 % | [05](../modules/05-stores-and-projections.md) | `05-stores-and-projections.test.ts` | 6 | ✅ |
| D4 | Async, transactions & optimistic state: async computations, `<Loading>`/`on`/`<Reveal>`, `isPending`/`latest`/`createDeferred`, cancellation, `<Errored>`, actions, optimistic primitives, `refresh`/`affects`/`until` | 20 % | [06](../modules/06-colorless-async.md), [07](../modules/07-actions-and-optimistic-state.md) | `06-…test.tsx`, `07-…test.tsx` | 12 | ✅ |
| D5 | Full stack: start mode, SSR entry points, hydration policy, `httpStatus`, request isolation, server functions wire contract and security | 15 % | [08](../modules/08-ssr-and-start-mode.md) | `08-ssr-and-server-functions.server.test.tsx`, `08-hydration-roundtrip.test.tsx` | 9 | ✅ |
| D6 | Testing, debugging & performance: Vitest postures, test patterns, build variants, attribution, performance tracks | 10 % | [09](../modules/09-testing-debugging-performance.md) | `09-…test.tsx`, `support/build-variant-probe.mjs` | 6 | ✅ |
| D7 | Migration & architecture: 1.x → 2.0, version history, ecosystem status, React vs Solid | 10 % | [10](../modules/10-migration-and-react-comparison.md) | `10-solid1-vs-solid2.test.ts` | 6 | ✅ |
| | **Total** | 100 % | | | **60** | |

### Out of scope (with reason)

| Topic (from docs.solidjs.com / v2.solidjs.com ToC) | Reason |
|---|---|
| Typing JSX, components, generic/polymorphic components | owned by the TypeScript track (M12) |
| `@solidjs/router` 2.0-next API details | API still moving on the `next` tag; listed as remaining work |
| Server components (`@solidjs/web/frames`) in depth | experimental; summarised in Module 08 only |
| `@solidjs/h`, `@solidjs/html`, `@solidjs/universal` (custom renderers) | niche; mentioned in Module 03/10 import maps |
| Styling libraries (Panda CSS integration) | owned by the `panda-css` track |
| TSRX (`.tsrx`) | experimental compiler frontend |
