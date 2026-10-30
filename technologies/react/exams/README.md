# Certifications & Exams: React

Verified on 2026-10-29 against the vendor pages linked below. Track version: React 19.3.1.

## 1. Is there an official React certification?

**No.** Neither Meta nor the React Foundation (Linux Foundation, announced 2026-02-24) offers an official React certification exam. Two credentials are commonly mentioned; neither is official:

| Credential | Vendor | Kind | Status (2026-10-29) | Format | Product version | Notes |
|---|---|---|---|---|---|---|
| [React Certification](https://certificates.dev/react) — Junior / Mid-Level / Senior | certificates.dev (third party; FAQ: *not officially endorsed by Meta*) | Proctored exam (webcam) | Junior and Mid-Level available; **Senior announced** ("expected to be released in Q3"; release not confirmed on the page) | Junior: 50 multiple-choice in 40 min. Mid-Level and Senior: 40 multiple-choice + 105 min coding challenges, 135 min total | Not stated | Topics listed only broadly (JavaScript, core concepts, JSX, components, events, state, hooks, React Router); per-level domain weights are not published; passing score not published |
| [Meta Front-End Developer Professional Certificate](https://www.coursera.org/professional-certificates/meta-front-end-developer) | Meta via Coursera | **Completion-based** course certificate: 9 courses (incl. *React Basics*, *Advanced React*, a capstone and *Coding Interview Preparation*), ~227 listed hours; graded course work, no proctored exam mentioned on the page | Offered (enrolment open) | Course assignments and projects | Not stated | Proves course completion, not exam-verified skill |

**Fallback used by this track (AGENTS.md priority 3):** the **senior React / senior frontend interview loop**: a technical knowledge screen (rendering model, hooks, concurrency, SSR/RSC, performance), a live-coding round (build or debug a component, write tests), and a frontend system-design round (data fetching, state architecture, rendering strategy, security). The question bank [`interview.md`](interview.md) targets that format and includes a full mock interview.

> **Exam delta (certificates.dev).** The vendor does not state which React version its exams target, and its topic list includes React Router (a third-party library, out of scope for this track). Expect the exams to emphasise hooks, components and state; this track additionally teaches 19.2/19.3 features (`<Activity>`, `useEffectEvent`, `<ViewTransition>`, untangled transitions, `browser()`), RSC and the React Compiler, which an exam written for an earlier 19.x or 18.x may not cover — or may answer according to older behaviour (e.g. `useId` format, entangled transitions, `useLayoutEffect` SSR warning). When an answer depends on the version, this track's bank states the version explicitly.

## 2. Interview domains and coverage matrix

The domain list and weights below are this track's own model of a senior React interview loop (no vendor publishes one), derived from the react.dev Learn/Reference tables of contents, the dossier's "interview hot topics", and the certificates.dev topic list. Weights drive the question distribution in [`interview.md`](interview.md).

| # | Domain / objectives | Weight | Modules | Examples (tests) | Questions | Status |
|---|---|---|---|---|---|---|
| D1 | **Rendering model & reconciliation**: elements, JSX runtime, purity, Strict Mode, identity/keys, Fiber, bailouts, commit phases | 12% | [01](../modules/01-elements-jsx-and-render-model.md), [02](../modules/02-fiber-reconciler-and-commit.md) | `01-elements`, `02-fiber` | 8 | ✅ |
| D2 | **State, hooks & effects**: hook list, update queue/batching, closures, reducers, external stores, effect phases, `useEffectEvent`, refs | 18% | [03](../modules/03-state-hooks-and-closures.md), [04](../modules/04-effects-and-synchronization.md) | `03-state`, `04-effects` | 11 | ✅ |
| D3 | **Concurrency & Suspense on the client**: lanes, scheduler, transitions (incl. 19.3 untangling), deferred values, `<Activity>`, `use(promise)` | 14% | [05](../modules/05-concurrency-lanes-transitions.md), [06](../modules/06-suspense-streaming-ssr-and-hydration.md) | `05-concurrency`, `06-suspense-ssr` | 9 | ✅ |
| D4 | **SSR, streaming & hydration**: shell, streaming format, errors, PPR, hydration mismatch, `useId`, `browser()` | 10% | [06](../modules/06-suspense-streaming-ssr-and-hydration.md) | `06-suspense-ssr` | 6 | ✅ |
| D5 | **Server Components, Server Functions & security**: module graphs, Flight, serialisation, `cache`, IDOR, CVE-2025-55182 | 12% | [07](../modules/07-server-components-and-flight.md) | `07-rsc` | 8 | ✅ |
| D6 | **Actions & forms**: form actions, `useFormStatus`, `useActionState`, `useOptimistic`, races | 8% | [08](../modules/08-actions-forms-and-optimistic-ui.md) | `08-actions` | 5 | ✅ |
| D7 | **Performance & the React Compiler**: measuring, context cost, virtualisation, code splitting, compiler model and lint | 12% | [09](../modules/09-react-compiler.md), [12](../modules/12-performance-testing-and-production.md) | `09-compiler`, `12-perf-testing` | 8 | ✅ |
| D8 | **Errors, testing & upgrades**: error boundaries, root callbacks, RTL/`act`, 18→19 removals, patch hygiene | 8% | [10](../modules/10-errors-and-resilience.md), [12](../modules/12-performance-testing-and-production.md) | `10-errors`, `12-perf-testing` | 5 | ✅ |
| D9 | **DOM platform integration**: `<ViewTransition>`, Fragment refs, portals, metadata/resources, Trusted Types | 6% | [11](../modules/11-animation-and-dom-platform.md) | `11-dom-platform` | 5 | ✅ |
| | **Total** | 100% | | | **65** | |

certificates.dev topic list → modules: JavaScript (prerequisite; owned by `languages/javascript`), core concepts/JSX/components (M01–M02), events (M01, M11 portals; synthetic event typing in TS M12), state and hooks (M03–M04), React Router (**out of scope**: third-party router; routing data/actions concepts in M07–M08).

### Out of scope (with reason)

| Topic | Reason |
|---|---|
| React Router, Next.js, Remix/React Router framework mode APIs | Framework specifics; cross-link only (brief §3 "Overlaps") |
| React Native | Separate renderer and platform |
| CSS-in-JS libraries, styling systems | `languages/css`, `technologies/panda-css` |
| State libraries' APIs (Redux, Zustand, TanStack Query) | Patterns covered in M03 §8; library APIs are not React |
| Typing React (JSX namespace, generics, polymorphic components) | Owned by `languages/typescript` M12 |

## 3. How to use the bank

1. Study the module; run its tests (`npm test -- examples/NN-…`).
2. Answer the domain's questions without peeking; check the `<details>` answers.
3. Take the mock interview in [`interview.md` § Mock interview](interview.md#mock-interview) under time.
4. Hands-on tasks (`hands-on` type) are verified by the named test files in `examples/` — make them pass on a fresh copy, or re-implement the behaviour and run the test.
