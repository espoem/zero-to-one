# Brief: JavaScript (`languages/javascript`)

| | |
|---|---|
| Phase | 1 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/javascript` · `../zto-javascript` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/C-runtimes.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- This is a **foundation track**: typescript, react, solidjs and nodejs cross-link to it. Prioritise the concepts listed under "Planned shared `languages/javascript`" in the frontend dossier.
- Decorators: the dossier saw Stage 2.7 on the TC39 list. Re-verify before teaching.
- Own the HTML event-loop processing model (task → microtask checkpoint → rendering steps). `languages/css` owns style/layout/paint internals.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Types & coercion, scope/closures/`this`, prototypes/classes
- Iterators, generators, async iteration, Promise/job-queue semantics (spec level)
- ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime
- Proxy/Reflect, WeakRef/FinalizationRegistry
- Shared memory, Atomics, JS memory model
- Temporal, explicit resource management (`using`, `DisposableStack`) runtime semantics
- Decorators runtime semantics (TC39)
- HTML event loop & rendering steps (task → microtasks → rAF → style/layout/paint)
- `structuredClone`, serialisation limits
- V8 shapes/ICs at the "why is my code slow" level

**Cross-link only (do not re-explain):**
- libuv phases, `process.nextTick`, threadpool, streams & backpressure, CJS loader, `require(esm)`, GC tuning flags → owned by `technologies/nodejs`
- Concurrency models, locks, data races, lock-free structures (language-neutral) → owned by `algorithms/dsa` (proposed extra module, TBD)

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### JavaScript / ECMAScript core — `languages/javascript`

- **Current stable version(s)**
  - **ECMA-262 17th edition = ES2026**, approved by Ecma GA on 2026-06-30 — https://262.ecma-international.org/17.0/ , https://www.infoworld.com/article/4193461/ecmascript-2026-specification-approved.html
  - ES2026 contents (tc39 finished-proposals, "2026"): Upsert (`Map/WeakMap.prototype.getOrInsert/getOrInsertComputed`), JSON.parse source text access (`JSON.rawJSON`, reviver `context.source`), Iterator Sequencing (`Iterator.concat`), `Uint8Array` to/from base64/hex, `Math.sumPrecise`, `Error.isError`, `Array.fromAsync` — https://github.com/tc39/proposals/blob/main/finished-proposals.md
  - **Already Stage 4, slated for ES2027**: **Temporal**, **Explicit Resource Management** (`using`/`await using`, `DisposableStack`, `Symbol.dispose`), `Atomics.pause`, Joint Iteration (`Iterator.zip`). (same source)
  - Stage 3 now (tc39/proposals README): Source Phase Imports, Deferring Module Evaluation (`import defer`), Import Text, Iterator chunking, Iterator includes, Iterator join, Error Stack Accessor, RegExp buffer boundaries (`\A \z \Z`), Await Dictionary, Dynamic Code Brand Checks, Non-extensible Applies to Private, Legacy RegExp features. Stage 2.7: **Decorators** & Decorator Metadata (listed at 2.7 in current README — surprising, verify before teaching), ShadowRealm, ESM Phase Imports, Immutable ArrayBuffers, Import Bytes. AsyncContext still Stage 2 (unverified as of Oct 2026).
  - Engine reality: V8 14.6 (Node 26) ships Temporal on by default, Upsert, `Iterator.concat`; `using` shipped in V8 since ~13.x/Chrome 134 (unverified exact version). Safari lacks Temporal per secondary press (https://lilting.ch/en/articles/nodejs-26-current-temporal-undici).
- **Authoritative syllabi used**
  - ECMA-262 ToC (§6 types, §7 abstract ops, §9 execution contexts/realms/jobs/agents, §10 ordinary & exotic objects, §16 scripts & modules, §25.4 Atomics/memory model §29) — https://tc39.es/ecma262/
  - TC39 process & proposals — https://tc39.es/process-document/ , https://github.com/tc39/proposals
  - HTML event-loop spec (tasks/microtasks/rendering) — https://html.spec.whatwg.org/multipage/webappapis.html#event-loops
  - MDN JS Guide/Reference — https://developer.mozilla.org/en-US/docs/Web/JavaScript
  - "You Don't Know JS Yet" (Simpson), "JavaScript: The Definitive Guide" 7e, v8.dev blog (engine internals), test262 — https://github.com/tc39/test262
  - No vendor cert exists for JS core worth targeting; JSNAD's "JavaScript Prerequisites" and "Control Flow" domains (see Node track) map here.
- **Proposed modules**
  1. **The spec as a tool** — reading ECMA-262 (abstract ops, `?`/`!`, Completion Records, internal slots `[[ ]]`); TC39 stages 0→4 (incl. 2.7); test262; editions vs. engines; how to look up "why does X behave so".
  2. **Types, values & coercion** — 8 language types; `ToPrimitive`/`ToNumber`/`ToString`/`ToPropertyKey`; `==` algorithm (IsLooselyEqual) vs `===` vs `SameValue`/`SameValueZero`; NaN/±0; BigInt rules & mixing errors; IEEE-754 & `Math.sumPrecise`; Symbols & well-known symbols.
  3. **Execution contexts, scope & closures** — Environment Records (declarative/object/global/function/module); hoisting, TDZ; `this` binding rules (incl. arrow, `bind`, class fields); closures & what they retain; strict mode semantics; `eval` direct vs indirect.
  4. **Objects & prototypes** — property descriptors, `[[Get]]/[[Set]]/[[DefineOwnProperty]]`; prototype chain & `Object.create`; classes as sugar (+ private `#x`, static blocks, `accessor`); exotic objects (Array length, arguments, TypedArray, module namespace); property order rules; `structuredClone` vs spread.
  5. **Functions, iterators & generators** — iterator protocol, `return()`/cleanup, Iterator helpers (`map/filter/take/drop/flatMap`, `Iterator.concat`, `Iterator.zip`), generators as coroutines, `yield*`, async iterators, `for await`, `Array.fromAsync`.
  6. **Agents, realms & the job queue** — agent / agent cluster; realm & intrinsics (cross-realm `instanceof`, `Error.isError`, `Array.isArray`); HostEnqueuePromiseJob; promise resolution procedure & thenable job; microtask vs task (HTML) vs Node phases; `queueMicrotask`; unhandled-rejection tracking (HostPromiseRejectionTracker).
  7. **Async programming in depth** — Promise combinators (`all/allSettled/any/race`, `withResolvers`), `async/await` desugaring & extra ticks, cancellation (AbortController/AbortSignal.any/timeout), error propagation, `await` in loops vs concurrency limits; AsyncContext proposal.
  8. **Modules (ESM & CJS)** — Module Records, Link/Evaluate phases, live bindings, cycles & TDZ, top-level await & async module graphs; dynamic `import()`; import attributes (`with { type: 'json' }`); `import.meta`; source/defer phase imports; CJS interop (default export, `require(esm)`) → deep detail cross-linked to Node track.
  9. **Metaprogramming** — Proxy invariants & traps, Reflect, `Symbol.toPrimitive/iterator/asyncIterator/hasInstance/species`; tagged templates; WeakMap/WeakRef/FinalizationRegistry semantics (non-determinism!).
  10. **Explicit resource management & Temporal** — `using`/`await using`, `DisposableStack`/`AsyncDisposableStack`, `SuppressedError`; Temporal types (Instant, ZonedDateTime, PlainDate/Time, Duration), calendars & time zones, DST arithmetic, migrating off `Date`.
  11. **Binary data & the memory model** — ArrayBuffer (resizable, transfer), TypedArrays/DataView, base64/hex, SharedArrayBuffer, Atomics (`wait`, `waitAsync`, `notify`, `pause`), happens-before / data-race semantics, cross-origin isolation requirement in browsers.
  12. **Engine internals for JS devs (V8 lens)** — parsing/lazy compile, Ignition→Sparkplug→Maglev→Turbofan tiers, hidden classes/shapes, inline caches (mono/poly/megamorphic), elements kinds, deopts; GC basics (generational, write barriers) → deeper in Node track.
  13. **Correctness & security pitfalls** — prototype pollution, ReDoS & regex `v` flag, `JSON.parse` big-number precision (`JSON.rawJSON`), floating point money, `Date` parsing, sort stability & comparator contracts.
- **Gotchas & production failure modes**
  - `[1,10,2].sort()` sorts lexicographically; inconsistent comparator ⇒ implementation-defined order.
  - `JSON.parse` silently loses precision for IDs > 2^53 (Twitter/Snowflake IDs) — use reviver `context.source` + BigInt.
  - `0.1+0.2`; summing large float arrays with `reduce` drifts — `Math.sumPrecise`.
  - `await` inside `for` serializes I/O unexpectedly; `Promise.all` over 10k items opens 10k sockets — need a concurrency limiter.
  - `Promise.all` rejects fast but does NOT cancel the other operations — they keep running (wire AbortSignal).
  - Floating promise (missing `await`) ⇒ unhandled rejection ⇒ Node process crash (default `--unhandled-rejections=throw`).
  - Closure capturing a large object (e.g., request) in a long-lived callback/timer ⇒ memory leak; V8 shares one context per scope so an unused sibling variable can still be retained.
  - Prototype pollution via `merge(target, JSON.parse(userInput))` with `__proto__` key ⇒ global behavior change; use `Object.create(null)`/`Map`.
  - `instanceof Array/Error` fails across realms (iframes, `vm` contexts, workers) — use `Array.isArray`/`Error.isError`.
  - Circular ESM imports ⇒ `ReferenceError: Cannot access 'X' before initialization` (TDZ on live binding).
  - Top-level await in a shared module blocks every importer's evaluation (and can deadlock in cycles).
  - `new Date('2026-03-29')` is UTC but `new Date('2026-03-29T00:00')` is local; DST-crossing "+24h" bugs — Temporal `ZonedDateTime.add({days:1})`.
  - Catastrophic backtracking regex `/(a+)+$/` on user input pins CPU (ReDoS).
  - Megamorphic call sites (objects with many shapes, `delete obj.x`) silently cost 10–100× in hot paths.
  - `WeakRef`/`FinalizationRegistry` callbacks may never run — never use for resource cleanup; use `using`.
  - `for...in` iterates inherited enumerable props; `Object.keys` order: integer keys first ascending.
- **Interview hot topics**
  - Event loop: order of `setTimeout`, `Promise.then`, `queueMicrotask`, `await` (predict output).
  - Closures & classic `var` in loop; `this` binding quiz.
  - Prototypal inheritance vs classes; implement `Object.create`/`new`/`bind`.
  - `==` coercion table; `typeof null`; NaN.
  - Implement `Promise.all`, debounce/throttle, retry with backoff, concurrency-limited pool.
  - ESM vs CJS differences (static vs dynamic, live bindings, TLA).
  - Generators/iterators and lazy pipelines.
  - Memory leaks in JS and how GC decides reachability.
  - Proxy use cases (reactivity — link to SolidJS signals).
  - What's new in ES2025/2026; Temporal; `using`.
- **Executable-proof strategy**
  - mise: `node = "26"` (and `"24"` matrix leg) — `.mise.toml`; run with `node --test` (no deps) for spec-behavior assertions: coercion tables, event-loop ordering (record into array, assert sequence), TDZ errors (`assert.throws(…, ReferenceError)`), Proxy invariant violations (`TypeError`), Temporal DST arithmetic.
  - Negative tests: `assert.rejects`, unhandled-rejection test via child process (`spawnSync(process.execPath, ['-e', …])` asserting exit code 1).
  - Engine-internals demos: `node --allow-natives-syntax` with `%GetOptimizationStatus`, `%HaveSameMap`, `--trace-deopt` output grepped in tests — mark as V8-version-sensitive (snapshot per pinned Node).
  - Cross-engine checks optional: `esvu`/`eshost-cli` to run snippets in V8/SpiderMonkey/JSC (unverified current maintenance) — fallback: document only.
  - test262 excerpts as reading material, not run (heavy harness).
  - Not provable locally: browser-only parts (HTML rendering steps, cross-origin isolation for SAB) — use Playwright 1.x (pin via mise/npm) if needed, else doc-only.
- **Overlaps / dedupe**
  - **This track OWNS** (others cross-link): types & coercion, scope/closures/`this`, prototypes/classes, iterators/generators, Promise/job-queue semantics (spec level), ESM semantics (Module Records, live bindings, TLA), Proxy/Reflect, WeakRef, memory model/Atomics, Temporal, explicit resource management, V8 shapes/ICs at "why my code is slow" level.
  - TypeScript track: cross-link for runtime semantics; TS owns type system, `erasableSyntaxOnly`, decorators (TS legacy vs TC39), declaration emit. Note TypeScript 7.0 (native, Go port) is current on npm (7.0.2, 2026-10-28) — TS track must verify.
  - React/SolidJS tracks: cross-link closures (stale closures), Proxy (Solid stores), microtask batching, structural sharing; they own rendering/reactivity.
  - Node track owns: libuv phases, `process.nextTick`, CJS loader internals, `require(esm)`, GC tuning flags, worker_threads (cross-link Atomics here).
  - Browser/Web platform track (if any): HTML event loop rendering steps, DOM, Web APIs.

---

#### Context from `A-frontend.md`

##### Planned shared `languages/javascript` — items flagged from these four tracks

- **Event loop & job queues**: macrotask vs microtask, `queueMicrotask`. Basis for Solid's flush batching, React's automatic batching and `act()`.
- **Closures, scope & `this`**: from TS M03.2 and the React stale-closure discussion.
- **Promises/async functions/async iterators/generators**: basis for Solid `action(function*)`, `from(AsyncIterable)` and React `use()`. `AbortController`/`AbortSignal`.
- **Proxies & Reflect**: Solid stores, draft setters, Panda runtime helpers. WeakMap/WeakRef/FinalizationRegistry.
- **Explicit Resource Management runtime semantics** (`using`, `DisposableStack`, `SuppressedError`). Stage-3 decorator runtime semantics, if confirmed shipped.
- **ES2023–ES2026 library**: immutable array methods, Set methods, iterator helpers, `Promise.try`, `RegExp.escape`, `Array.fromAsync`, `Error.isError`, `Math.sumPrecise`, Uint8Array base64/hex. Proposals: `Promise.allKeyed`, `Iterator.zip`/`chunks`. TS 7.1 types these under `es2026`/`esnext`.
- **Modules**: ESM vs CJS, package.json `exports` conditions at runtime (`browser`/`node`/`worker`/`development`/`react-server`/`observe`; Solid and React both rely on condition-based builds), import attributes, source-phase imports.
- **Serialisation**: `structuredClone`, JSON limits, seroval/Flight motivations.
- **Node running TS natively** (type stripping) as runtime behaviour; TS keeps the `erasableSyntaxOnly` typing side.
- **TC39 Signals proposal**: conceptual bridge for Solid (stage unverified).

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Stage 3 now (tc39/proposals README): Source Phase Imports, Deferring Module Evaluation (`import defer`), Import Text, Iterator chunking, Iterator includes, Iterator join, Error Stack Accessor, RegExp buffer boundaries (`\A \z \Z`), Await Dictionary, Dynamic Code Brand Checks, Non-extensible Applies to Private, Legacy RegExp features. Stage 2.7: **Decorators** & Decorator Metadata (listed at 2.7 in current README — surprising, verify before teaching), ShadowRealm, ESM Phase Imports, Immutable ArrayBuffers, Import Bytes. AsyncContext still Stage 2 (unverified as of Oct 2026).
- Engine reality: V8 14.6 (Node 26) ships Temporal on by default, Upsert, `Iterator.concat`; `using` shipped in V8 since ~13.x/Chrome 134 (unverified exact version). Safari lacks Temporal per secondary press (https://lilting.ch/en/articles/nodejs-26-current-temporal-undici).
- Cross-engine checks optional: `esvu`/`eshost-cli` to run snippets in V8/SpiderMonkey/JSC (unverified current maintenance) — fallback: document only.
- **TC39 Signals proposal**: conceptual bridge for Solid (stage unverified).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/javascript` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(javascript)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/javascript.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/javascript.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
