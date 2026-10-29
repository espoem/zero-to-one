# Review: languages/javascript

## Hand-off (primary · Opus · in progress, last updated 2026-10-29)

Status: 🟦 authoring. Modules 01–07 done; modules 08–13, the exams, the glossary, the cheatsheet and the README are still to do.

### Done
| Module | File | Example / tests |
|---|---|---|
| 01 Reading the spec (notation, Completion/Reference Records, TC39 stages incl. 2.7, proposal snapshot, Node 26 support matrix, test262) | `modules/01-reading-the-spec.md` | `examples/01-reading-the-spec.test.js` (pins the engine support matrix) |
| 02 Types, values, coercion (8 types, IEEE 754, BigInt, UTF-16, Symbols, ToPrimitive/ToNumber/…, 4 equality algorithms, `+`, Neumaier pseudocode + invariant) | `modules/02-types-values-coercion.md` | `examples/02-…test.js` (fast-check: round-trip, ToInt32, SameValue) |
| 03 Execution contexts, scope, closures, `this`, strict mode, eval | `modules/03-…md` | `examples/03-…test.js` (V8 shared-Context leak proven via `--expose-gc` + WeakRef) |
| 04 Objects, prototypes, classes, exotic objects, copying | `modules/04-…md` | `examples/04-…test.js` (myNew, myInstanceof, override mistake, private names vs Proxy) |
| 06 Agents, realms, jobs, promise tick accounting, rejection tracking, **HTML event-loop processing model** | `modules/06-…md` | `examples/06-…test.js` + executable model `examples/06-event-loop-model.js` (starvation, rAF ordering) |
| 07 Async in depth: combinators, withResolvers/try, await desugaring, AbortSignal, pool, retry+jitter, debounce/throttle, AsyncContext status | `modules/07-…md` | `examples/07-…test.js` + `examples/07-async-utils.ts` (property tests vs Promise.all, peak-concurrency property) |
| 05 Iterators, generators, helpers, `Iterator.concat`, async iteration, `Array.fromAsync` | `modules/05-…md` | `examples/05-…test.js` (IteratorClose cases, co driver, `for await` crash in a child process) |

Tooling: `package.json` (TypeScript 7.0.2, @types/node 26.6.6, fast-check 4.10.2, esbuild 0.28.2, reserved for the module 09 decorator desugaring demo), `tsconfig.json`, `.mise.toml` (node 26.12.1), and `examples/helpers/run-node.js` (spawns the same Node binary for flag- and goal-specific checks).

Test output at the last commit: `npm test` → 198 tests, 198 pass, 0 fail. `npm run typecheck` → clean.

### Verified facts (2026-10-28/29)
- ES2026 is ECMA-262 17th edition (June 2026). Section numbers were taken from the 17.0 ToC.
- Node 26.12.1 / V8 14.6.202 ships Temporal, `using`/`DisposableStack`, Upsert, `Iterator.concat`, `JSON.rawJSON`, base64/hex, `Error.isError`, `Array.fromAsync` and `Atomics.pause`. **It does not ship `Math.sumPrecise` (ES2026) without `--js-sum-precise`**, nor `Iterator.zip` or `chunks`. `import defer` needs `--js-defer-import-eval`. `--js-decorators` parses `accessor` but not `@dec`.
- Decorators and Decorator Metadata were moved back from Stage 3 to **Stage 2.7** at the May 2026 TC39 meeting (agenda item "Decorators for Stage 2.7"; tc39/proposals README).
- Dossier correction: iterator chunking, includes and join are **Stage 4 (ES2027)**, not Stage 3. "Curtailing the power of Thenables" is now at Stage 3. Signals: Stage 1. AsyncContext: Stage 2.
- JSNAD was retired on 2025-09-30, and JSNSD is inactive (Linux Foundation pages). The only active proctored JS-core cert found is OpenEDG JS Institute **JSA-41-01**: 40 questions, 60 min, US$325, Pearson VUE. Domains: Classless Objects 25%, Classes 23%, Built-in Objects 27%, Advanced Functions 25%. Passing score not published on the voucher page. Its authority is low (InfoWorld 2026-04: no widely accepted JS cert authority). Plan: put the primary effort into `exams/interview.md` and map the JSA domains in the coverage matrix.

## Remaining work (ordered)
4. Module 08 modules (Module Records, Link/Evaluate, live bindings, cycles/TDZ, TLA, import attributes, `import.meta`, `import defer`/source phase, `exports` conditions at runtime; link to the nodejs track for the CJS loader and `require(esm)`), with fixtures under `examples/fixtures/08/`.
5. Module 09 metaprogramming (Proxy invariants, Reflect, well-known symbols, tagged templates, WeakMap/WeakRef/FinalizationRegistry, decorators runtime semantics shown via an esbuild transform, labelled Stage 2.7).
6. Module 10 explicit resource management & Temporal (ES2027).
7. Module 11 binary data, serialisation & memory model (ArrayBuffer resize/transfer, TypedArrays, base64, SAB/Atomics with worker_threads, `structuredClone` full treatment).
8. Module 12 V8 internals (`--allow-natives-syntax` tests, version-sensitive).
9. Module 13 correctness & security pitfalls, plus the version history table (ES2015 → ES2027).
10. `exams/README.md` (interview format + JSA-41-01 matrix) and `exams/interview.md` (≥60 questions, mock exam).
11. GLOSSARY.md (EN ↔ CZ), CHEATSHEET.md, README.md (syllabus, run instructions, Certifications & Exams, the "Verified against …" line).
12. `mise.lock`: not generated (no mise binary in the authoring sandbox). Run `mise install && mise lock` on a machine with mise.

## Least-certain claims (for the challenger)
- ECMA-262 17th edition section numbers came from an automated reading of the ToC. Spot-check §7.2.13 IsLooselyEqual, §9.6 Agents, §21.3.2.34 Math.sumPrecise, §23.3.1.1 Uint8Array.fromBase64 and §20.5.2.1 Error.isError.
- Module 01 says Temporal was "promoted to Stage 4 during 2026". The January 2026 notes still list it at Stage 3; the exact meeting was not confirmed.
- Module 03: the V8 shared-Context retention claim is engine-specific (it is tested on Node 26).
- Module 06: the list and order of the HTML "update the rendering" sub-steps, and the claim that rendering is now a task on the rendering task source, were written from knowledge. The HTML page could not be fetched past its first 117k characters; Servo PR #31505 corroborates the rendering-task change. Verify against §8.1.7.3.
- Cross-links to `../../../technologies/react/` and the future nodejs track will not resolve until those tracks merge.

## Proposals for integrator
- Cross-linking tracks should target these stable module filenames: `01-reading-the-spec`, `02-types-values-coercion`, `03-execution-contexts-scope-closures`, `04-objects-prototypes-classes`, `05-iterators-generators`, `06-agents-realms-job-queue` (HTML event loop), `07-async-in-depth`, `08-modules`, `09-metaprogramming`, `10-resource-management-temporal`, `11-binary-data-memory-model` (structuredClone), `12-engine-internals-v8`, `13-correctness-security-pitfalls`.
- STATUS.md: set `languages/javascript` to 🟦 (the author may not edit STATUS.md).
