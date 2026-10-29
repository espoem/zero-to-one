# Review: languages/javascript

## Hand-off (primary · Opus · 2026-10-29)

**State: ready for challenge and verification (🟨 requested; the author may not edit STATUS.md).** Every deliverable in the brief exists, tests are green, and the remaining items are listed below.

### Done
| Module | File | Executable proof |
|---|---|---|
| 01 Reading the spec: editions vs living draft, `?`/`!`, Completion/Reference Records, TC39 stages incl. 2.7, proposal snapshot, Node 26 support matrix, test262 | `modules/01-reading-the-spec.md` | `examples/01-reading-the-spec.test.js` (pins the engine support matrix, so a Node upgrade that changes it fails loudly) |
| 02 Types, values, coercion: 8 types, IEEE 754, BigInt, UTF-16, symbols, conversions, 4 equality algorithms, `+`, Neumaier pseudocode + invariant | `modules/02-…md` | `examples/02-…test.js` (fast-check: round-trip, ToInt32, SameValue) |
| 03 Execution contexts, scope, TDZ, closures, `this`, strict mode, eval | `modules/03-…md` | `examples/03-…test.js` (V8 shared-Context retention via `--expose-gc` + WeakRef) |
| 04 Objects, descriptors, `[[Get]]`/`[[Set]]`, override mistake, key order, `new`/`instanceof`, classes, private names, exotic objects, copying; JSA exam-delta callout | `modules/04-…md` | `examples/04-…test.js` |
| 05 Iterators, IteratorClose, generators/coroutines, helpers, `Iterator.concat`, async iteration, `Array.fromAsync` | `modules/05-…md` | `examples/05-…test.js` |
| 06 Agents, realms, jobs, tick accounting, rejection tracking, **HTML event-loop processing model** | `modules/06-…md` | `examples/06-…test.js` + executable model `examples/06-event-loop-model.js` |
| 07 Async in depth: combinators, `withResolvers`/`try`, await desugaring, AbortSignal, pool, retry + jitter, debounce/throttle, AsyncContext status | `modules/07-…md` | `examples/07-…test.js` + `examples/07-async-utils.ts` |
| 08 Modules: records, link/evaluate, live bindings, namespaces, cycles/TDZ, TLA, attributes, `import.meta`, `import defer`, `exports` conditions | `modules/08-modules.md` | `examples/08-modules.test.js` + `examples/fixtures/08-modules/` |
| 09 Metaprogramming: Proxy invariants, Reflect receiver, reactivity, symbols, tagged templates, weak refs, decorators (Stage 2.7) | `modules/09-…md` | `examples/09-…test.js` (decorators executed via an esbuild 0.28 transform) |
| 10 `using`/`await using`/`DisposableStack`/`SuppressedError`; Temporal (DST, disambiguation, overflow, durations, Date migration) | `modules/10-…md` | `examples/10-…test.js` (Europe/Prague 2026 DST days; fast-check) |
| 11 Binary data, base64/hex, `structuredClone`, SAB + COOP/COEP, memory model, Atomics, CAS mutex | `modules/11-…md` | `examples/11-…test.js` (workers, deterministic handshakes) |
| 12 V8: tiers, hidden classes, ICs, elements kinds, deopts, GC, diagnosis | `modules/12-…md` | `examples/12-…test.js` (`--allow-natives-syntax`; **pinned to V8 14.6**) |
| 13 Pitfalls: prototype pollution, ReDoS, `lastIndex`, `v` flag, lossless JSON, money, dates, sorting; **version history ES2015 → ES2027** | `modules/13-…md` | `examples/13-…test.js` |
| Exams | `exams/README.md` (exam list, interview + JSA-41-01 matrices, exam delta, syllabus completeness vs the ECMA-262 ToC); `exams/interview.md` (73 questions: 67 across D1–D10 plus 6 hands-on; difficulty 14/41/18; Mock A interview screen, Mock B JSA-shaped 40 items/60 min) | `examples/exam-hands-on.test.js` + `examples/exam-solutions.js` (`SOLUTIONS=… node --test …`) |
| GLOSSARY (108 track terms + 8 root terms copied verbatim), CHEATSHEET, README (syllabus, run instructions, Certifications & Exams, "Verified against … on 2026-10-28") | track root | — |

**Tooling:** `package.json` (exact pins: TypeScript 7.0.2, @types/node 26.6.6, fast-check 4.10.2, esbuild 0.28.2), `package-lock.json`, `tsconfig.json` (strict, `erasableSyntaxOnly`, `allowJs`), `.mise.toml` (node 26.12.1), `examples/helpers/run-node.js` (spawns the same Node binary for flag- and goal-specific checks). No `test:integration`: nothing needs Docker.

**Test output at hand-off:** `npm test` → 333 tests, 80 suites, 333 pass, 0 fail (stable across repeated runs). `npm run typecheck` → 0 errors. Relative-link check: everything resolves except links to tracks not yet merged (nodejs, css, dsa, security-identity). Leak scan for absolute paths and e-mails: clean.

### Determinism policy
No test depends on a race manifesting or on wall-clock thresholds. Data-race tests assert only bounds (`plain ≤ expected`, `atomic === expected`); cross-agent tests use Atomics handshakes; concurrency is measured by peak in-flight counts; timer-based ordering relies only on timer expiry order. Two kinds of assertion are engine-specific but deterministic: the V8 GC tests (modules 03 and 09, `--expose-gc` + `gc()`) and the V8 intrinsics in module 12. The ReDoS test kills a child after 3 s on a ~2⁴⁰-step input, which cannot finish in that time.

### Verified facts (2026-10-28/29)
- ES2026 = ECMA-262 17th edition (June 2026). Section numbers were read from the 17.0 ToC.
- Node 26.12.1 / V8 14.6.202 ships Temporal, `using`/`DisposableStack`, Upsert, `Iterator.concat`, `JSON.rawJSON`, base64/hex, `Error.isError`, `Array.fromAsync`, `Atomics.pause`. It does **not** ship `Math.sumPrecise` (ES2026!) without `--js-sum-precise`, nor `Iterator.zip`/`chunks`. `import defer` needs `--js-defer-import-eval`; `--js-decorators` parses `accessor` only.
- Decorators and Decorator Metadata were moved from Stage 3 back to **Stage 2.7** at the May 2026 TC39 meeting (agenda "Decorators for Stage 2.7"; proposals README).
- **Dossier corrections:** iterator chunking, includes and join are Stage 4 (ES2027), not Stage 3. "Curtailing the power of Thenables" is at Stage 3. Signals: Stage 1. AsyncContext: Stage 2 (resolves the dossier's "unverified").
- JSNAD retired 2025-09-30; JSNSD inactive. JSA-41-01 (OpenEDG): 40 items, 60 min, US$325, Pearson VUE; section weights 25/23/27/25.
- `esvu`/`eshost-cli` maintenance was **not** verified; the track runs on the pinned Node only and says so (module 01 §7). This resolves the re-verify item as documentation-only.

### Brief vs AGENTS.md / prompt conflicts
- The brief asks the author to update STATUS.md; the authoring prompt forbids it. Not edited. Integrator: set `languages/javascript` to 🟨.
- The brief suggests a Node 24 matrix leg. Not done: the track teaches Node 26 behaviour, and several tests pin V8 14.6. See remaining work.

## Remaining work (ordered)
1. **`mise.lock`**: not generated (no mise binary in the authoring sandbox). Run `mise install && mise lock` in `languages/javascript/` and commit.
2. **Deepen modules toward the 400–900-line guideline.** Current lengths: 01 = 399, 02 = 427, 03 = 393, 04 ≈ 364, 05 = 278, 06 = 268, 07 = 284, 08 = 314, 09 = 269, 10 = 281, 11 = 240, 12 = 213, 13 = 238. The content is dense (tables, code), but candidates for expansion are: 06 (worked rendering-step examples, `scheduler.yield`/`postTask`), 11 (SAB-based ring buffer with invariants), 12 (worked megamorphism benchmark with a CPU profile), 13 (more security cases: `Function`/`eval` gadgets, `postMessage` origin checks).
3. **Exam bank:** add at least 5 class-specific questions so Mock B's Classes section no longer needs the fillers 010 and 014 (🟡 row in `exams/README.md`). Verify JSE-40-01 format details on the official OpenEDG page (fetch was rate-limited) or keep it marked unverified.
4. **Question anchors:** answers link to module files plus "§N" in text, not to `#anchor` slugs. Add anchors if the verifier's renderer confirms the slugs.
5. Optional Node 24 matrix leg: would need to skip the Node-26-only assertions (Temporal, `using`, V8 14.6 intrinsics) on Node 24.
6. Once the nodejs, css, dsa and security-identity tracks merge, re-run the link check (8 cross-track links are pending).

## Least-certain claims (for the challenger)
- ECMA-262 17th-edition section numbers came from an automated reading of the ToC. Spot-check §7.2.13 IsLooselyEqual, §9.6 Agents, §21.3.2.34 `Math.sumPrecise`, §23.3.1.1 `Uint8Array.fromBase64`, §20.5.2.1 `Error.isError`, §13.3.11 tagged templates.
- Module 01: "Temporal promoted to Stage 4 during 2026". The January 2026 notes still list Stage 3; the exact meeting was not confirmed. finished-proposals lists it for 2027.
- Module 06: the list and order of the HTML "update the rendering" sub-steps, and the claim that rendering is now a task on the rendering task source, were written from knowledge. The HTML page could not be fetched beyond 117k characters; Servo PR #31505 corroborates the task change. Verify against §8.1.7.3.
- Module 08: "Node support for Wasm source-phase imports is experimental"; "import assertions rejected since Node 22" (Node 26 rejection is tested; the starting version is not).
- Module 09: decorator application order is asserted against esbuild 0.28, not an engine; it may change while the proposal is at Stage 2.7.
- Module 12: the `%GetOptimizationStatus` TurboFan bit (1 << 5), dictionary mode after deleting the last-added property, and `new Array(n).fill(v)` being packed are V8 14.6 observations. The V8 blog titles and years in the sources list were cited from knowledge.
- Module 13: "V8 switched to TimSort in V8 7.0 (2018)" is from knowledge.
- Exams: the interview domain weights are the author's estimate (no official weights exist), stated as such.
- GLOSSARY: Czech equivalents for newer terms (job, microtask, live binding, TDZ, brand check, happens-before) follow developer usage with English in parentheses; a native-speaker review is advisable. Some glossary section refs point to overview sections.

## Proposals for integrator
- **Stable module filenames** for cross-links from other tracks: `01-reading-the-spec`, `02-types-values-coercion`, `03-execution-contexts-scope-closures` (stale closures), `04-objects-prototypes-classes`, `05-iterators-generators`, `06-agents-realms-job-queue` (**HTML event loop**, microtask batching), `07-async-in-depth`, `08-modules` (`exports` conditions), `09-metaprogramming` (Proxy for Solid stores), `10-resource-management-temporal`, `11-binary-data-memory-model` (`structuredClone`), `12-engine-internals-v8`, `13-correctness-security-pitfalls`.
- **OWNERSHIP.md:** register "AbortController/AbortSignal cancellation patterns, retry/backoff with jitter, bounded concurrency pools" under `languages/javascript` (module 07); currently unregistered. Also register "prototype pollution and ReDoS mechanics at the language level" as `languages/javascript` (module 13), with `technologies/nodejs` keeping Node-specific hardening (`--disable-proto`, permission model), to avoid a double owner with the existing Node-specific security row.
- **Root GLOSSARY candidates** (cross-cutting): Event Loop / Smyčka událostí; Coroutine / Korutina; Memory Model / Paměťový model; Data Race / Datový souběh (data race); Happens-Before; Sequential Consistency / Sekvenční konzistence; Compare-and-Swap (CAS); Just-in-Time Compilation (JIT); Inline Cache; Generational Garbage Collection; Weak Reference / Slabá reference. Definitions are in `languages/javascript/GLOSSARY.md`.
- **Open ownership question** (OWNERSHIP.md "testing theory"): this track uses property-based testing (fast-check) throughout but does not teach testing theory. Recommend keeping it unowned here or giving it to a dedicated module elsewhere.
- **Handovers:** the Node.js track should link to modules 06 (job queue vs `process.nextTick`), 08 (ESM semantics before the loader), 11 (Atomics for `worker_threads`). React/Solid should link to 03 §4 (stale closures), 06 §4 (batching primitives), 09 §1 (proxy reactivity), 11 §4 (structured clone vs Flight/seroval).
