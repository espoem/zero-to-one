# Brief: Node.js (`technologies/nodejs`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/nodejs` · `../zto-nodejs` |
| Depends on | languages/javascript |
| Research dossier | `.agents/research/C-runtimes.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- The JSNAD/JSNSD certifications were retired 2025-09-30. Use their former domain outlines plus the senior Node interview format; state the retirement in the README.
- Pin Node 26 (LTS from 2026-10-28). Add a "Then vs now" for the new yearly release model from v27.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- libuv phases, `process.nextTick`, threadpool, streams & backpressure, CJS loader, `require(esm)`, GC tuning flags
- Node runtime type stripping
- Node-specific security (permission model, prototype pollution, `vm` is not a sandbox, ReDoS)

**Cross-link only (do not re-explain):**
- Iterators, generators, async iteration, Promise/job-queue semantics (spec level) → owned by `languages/javascript`
- ESM semantics (Module Records, live bindings, TLA), `exports` conditions at runtime → owned by `languages/javascript`
- Shared memory, Atomics, JS memory model → owned by `languages/javascript`
- V8 shapes/ICs at the "why is my code slow" level → owned by `languages/javascript`
- Standard Schema, Zod typing of runtime boundaries → owned by `languages/typescript` (M11)
- Concurrency models, locks, data races, lock-free structures (language-neutral) → owned by `algorithms/dsa` (proposed extra module, TBD)
- Crypto primitives, password hashing, KDFs, AEAD, signatures → owned by `architecture/security-identity`
- Linux processes, signals, filesystems, namespaces, cgroups v2, overlayfs, seccomp → owned by `technologies/containers`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Node.js runtime — `technologies/nodejs`

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

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **Permission model: Stable** since v23.5/v22.13; `--permission`, `--allow-fs-read/write`, `--allow-net`, `--allow-child-process`, `--allow-worker`, `--allow-addons`, `--allow-wasi`, `--allow-ffi` (FFI builds only), `--permission-audit` mode, config-file `permission` block, `process.permission.drop()` — https://nodejs.org/api/permissions.html (docs page is latest-line; exact version where `--allow-net`/audit/drop landed = unverified).
- AsyncLocalStorage uses AsyncContextFrame by default since Node 24 (unverified from release notes in this pass; recalled from v24.0.0 notes).
- Retired JSNSD: Servers & Services ~70%, Security ~30% (unverified weights) — HTTP servers, RESTful services, proxies, input validation, attack mitigation (rate limits, DoS, injection).
- 3. **Modules & packages** — CJS loader (`Module._load`, cache, wrapper), ESM loader, `require(esm)`, `module.registerHooks`, package.json `exports`/`imports` (`#` subpaths)/`type`/conditions, dual-package hazard, npm/pnpm lockfiles & `npm ci`, corepack status (unverified), type stripping rules.
- 12. **Testing** — `node:test` (describe/it, mocks incl. `mock.timers`, `mock.module`, snapshots, coverage `--experimental-test-coverage` status unverified, reporters, `--test-isolation`), `assert/strict` deep equality semantics, test doubles for fs/net, Vitest as cross-link.
- Not locally provable deterministically: GC timing, deopt traces (V8-version-sensitive → snapshot per pinned Node), cluster load distribution (OS-dependent on macOS vs Linux) → docker compose `node:26-slim` leg for Linux-specific behavior (SO_REUSEPORT, cgroup memory, PID 1 signals). clinic `13.0.0` exists on npm but maintenance status unverified — prefer built-in `--cpu-prof` + speedscope/DevTools.

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
1. **Primary (Opus)** works on branch `track/nodejs` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(nodejs)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/nodejs.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/nodejs.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
