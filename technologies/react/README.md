# React 19.3 — From Elements to Server Components

A single progressive track through React's runtime: the element model, the Fiber reconciler, hooks and effects, concurrent scheduling, Suspense and streaming SSR, Server Components and the Flight protocol, Actions, the React Compiler, error handling, DOM platform integration, and production operations. Every claim that can be executed is executed: each module has a Vitest suite that runs against the **real** React packages (no simulations), including negative tests for the failure modes.

**Verified against** react / react-dom / react-server-dom-webpack 19.3.1, scheduler 0.28.0, @types/react 19.3.0, babel-plugin-react-compiler 1.0.0, eslint-plugin-react-hooks 7.1.1, Vitest 5.0.5, jsdom 30.1.3, @testing-library/react 16.3.3, TypeScript 7.0.2, Node 26.12.1 **on 2026-10-29** (npm registry, react.dev blog and reference, GitHub/OSV/GitLab advisory databases).

## Prerequisites

- JavaScript: closures, promises and the event loop ([languages/javascript](../../languages/javascript/README.md)).
- TypeScript basics; **typing React** (JSX namespace, component and hook types, generic components) is taught in [languages/typescript](../../languages/typescript/README.md) module 12, not here.
- HTML/DOM basics; CSS view transitions and the rendering pipeline are in [languages/css](../../languages/css/README.md).

## Syllabus

| # | Module | Covers | Proofs |
|---|---|---|---|
| 01 | [Elements, JSX & the render model](modules/01-elements-jsx-and-render-model.md) | JSX automatic runtime, `$$typeof` brand (19 transitional symbol), purity, Strict Mode, keys/identity, `ref` as prop, roots, renderers | [`01-elements`](examples/01-elements/elements.test.tsx) |
| 02 | [Fiber reconciler & commit](modules/02-fiber-reconciler-and-commit.md) | Fiber fields, double buffering, work loop, two-pass keyed diff (vs LIS), bailouts, commit sub-phases, Fragment refs | [`02-fiber`](examples/02-fiber/fiber.test.tsx) |
| 03 | [State, hooks & closures](modules/03-state-hooks-and-closures.md) | Hook list, update queues and rebasing, batching, stale closures, reducers as state machines, context, `useSyncExternalStore` and tearing | [`03-state`](examples/03-state/state.test.tsx) |
| 04 | [Effects & synchronization](modules/04-effects-and-synchronization.md) | Insertion/layout/passive order, Strict Mode (incl. 19.3 hydration), ref cleanup, `useEffectEvent`, fetch races, "you might not need an effect" | [`04-effects`](examples/04-effects/effects.test.tsx) |
| 05 | [Concurrency: lanes, transitions & Activity](modules/05-concurrency-lanes-transitions.md) | Lane bitmask (checked against the shipped build), scheduler, transitions, **19.3 untangled transitions**, `useDeferredValue`, `<Activity>` | [`05-concurrency`](examples/05-concurrency/concurrency.test.tsx) |
| 06 | [Suspense, streaming SSR & hydration](modules/06-suspense-streaming-ssr-and-hydration.md) | `use(promise)`, reveal rules, streaming wire format, PPR `prerender`/`resume`, hydration mismatches, `useId`, `browser()` | [`06-suspense-ssr`](examples/06-suspense-ssr/suspense-ssr.test.tsx) |
| 07 | [Server Components & Flight](modules/07-server-components-and-flight.md) | Module graphs, Flight rows, serialisation, `cache`/`cacheSignal`, Server Function security, **CVE-2025-55182** and follow-ups | [`07-rsc`](examples/07-rsc/rsc.test.tsx) |
| 08 | [Actions, forms & optimistic UI](modules/08-actions-forms-and-optimistic-ui.md) | Form actions, `useFormStatus`, `useActionState`, `useOptimistic`, races, progressive enhancement | [`08-actions`](examples/08-actions/actions.test.tsx) |
| 09 | [React Compiler 1.0](modules/09-react-compiler.md) | Pipeline, generated cache code, Rules of React as preconditions, lint, configuration, adoption | [`09-compiler`](examples/09-compiler/compiler.test.tsx) |
| 10 | [Errors & resilience](modules/10-errors-and-resilience.md) | Error boundaries, root error callbacks, recovery, errors in hidden `<Activity>` | [`10-errors`](examples/10-errors/errors.test.tsx) |
| 11 | [Animation & DOM platform](modules/11-animation-and-dom-platform.md) | `<ViewTransition>`, `addTransitionType`, Fragment refs, portals, metadata/resources, Trusted Types | [`11-dom-platform`](examples/11-dom-platform/dom-platform.test.tsx) |
| 12 | [Performance, testing & production](modules/12-performance-testing-and-production.md) | Profiler and Performance Tracks, render cost, virtualisation, `lazy`, RTL/`act`, 18→19 upgrade, patch hygiene, version history | [`12-perf-testing`](examples/12-perf-testing/perf-testing.test.tsx) |

Reference material: [GLOSSARY.md](GLOSSARY.md) (EN ↔ CZ) · [CHEATSHEET.md](CHEATSHEET.md) · [exams/](exams/README.md).

**Out of scope:** routers and meta-frameworks (Next.js, React Router) beyond cross-references; React Native; state-management library APIs; styling systems. See [exams/README.md](exams/README.md#out-of-scope-with-reason).

## Running the examples

```bash
mise install                 # node 26, typescript 7.0.2 (see .mise.toml)
mise exec -- npm ci
mise exec -- npm test        # vitest run — all 12 example suites
mise exec -- npm run typecheck
mise exec -- npm test -- examples/07-rsc   # one module
```

How the harness works:

- Client tests run in **jsdom** with `IS_REACT_ACT_ENVIRONMENT = true` ([`examples/setup.ts`](examples/setup.ts)); a few tests deliberately leave `act()` to observe production scheduling.
- Server-rendering tests call `react-dom/server` and `react-dom/static` in the same process.
- **Server Components** run in a child Node process started with `--conditions react-server` and `NODE_ENV=production` ([`examples/07-rsc/server.ts`](examples/07-rsc/server.ts)); the test decodes the Flight stream with `react-server-dom-webpack/client.node`. No bundler is needed.
- Compiler tests run the real `babel-plugin-react-compiler` and import compiled output from a git-ignored `.generated/` directory.
- A few tests read **private** fiber fields through [`examples/_shared/internals.ts`](examples/_shared/internals.ts) for teaching; they are pinned to 19.3.1 and documented as such.
- Browser-only behaviour (real view-transition animations, layout, CSP/Trusted Types) cannot be proven in jsdom; see Module 11 §6. There is no `test:integration` script yet (no Docker or browser is needed by the current suites).

## Certifications & Exams

**There is no official React certification** from Meta or the React Foundation. Documented in detail, with the domain coverage matrix, in [exams/README.md](exams/README.md):

| Credential | Vendor / code | Status (verified 2026-10-29) | Format | Product version |
|---|---|---|---|---|
| [React Certification](https://certificates.dev/react) — Junior, Mid-Level, Senior | certificates.dev (third party, not endorsed by Meta) | Junior and Mid-Level available; Senior announced, release not confirmed | Proctored. Junior: 50 MCQ / 40 min. Mid/Senior: 40 MCQ + 105 min coding (135 min); passing score not published | Not stated (exam delta noted in exams/README) |
| [Meta Front-End Developer Professional Certificate](https://www.coursera.org/professional-certificates/meta-front-end-developer) | Meta via Coursera | Offered | **Completion-based** 9-course programme (incl. React Basics, Advanced React), no proctored exam mentioned | Not stated |
| **Senior React interview loop** (this track's fallback) | — | — | Technical screen, live coding, frontend system design | React 19.3 |

Preparation: [exams/interview.md](exams/interview.md) — 65 original questions across 9 domains (single, multi-select, scenario, ordering, hands-on tasks verified by the example tests) and a full mock interview with a scoring key.

## Relationship to other tracks

This track owns Fiber, lanes, Suspense, RSC/Flight, Actions and the React Compiler (see `.agents/OWNERSHIP.md`). It cross-links instead of re-explaining: JavaScript semantics ([languages/javascript](../../languages/javascript/README.md)), typing React ([languages/typescript](../../languages/typescript/README.md) M12), view transitions and rendering pipeline ([languages/css](../../languages/css/README.md)), HTTP/streaming/caching ([architecture/networking](../../architecture/networking/README.md)), authorization and OWASP ([architecture/security-identity](../../architecture/security-identity/README.md)), and the React-vs-Solid comparison ([technologies/solidjs](../solidjs/README.md)).
