# Node.js 26 LTS Cheatsheet

Fast lookup for runtime architecture, event-loop phases, stream protocols, networking defaults, diagnostics, and production operations in Node.js 26 LTS ("Lithium"). Every rule here is backed by an executable test in [examples/](examples/). Runtime: Node 26.13.0 (V8 14.6, libuv 1.52.1).

---

## 1. Versions and release lines ([01](modules/01-runtime-architecture.md#4-release-lines-and-choosing-a-version), [14](modules/14-production-operations.md#7-version-history-node-20--27))

| Major | Codename | First release | Active LTS | Maintenance | End of life (EOL) | V8 | Key additions & removals |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **20** | Iron | 2023-04 | 2023-10 | 2024-10 | **2026-04-30** | 11.3 | Stable `node:test`; libuv 1.45 timers after poll; Happy Eyeballs default |
| **22** | Jod | 2024-04 | 2024-10 | 2025-10 | 2027-04-30 | 12.4 | `require(esm)` unflagged (22.12); `node --run`; stream HWM 64 KiB; type stripping |
| **24** | Krypton | 2025-05 | 2025-10 | 2026-10 | 2028-04-30 | 13.6 | AsyncContextFrame ALS; `--permission` stable; explicit resource management (`using`) |
| **26** | **Lithium** | **2026-05** | **2026-10** | **2027-10** | **2029-04-30** | **14.6** | Stable `--config-file`; `Buffer.poolSize` 64 KiB; removed `writeHeader` & `_stream_*` |
| **27** | — | 2026-10 (alpha) / 2027-04 | 2027-10 | 2028-10 | 2030-04 | 15.x | Yearly release model: single April major, every major becomes LTS in October |

**Release model change (from Node 27):** Node 26 is the last line released under the dual-major model (even LTS, odd non-LTS). From Node 27, Node releases **one major per year** in April, preceded by an **Alpha channel** (October–March) and followed by promotion to **Active LTS in October**.

---

## 2. CLI flags and configuration ([01](modules/01-runtime-architecture.md#3-configuring-a-process), [10](modules/10-v8-memory-and-gc.md#4-sizing-flags), [11](modules/11-diagnostics-and-performance.md#7-diagnostic-reports), [12](modules/12-testing.md#3-the-runner), [13](modules/13-security.md#3-the-permission-model), [14](modules/14-production-operations.md#6-upgrading-node-in-production))

Precedence (highest first): CLI arguments > `NODE_OPTIONS` environment variable > `--env-file` variables > Config file (`node.config.json`) > Runtime APIs.

| Option / Flag | Scope / Subsystem | Purpose & Production Invariants |
| :-- | :-- | :-- |
| `--env-file=<path>` | Environment | Loads environment variables into `process.env`; real shell variables win on conflict; read before `--permission` |
| `--env-file-if-exists=<path>` | Environment | Same as `--env-file`, but silently ignores missing files instead of failing with exit code 9 |
| `--config-file[=<path>]` | Configuration | Stable in 26.12; loads `nodeOptions`, `permission`, `test`, and `watch` settings; defaults to `node.config.json` |
| `--run <script>` | Developer loop | Executes `package.json` script without npm; skips `pre`/`post` hooks; sets `NODE_RUN_SCRIPT_NAME` |
| `--watch`, `--watch-path=<dir>` | Developer loop | Restarts process on file changes; `--watch-preserve-output` keeps terminal scrollback |
| `--import=<specifier>` / `-r` | Preload | Evaluates module before entry point; `--import` executes in ESM loader thread; repeatable and executed in order |
| `--enable-source-maps` | Stack traces | Translates compiled V8 stack traces using inline or external source maps; adds CPU cost to error formatting |
| `--max-old-space-size=<MiB>` | V8 memory | Explicitly caps old generation heap (e.g. 512); derived from available RAM if unset |
| `--max-old-space-size-percentage=<n>` | V8 memory | Caps old generation as percentage of available cgroup memory limit |
| `--permission` | Security | Denies all system capabilities (fs, network, child process, workers) unless granted by explicit flags |
| `--test` | Testing | Invokes built-in test runner; executes isolated child processes per test file by default |
| `--throw-deprecation` | Upgrades | Forces runtime deprecation warnings (e.g. `DEP0xxx`) to throw fatal uncaught exceptions (exit 1) in CI |
| `--report-uncaught-exception` | Diagnostics | Generates detailed JSON diagnostic report on uncaught exception before process exits |

---

## 3. Exit codes and signals ([01](modules/01-runtime-architecture.md#2-the-process-lifecycle), [14](modules/14-production-operations.md#2-node-as-pid-1-and-signal-handling))

| Code / Signal | Name | Cause / Trigger | Handling & Production Triage |
| :-- | :-- | :-- | :-- |
| `0` | Success | Event loop drained naturally, or `process.exit(0)` called | Normal shutdown; pending `beforeExit` hooks executed |
| `1` | Fatal error | Uncaught JavaScript exception, or unhandled rejection under default `throw` mode | Process unwound; inspect stderr, diagnostic report, or crash log |
| `9` | Invalid option | Unknown CLI flag, or flag not permitted inside `NODE_OPTIONS` (e.g. `-e`, `--run`) | Fix deployment startup script or Docker command line |
| `13` | Unsettled TLA | Event loop drained while top-level await promise remained unsettled | Unsettled promise in module root; process cannot proceed |
| `134` (128+6) | SIGABRT | V8 heap limit reached (`FATAL ERROR: JavaScript heap out of memory`) | V8 aborted; inspect heap snapshot near limit or raise heap flag |
| `137` (128+9) | SIGKILL | OS kernel OOM killer or host `kill -9` | Kernel terminated container; RSS exceeded container cgroup limit |
| `143` (128+15) | SIGTERM | Termination request from Kubernetes or container manager | Catch via `process.on('SIGTERM')` to trigger graceful shutdown |

**PID 1 Container Rules:** When Node runs as PID 1 in a container without an init process, Linux suppresses default signal termination (SIGTERM/SIGINT are ignored unless Node registers explicit handlers) and Node does not reap orphaned zombie processes. Use `CMD ["node", "app.js"]` (exec form), run an init system (`docker run --init` or `tini`), and explicitly handle `SIGTERM`.

---

## 4. Event-loop ordering rules ([02](modules/02-event-loop.md#2-one-iteration-of-uv_run))

```
Start (run timers once) → pending callbacks → idle/prepare → poll (epoll_wait / I/O) → check (setImmediate) → close callbacks → timers (setTimeout)
Checkpoints: processTicksAndRejections (nextTick queue, then V8 microtask queue) drains after EVERY callback across all phases.
```

| Context | Ordering Guarantee | Underlying Specification & Mechanics |
| :-- | :-- | :-- |
| Inside I/O callback | `setImmediate` always runs before `setTimeout(fn, 0)` | I/O callbacks run in poll phase; check (`setImmediate`) follows immediately before timers |
| Top-level CommonJS | `process.nextTick` runs before Promise `.then` microtasks | CJS runs synchronously from C++; Node runs tick queue before V8 microtasks on return |
| Top-level ES Module | Promise `.then` microtasks run before `process.nextTick` | ESM executes inside a V8 promise job; V8 microtask queue is already draining at completion |
| Timer delay clamping | Delays `< 1` and `NaN` clamped to `1 ms`; `> 2**31 - 1` clamped to `1 ms` | Integer overflow in 32-bit signed timeout representation emits `TimeoutOverflowWarning` |
| `process.nextTick` recursion | Starves I/O and timers completely | NextTick queue drains exhaustively before control yields back to the libuv event loop |

---

## 5. Thread-pool users and non-users ([02](modules/02-event-loop.md#5-the-thread-pool))

The libuv thread pool (`UV_THREADPOOL_SIZE`, default **4**, max 1024) is shared across the entire process (including all `worker_threads`). Work items execute in a FIFO queue.

| Work Category | Operations using libuv Thread Pool | Operations NOT using Thread Pool |
| :-- | :-- | :-- |
| **File system** | Asynchronous `fs.*` operations (`readFile`, `stat`, `writeFile`) | `fs.watch` (uses OS kernel `inotify` / `FSEvents` / `ReadDirectoryChangesW`) |
| **DNS resolution** | `dns.lookup()` (calls blocking OS `getaddrinfo(3)`) | `dns.resolve*()`, `dns.Resolver` (uses non-blocking c-ares over UDP/TCP) |
| **Cryptography** | Asynchronous CPU hashing: `pbkdf2`, `scrypt`, `randomBytes`, `generateKeyPair` | Synchronous `*Sync` crypto (runs on main thread, blocking event loop) |
| **Compression** | Asynchronous `zlib` stream compression and decompression | Synchronous `zlib.*Sync` methods (runs on main thread) |
| **Networking** | None (sockets never touch thread pool) | All TCP/UDP sockets (`net`, `dgram`, `http`, `fetch` via non-blocking epoll/kqueue) |
| **Processes / Timers** | None | Child processes (`spawn`, `exec`), pipes, signals, and `setTimeout`/`setImmediate` |

---

## 6. Module resolution and loaders ([03](modules/03-modules-and-packages.md#1-two-module-systems-in-one-runtime))

### File format determination

| File Extension | Containing `package.json` `"type"` | Resolved Module Format |
| :-- | :-- | :-- |
| `.mjs`, `.mts` | Any / none | **ESM** (`module` / `module-typescript`) |
| `.cjs`, `.cts` | Any / none | **CommonJS** (`commonjs` / `commonjs-typescript`) |
| `.js`, `.ts` | `"type": "module"` | **ESM** |
| `.js`, `.ts` | `"type": "commonjs"` | **CommonJS** |
| `.js`, `.ts` | Field absent | **Syntax detection**: CJS, unless file contains static `import`/`export`/TLA, then ESM |
| `.json` | Any / none | **JSON** (requires `with { type: 'json' }` under ESM) |
| `.node` | Any / none | **Native addon** (loaded via CJS `require` or `process.dlopen`) |

### `require(esm)` & Type Stripping Rules

- **`require(esm)`:** Synchronously loads ES modules via `require()` without flags (Node 22.12+, stable in 25.4+). Returns the module namespace object. If the target module or any transitive dependency uses top-level `await`, it throws `ERR_REQUIRE_ASYNC_MODULE`. Custom CJS return value: `export { target as 'module.exports' }`.
- **Package export conditions:** Matched in object key order: `"node"`, `"import"`, `"require"`, `"module-sync"` (matches both `import` and `require` when `require(esm)` is supported), `"default"` (fallback, must be last).
- **TypeScript Type Stripping:** Stable in Node 25.2/24.12. Erases types into whitespace, preserving line/column offsets for stack traces. Only **erasable syntax** is supported: annotations, interfaces, types, generics, `satisfies`, `as`. Runtime TS syntax (`enum`, parameter properties, namespaces) throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Ignores `tsconfig.json`.

---

## 7. Error and rejection policy ([04](modules/04-async-control-flow-and-errors.md#6-process-level-policy-uncaught-exceptions-and-unhandled-rejections))

### `--unhandled-rejections=<mode>`

| Mode | Behavior with NO `'unhandledRejection'` listener | Behavior WITH `'unhandledRejection'` listener |
| :-- | :-- | :-- |
| `throw` (**default**) | Emits uncaught exception; prints stack trace and exits with code **1** | Listener invoked; rejection marked handled; process continues |
| `strict` | Emits uncaught exception; exits with code **1** | Listener invoked, but still raises uncaught exception and exits **1** |
| `warn` | Prints `UnhandledPromiseRejectionWarning`; process continues | Listener invoked; no warning logged |
| `warn-with-error-code` | Prints warning; continues running; exits with code **1** on drain | Listener invoked; exits with code 0 if listener handles it |
| `none` | Silently swallowed; no log, no exit | Listener invoked |

### `EventEmitter` error rules

- `emitter.emit('error', err)` throws `err` if no `'error'` listener is registered. If the error is not an `Error` instance, wraps it in `ERR_UNHANDLED_ERROR`.
- `events.errorMonitor`: Allows monitoring error events without consuming them or altering unhandled error semantics.
- Async listeners returning rejected promises are silently unhandled unless `captureRejections: true` is configured on the emitter or class.

---

## 8. Buffers and streams ([05](modules/05-buffers-streams-backpressure.md#2-streams-the-model))

| Setting / Metric | Default Value | Operational Meaning |
| :-- | :-- | :-- |
| Byte stream `highWaterMark` | **64 KiB** (65 536 bytes) | Buffer threshold before `write()` returns `false` (was 16 KiB in Node ≤ 21) |
| Object mode `highWaterMark` | **16 objects** | Item count threshold before backpressure triggers in object mode |
| `Buffer.poolSize` | **64 KiB** (65 536 bytes) | Shared slab for `allocUnsafe` and string buffers `< 32 KiB` (Node 26.3+) |
| `pipe()` vs `pipeline()` | Always use **`pipeline`** | `pipe` leaks sockets/descriptors on error; `pipeline` guarantees cleanup and error forwarding |

### Stream Backpressure Protocol

```
Consumer: sink.write(chunk) === false  → Buffer at or above highWaterMark; producer must stop writing.
Producer: await once(sink, 'drain')     → Buffer drained below low-water mark; producer resumes.
```

- **Lifecycle events:** Readable emits `'data'` → `'end'` → `'close'`. Writable emits `'drain'` → `'finish'` → `'close'`. Both emit `'error'`.
- **Memory safety:** Small slices of pooled Buffers pin their backing 64 KiB slab in memory. For long-lived caches, use `Buffer.allocUnsafeSlow()` or clone with `Uint8Array.prototype.slice`.

---

## 9. Child processes ([06](modules/06-filesystem-process-os.md#5-child-processes))

| Function | Shell Spawned? | Output Handling | Buffer Limit | Primary Use Case |
| :-- | :-- | :-- | :-- | :-- |
| `spawn(file, args, opts)` | No (unless `shell: true`) | Streamed (`child.stdout`) | Unlimited | Streaming large datasets, long-running services |
| `execFile(file, args, opts, cb)` | No | Buffered into memory | `maxBuffer` (1 MiB default) | Short CLI commands with explicit argument array |
| `exec(command, opts, cb)` | **Yes** (`/bin/sh`, `cmd.exe`) | Buffered into memory | `maxBuffer` (1 MiB default) | Fixed shell pipelines; NEVER with unsanitized user input |
| `fork(module, args, opts)` | No | Streamed + IPC channel | Unlimited | Node-to-Node worker isolation with structured messaging |

- **Shell injection:** Never pass untrusted strings to `exec()` or `spawn` with `shell: true`. Use `execFile` with an array of arguments. `spawn(cmd, args, { shell: true })` concatenates arguments unescaped (DEP0190).
- **IPC serialization:** Default `'json'` strips `BigInt`, `Map`, `Set`, and `Date`. Configure `serialization: 'advanced'` to enable V8 structured clone support.

---

## 10. Networking and HTTP defaults ([07](modules/07-networking-and-http.md#4-server-timeouts))

### Server timeouts (`http.Server`)

| Timeout Property | Default (Node 26) | Purpose & Load Balancer Alignment |
| :-- | :-- | :-- |
| `headersTimeout` | **60 000 ms** (60 s) | Max time to parse incoming HTTP headers; must exceed `keepAliveTimeout` |
| `requestTimeout` | **300 000 ms** (300 s) | Max time to receive entire request body; prevents slow-POST attacks |
| `keepAliveTimeout` | **5 000 ms** (5 s) | Idle time on kept-alive socket before closure; advertised in `Keep-Alive: timeout=5` |
| `keepAliveTimeoutBuffer` | **1 000 ms** (1 s) | Extra internal socket timer slack (Node 24.6+) to reduce race conditions |
| `timeout` | **0** (disabled) | Socket inactivity timeout; emits `'timeout'` event without closing socket |

**Load Balancer Alignment Rule:** To prevent 502 Bad Gateway errors caused by race conditions on idle connection closure: $$\text{Server } \texttt{headersTimeout} > \text{Server } \texttt{keepAliveTimeout} > \text{Load Balancer Idle Timeout} > \text{Client Agent Timeout}$$

### Client Agents & DNS

- `http.globalAgent`: `keepAlive: true` (Node 19+), `maxFreeSockets: 256`, `maxSockets: Infinity`, idle timeout 5 000 ms, LIFO scheduling. Always set finite `maxSockets` per upstream in production.
- `fetch` / undici: `fetch` rejects only on network errors or timeouts; HTTP 4xx/5xx responses resolve with `res.ok === false`. Always consume or cancel bodies (`await res.text()` or `await res.body.cancel()`) to return sockets to pool.
- DNS defaults: `dns.lookup()` runs on thread pool; `dns.resolve*()` uses c-ares. Result order is `'verbatim'` (Node 17+). Happy Eyeballs (`autoSelectFamily`) defaults to 500 ms attempt delay.

---

## 11. Fastify service architecture ([08](modules/08-building-services.md#2-fastifys-architecture))

### Lifecycle Hook Order

$$\texttt{onRequest} \to \texttt{preParsing} \to \text{Parser} \to \texttt{preValidation} \to \text{Ajv Validation} \to \texttt{preHandler} \to \text{Handler} \to \texttt{preSerialization} \to \text{Serializer} \to \texttt{onSend} \to \texttt{onResponse}$$

- **Schema validation:** Fastify compiles JSON Schema with Ajv at startup. Default option `removeAdditional: true` silently strips undeclared body properties. Set `additionalProperties: false` and `removeAdditional: false` to return 400 on unexpected properties.
- **Fast serialization:** Response schemas compile via `fast-json-stringify`, stripping undeclared properties from output payloads to prevent sensitive data leaks.
- **Encapsulation:** Contexts are isolated down the plugin tree. Plugins registered without `fastify-plugin` (or `skip-override`) do not expose decorators, hooks, or routes to parent or sibling contexts.

---

## 12. Concurrency and worker threads ([09](modules/09-concurrency-and-scaling.md#1-concurrency-parallelism-and-the-four-options))

| Concurrency Model | Memory Isolation | Startup Overhead | Communication Primitive | Best Applied To |
| :-- | :-- | :-- | :-- | :-- |
| **Event loop** | Single heap | Zero | Direct synchronous / async calls | I/O-bound web APIs and database queries |
| **`worker_threads`** | Separate isolates; shared OS process | ~5–10 ms, ~20–30 MB | `postMessage` (clone/transfer), `SharedArrayBuffer` | CPU-bound computation, image resizing, parsing |
| **`child_process`** | Complete OS isolation | ~30–50 ms, ~40–60 MB | IPC channel, stdin/stdout streams | Untrusted code, foreign CLI tools, isolated crashes |
| **`cluster` / `SO_REUSEPORT`** | Multi-process; shared listening port | Process-level | Master/worker IPC, OS socket balancing | Single-node multi-core scaling without orchestrator |
| **Containers / Pods** | Full OS and cgroup limits | Seconds | Network (HTTP, gRPC, queues) | Horizontal production service scaling |

### Worker Communication Semantics

- **Structured clone:** Deep copy; supports `Map`, `Set`, `Date`, `RegExp`, `ArrayBuffer`, typed arrays, and cycles. Functions and symbols throw `DataCloneError`.
- **Transfer list:** `postMessage(data, [buffer])` transfers memory ownership in O(1) time. The transferred `ArrayBuffer` becomes detached (byteLength 0) in the sender. Pooled Buffers cannot be transferred.
- **Shared memory:** `SharedArrayBuffer` allows direct concurrent read/writes; synchronise using `Atomics.add`, `Atomics.wait`, `Atomics.notify`.

---

## 13. V8 memory and GC triage ([10](modules/10-v8-memory-and-gc.md#1-where-a-node-processs-memory-goes))

### Memory metrics (`process.memoryUsage()`)

- `rss`: Resident Set Size; total physical memory allocated by the OS process (heap + external + native + worker isolates).
- `heapTotal`: Total V8 heap memory allocated by the virtual machine.
- `heapUsed`: Memory actively occupied by live JavaScript objects and closures.
- `external`: Native memory bound to V8 objects (includes `Buffer` and `ArrayBuffer` backing stores).
- `arrayBuffers`: Memory allocated for raw binary `ArrayBuffer` backing stores.

### OOM triage: V8 Heap OOM vs Container OOM Kill

| Metric / Symptom | V8 Heap Out of Memory | Container / Kernel OOM Kill |
| :-- | :-- | :-- |
| **Exit code & signal** | Exit **134** (SIGABRT) | Exit **137** (SIGKILL, `OOMKilled`) |
| **Mechanism** | V8 failed allocation near `--max-old-space-size` | Linux kernel OOM killer terminated container cgroup |
| **Output** | `FATAL ERROR: Ineffective mark-compacts near heap limit` | No output; process terminated mid-instruction |
| **Evidence available** | Heap snapshot (`--heapsnapshot-near-heap-limit`), report | Container metrics only; no in-process dump |
| **Root cause** | JavaScript object leak or undersized heap limit | Heap set above container limit, or external Buffer/native leak |

---

## 14. Diagnostics toolbox ([11](modules/11-diagnostics-and-performance.md#2-the-built-in-toolbox))

| Diagnostic Tool | Primary Metric / Question Answered | Production Overhead | Safe in Production? |
| :-- | :-- | :-- | :-- |
| `perf_hooks.monitorEventLoopDelay()` | Callback delay and scheduling latency (p50/p99) | Low | **Yes**, always enabled |
| `performance.eventLoopUtilization()` | Active execution time ratio vs idle poll time | Negligible | **Yes**, always enabled |
| `--cpu-prof` | CPU execution profile and flame graphs | Low (sampling) | Yes (bounded time windows) |
| `--heap-prof` | Memory allocation call sites | Low (sampling) | Yes (bounded time windows) |
| `v8.writeHeapSnapshot()` | Complete object graph and retainer paths | **Stops the process** | Canary / drained nodes only |
| `process.report.writeReport()` | JSON dump of stacks, handles, heap, and OS limits | Low | **Yes** (use `--report-exclude-env`) |
| `--inspect` | Interactive DevTools debugging | High (pauses execution) | **No** on public networks |
| `diagnostics_channel` | Named event telemetry across core and libraries | Negligible | **Yes**, built-in |

---

## 15. Testing and assertions ([12](modules/12-testing.md#3-the-runner))

### Test Runner Quick Reference

- **Execution:** `node --test` discovers `**/*.test.{js,ts,mjs}`. Each file runs in an isolated child process by default (`--test-isolation=process`).
- **Concurrency:** `--test-concurrency=n` runs _n_ files in parallel (default: CPUs − 1).
- **Reporters:** `--test-reporter=spec` (TTY default), `tap` (CI default), `junit`, `dot`, `lcov`.
- **Mocks & Timers:**
  - `mock.fn(impl)`: Spies on calls and results; `fn.mock.calls[i].arguments`.
  - `mock.method(obj, 'method')`: Replaces method; restore with `m.mock.restore()`.
  - `mock.timers.enable()`: Replaces `setTimeout`, `setInterval`, `Date` with fake clock; advance with `mock.timers.tick(ms)`.

### Strict Assertions (`node:assert/strict`)

Always import `node:assert/strict`. `assert.deepEqual` uses `deepStrictEqual`:

- **Primitives:** Compared via `Object.is` (SameValue: `NaN === NaN`, `+0 !== -0`).
- **Prototypes:** `[[Prototype]]` must be strictly identical (`===`); `{}` does not equal `Object.create(null)`.
- **Objects & Collections:** Enumerable own properties compared deeply; property key order ignored. `Map` and `Set` compared by contents.
- **Typed arrays:** Byte contents must match exactly.

---

## 16. Security hardening ([13](modules/13-security.md#10-a-hardening-checklist))

| Vector / Domain | Hardening Mechanism | CLI Flag or Implementation |
| :-- | :-- | :-- |
| **Permission model** | Restricts filesystem, network, child process, worker execution | `--permission --allow-fs-read=./ --allow-net` |
| **Prototype pollution** | Disables mutable `__proto__` property on `Object.prototype` | `--disable-proto=throw` or `--disable-proto=delete` |
| **ReDoS** | Prevents catastrophic backtracking in regex evaluation | Bound input strings (`maxLength`); audit regexes for nested quantifiers |
| **SSRF** | Blocks access to internal networks (`10.0.0.0/8`, `169.254.169.254`) | Validate URLs and pin resolved IP addresses in custom `lookup` agent hook |
| **Supply chain** | Eliminates lifecycle script execution during dependency install | `npm ci --ignore-scripts --omit=dev`; commit `package-lock.json` |
| **Sandboxing** | Code execution isolation | Note: `node:vm` is **not a security sandbox**; use OS container isolation |

---

## 17. Production operations and containers ([14](modules/14-production-operations.md#3-container-images-for-node))

### Container Image Best Practices

- **Base image:** Use `node:26.13.0-slim` (Debian glibc) pinned by exact tag and digest. Avoid Alpine unless native binaries and DNS are verified.
- **Unprivileged user:** Switch to non-root user (`USER node`).
- **Entrypoint:** Use exec form `CMD ["node", "src/server.js"]`. Never invoke via `npm start` or shell wrapper.
- **Compilation cache:** Enable `ENV NODE_COMPILE_CACHE=/app/.cache` to write V8 code caches and accelerate container cold starts.
- **Heap sizing:** Set `--max-old-space-size-percentage=60` to automatically budget the V8 heap at 60% of container cgroup memory.

### Graceful Shutdown Sequence

```
1. Receive SIGTERM from orchestrator.
2. Stop accepting new connections (server.close() / server.closeIdleConnections()).
3. Set readiness probe to false (503 Service Unavailable).
4. Allow in-flight requests to complete within a bounded grace timeout (e.g. 15 s).
5. Close database connection pools, message brokers, and background worker queues.
6. Force exit 0 before orchestrator issues SIGKILL (typically 30 s default).
```
