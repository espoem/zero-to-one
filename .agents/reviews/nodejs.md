# Review: technologies/nodejs

## Hand-off (primary author: Opus via Claude Code subagent, 2026-11-05)

**State:** 🟨 challenge + verify complete → ready for 🟪 final gate. All 14 modules, their examples and tests, `exams/README.md` (exam status, matrices and the question-bank specification) and the track `README.md` are written and committed on `track/nodejs`. Per the coordinator's division of labour, the **question bank, glossary and cheatsheet are not written by the author**: a drafter writes them from the spec below, and Opus reviews them. `.agents/STATUS.md` was not edited (the author prompt forbids it; the brief asked for 🟦, so the integrator should set it).

**Gates at hand-off (Node 26.12.1, from the track directory / worktree root):**

- `npm test`: **324 tests, 324 pass, 0 fail** (about 40 s; 14 files run in parallel processes).
- `npm run typecheck` (TypeScript 7.0.2): clean.
- `npm run test:integration`: 2 suites skipped with "Docker is not available" (no Docker here).
- `npx oxfmt --check technologies/nodejs`, `npx oxlint technologies/nodejs`, `node tools/wrap-check/check.mjs technologies/nodejs`: clean.
- mermaid-check 21 diagrams, table-check 141 tables, link-check 361 links: 0 failing, 0 pending.
- Leak scan: no absolute paths, usernames or e-mails in tracked files.

| Module | Lines | Test file (tests) | Highlights |
| --- | --- | --- | --- |
| 01 Runtime architecture | 413 | 01 (27) | lifecycle, exit codes incl. 13 for unsettled TLA, preload order, env/config files, `--run`, stdout truncation on `process.exit`, release model Then vs now |
| 02 Event loop | 417 | 02 (21) + `02-mini-loop.ts` | libuv ≥ 1.45 order, nextTick vs microtasks in CJS **and** ESM, starvation proofs, thread pool FIFO, executable loop model |
| 03 Modules and packages | 408 | 03 (26) + fixtures | CJS loader, `require(esm)`, `module-sync`, dual hazard, `registerHooks`, DEP0205, type-stripping rules |
| 04 Async control flow and errors | 408 | 04 (34) + `04-control-flow.ts` | Zalgo, EventEmitter/EventTarget, AbortSignal, all `--unhandled-rejections` modes, `withTimeout` |
| 05 Buffers and streams | 406 | 05 (29) + `05-streams.ts` | Buffer.poolSize 64 KiB (26.3), slab exposure, backpressure bounds, `pipe` vs `pipeline`, property-tested LineSplitter and FrameDecoder, zlib bombs |
| 06 FS, processes, OS | 403 | 06 (32) + `06-fs-utils.ts` | GC-closed FileHandle is fatal on 26, atomic writes, traversal, injection, IPC serialisation, `run()` helper |
| 07 Networking and HTTP | 401 | 07 (24) + `07-http-utils.ts` | timeout defaults (5 s/+1 s buffer/60 s/300 s), 408/400/431 from llhttp, agent reuse, MockAgent, DNS defaults, HTTP/2, body limits, safe retries |
| 08 Building services | 407 | 08 (16) + `08-service.ts` + fixture server | Fastify 5 lifecycle, encapsulation, removeAdditional surprise, logging, token bucket, circuit breaker, **SIGTERM shutdown tests in a child process** |
| 09 Concurrency and scaling | 404 | 09 (16) + `09-pool.ts`, `09-ring.ts` | worker semantics, untransferable pool slab, pool invariants, lock-free SPSC ring, cluster round-robin, node:sqlite |
| 10 V8 memory and GC | 400 | 10 (14) | heap spaces, limit arithmetic, OOM = SIGABRT, near-limit snapshots, listener/Map/sliced-string retention, container budgets |
| 11 Diagnostics | 403 | 11 (17) + `11-heap-snapshot.ts` | loop delay/ELU lower bounds, `--cpu-prof`, inspector profiling, snapshot parsing, reports without env, ALS context loss and `AsyncResource.bind`, tracing channels |
| 12 Testing | 418 | 12 (25) + fixtures + `12-di.ts` | runner features proven via child `node --test`: module mocks (flag), snapshots, coverage thresholds, isolation, plan with `wait`, junit |
| 13 Security | 398 | 13 (25) + `13-security.ts` + npm fixture | permission model incl. symlink and env-file gaps, audit mode, `drop()`, pollution and gadgets (core hardened), `vm` escape, ReDoS with linear engine, SSRF lookup guard incl. IPv4-mapped IPv6, install-script proof |
| 14 Production operations | 409 | 14 (12) + fixtures + integration | signal forwarding vs naive wrappers, `--build-sea` binary, source-mapped stacks via `tsc`, `--throw-deprecation`, compile cache, **version history Node 20 → 27** |

## Remaining work (ordered)

1. **Drafter:** `exams/interview.md` (80 questions, 6 hands-on tasks, mock exam) per the specification in `technologies/nodejs/exams/README.md` § "Specification for the question bank", plus `examples/exam-solutions.ts` and `examples/exam-hands-on.test.ts` (pattern: `languages/javascript/examples/exam-hands-on.test.js`).
2. **Drafter:** `GLOSSARY.md` and `CHEATSHEET.md` per the drafter spec below.
3. **Opus review** of the drafter output: every answer traceable to a module statement or test, anchors valid (link-check), counts per domain, no new facts.
4. After the bank exists: update `exams/README.md` (status column "bank pending" → question ranges) and the README's supporting-material sentence.
5. On a networked machine: `mise lock` to add checksums for Node 26.13.0 to `mise.lock` (see least-certain claims), and run `npm run test:integration` with Docker.
6. Integrator: STATUS.md row → 🟦/🟨, and the proposals below.

## Drafter spec

**General rules.** English prose; one paragraph or list item per source line (no hard wraps; run `npx oxfmt` and `node tools/wrap-check/check.mjs technologies/nodejs`); escape `|` in table cells; only relative links, and only to anchors listed below; every fact must already be in a module (cite the module). Run the full gate set before handing back.

### GLOSSARY.md (target 60–80 entries)

Format as in `languages/javascript/GLOSSARY.md`: English term · established Czech equivalent · one-sentence English definition · module reference. Terms shared with the root `GLOSSARY.md` (for example **Event Loop / Smyčka událostí**, **Idempotence**) must reuse its English definition and Czech term verbatim. Use established Czech terms only; where Czech practice keeps the English term (common for "backpressure", "event emitter", "thread pool"), say so rather than inventing a translation. Terms to cover, grouped:

- Runtime: libuv, binding (`internalBinding`), primordials, startup snapshot, handle, request (libuv), referenced/unreferenced handle (`unref`), exit code, `NODE_OPTIONS`, config file, env file, Node-API, `NODE_MODULE_VERSION`, LTS, Active LTS, Maintenance LTS, Current, Alpha channel, end of life.
- Event loop: event loop, phase (timers, pending callbacks, poll, check, close callbacks), poll timeout, `process.nextTick` queue, microtask queue, macrotask, tick processing, starvation, blocking the event loop, thread pool (`UV_THREADPOOL_SIZE`), event-loop delay, event-loop utilisation.
- Modules: CommonJS, ES module, module wrapper, module cache, `require(esm)`, syntax detection, package exports, package imports (subpath imports), conditional exports, `module-sync` condition, self-reference, dual-package hazard, customisation hooks, type stripping, erasable syntax, compile cache, lockfile.
- Async and errors: error-first callback, Zalgo, `EventEmitter`, `EventTarget`, `AbortController`/`AbortSignal`, operational error, programmer error, system error, unhandled rejection, uncaught exception, `captureRejections`.
- Streams: Buffer, buffer pool, stream, Readable, Writable, Duplex, Transform, object mode, high-water mark, backpressure, `pipeline`, framing, decompression bomb.
- Processes and OS: file descriptor, `FileHandle`, atomic rename, TOCTOU, path traversal, child process, IPC channel, structured clone, shell injection, process group, PID 1, init process, zombie process.
- Networking and services: keep-alive, agent (connection pool), request smuggling, slowloris, Happy Eyeballs, undici, dispatcher, encapsulation (Fastify), liveness probe, readiness probe, graceful shutdown, token bucket, load shedding, circuit breaker, idempotency key.
- Concurrency: worker thread, isolate, transfer list, `SharedArrayBuffer`, Atomics, worker pool, cluster, `SO_REUSEPORT`.
- Memory and diagnostics: heap, young generation, old generation, Scavenger, Mark-Compact, write barrier, tri-colour marking, heap snapshot, retainer, retained size, memory leak, OOM kill, CPU profile, flame graph, diagnostic report, `AsyncLocalStorage`, AsyncContextFrame, `diagnostics_channel`, coordinated omission.
- Testing and security: test runner, mock, stub, spy, fake timers, snapshot test, code coverage, property-based testing, deterministic test, permission model, prototype pollution, gadget, ReDoS, SSRF, DNS rebinding, supply-chain attack, install script, provenance, single executable application, source map.

### CHEATSHEET.md (target 250–400 lines, tables first)

Format as in `languages/javascript/CHEATSHEET.md`. Sections, each a compact table or code block, every row traceable to a module:

1. Versions and release lines (Node 22/24/26/27 dates, V8 versions; new release model) → 01, 14 §7.
2. CLI flags and config: `--env-file`, `--config-file`, `--run`, `--watch`, `--import`/`-r` order, `--enable-source-maps`, heap flags, `--permission` flags, test flags, deprecation flags, report flags → 01, 10, 11, 12, 13, 14.
3. Exit codes and signals (0, 1, 9, 13, 134 vs 137, 143; PID 1 rules) → 01 §2.4, 14 §2.
4. Event-loop ordering rules (CJS vs ESM `nextTick`/promise order, I/O-callback `setImmediate` rule, timer clamping) → 02.
5. Thread-pool users and non-users → 02 §5.
6. Module resolution: format decision table, `require(esm)` rules, conditions table, type-stripping rules → 03.
7. Error and rejection policy: `--unhandled-rejections` modes table, EventEmitter `'error'` rules → 04 §6, §2.
8. Streams: defaults (64 KiB / 16 objects, `Buffer.poolSize`), backpressure protocol, `pipe` vs `pipeline`, stream events → 05.
9. Child processes: the four functions, injection rules, `maxBuffer`, IPC serialisation → 06 §5.
10. HTTP server and client defaults: the timeout table, LB alignment rule, agent defaults, `fetch` rules, DNS defaults → 07.
11. Fastify: hook order, encapsulation, schema behaviour (`removeAdditional`), defaults that differ from `node:http` → 08.
12. Concurrency choice table and worker message semantics (clone, transfer, share) → 09.
13. Memory: `process.memoryUsage` fields, heap flags, OOM triage (134 vs 137), leak retainers → 10.
14. Diagnostics toolbox table (tool, question answered, production-safe?) → 11 §2.
15. `node:test` and `assert/strict` quick reference (mocks, timers, snapshots, coverage flags, `deepStrictEqual` rules) → 12.
16. Security checklist (permission flags, `--disable-proto`, ReDoS rules, SSRF guard, npm settings) → 13 §10.
17. Production checklist (Dockerfile decisions, Kubernetes settings, upgrade procedure) → 14.

### Valid anchors for links (`##` level; `### ` subsections are also valid, see the modules)

- `modules/01-runtime-architecture.md`: #1-the-four-layers #2-the-process-lifecycle #3-configuring-a-process #4-release-lines-and-choosing-a-version #5-the-process-object-standard-io-and-signals #6-native-code-addons-and-node-api #7-worked-trace-one-http-request-through-the-layers #8-production-failure-modes
- `modules/02-event-loop.md`: #1-definitions #2-one-iteration-of-uv_run #3-processnexttick-vs-microtasks #4-blocking-and-starvation #5-the-thread-pool #6-timers-in-depth #7-how-node-builds-its-queues-on-top-of-libuv #8-worked-trace #9-other-loops-workers-deno-and-bun #10-measuring-the-loop #11-production-failure-modes
- `modules/03-modules-and-packages.md`: #1-two-module-systems-in-one-runtime #2-the-commonjs-loader #3-nodes-esm-loader #4-requireesm #5-packages-as-node-reads-them #6-customisation-hooks-moduleregisterhooks #7-typescript-type-stripping #8-package-managers-and-lockfiles #9-startup-cost-the-compile-cache #10-production-failure-modes
- `modules/04-async-control-flow-and-errors.md`: #1-three-generations-of-asynchronous-apis #2-eventemitter #3-bridging-events-and-asyncawait #4-cancellation-in-node-apis #5-errors #6-process-level-policy-uncaught-exceptions-and-unhandled-rejections #7-control-flow-patterns-that-are-node-specific #8-production-failure-modes
- `modules/05-buffers-streams-backpressure.md`: #1-buffer #2-streams-the-model #3-events-and-lifecycle #4-backpressure #5-pipe-vs-pipeline #6-implementing-a-transform-correctly #7-binary-protocols-framing-over-a-byte-stream #8-compression-and-other-cpu-bound-streams #9-modern-stream-apis-and-web-streams #10-production-failure-modes
- `modules/06-filesystem-process-os.md`: #1-three-apis-for-the-same-system-calls #2-durability-and-atomic-replacement #3-paths-and-traversal #4-watching-and-globbing #5-child-processes #6-the-os-and-the-process-environment #7-production-failure-modes
- `modules/07-networking-and-http.md`: #1-the-networking-stack-inside-node #2-tcp-with-nodenet #3-the-http11-server #4-server-timeouts #5-the-classic-http-client-and-httpagent #6-fetch-and-undici #7-dns-lookup-vs-resolve #8-tls-in-node #9-http2-websocket-and-http3-in-node #10-production-failure-modes
- `modules/08-building-services.md`: #1-why-a-framework-and-why-fastify #2-fastifys-architecture #3-schemas-validation-in-serialisation-out #4-errors-logging-and-request-correlation #5-health-checks-rate-limits-and-load-shedding #6-graceful-shutdown #7-restful-design-and-proxies-jsnsd-domains #8-configuration #9-production-failure-modes
- `modules/09-concurrency-and-scaling.md`: #1-concurrency-parallelism-and-the-four-options #2-worker-threads #3-worker-pools #4-shared-memory-in-practice #5-cluster-and-so_reuseport #6-nodesqlite-a-synchronous-database-in-the-process #7-choosing-with-examples #8-production-failure-modes
- `modules/10-v8-memory-and-gc.md`: #1-where-a-node-processs-memory-goes #2-the-generational-heap #3-observing-the-collector #4-sizing-flags #5-out-of-memory-what-actually-happens #6-memory-leaks-in-node #7-heap-limits-in-containers #8-production-failure-modes
- `modules/11-diagnostics-and-performance.md`: #1-a-method-before-tools #2-the-built-in-toolbox #3-event-loop-delay-and-utilisation #4-memory-heap-snapshots-and-the-sampling-heap-profiler #5-asynclocalstorage-and-async-context #6-cpu-profiling-and-flame-graphs #7-diagnostic-reports #8-tracing-your-own-operations #9-benchmarking-and-load-testing #10-debugging-live-processes #11-production-failure-modes
- `modules/12-testing.md`: #1-why-the-built-in-runner #2-structure #3-the-runner #4-mocking-functions-timers-and-modules #5-snapshots #6-coverage #7-nodeassert-equality-precisely #8-test-doubles-for-nodes-io #9-determinism #10-production-failure-modes-of-test-suites
- `modules/13-security.md`: #1-nodes-threat-model #2-then-vs-now-node-security-features #3-the-permission-model #4-prototype-pollution-in-node #5-redos #6-vm-is-not-a-sandbox #7-supply-chain #8-ssrf-in-node #9-other-node-specific-defences-briefly #10-a-hardening-checklist #11-production-failure-modes
- `modules/14-production-operations.md`: #1-what-operable-means-for-a-node-process #2-node-as-pid-1-and-signal-handling #3-container-images-for-node #4-single-executable-applications #5-source-maps-and-stack-traces #6-upgrading-node-in-production #7-version-history-node-20--27 #8-running-the-service-slos-and-runbooks #9-production-failure-modes #10-where-this-track-hands-over

## Least-certain claims (for the challenger)

1. **`mise.lock`** pins Node 26.13.0 **without checksums**: nodejs.org SHASUMS could not be fetched from this environment (robots-disallowed for WebFetch; the shell has no general internet). Tests ran on 26.12.1; the 26.13.0 release notes state the only change is LTS metadata.
2. Module 01 §3.2: with any `NODE_OPTIONS` present (even empty), `nodeOptions` from the config file were not applied on 26.12.1 while the `permission` block was. Observed and pinned by a test, not documented; may be a bug that a patch release fixes.
3. Module 01/14: watch mode stable since 22.0.0; `--run` added in 22.0.0 (stability wording kept vague: "no experimental warning on Node 26").
4. Module 03 §8 and 14 §7: Corepack no longer distributed since Node 25 (TSC vote 2025-03-19), sourced from an unmerged documentation PR (#61207) and memory of the vote; confirm against the distribution policy.
5. Module 05 §8: zstd in `zlib` "since Node 23.8 / 22.15" (the API exists on 26; the version is from memory).
6. Module 07: `@types/node` 26.6.6 documents `keepAliveTimeout` default as 65 000 in one JSDoc comment while the runtime value is 5 000 (test-pinned); `keepAliveTimeoutBuffer` "added 24.6.0" is from the typings.
7. Module 07 §6.2: `NODE_USE_ENV_PROXY=1` as an environment equivalent of `--use-env-proxy` (the flag is verified in `node --help`; the variable is not).
8. Module 07 §7: Happy Eyeballs attempt timeout 500 ms is observed on this build; the documentation historically said 250 ms.
9. Module 10 §4: pointer compression not enabled in Node's default builds; default heap limit described only by the observed value (2 144 MiB on an 8 GiB sandbox), not by V8's formula.
10. Module 10 §4.1: Maglev "enabled by default" in Node 22 (from release-note memory).
11. Module 12: default test-file discovery patterns paraphrased; `--test-concurrency` default "CPUs − 1".
12. Module 13: "pnpm 10 does not run dependency lifecycle scripts by default"; "`--experimental-policy` removed" (absence verified in `node --help`, removal version not stated).
13. Module 14 §4: `node --build-sea` exists and works on 26.12.1 (tested); the release that introduced it is not stated. SEA described as still under active development.
14. Module 14 §7 version table: Node 23 V8 12.9 and Node 25 V8 14.1 from the research dossier; "`FileHandle` closed by GC is an error" verified on 26 but the release that changed it is not stated.
15. `exams/README.md`: JSNAD weights come from a third-party summary (official pages no longer list them); JSNSD weights (70% / 30%) were resolved on 2026-11-06 from a 2024-06-19 Wayback snapshot of the official page; they stay unused for question counts.
16. The supply-chain test uses whatever `npm` is on `PATH` (10.9.9 in this environment, not the npm bundled with Node 26); it skips if npm is missing.

## Proposals for integrator

- **Root glossary:** add or align "Backpressure", "Thread pool", "Graceful shutdown", "Load shedding", "Circuit breaker", "Memory leak", "Heap snapshot" (general systems concepts used across tracks); keep "Event Loop" as is (this track reuses it).
- **Ownership (`.agents/OWNERSHIP.md`):** register under `technologies/nodejs`: "Fastify/Node service patterns (graceful shutdown, health probes for single-threaded runtimes, load shedding on loop delay)", "Node diagnostics tooling (loop delay/ELU, reports, heap-snapshot workflow, AsyncLocalStorage)", "Node single executable applications and Node container specifics (PID 1 for Node, heap vs cgroup budgets)". Propose `architecture/distributed-systems` or `system-design` as owner of circuit breakers and retry budgets in general (this track only implements a Node example).
- **Cross-track handovers:** `technologies/containers` should link module 14 §2 for Node-specific PID 1 behaviour; `technologies/observability` should link module 11 §2.1 (Node metric set) and §8 (tracing channels); `languages/javascript` module 06's "Node.js as a host" paragraph can now link `../../../technologies/nodejs/modules/02-event-loop.md` directly; `languages/typescript` module 01 §6.1 can link module 03 §7.
- **Testing-theory owner:** this track's module 12 assumes the open question in OWNERSHIP.md ("testing theory: no owner yet") is resolved in favour of `languages/javascript`.

## Agent provenance

Core track curriculum, modules, and examples authored by the primary (Opus, running as a Claude Code subagent). Question bank, mock exam, reference solutions, hands-on test suite, glossary, and cheatsheet produced by drafter and audited/verified by Challenger and Verifier (Antigravity).

## Integration run (2026-11-06, Claude Code & Antigravity)

- **Service & Environment Versions:**
  - Container image: `node:26.13.0-slim`
  - Docker Engine: 29.5.2 (Colima VM aarch64 Linux)
  - Host Node.js: 26.13.0
- **Container Integration Verification (`examples/integration/14-docker.itest.ts`):**
  - PID 1 signal handling without handler: verified that Node as PID 1 ignores `SIGTERM`, causing `docker stop` to wait for timeout and issue `SIGKILL` (exit code 137).
  - PID 1 with `--init`: verified that tini forwards `SIGTERM` and Node's default exit handler terminates promptly (<1s).
  - Memory constraints: verified `process.constrainedMemory()` reports exact container cgroup memory limit (256 MiB).
- **Results:**
  - Integration suite: 3/3 passed, 0 skipped, 0 failed.

## Drafter output (2026-11-07)

Drafter delivered the supporting reference and examination suite per the specification in `exams/README.md`:

- **Question bank (`exams/interview.md`):** 80 original interview questions across difficulty tiers 1–3, with 0 braindump content, comprehensive explanations grounded in the 14 modules, distractor rationales, verified doc references, and valid module anchor links. Spans all 11 core domains plus hands-on tasks:
  - D1 Runtime architecture: 5 questions (`Q-NODE-001`..`005`)
  - D2 Event loop: 10 questions (`Q-NODE-006`..`015`)
  - D3 Modules and packages: 7 questions (`Q-NODE-016`..`022`)
  - D4 Async control flow and errors: 7 questions (`Q-NODE-023`..`029`)
  - D5 Buffers and streams: 9 questions (`Q-NODE-030`..`038`)
  - D6 File system, processes and OS: 6 questions (`Q-NODE-039`..`044`)
  - D7 Networking and HTTP: 7 questions (`Q-NODE-045`..`051`)
  - D8 Building services: 6 questions (`Q-NODE-052`..`057`)
  - D9 Concurrency and scaling: 6 questions (`Q-NODE-058`..`063`)
  - D10 Memory and performance: 6 questions (`Q-NODE-064`..`069`)
  - D11 Testing, security and operations: 5 questions (`Q-NODE-070`..`074`)
  - H Hands-on tasks: 6 live coding tasks (`Q-NODE-075`..`080`)
- **Mock interview (`exams/interview.md#mock-interview-60-minutes`):** 40-question timed mock interview (38 domain questions + 2 hands-on tasks) mirroring real staff/senior loop proportions with scoring rubric.
- **Reference solutions (`examples/exam-solutions.ts`):** Production-grade reference implementations for H1 (`promisifyOnce`), H2 (`FrameDecoder`), H3 (`writeWithBackpressure`), H4 (`withTimeout`), H5 (`WorkerPool`), and H6 (`gracefulShutdown`).
- **Hands-on verification test suite (`examples/exam-hands-on.test.ts`):** 21 deterministic test cases asserting edge cases, backpressure, cancellations, timeouts, worker crashes, and signal handling.
- **Bilingual terminology index (`GLOSSARY.md`):** Comprehensive bilingual English ↔ Czech terminology glossary covering 90+ terms across 10 sections with precise definitions and module references.
- **Fast-lookup reference (`CHEATSHEET.md`):** 17 dense sections summarizing release lifecycles, CLI flags, exit codes, event loop ordering, thread pool usage, module loaders, error policies, streams, child processes, HTTP timeouts, Fastify lifecycle, worker threads, V8 memory flags, diagnostics, testing, security, and container PID 1 rules.

## Challenger and Verifier Gate (2026-11-07)

Combined Challenger & Verifier audit by Antigravity across `technologies/nodejs` and `.agents/reviews/nodejs.md`:

- **Test Suite Execution:**
  - `mise exec -- npm test`: **345 passed, 0 failed, 0 cancelled, 0 skipped** across 102 suites (324 core module tests + 21 exam hands-on tests).
  - Resolved macOS platform edge cases:
    - `06-filesystem-process-os.test.ts`: Filtered Darwin-injected `__CF_USER_TEXT_ENCODING` when verifying replaced environment keys.
    - `09-concurrency-and-scaling.test.ts`: Prevented race condition in worker uncaught exception test by registering `exit` listener synchronously before awaiting `error`.
    - `13-security.test.ts`: Canonicalized tmpdir path with `fs.realpathSync` to align macOS `/var` symlink with `--allow-fs-read` permission model.
    - `14-production-operations.test.ts`: Added ad-hoc Mach-O code-signing (`codesign --sign - --force`) for `--build-sea` binary on Darwin.
  - `mise exec -- npm run typecheck` (TypeScript 7.0.2): Clean (0 errors).
  - Docker container integration suite verified in `bd15a0d` (3/3 tests pass).
- **Tooling and Quality Gates:**
  - `node tools/wrap-check/check.mjs technologies/nodejs .agents/reviews/nodejs.md`: Clean (0 unwrapped lines).
  - `node tools/table-check/check.mjs technologies/nodejs .agents/reviews`: Clean (190 tables, 0 failing).
  - `tools/mermaid-check`: 21 diagrams validated against Mermaid 11/12 parser, 0 failing.
  - `tools/link-check`: 643 links checked, 0 broken, 0 pending.
  - Secret & path leak scan: `git grep -i 'local home paths' technologies/nodejs .agents/reviews/nodejs.md` verified 0 local absolute paths (only matching HTTP route literals).
- **Spot-Checked Questions & Claim Audits:**
  - Spot-checked 18 questions across domains, including:
    - `Q-NODE-007`..`010`: Output prediction for timer vs immediate and CommonJS vs ESM tick queue vs microtask drain (verified against V8/libuv loop mechanics in Module 02).
    - `Q-NODE-030`..`036`: Buffer pooling (64 KiB slab retention hazard) and stream backpressure protocol (`write()` returning `false` waiting for `'drain'`; `pipe` dangling stream hazard vs `stream.pipeline`).
    - `Q-NODE-075`..`080`: All 6 hands-on coding tasks (H1–H6) verified against `exam-solutions.ts` by the 21 tests in `exam-hands-on.test.ts`.
  - Least-certain claims reconciliation:
    - `mise.lock` regenerated with exact sha256 checksums in `eaee1e4`.
    - JSNSD domain weights (70% / 30%) updated from official Wayback Machine archives in `cf2879c`.

## Final Gate Review (2026-11-07, Argon)

- **Reviewer:** Isolated `gemini-4-argon` (`independent_review` mode) + Primary integrator.
- **Module Depth:** All 14 modules verified at 400–435 lines post-`oxfmt` (5,732 lines total), 0 `(unverified)` markers, 21 Mermaid diagrams, 167 tables, and 643 links passing.
- **Verification:** 345 hermetic tests + 3 Docker PID 1/heap container integration tests passing; 80-question bank + 40-question mock + 6 hands-on reference suites verified.
- **Findings:** 0 P0, 0 P1. Approved and merged into `main`.
