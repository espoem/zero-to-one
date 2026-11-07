# Exams and Interview Coverage: Node.js 26 LTS

## Is there an official Node.js certification?

**No active certification exists for Node.js** (checked 2026-11-05). The OpenJS Foundation's two Node.js exams, delivered by the Linux Foundation, were both retired on **2025-09-30** without a named successor, and no other vendor-neutral Node.js certification was found in the OpenJS or Linux Foundation catalogues.

| Exam | Code | Vendor | Status (verified) | Former format | Used here as |
| --- | --- | --- | --- | --- | --- |
| OpenJS Node.js Application Developer | JSNAD | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30** ([LF page](https://training.linuxfoundation.org/certification/jsnad), [notice](https://training.linuxfoundation.org/jsnad-cert-inactive/)) | performance-based, online proctored, tasks solved in a terminal and editor | **syllabus source**: its domain outline and weights shape domains D1–D9 |
| OpenJS Node.js Services Developer | JSNSD | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30** ([LF page](https://training.linuxfoundation.org/certification/jsnsd), [notice](https://training.linuxfoundation.org/jsnsd-cert-inactive/)) | performance-based, online proctored, two hours, tasks solved in a remote Linux desktop | **syllabus source**: its Servers and Services (70%) and Security (30%) domains shape D7, D8 and D11 |
| **Senior Node.js backend interview** | — | industry format | — | knowledge and output-prediction questions, production scenarios, live coding of async/stream utilities, debugging walkthroughs | **primary target**: [interview.md](interview.md) (80 questions, 6 hands-on tasks, 40-question mock exam) |

**Decision.** Following AGENTS.md's priority order (official certification → recognised third-party exam → recognised interview format), and with both official exams retired, this track targets **the senior Node.js interview** as its primary format and uses the retired JSNAD and JSNSD outlines as a syllabus checklist, so that everything those exams tested is covered.

> **Exam delta (retired exams).** JSNAD and JSNSD tracked older LTS lines (the retired pages no longer state the exact version; preparation material from 2023–2025 targeted Node 18–20). Expect material written for them to predate: `require(esm)` and the `module-sync` condition, type stripping, the stable permission model (`--permission`, not `--experimental-permission`), `node:test` features added after 20 (snapshots, module mocks, `t.plan`), AsyncContextFrame, `module.registerHooks`, Fastify 5, the 64 KiB stream and Buffer-pool defaults, Temporal, and the removals in Node 26 (`writeHeader`, `_stream_*`). Answers in this track's bank follow Node 26 behaviour; where an older behaviour is still common, the question says so.

## Domains, weights and coverage

### Retired JSNAD outline (syllabus source)

Weights as published while the exam was active, taken from a third-party summary of the official outline because the Linux Foundation pages no longer show them (<https://platzi.com/cursos/nodejs-certificaciones-2023/dominios-y-pesos-del-examen-de-node-js/>; "Control Flow 12%" is derived from the remainder). They are a historical reference for proportions, not a current exam guide.

| JSNAD domain | Weight | Modules | Status |
| --- | --- | --- | --- |
| Buffers and Streams | 11% | [05](../modules/05-buffers-streams-backpressure.md) | ✅ |
| Control Flow | 12% | [02](../modules/02-event-loop.md), [04](../modules/04-async-control-flow-and-errors.md) | ✅ |
| Child Processes | 8% | [06](../modules/06-filesystem-process-os.md#5-child-processes), [09](../modules/09-concurrency-and-scaling.md) | ✅ |
| Diagnostics | 6% | [11](../modules/11-diagnostics-and-performance.md), [10](../modules/10-v8-memory-and-gc.md) | ✅ |
| Error Handling | 8% | [04](../modules/04-async-control-flow-and-errors.md#5-errors) | ✅ |
| Node.js CLI | 4% | [01](../modules/01-runtime-architecture.md#3-configuring-a-process) | ✅ |
| Events | 11% | [04](../modules/04-async-control-flow-and-errors.md#2-eventemitter) | ✅ |
| File System | 8% | [06](../modules/06-filesystem-process-os.md) | ✅ |
| JavaScript Prerequisites | 7% | cross-linked to `languages/javascript` (closures, prototypes, promises); Node delta in [04](../modules/04-async-control-flow-and-errors.md) | ✅ (owned elsewhere) |
| Module System | 7% | [03](../modules/03-modules-and-packages.md) | ✅ |
| Process / Operating System | 6% | [01](../modules/01-runtime-architecture.md#5-the-process-object-standard-io-and-signals), [06](../modules/06-filesystem-process-os.md#6-the-os-and-the-process-environment) | ✅ |
| Package.json | 6% | [03](../modules/03-modules-and-packages.md#5-packages-as-node-reads-them) | ✅ |
| Unit Testing | 6% | [12](../modules/12-testing.md) | ✅ |

### Retired JSNSD outline (syllabus source)

Domains and weights are taken from the official Linux Foundation certification page, read through the [Wayback Machine snapshot of 2024-06-19](https://web.archive.org/web/20240619035740/https://training.linuxfoundation.org/certification/JSNSD/) (retrieved 2026-11-06). The live URL now redirects to the [JSNSD inactive notice](https://training.linuxfoundation.org/jsnsd-cert-inactive/), which no longer lists them. Later snapshots could not be checked because the Wayback availability API answered HTTP 429 twice, so these are the weights as of June 2024, not proven unchanged up to the retirement. The same page describes a two-hour, online proctored, performance-based exam in a remote Linux desktop. Weights were not used for question counts: the bank targets the interview format below.

| JSNSD domain | Weight | Competency | Modules | Status |
| --- | --- | --- | --- | --- |
| Servers and Services | 70% | Implementing public facing web servers | [07](../modules/07-networking-and-http.md#3-the-http11-server), [07 §4](../modules/07-networking-and-http.md#4-server-timeouts), [08](../modules/08-building-services.md) | ✅ |
|  |  | Creating RESTful HTTP services | [08 §7](../modules/08-building-services.md#7-restful-design-and-proxies-jsnsd-domains) | ✅ |
|  |  | Consuming other HTTP services | [07 §5](../modules/07-networking-and-http.md#5-the-classic-http-client-and-httpagent), [07 §6](../modules/07-networking-and-http.md#6-fetch-and-undici), [08 §7](../modules/08-building-services.md#7-restful-design-and-proxies-jsnsd-domains) | ✅ |
|  |  | Knowledge of HTTP verbs and status codes | [08 §7](../modules/08-building-services.md#7-restful-design-and-proxies-jsnsd-domains) | ✅ |
|  |  | Processing user input | [08 §3](../modules/08-building-services.md#3-schemas-validation-in-serialisation-out), [07 §3.3](../modules/07-networking-and-http.md#33-reading-bodies-safely) | ✅ |
| Security | 30% | Protecting against malicious input | [08 §3](../modules/08-building-services.md#3-schemas-validation-in-serialisation-out), [13](../modules/13-security.md) | ✅ |
|  |  | Attack mitigation (rate limits, slowloris, body size, ReDoS, injection, pollution) | [08 §5](../modules/08-building-services.md#5-health-checks-rate-limits-and-load-shedding), [07 §4](../modules/07-networking-and-http.md#4-server-timeouts), [13](../modules/13-security.md) | ✅ |

### Interview format (primary target)

There is no official weighting. These weights are this track's estimate of how often each area appears in senior Node.js backend interviews, cross-checked against the "Interview hot topics" of the track's research dossier and the retired JSNAD proportions. They define the question counts for `interview.md`.

| # | Domain / objectives | Weight | Modules | Examples (verification) | Target questions | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Runtime architecture: V8/libuv/bindings, lifecycle, exit codes, CLI, env and config files, release lines | 6% | [01](../modules/01-runtime-architecture.md) | `01-runtime-architecture.test.ts` | 5 | ✅ [Q-NODE-001–005](interview.md#d1--runtime-architecture) |
| D2 | Event loop: phases, `nextTick` vs microtasks (CJS vs ESM), timers, blocking, starvation, thread pool | 14% | [02](../modules/02-event-loop.md) | `02-event-loop.test.ts`, `02-mini-loop.ts` | 10 | ✅ [Q-NODE-006–015](interview.md#d2--event-loop) |
| D3 | Modules and packages: CJS loader, ESM loader, `require(esm)`, `exports`/`imports`, conditions, dual-package hazard, hooks, type stripping, lockfiles | 10% | [03](../modules/03-modules-and-packages.md) | `03-modules-and-packages.test.ts`, `fixtures/03-modules/` | 7 | ✅ [Q-NODE-016–022](interview.md#d3--modules-and-packages) |
| D4 | Async control flow and errors: callbacks, Zalgo, `EventEmitter`, `EventTarget`, `AbortSignal`, error kinds, unhandled-rejection modes, process policy | 10% | [04](../modules/04-async-control-flow-and-errors.md) | `04-async-control-flow-and-errors.test.ts`, `04-control-flow.ts` | 7 | ✅ [Q-NODE-023–029](interview.md#d4--async-control-flow-and-errors) |
| D5 | Buffers and streams: Buffer pool and safety, encodings, Readable/Writable/Transform, backpressure, `pipeline`, framing, Web Streams | 12% | [05](../modules/05-buffers-streams-backpressure.md) | `05-buffers-streams-backpressure.test.ts`, `05-streams.ts` | 9 | ✅ [Q-NODE-030–038](interview.md#d5--buffers-and-streams) |
| D6 | File system, processes and OS: `FileHandle`, atomic writes, paths and traversal, watch/glob, child processes, injection, IPC, signals | 8% | [06](../modules/06-filesystem-process-os.md) | `06-filesystem-process-os.test.ts`, `06-fs-utils.ts` | 6 | ✅ [Q-NODE-039–044](interview.md#d6--file-system-processes-and-os) |
| D7 | Networking and HTTP: sockets, server timeouts and LB alignment, agents and keep-alive, `fetch`/undici, DNS, TLS, HTTP/2 | 10% | [07](../modules/07-networking-and-http.md) | `07-networking-and-http.test.ts`, `07-http-utils.ts` | 7 | ✅ [Q-NODE-045–051](interview.md#d7--networking-and-http) |
| D8 | Building services: Fastify lifecycle and encapsulation, schemas, logging, health, rate limits, load shedding, graceful shutdown, proxies | 8% | [08](../modules/08-building-services.md) | `08-building-services.test.ts`, `08-service.ts`, `fixtures/08-service/` | 6 | ✅ [Q-NODE-052–057](interview.md#d8--building-services) |
| D9 | Concurrency and scaling: worker threads, pools, shared memory, cluster, `SO_REUSEPORT`, `node:sqlite` | 8% | [09](../modules/09-concurrency-and-scaling.md) | `09-concurrency-and-scaling.test.ts`, `09-pool.ts`, `09-ring.ts` | 6 | ✅ [Q-NODE-058–063](interview.md#d9--concurrency-and-scaling) |
| D10 | Memory and performance: V8 heap and GC, limits and containers, leaks, loop delay/ELU, profiling, heap snapshots, reports, `AsyncLocalStorage` | 8% | [10](../modules/10-v8-memory-and-gc.md), [11](../modules/11-diagnostics-and-performance.md) | `10-…test.ts`, `11-…test.ts`, `11-heap-snapshot.ts` | 6 | ✅ [Q-NODE-064–069](interview.md#d10--memory-and-performance) |
| D11 | Testing, security and operations: `node:test`, mocks, determinism; permission model, pollution, ReDoS, SSRF, supply chain; PID 1, SEA, source maps, upgrades | 6% | [12](../modules/12-testing.md), [13](../modules/13-security.md), [14](../modules/14-production-operations.md) | `12-…test.ts`, `13-…test.ts`, `14-…test.ts` | 5 | ✅ [Q-NODE-070–074](interview.md#d11--testing-security-and-operations) |
| H | Hands-on tasks (live coding with verification tests) spanning D4, D5, D8, D9 | — | 04, 05, 08, 09 | [exam-hands-on.test.ts](../examples/exam-hands-on.test.ts) | 6 | ✅ [Q-NODE-075–080](interview.md#h--hands-on-tasks) |
|  | **Total** | 100% |  |  | **80** | ✅ (all 80 delivered) |

Every teaching row and question bank domain is ✅: each objective is taught in a module, exercised by tests, and tested in [interview.md](interview.md).

## Specification for the question bank (`exams/interview.md`)

This section is the drafter's brief. The primary author reviews and corrects the draft before it is merged.

**File and format.** One file, `exams/interview.md`, written in the exact AGENTS.md question format:

```markdown
### Q-NODE-<NNN> · <Domain name> · difficulty <1-3> · <single|multi|scenario|ordering|hands-on>

<question text>
- A) …
- B) …
<details><summary>Answer</summary>

**B.** <explanation>

- Why not A: …
- Ref: [modules/NN-….md](../modules/NN-….md#anchor), <official doc URL on nodejs.org/api or nodejs.org/en/learn>

</details>
```

**Counts.** At least the "Target questions" per domain above (80 in total, at least 5 per domain), numbered `Q-NODE-001` onwards in domain order, with the six hands-on tasks last (`Q-NODE-075`–`Q-NODE-080`).

**Question types.** Each domain mixes `single`, `multi`, `scenario` (a production incident: symptoms, then "what is the most likely cause / best next step"), and `ordering` (put event-loop outputs, lifecycle steps or shutdown steps in order). Output-prediction questions must say whether the snippet runs as CommonJS or as an ES module (the answer differs, [module 02 §3.2](../modules/02-event-loop.md#3-processnexttick-vs-microtasks)).

**Difficulty.** 1 = solid mid-level, 2 = senior, 3 = harder than typical interviews (internals, version-specific behaviour). At least 15 questions at difficulty 3, spread over at least six domains.

**Answers.** Every question: the correct option(s), a concise explanation grounded in a module, **why each distractor is wrong**, a module link **with an anchor that exists** (the list of valid anchors is in the review file's drafter spec), and one official documentation URL. Every factual claim in an answer must already be stated in a module or proven by a test; the drafter must not introduce new facts.

**Hands-on tasks (H).** Six live-coding tasks, each solvable in 15–30 minutes, each with a verification test in [exam-hands-on.test.ts](../examples/exam-hands-on.test.ts) that imports the candidate's solution from the path in the `SOLUTIONS` environment variable (default: [exam-solutions.ts](../examples/exam-solutions.ts), the reference solutions), following the pattern of `languages/javascript/examples/exam-hands-on.test.js`:

1. `promisifyOnce(fn)`: promisify an error-first function and guard against double callbacks (D4).
2. `LineSplitter` or a length-prefixed `FrameDecoder` Transform with a maximum frame size (D5).
3. `writeWithBackpressure(writable, chunks)`: respect `write()` and `'drain'`, reject on `'error'` (D5).
4. `withTimeout(work, ms, parentSignal)` that cancels the losing side and leaves no timers (D4).
5. A fixed-size worker pool with a bounded queue that rejects when full (D9).
6. A graceful-shutdown function for a `node:http` server with a deadline, verified by a child-process test (D8).

**Mock exam.** One section "Mock interview (60 minutes)": 40 questions selected from the bank, in this mix: D2 6, D3 4, D4 4, D5 5, D6 3, D7 4, D8 3, D9 3, D10 4, D11 2, plus two hands-on tasks (H) at the end; scoring key: 1 point per question (multi-select only fully correct), 5 points per hands-on task passing its verification test, pass mark 70%.

**Integrity.** Original questions only, based on the modules and the official documentation. Nothing may reproduce or paraphrase real JSNAD/JSNSD items or any company's interview questions.

## Syllabus completeness against the Node.js API documentation

| API documentation area (nodejs.org/api) | Covered in | Notes |
| --- | --- | --- |
| Assertion testing, Test runner | 12 |  |
| Async hooks, Asynchronous context tracking | 11 | `createHook` taught as discouraged |
| Buffer, String decoder | 05 |  |
| Child processes, Cluster, Worker threads | 06, 09 |  |
| Command-line options, Environment variables, Single executable applications | 01, 14 |  |
| Console, Readline, REPL, TTY | 01 (stdio), 05 (readline), 11 (`node inspect`) | REPL internals out of scope (developer tool, not runtime behaviour) |
| Crypto, Web Crypto | 13 (Node delta), 02 (thread pool) | primitives owned by `architecture/security-identity` |
| Debugger, Inspector | 11 |  |
| Diagnostics channel, Performance hooks, Report, Trace events | 08, 11 |  |
| DNS, Net, TLS, HTTP, HTTPS, HTTP/2, UDP/datagram | 07 | QUIC not in default builds |
| Errors, Events, Process, Timers | 01, 02, 04 |  |
| File system, Path, OS, URL, Query string | 06, 07 (URL), 13 (`url.parse`) |  |
| Modules (CommonJS, ECMAScript, `node:module`, packages, TypeScript) | 03 | ESM semantics owned by `languages/javascript` |
| Permissions | 13 |  |
| SQLite | 09 | operations owned by `technologies/sqlite` |
| Stream, Web Streams, Zlib | 05 |  |
| Util | 04 (`promisify`, `callbackify`), 01 (`parseEnv`) |  |
| V8 | 10, 11 | engine internals owned by `languages/javascript` |
| VM, WASI | 13 (vm is not a sandbox), 03 (WebAssembly modules) | WASI details out of scope (rarely used in services) |
| Corepack, Domain, Punycode, deprecated modules | 03 (Corepack), 04 (`domain` deprecated) | deprecated APIs named only in "Then vs now" |
| Internationalization, Globals | cross-linked to `languages/javascript` | `Intl`/Temporal semantics owned there |
