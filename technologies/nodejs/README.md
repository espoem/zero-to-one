# Node.js 26 LTS: the Runtime, from libuv to Production

A technology track for **Node.js as a runtime**: how a `node` process starts, schedules work and stops; the module loaders, streams and backpressure, networking defaults, worker threads and processes; memory and garbage collection; diagnostics; testing; security; and operating Node services in containers. It is pinned to **Node 26 "Lithium"**, the Active LTS line since 2026-10-28, and every claim that can be executed is executed: each module has a deterministic `node:test` suite (TypeScript run directly by Node's type stripping) with negative tests, and every runtime-flag experiment runs in a child process.

> Verified against **Node.js 26.13.0** (LTS "Lithium", released 2026-10-28; tests executed on 26.12.1, which differs only in `process.release.lts`), **V8 14.6.202**, **libuv 1.52.1**, **undici 8.12.x**, **TypeScript 7.0.2**, **@types/node 26.6.6**, **Fastify 5.12.8**, **undici (npm) 8.12.3**, **fast-check 4.10.2**, **oxfmt 0.76.0** and **oxlint 1.91.0** on **2026-10-28**, re-checked on 2026-11-05.

The language itself (types, closures, prototypes, promises and the job queue, ESM semantics, the memory model, V8 tiers and shapes) is owned by [`languages/javascript`](../../languages/javascript/), and this track links there instead of re-explaining it. Ownership boundaries are recorded in `.agents/OWNERSHIP.md`.

## Prerequisites

- The JavaScript track's modules on async programming and modules, or equivalent experience: [JavaScript module 06](../../languages/javascript/modules/06-agents-realms-job-queue.md), [07](../../languages/javascript/modules/07-async-in-depth.md) and [08](../../languages/javascript/modules/08-modules.md).
- Basic TCP/HTTP and Linux process knowledge; the networking and security tracks are linked where depth is needed.

## Syllabus

The modules form one progressive narrative; read them in order.

| # | Module | Core content | Executable proof |
| --- | --- | --- | --- |
| 01 | [Runtime architecture](modules/01-runtime-architecture.md) | V8, libuv, bindings, bundled dependencies; startup and exit; exit codes; `NODE_OPTIONS`, `--env-file`, `--config-file`, `--run`; stdio and signals; Node-API; release lines and the new yearly model | [01](examples/01-runtime-architecture.test.ts) |
| 02 | [The event loop](modules/02-event-loop.md) | libuv phases (≥ 1.45 order), `nextTick` vs microtasks in CJS and ESM, starvation, the thread pool, timers, an executable loop model | [02](examples/02-event-loop.test.ts), [model](examples/02-mini-loop.ts) |
| 03 | [Modules and packages](modules/03-modules-and-packages.md) | CJS loader, ESM loader, `require(esm)`, `exports`/`imports`, `module-sync`, dual-package hazard, `module.registerHooks`, type stripping, lockfiles, compile cache | [03](examples/03-modules-and-packages.test.ts) |
| 04 | [Async control flow and errors](modules/04-async-control-flow-and-errors.md) | callbacks and Zalgo, `EventEmitter` vs `EventTarget`, `AbortSignal` in Node APIs, error kinds, unhandled-rejection modes, crash policy | [04](examples/04-async-control-flow-and-errors.test.ts) |
| 05 | [Buffers, streams and backpressure](modules/05-buffers-streams-backpressure.md) | Buffer pool (64 KiB in 26.3), encodings, stream state machines, backpressure proofs, `pipeline`, framing, zlib bombs, Web Streams | [05](examples/05-buffers-streams-backpressure.test.ts) |
| 06 | [File system, processes and OS](modules/06-filesystem-process-os.md) | `FileHandle` and `await using`, atomic writes, traversal, watch/glob, child processes, injection, IPC, signals across trees, container limits | [06](examples/06-filesystem-process-os.test.ts) |
| 07 | [Networking and HTTP](modules/07-networking-and-http.md) | sockets, server timeouts and the load-balancer 502 race, parser limits, agents, `fetch`/undici, DNS, TLS, HTTP/2, retries | [07](examples/07-networking-and-http.test.ts) |
| 08 | [Building services](modules/08-building-services.md) | Fastify 5 lifecycle and encapsulation, schemas, logging, health, rate limiting, load shedding, circuit breakers, graceful shutdown, proxies | [08](examples/08-building-services.test.ts) |
| 09 | [Concurrency and scaling](modules/09-concurrency-and-scaling.md) | worker threads, pools, shared-memory ring buffer, cluster, `SO_REUSEPORT`, `node:sqlite` | [09](examples/09-concurrency-and-scaling.test.ts) |
| 10 | [V8 memory and GC](modules/10-v8-memory-and-gc.md) | heap spaces, Scavenger and Mark-Compact, sizing flags, OOM, leaks, heap limits in containers | [10](examples/10-v8-memory-and-gc.test.ts) |
| 11 | [Diagnostics and performance](modules/11-diagnostics-and-performance.md) | loop delay and ELU, CPU profiles, heap snapshots, reports, `AsyncLocalStorage`, tracing channels, load testing | [11](examples/11-diagnostics-and-performance.test.ts) |
| 12 | [Testing](modules/12-testing.md) | `node:test` runner, mocks (functions, timers, modules), snapshots, coverage, `assert` semantics, determinism | [12](examples/12-testing.test.ts) |
| 13 | [Security](modules/13-security.md) | threat model, permission model, prototype pollution, ReDoS, `vm`, SSRF, npm supply chain | [13](examples/13-security.test.ts) |
| 14 | [Production operations](modules/14-production-operations.md) | PID 1 and signals, images, single executables, source maps, upgrades, runbooks, **version history Node 20 → 27** | [14](examples/14-production-operations.test.ts) |

Each module ends with an **Interview Drill** (answers in collapsible blocks). Supporting material: [exams/](exams/README.md) (exam status, coverage matrices, and [question bank](exams/interview.md)); [GLOSSARY.md](GLOSSARY.md) (English ↔ Czech) and [CHEATSHEET.md](CHEATSHEET.md).

**Out of scope, with owners:** language semantics → `languages/javascript`; the type system and `tsconfig` → [`languages/typescript`](../../languages/typescript/); protocol theory → [`architecture/networking`](../../architecture/networking/); crypto, identity and OWASP classes → [`architecture/security-identity`](../../architecture/security-identity/); Linux containers, Kubernetes and observability backends → their technology tracks; Deno and Bun → a short comparison in [module 14 §10](modules/14-production-operations.md#10-where-this-track-hands-over). The full mapping against the Node.js API documentation is in [exams/README.md](exams/README.md#syllabus-completeness-against-the-nodejs-api-documentation).

## Running the examples

Tooling is pinned with mise ([`.mise.toml`](.mise.toml): Node 26.13.0). From this directory:

```bash
mise install                         # installs the pinned Node
mise exec -- npm ci                  # TypeScript, @types/node, Fastify, undici, fast-check, oxfmt, oxlint
mise exec -- npm test                # node --test "examples/**/*.test.ts" (TypeScript via type stripping)
mise exec -- npm run typecheck       # tsc --noEmit (TypeScript 7)
mise exec -- npm run lint            # oxlint with the repository config
mise exec -- npm run fmt:check       # oxfmt with the repository config
mise exec -- npm run test:integration   # Docker-only checks; skips with a message when Docker is absent
```

Run one module: `mise exec -- node --test examples/07-networking-and-http.test.ts`.

Notes:

- Tests that change process-wide behaviour (`--permission`, heap limits, `--unhandled-rejections`, `--expose-gc`, deprecation flags) start a child process with the same Node binary and a clean environment ([`examples/helpers/run-node.ts`](examples/helpers/run-node.ts)).
- No test depends on a race or a timing threshold; orderings are asserted only where Node guarantees them, timing only as lower bounds that cannot be violated, and long-running processes are driven by explicit readiness lines.
- The single-executable test builds a ~150 MB binary in a temporary directory (about 10 s). The supply-chain test needs `npm` on `PATH` and skips otherwise; it installs a local fixture offline.
- V8-sensitive observations (heap spaces, GC trace format, pooled-Buffer details) are pinned to V8 14.6 and are expected to change with Node upgrades.

## Certifications & Exams

**No active Node.js certification exists** (checked 2026-11-05). Details, the coverage matrices and the exam delta are in [exams/README.md](exams/README.md).

| Exam | Vendor | Status | Format | Used here as |
| --- | --- | --- | --- | --- |
| JSNAD (OpenJS Node.js Application Developer) | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30**, no successor ([official page](https://training.linuxfoundation.org/certification/jsnad)) | was performance-based, online proctored | syllabus source: domain outline and weights |
| JSNSD (OpenJS Node.js Services Developer) | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30**, no successor ([official page](https://training.linuxfoundation.org/certification/jsnsd)) | was performance-based | syllabus source: servers, services and security |
| **Senior Node.js backend interview** | industry format | — | knowledge, output prediction, production scenarios, live coding | **primary target**: an 80-question bank with 6 hands-on tasks and a 60-minute mock in [exams/interview.md](exams/interview.md) |

**Exam delta:** material written for the retired exams targeted Node 18–20 era behaviour and predates `require(esm)`, type stripping, the stable permission model, AsyncContextFrame, `module.registerHooks` and the Node 26 removals; this track teaches Node 26.

## Layout

```
technologies/nodejs/
├── README.md
├── modules/          01–14, one progressive narrative
├── examples/         one *.test.ts per module, supporting *.ts, helpers/, fixtures/, integration/
├── exams/            README.md, interview.md (80 questions, 6 hands-on tasks, mock exam)
├── GLOSSARY.md, CHEATSHEET.md
├── package.json, package-lock.json, tsconfig.json, .mise.toml, mise.lock
```

## Primary sources

- Node.js API documentation: <https://nodejs.org/api/>; Learn guides: <https://nodejs.org/en/learn>
- Release schedule: <https://github.com/nodejs/Release/blob/main/schedule.json>; release notes: <https://nodejs.org/en/blog/release/v26.0.0>, <https://github.com/nodejs/node/releases/tag/v26.13.0>
- libuv documentation: <https://docs.libuv.org/en/v1.x/>
- V8 blog: <https://v8.dev/blog>
- Node.js security policy and threat model: <https://github.com/nodejs/node/blob/main/SECURITY.md>
- Fastify documentation: <https://fastify.dev/docs/latest/>; undici documentation: <https://undici.nodejs.org/>
