# C — Runtimes & languages: JavaScript core, Node.js, Python

Verified 2026-10-28. Sources: git tags (`git ls-remote` on github.com/nodejs/node, github.com/python/cpython), nodejs/Release `schedule.json`, python.org/downloads, tc39/proposals, PyPI/npm registries. Where a claim comes from secondary press only, it is marked.

---

### JavaScript / ECMAScript core — `languages/javascript`

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

### Node.js runtime — `technologies/nodejs`

- **Current stable version(s)** (verified via git tags + `src/node_version.h` + nodejs/Release `schedule.json`)
  - **Node 26.x** — released 2026-05-05; latest **26.12.1** (2026-10-21, still `NODE_VERSION_IS_LTS 0`); **scheduled LTS promotion 2026-10-28 (today)**, maintenance 2027-10-20, EOL 2029-04-30; V8 14.6 — https://github.com/nodejs/Release/blob/main/schedule.json , https://nodejs.org/en/blog/release/v26.0.0
  - **Node 24.x "Krypton"** — LTS; latest 24.22.1 (2026-10-21); entered Maintenance LTS 2026-10-20; EOL 2028-04-30; V8 13.6.
  - Node 22 "Jod" maintenance until 2027-04-30; Node 20 EOL 2026-04-30; Node 25 EOL 2026-06-01 — https://endoflife.date/nodejs
  - **Release-model change**: from Node 27, one major per year (April), every major becomes LTS (October), odd/even rule ends, new **Alpha** channel (27.x alphas from Oct 2026) — https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule (mirror fetched). Node 27 scheduled 2027-04-22, LTS 2027-10-20.
  - Node 26 notable: Temporal on by default, `Map#getOrInsert`, `Iterator.concat`, undici 8.0.2, removed `http.Server.prototype.writeHeader()` and `_stream_*` legacy modules, removed `--experimental-transform-types`, runtime-deprecated `module.register()` (→ `module.registerHooks()` sync hooks), NODE_MODULE_VERSION 147.
  - **Type stripping: Stability 2 – Stable** since v25.2.0/v24.12.0 (on by default since 23.6/22.18); erasable syntax only (no enums, runtime namespaces, parameter properties, import aliases); ignores tsconfig; `.tsx` unsupported; refuses TS under `node_modules` — https://nodejs.org/api/typescript.html
  - **Permission model: Stable** since v23.5/v22.13; `--permission`, `--allow-fs-read/write`, `--allow-net`, `--allow-child-process`, `--allow-worker`, `--allow-addons`, `--allow-wasi`, `--allow-ffi` (FFI builds only), `--permission-audit` mode, config-file `permission` block, `process.permission.drop()` — https://nodejs.org/api/permissions.html (docs page is latest-line; exact version where `--allow-net`/audit/drop landed = unverified).
  - AsyncLocalStorage uses AsyncContextFrame by default since Node 24 (unverified from release notes in this pass; recalled from v24.0.0 notes).
  - **Certifications: JSNAD and JSNSD were retired 2025-09-30** — https://training.linuxfoundation.org/certification/jsnad , https://training.linuxfoundation.org/certification/jsnsd . Use their domain lists as a syllabus anyway (below).
- **Authoritative syllabi used**
  - Node API docs ToC — https://nodejs.org/api/ ; Learn section (event loop, blocking vs non-blocking, diagnostics guides) — https://nodejs.org/en/learn
  - Retired JSNAD domains (weights): Buffers & Streams 11, Control Flow 12, Event Emitter 11, Child Processes 8, Error Handling 8, File System 8, JS Prerequisites 7, Module System 7, Diagnostics 6, Process & OS 6, package.json 6, Unit Testing 6, CLI 4 — https://platzi.com/cursos/nodejs-certificaciones-2023/dominios-y-pesos-del-examen-de-node-js/ (Control Flow 12% derived from the remainder).
  - Retired JSNSD: Servers & Services ~70%, Security ~30% (unverified weights) — HTTP servers, RESTful services, proxies, input validation, attack mitigation (rate limits, DoS, injection).
  - libuv design docs — https://docs.libuv.org/en/v1.x/design.html ; V8 blog (Orinoco, Maglev, Sparkplug, pointer compression) — https://v8.dev/blog
  - Node Security best practices & threat model — https://nodejs.org/en/learn/getting-started/security-best-practices , https://github.com/nodejs/node/blob/main/SECURITY.md
  - Books: "Node.js Design Patterns" 4e (Casciaro/Mammino), "Distributed Systems with Node.js" (Hunter).
- **Proposed modules**
  1. **Runtime architecture** — V8 + libuv + bindings + JS core lib; process lifecycle (bootstrap snapshot, `--import`, preload, `process.on('exit')`); CLI & `node.config.json` (`--config-file`), `--env-file`, `--watch`, `--run`; Node release lines & choosing LTS.
  2. **Event loop for real** — libuv phases (timers, pending, idle/prepare, poll, check, close); `process.nextTick` queue vs microtasks vs `setImmediate`; thread pool (`UV_THREADPOOL_SIZE`: fs, dns.lookup, crypto, zlib); blocking detection; `setTimeout` vs `setImmediate` ordering non-determinism in main module.
  3. **Modules & packages** — CJS loader (`Module._load`, cache, wrapper), ESM loader, `require(esm)`, `module.registerHooks`, package.json `exports`/`imports` (`#` subpaths)/`type`/conditions, dual-package hazard, npm/pnpm lockfiles & `npm ci`, corepack status (unverified), type stripping rules.
  4. **Async control flow & errors** — callbacks→promises→async/await, `events.once`, `EventEmitter` (sync emit!, `error` event, `captureRejections`, max listeners), AbortSignal everywhere, `util.promisify`, operational vs programmer errors, `uncaughtException`/`unhandledRejection` policy, `Error.cause`, AggregateError.
  5. **Buffers, streams & backpressure** — Buffer pooling & `allocUnsafe`, encodings; Readable/Writable/Duplex/Transform, `highWaterMark`, `write()` return value & `'drain'`, `pipeline()` + AbortSignal, object mode, async-iterator streams, Web Streams interop (`Readable.toWeb`), `stream/promises`.
  6. **File system, process & OS** — `fs/promises`, `FileHandle` leaks, `fs.watch` caveats, `glob`, signals (SIGTERM/SIGINT graceful shutdown), `child_process` (spawn/exec/execFile/fork, shell injection, stdio, IPC), env, exit codes.
  7. **Networking & HTTP** — `net`/TCP, `http`/`https`/`http2`, keep-alive agents, server timeouts (`headersTimeout`, `requestTimeout`, `keepAliveTimeout` vs LB idle timeout), undici/`fetch` internals & connection pools, TLS, DNS (`lookup` vs `resolve`), WebSocket client.
  8. **Building services** — Fastify 5 (schemas, hooks, encapsulation), validation, structured logging (pino), graceful shutdown & readiness, rate limiting, config, health checks, OpenTelemetry auto-instrumentation via `diagnostics_channel`. (JSNSD domain)
  9. **Concurrency & scaling** — `worker_threads` (MessagePort, transfer lists, SharedArrayBuffer/Atomics, resourceLimits), worker pools (piscina), `cluster` & SO_REUSEPORT vs round-robin, child processes vs workers vs containers, `node:sqlite`, CPU-bound offload.
  10. **V8 internals & memory** — tiers (Ignition/Sparkplug/Maglev/Turbofan), hidden classes & ICs, deopts; heap spaces (new/old/large/code), Scavenger + Mark-Compact, Orinoco parallel/concurrent/incremental marking; `--max-old-space-size`, `--max-semi-space-size`, container memory awareness; pointer compression; external memory (Buffers).
  11. **Diagnostics & performance** — `--inspect`/Chrome DevTools, `--cpu-prof`, `--heap-prof`, heap snapshots (`v8.writeHeapSnapshot`, `--heapsnapshot-near-heap-limit`), diagnostic report, `perf_hooks` (`monitorEventLoopDelay`, ELU), `AsyncLocalStorage`/AsyncContextFrame, `async_hooks` (legacy/discouraged), `diagnostics_channel`, `tracing_channel`, flamegraphs (0x, clinic), load testing (autocannon), `--trace-gc`.
  12. **Testing** — `node:test` (describe/it, mocks incl. `mock.timers`, `mock.module`, snapshots, coverage `--experimental-test-coverage` status unverified, reporters, `--test-isolation`), `assert/strict` deep equality semantics, test doubles for fs/net, Vitest as cross-link.
  13. **Security** — threat model (Node trusts code it runs), permission model (seat-belt, not sandbox), supply chain (lockfiles, `npm audit signatures`, provenance, install scripts, `--ignore-scripts`), prototype pollution, ReDoS, path traversal, SSRF via fetch, `child_process` injection, HTTP request smuggling/timeouts, security release cadence, `vm` is not a sandbox.
  14. **Production operations** — containers (PID 1 & signals, `--init`/tini), memory limits & OOMKilled vs heap OOM, SEA (single executable apps), source maps (`--enable-source-maps`), upgrade strategy across LTS lines, observability SLOs (event-loop lag).
- **Gotchas & production failure modes**
  - Sync work in a request handler (`JSON.parse` of 50 MB, `crypto.pbkdf2Sync`, `fs.readFileSync`) stalls all requests — event-loop lag spikes, p99 explodes.
  - Recursive `process.nextTick`/microtask chains starve I/O (poll phase never reached).
  - Default thread pool of 4: slow `dns.lookup` (getaddrinfo) or bcrypt hashing starves `fs` operations → "random" fs latency.
  - Ignoring `write()` → `false` (no backpressure) ⇒ unbounded memory growth; `.pipe()` doesn't forward errors or destroy — use `stream.pipeline`.
  - `keepAliveTimeout` (5 s default) shorter than the AWS ALB idle timeout (60 s) ⇒ sporadic 502s; set server timeout > LB timeout.
  - `EventEmitter` `'error'` with no listener throws and crashes the process; `emit` is synchronous (slow listeners block emitter).
  - Unhandled promise rejection ⇒ process exit (since Node 15) — surfaces as crash loops after a dependency upgrade.
  - `--max-old-space-size` not set in a container ⇒ V8 heap limit vs cgroup limit mismatch ⇒ OOMKilled with no heap snapshot; Buffers live outside the V8 heap (external memory).
  - Node as PID 1 in Docker ignores SIGTERM ⇒ 10 s kill, dropped in-flight requests; `npm start` wrapper doesn't forward signals.
  - `cluster`/multiple workers each holding an in-memory cache/rate limiter ⇒ inconsistent state; use Redis.
  - `AsyncLocalStorage` context lost across custom thenables/callback-based pools ⇒ wrong request IDs in logs.
  - `require(esm)` throws `ERR_REQUIRE_ASYNC_MODULE` when the ES module (graph) uses top-level await.
  - Dual-package hazard: CJS and ESM copies of the same library loaded ⇒ two singletons, `instanceof` fails.
  - `child_process.exec` with interpolated user input ⇒ shell injection; `exec` buffers output and dies at `maxBuffer`.
  - `fs.watch` duplicates/misses events on macOS vs Linux; `setTimeout` > 2^31-1 ms fires immediately.
  - Permission model bypasses: existing fds, symlinks outside granted paths, `--env-file` read before init — not a sandbox for untrusted code.
  - `Buffer.allocUnsafe` exposes old memory if not fully overwritten.
  - Type stripping: `import { Type }` without `type` keyword ⇒ runtime `SyntaxError` (missing export); enums ⇒ `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
- **Interview hot topics**
  - Event loop phases; predict `nextTick`/`Promise`/`setImmediate`/`setTimeout` ordering (in main vs inside I/O callback).
  - Why Node is single-threaded yet concurrent; what runs on the thread pool.
  - Streams & backpressure; implement a Transform; `pipeline` vs `pipe`.
  - worker_threads vs cluster vs child_process; when to use each.
  - Debugging a memory leak (heap snapshot comparison, retainers) and a CPU hot path (flamegraph).
  - Graceful shutdown in Kubernetes.
  - CJS vs ESM in Node, `exports` field, `require(esm)`.
  - Error handling strategy & unhandled rejections.
  - Securing a Node service (supply chain, input validation, permission model limits, ReDoS, SSRF).
  - V8 GC generations & hidden classes — "why is this code slow".
  - AsyncLocalStorage for request context; costs.
- **Executable-proof strategy**
  - `.mise.toml`: `node = "26.12.1"` (bump to first 26 LTS patch) + CI matrix leg `24.22.1`; examples in TS run directly via type stripping (`node --test 'examples/**/*.test.ts'`), TypeScript only for `tsc --noEmit` (pin `typescript` per TS track; npm latest 7.0.2).
  - Deterministic event-loop tests: record order into arrays; run main-module ordering cases in a child process; `mock.timers` for timeouts.
  - Streams/backpressure: assert `write()` returns false at `highWaterMark`, memory bounded with a slow consumer (`process.memoryUsage` bounds loose, or count chunks in flight).
  - HTTP: in-process servers on port 0 + `fetch`; timeout/keep-alive behavior with fake slow clients (`net.connect` writing partial headers) — negative tests for `headersTimeout` 408.
  - Permission model: spawn `node --permission --allow-fs-read=./fixtures` and assert `ERR_ACCESS_DENIED` exit; audit mode via `diagnostics_channel` subscription.
  - Diagnostics: produce heap snapshot with `v8.writeHeapSnapshot()` and assert retained object count via parsing (or `v8.getHeapStatistics` deltas); `--cpu-prof` file existence; `monitorEventLoopDelay` assertion under a deliberate block.
  - Load tests: `autocannon@8.0.0` (npm) for local benchmarks — non-deterministic, run manually / report-only, not in CI gates.
  - Fastify `5.12.7` with `inject()` (no network) for service tests; undici `8.x` `MockAgent` for outbound HTTP.
  - Graceful shutdown: spawn server, send SIGTERM, assert in-flight request completes and exit code 0.
  - Not locally provable deterministically: GC timing, deopt traces (V8-version-sensitive → snapshot per pinned Node), cluster load distribution (OS-dependent on macOS vs Linux) → docker compose `node:26-slim` leg for Linux-specific behavior (SO_REUSEPORT, cgroup memory, PID 1 signals). clinic `13.0.0` exists on npm but maintenance status unverified — prefer built-in `--cpu-prof` + speedscope/DevTools.
- **Overlaps / dedupe**
  - Cross-link to **`languages/javascript`** for: microtask semantics (spec), closures, ESM spec semantics, Atomics memory model, Temporal, `using`.
  - Cross-link to TypeScript track for tsconfig/`erasableSyntaxOnly`; this track only covers Node's runtime stripping rules.
  - Cross-link to Redis/SQL tracks for client pooling details; to Docker/Kubernetes track for container signals, probes, cgroup limits; to an Observability track (OpenTelemetry) if it exists; to a Security/AppSec track for OWASP generics.
  - Deno 2.x / Bun 1.x: cross-link appendix only (compat matrix, permission model comparison) — no modules.

---

### Python — `languages/python`

- **Current stable version(s)** (python.org/downloads + cpython git tags)
  - **Python 3.15** — 3.15.0 released 2026-10-09 (slipped from early Oct; beta 1 postponed to 2026-05-07 per secondary press); latest **3.15.2 (2026-10-25)**; bugfix until 2031-10 — https://www.python.org/downloads/ , https://docs.python.org/3.15/whatsnew/3.15.html
  - **Python 3.14** — latest 3.14.10 (2026-10-25), bugfix; 3.13/3.12/3.11 security-only; **3.10 EOL 2026-10**. 3.16 planned 2027-10-06.
  - 3.15 highlights: PEP 810 explicit lazy imports (`lazy import x`), PEP 814 `frozendict`, PEP 661 `sentinel`, **PEP 686 UTF-8 default encoding**, PEP 798 unpacking in comprehensions, PEP 799 `profiling` package with **Tachyon sampling profiler** (`profile` module deprecated → removal 3.17), PEP 829 startup config files, PEP 831 frame pointers on by default, upgraded experimental JIT, typing PEP 728 (TypedDict extra items), PEP 747 `TypeForm`, PEP 800 disjoint bases, `asyncio.TaskGroup.cancel()`, stable ABI for free-threading `abi3t` (PEP 803/820/793).
  - 3.14 highlights: PEP 649/749 deferred annotations (`annotationlib`), PEP 750 t-strings, PEP 734 `concurrent.interpreters` + `InterpreterPoolExecutor`, **PEP 779 free-threading officially supported**, PEP 784 `compression.zstd`, PEP 768 `sys.remote_exec`, `python -m asyncio ps/pstree`, tail-call interpreter, PEP 758/765. **Surprise: incremental GC shipped in 3.14.0–3.14.4 was reverted in 3.14.5** back to 3.13-style generational GC — https://docs.python.org/3.14/whatsnew/3.14.html
  - **Free-threading status**: still a separate, optional build (not default) in 3.15; macOS installers now install it by default alongside; single-thread overhead ~1% (macOS arm64) to ~8% (x86-64 Linux); importing a non-FT-marked C extension re-enables the GIL with a warning (`PYTHON_GIL`, `-X gil`) — https://docs.python.org/3.15/howto/free-threading-python.html . No date for making it default.
  - Tooling (PyPI, 2026-10-27/28): uv 0.13.6, ruff 0.17.3, pytest 9.2.0, pytest-asyncio 1.4.1, hypothesis 6.170.12, mypy 2.4.0, pyright 1.1.414, ty 0.0.93 (Astral type checker, still 0.0.x preview).
- **Authoritative syllabi used**
  - Python Language Reference (data model §3, execution model §4, import system §5) — https://docs.python.org/3.15/reference/
  - Library reference & HOWTOs (descriptors, free-threading, asyncio, logging) — https://docs.python.org/3.15/howto/
  - Typing spec — https://typing.python.org/en/latest/spec/ ; PEP index — https://peps.python.org/
  - CPython Developer's Guide + internals docs (`InternalDocs/` in repo: interpreter, GC, frames, exception table) — https://devguide.python.org/ , https://github.com/python/cpython/tree/main/InternalDocs
  - Packaging: PyPA guide (pyproject, PEP 621/517/518/660, PEP 751 `pylock.toml`) — https://packaging.python.org/ ; uv docs — https://docs.astral.sh/uv/
  - Certs: Python Institute PCEP-30-02 / PCAP-31-03 / PCPP1 (PCPP-32-101) — https://pythoninstitute.org/certification-roadmap (current exam codes unverified this pass; low signal for senior roles — use only to check coverage of basics/OOP/stdlib).
  - Books: "Fluent Python" 2e (Ramalho), "CPython Internals" (Shaw), "Architecture Patterns with Python", "High Performance Python" 3e.
- **Proposed modules**
  1. **Execution model & tooling baseline** — CPython vs PyPy/GraalPy; `uv` (python install, venvs, `uv run`, lock, workspaces, tools/`uvx`), `pyproject.toml`, ruff (lint+format), interpreter startup, `-X` options, REPL; versions & support policy (PEP 602 annual).
  2. **Names, scopes, objects** — everything is an object, identity/equality/hash, mutability, LEGB & `nonlocal`, closures & late binding, default-argument trap, comprehension scopes, PEP 649 lazy annotations, `sentinel`.
  3. **Data model** — dunder protocols (`__eq__/__hash__`, `__len__`, `__iter__`, `__getitem__`, `__enter__/__exit__`, numeric reflected ops, `__format__`), attribute lookup order, `__slots__`, `__init_subclass__`, `__class_getitem__`, `frozendict`, dataclasses & `attrs`.
  4. **Descriptors, metaclasses & attribute machinery** — data vs non-data descriptors, `property`/`classmethod`/`staticmethod`/functions as descriptors, `__set_name__`, `__getattr__` vs `__getattribute__`, MRO (C3), `super()`, metaclasses vs class decorators vs `__init_subclass__`, ABCs.
  5. **Iteration, generators & context managers** — iterator protocol, generator internals (frame suspension), `yield from`, `send/throw/close`, itertools, `contextlib` (`ExitStack`, `contextmanager`), exception groups & `except*`, PEP 758/765.
  6. **Typing** — gradual typing, mypy/pyright/ty, PEP 695 generics & `type` aliases, PEP 696 defaults, variance inference, Protocols (structural), TypedDict (`ReadOnly`, extra items PEP 728), `ParamSpec`/`Concatenate`, `TypeVarTuple`/`Unpack`, `Self`, `Never`, `TypeIs`/`TypeGuard`, overloads, `TypeForm`, runtime annotations via `annotationlib`, t-strings & `Template` typing.
  7. **Imports & packaging** — import system (finders/loaders, `sys.modules`, `__init__` side effects, circular imports), lazy imports PEP 810, namespace packages, building wheels (hatchling/uv_build), entry points, versioning & resolver, lockfiles (`uv.lock`, `pylock.toml`), private indexes, publishing with trusted publishing.
  8. **CPython internals** — compile pipeline (tokenizer→PEG parser→AST→symtable→bytecode), `dis`, specializing adaptive interpreter (PEP 659), frames, exception tables, refcounting & immortal objects, cyclic GC (generations; 3.14 incremental GC revert), memory allocator (pymalloc/mimalloc), JIT (copy-and-patch) & tail-call interpreter.
  9. **Concurrency: GIL, threads, processes, subinterpreters** — what the GIL protects; free-threaded build (biased refcounting, per-object locks, `Py_GIL_DISABLED`, `sys._is_gil_enabled()`, C-extension readiness), `threading`, `concurrent.futures`, `multiprocessing` (spawn vs fork vs forkserver default changes), `concurrent.interpreters`, choosing the model.
  10. **asyncio internals** — event loop, coroutines vs tasks vs futures, `TaskGroup` (+`cancel()`), structured concurrency, cancellation semantics (`CancelledError`, `uncancel`), timeouts (`asyncio.timeout`), `contextvars`, executors for blocking calls, uvloop, introspection (`asyncio ps/pstree`), backpressure with streams/queues (`Queue.shutdown`).
  11. **Testing** — pytest (fixtures scopes, parametrization, markers, `tmp_path`, `monkeypatch`, plugins), pytest-asyncio modes, Hypothesis property-based testing, coverage, mocking pitfalls (`autospec`), snapshot testing, testing free-threaded builds (`pytest-run-parallel`, unverified).
  12. **Performance & profiling** — `profiling.sampling` (Tachyon) / `profiling.tracing`, py-spy, `tracemalloc`, memray, `timeit`/pyperf; algorithmic wins, vectorization (NumPy), Cython/mypyc/Rust (PyO3) extensions, `__slots__`, string building, avoiding attribute lookups; frame pointers & `perf`.
  13. **Production Python** — logging config, settings, UTF-8 default mode (PEP 686) migration, signal handling, fork-safety, Docker images (uv in containers, `--compile-bytecode`), security (pickle, `eval`, `subprocess` shell, `yaml.load`, supply chain, `sys.remote_exec` hardening), upgrade strategy across minors.
- **Gotchas & production failure modes**
  - Mutable default argument `def f(x=[])` shared across calls.
  - Late-binding closures in loops (`lambda: i`) all see last `i`.
  - Defining `__eq__` without `__hash__` makes instances unhashable (`__hash__ = None`).
  - Calling a blocking function (`requests.get`, `time.sleep`, sync DB driver) inside `async def` freezes the whole event loop.
  - Fire-and-forget `asyncio.create_task()` without keeping a reference ⇒ task may be garbage-collected mid-flight.
  - Swallowing `CancelledError` (bare `except Exception` is fine since 3.8, but `except BaseException`/`finally: return`) breaks cancellation and TaskGroup shutdown.
  - `multiprocessing` with `fork` after threads exist ⇒ deadlocks (inherited held locks); default start method on Linux changed from `fork` (3.14 → `forkserver`, unverified exact version) breaks code relying on inherited globals.
  - Free-threaded build: importing one non-FT C extension silently re-enables the GIL (only a warning) ⇒ no speedup; plus data races in pure-Python code that "worked" under the GIL (e.g., check-then-act on dicts/lists).
  - PEP 686: code relying on locale encoding (cp1252 on Windows) now reads UTF-8 in 3.15 ⇒ `UnicodeDecodeError` / mojibake on legacy files.
  - `isinstance(x, dict)` is False for `frozendict` ⇒ validation code rejects it; use `collections.abc.Mapping`.
  - Circular imports surface as `ImportError: cannot import name … (most likely due to a circular import)` / partially initialized module; lazy imports can move the failure to first use (later, in production path).
  - `pickle.loads`/`yaml.load` on untrusted input ⇒ RCE.
  - `datetime.utcnow()` naive datetimes (deprecated) compared with aware ones ⇒ `TypeError` or silent off-by-hours.
  - Memory "leak" from reference cycles with `__del__`, or from `functools.lru_cache` on methods holding `self`.
  - Float `round(2.5) == 2` (banker's rounding); `Decimal` for money.
  - Unpinned transitive deps / no lockfile ⇒ broken deploys; `pip install` into system Python; `uv sync --frozen` in CI.
  - 3.14.0–3.14.4 incremental GC memory-pressure regression — pin ≥ 3.14.5.
- **Interview hot topics**
  - GIL: what it is, why, free-threading (PEP 703/779) trade-offs; threads vs processes vs asyncio vs subinterpreters.
  - Descriptors & how `@property`/methods bind; MRO & `super()`.
  - Metaclasses vs class decorators vs `__init_subclass__`.
  - Generators & lazy evaluation; implement an iterator/context manager.
  - asyncio: event loop, task cancellation, structured concurrency, blocking-call detection.
  - Memory management: refcounting + cyclic GC; `__slots__`; weakref.
  - Typing: Protocol vs ABC, variance, generics PEP 695, `TypeVarTuple`.
  - Mutability/identity traps (default args, `is` vs `==`, int caching).
  - Packaging & dependency management (uv, lockfiles, wheels).
  - Profiling a slow Python service; when to drop to C/Rust.
  - What's new in 3.13/3.14/3.15 (JIT, FT, t-strings, lazy imports).
- **Executable-proof strategy**
  - `.mise.toml`: `python = "3.15.2"`, plus `python = "3.15.2t"`/free-threaded variant leg (mise/uv support for `3.15t` via python-build-standalone — `uv python install 3.15t` verified naming unverified), `uv = "0.13.6"`; project via `uv init`, `uv sync --frozen`, `uv run pytest`.
  - pytest 9.2 + pytest-asyncio 1.4 (strict mode) + Hypothesis for property tests; negative tests with `pytest.raises(..., match=...)`; `pytest.warns` for deprecations; `-W error` in CI.
  - Internals made deterministic: `dis` output snapshot tests per pinned minor (bytecode changes each minor — tie snapshot to `sys.version_info[:2]`); `sys.getrefcount` deltas; `gc.get_referrers`/`gc.collect()` returns; `tracemalloc` snapshot diffs with tolerances.
  - Free-threading proof: test that runs CPU-bound threads and asserts `sys._is_gil_enabled() is False` on the `t` build and speedup ratio > 1.5 (mark `slow`, skip on GIL build); data-race demo asserting non-determinism via repeated runs is flaky ⇒ make it a script, not a gate.
  - asyncio: deterministic ordering with `asyncio.Event`s; cancellation tests; blocking detection via `loop.slow_callback_duration` + debug mode log capture (`caplog`).
  - Typing: `mypy --strict` and `pyright` runs as tests over `examples/typing/` with expected-error files (`# type: ignore[...]` / `reveal_type` + `assert_type`); "negative" typing cases checked by expecting specific error codes (pyright `--outputjson` parsed in pytest).
  - Profiling: `python -m profiling.sampling` producing collapsed stacks — assert hot function appears in top N (tolerant); not CI-gating.
  - Packaging: build a wheel with `uv build` and install into a temp venv, import entry point (fully local, no network with `--offline` after cache warmup).
  - Not provable locally / flaky: real multi-core speedup on shared CI runners, JIT effects (experimental, build-dependent), Windows-encoding behavior (run PEP 686 demo by forcing `PYTHONUTF8=0` + `encoding='locale'` with `LC_ALL=C` instead).
- **Overlaps / dedupe**
  - Shared **`languages/javascript`** concepts are analogues only (closures, event loop) — write a short "JS ↔ Python" comparison table in Python README; don't duplicate.
  - asyncio vs Node event loop: Node track owns libuv; Python track owns asyncio; a shared "concurrency models" foundation page (e.g., `foundations/concurrency`, if the curriculum has one) should own threads/processes/async theory, locks, memory models, data races.
  - SQL/Redis tracks own DB drivers & pooling (cross-link SQLAlchemy/asyncpg/redis-py usage only).
  - Data/ML (NumPy/pandas) out of scope — cross-link if a data track exists.
  - Docker/CI tracks own container builds & GitLab CI; Python track just gives the uv-in-Docker recipe.
  - Testing philosophy (test pyramid, property-based testing theory) → shared testing foundation if present; this track owns pytest/Hypothesis mechanics.
