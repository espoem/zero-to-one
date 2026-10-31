# JavaScript (ECMAScript 2026): from the Specification to Production

A foundation track for the language itself: its types and coercions, execution model, objects, iteration, asynchronous semantics, modules, metaprogramming, memory model and engine behaviour, anchored in **ECMA-262 17th edition (ES2026)** with the ES2027 features that already ship (Temporal, explicit resource management). Every claim that can be executed is executed: each module has a deterministic `node:test` suite on Node 26, with negative tests and fast-check property tests.

> Verified against **Node.js 26.12.1 (V8 14.6.202, IANA tz 2026e)**, **ECMA-262 17th edition (ES2026, June 2026)** and the tc39.es living draft (ES2027), the **tc39/proposals** stage tables, **TypeScript 7.0.2**, **fast-check 4.10.2**, **esbuild 0.28.2** and **@types/node 26.6.6** on **2026-10-28**.

Other tracks build on this one and link here instead of re-explaining language semantics: [TypeScript](../typescript/), React, SolidJS, Node.js and Panda CSS (ownership in `.agents/OWNERSHIP.md`).

## Prerequisites

- Comfortable writing everyday JavaScript (functions, objects, arrays, promises).
- Basic command-line use. No prior knowledge of the specification is assumed: [module 01](modules/01-reading-the-spec.md) teaches how to read it.

## Syllabus

The modules form one progressive narrative; read them in order.

| # | Module | Core content | Spec anchors | Executable proof |
|---|---|---|---|---|
| 01 | [Reading the specification](modules/01-reading-the-spec.md) | editions vs living draft, notation (`?`/`!`, Completion and Reference Records), TC39 stages incl. 2.7, proposal snapshot, engine support matrix, test262 | §5, §6.2.4–§6.2.5, Annex B | [01](examples/01-reading-the-spec.test.js) |
| 02 | [Types, values and coercion](modules/02-types-values-coercion.md) | 8 types, IEEE 754, BigInt, UTF-16, symbols, ToPrimitive/ToNumber/…, four equality algorithms, `+`, compensated summation | §6.1, §7.1, §7.2 | [02](examples/02-types-values-coercion.test.js) |
| 03 | [Execution contexts, scope, closures and `this`](modules/03-execution-contexts-scope-closures.md) | Environment Records, hoisting and TDZ, closures and V8 context retention, `this` rules, `bind`, strict mode, `eval` | §9.1, §9.4, §10.2, §19.2.1 | [03](examples/03-execution-contexts-scope-closures.test.js) |
| 04 | [Objects, prototypes and classes](modules/04-objects-prototypes-classes.md) | descriptors, `[[Get]]`/`[[Set]]` and the override mistake, key order, `new`/`instanceof`, classes, private names, exotic objects, copying | §6.1.7, §10.1, §10.4, §15.7 | [04](examples/04-objects-prototypes-classes.test.js) |
| 05 | [Iterators, generators and async iteration](modules/05-iterators-generators.md) | protocols, IteratorClose, generators as coroutines, iterator helpers, `Iterator.concat`, async generators, `Array.fromAsync` | §7.4, §27.1, §27.5–§27.6 | [05](examples/05-iterators-generators.test.js) |
| 06 | [Agents, realms, the job queue and the event loop](modules/06-agents-realms-job-queue.md) | agents and realms, promise jobs and tick accounting, rejection tracking, **HTML event-loop processing model** and rendering steps | §9.3–§9.7, §27.2; HTML §8.1.7 | [06](examples/06-agents-realms-job-queue.test.js) + [model](examples/06-event-loop-model.js) |
| 07 | [Async programming in depth](modules/07-async-in-depth.md) | combinators, `async`/`await` desugaring, cancellation with `AbortSignal`, bounded concurrency, retry with jitter, debounce/throttle, AsyncContext status | §27.2, §27.7; DOM §3 | [07](examples/07-async-in-depth.test.js) + [utils](examples/07-async-utils.ts) |
| 08 | [Modules](modules/08-modules.md) | Module Records, link/evaluate, live bindings, cycles and TDZ, top-level await, import attributes, `import defer`, `exports` conditions | §16.2, §10.4.6 | [08](examples/08-modules.test.js) + [fixtures](examples/fixtures/08-modules/) |
| 09 | [Metaprogramming](modules/09-metaprogramming.md) | Proxy and invariants, Reflect, reactivity, well-known symbols, tagged templates, weak references, decorators (Stage 2.7) | §10.5, §26, §28 | [09](examples/09-metaprogramming.test.js) |
| 10 | [Resource management and Temporal](modules/10-resource-management-temporal.md) | `using`/`await using`, `DisposableStack`, `SuppressedError`; Temporal types, DST disambiguation, durations, migrating from `Date` | ES2027 draft | [10](examples/10-resource-management-temporal.test.js) |
| 11 | [Binary data, serialisation and the memory model](modules/11-binary-data-memory-model.md) | resizable/transferable buffers, typed arrays, base64/hex, `structuredClone`, SharedArrayBuffer, happens-before, data races, Atomics | §23.2, §25, §29; HTML §2.7 | [11](examples/11-binary-data-memory-model.test.js) |
| 12 | [Engine internals (V8)](modules/12-engine-internals-v8.md) | tiers (Ignition, Sparkplug, Maglev, Turbofan), hidden classes, inline caches, elements kinds, deopts, GC basics, diagnosis | V8 documentation | [12](examples/12-engine-internals-v8.test.js) |
| 13 | [Correctness and security pitfalls](modules/13-correctness-security-pitfalls.md) | prototype pollution, ReDoS, lossless JSON, money, dates, sorting; **version history ES2015 → ES2027** | §25.5, §23.1.3.30, §22.2 | [13](examples/13-correctness-security-pitfalls.test.js) |

Each module ends with an **Interview Drill** (answers in collapsible blocks). Supporting material: [GLOSSARY.md](GLOSSARY.md) (English ↔ Czech), [CHEATSHEET.md](CHEATSHEET.md), and [exams/](exams/).

**Out of scope, with owners:** libuv phases, `process.nextTick`, streams, the CommonJS loader and `require(esm)` → `technologies/nodejs`; type system → [`languages/typescript`](../typescript/); style/layout/paint internals → `languages/css`; language-neutral concurrency theory → `algorithms/dsa`; `Intl` (ECMA-402) and DOM/Web APIs beyond what async cancellation needs. See [exams/README.md](exams/README.md#syllabus-completeness-against-ecma-262-2026) for the full mapping against the ECMA-262 table of contents.

## Running the examples

Tooling is pinned with mise ([`.mise.toml`](.mise.toml): Node 26.12.1). From this directory:

```bash
mise install                    # installs the pinned Node
mise exec -- npm ci             # TypeScript, fast-check, esbuild, @types/node (exact versions)
mise exec -- npm test           # all suites: node --test "examples/**/*.test.{js,mjs,ts}"
mise exec -- npm run typecheck  # tsc --noEmit (TypeScript 7)
```

Run one module: `mise exec -- node --test examples/06-agents-realms-job-queue.test.js`.

Notes:
- The examples are JavaScript (the track's own language) plus TypeScript files that Node 26 runs natively (erasable syntax only).
- Some tests start child processes with engine flags (`--expose-gc`, `--allow-natives-syntax`, `--js-sum-precise`, `--js-defer-import-eval`, `--enable-experimental-regexp-engine`). Module 12's assertions about V8 internals are **pinned to V8 14.6** and are expected to change with V8 upgrades.
- All tests are deterministic: none relies on a race manifesting or on wall-clock thresholds; cross-agent tests use Atomics handshakes.
- There is no `test:integration` script: nothing in this track needs Docker or external services.
- Hands-on exam tasks: `SOLUTIONS=./my-solutions.js node --test examples/exam-hands-on.test.js` (path relative to `examples/`).

## Certifications & Exams

**No authoritative certification exists for the JavaScript language** (verified 2026-10-28). Details, coverage matrices and the exam delta are in [exams/README.md](exams/README.md).

| Exam | Vendor | Status | Format | Used here as |
|---|---|---|---|---|
| JSNAD (OpenJS Node.js Application Developer) | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30**, no successor ([LF notice](https://training.linuxfoundation.org/jsnad-cert-inactive/)) | was performance-based | history only |
| JSNSD (OpenJS Node.js Services Developer) | OpenJS Foundation / Linux Foundation | **Inactive** ([LF notice](https://training.linuxfoundation.org/jsnsd-cert-inactive/)) | — | — |
| **JSA-41-01** JSA™ Certified Associate JavaScript Programmer | JS Institute (OpenEDG) | Active ([official voucher page](https://ums.edube.org/products/jsa-exam), checked 2026-10-28); ECMAScript version not stated | 40 items, 60 minutes, Pearson VUE or OnVUE, US$325; sections Classless Objects 25%, Classes 23%, Built-in Objects 27%, Advanced Functions 25%; passing score not published | secondary target: section matrix + 40-item mock (Mock B) |
| JSE-40-01 JSE™ Certified Entry-Level JavaScript Programmer | JS Institute (OpenEDG) | Active (OpenEDG store, TestNow) | details unverified | not targeted (below this track's level) |
| **Senior JavaScript technical interview** | industry format | — | knowledge and output-prediction questions plus live coding | **primary target**: [exams/interview.md](exams/interview.md), 78 questions in 10 domains, 6 hands-on tasks with a verification script, and a 60-minute mock (Mock A) |

**Exam delta:** JSA-41-01 does not state its ECMAScript edition and its sections predate ES2022–ES2027; expect ES2015–ES2020 era questions. This track's ES2024+ content (Temporal, `using`, iterator helpers, ES2026 built-ins, decorators) is beyond that exam.

## Layout

```
languages/javascript/
├── README.md, GLOSSARY.md, CHEATSHEET.md
├── modules/          01–13, one progressive narrative
├── examples/         one *.test.js per module, helpers/, fixtures/08-modules/,
│                     06-event-loop-model.js, 07-async-utils.ts, exam-solutions.js, exam-hands-on.test.js
├── exams/            README.md (exams, matrices, delta), interview.md (bank + mocks)
├── package.json, package-lock.json, tsconfig.json, .mise.toml
```

## Primary sources

- ECMA-262 17th edition: <https://262.ecma-international.org/17.0/>; living draft: <https://tc39.es/ecma262/>
- TC39 process and proposals: <https://tc39.es/process-document/>, <https://github.com/tc39/proposals>
- HTML Living Standard, event loops and structured serialisation: <https://html.spec.whatwg.org/multipage/webappapis.html#event-loops>
- test262: <https://github.com/tc39/test262>
- V8 blog and docs: <https://v8.dev/blog>, <https://v8.dev/docs>
- Temporal documentation: <https://tc39.es/proposal-temporal/docs/>
- MDN JavaScript reference: <https://developer.mozilla.org/en-US/docs/Web/JavaScript>
