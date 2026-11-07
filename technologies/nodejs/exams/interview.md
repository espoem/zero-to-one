# Senior Node.js Backend Interview: Question Bank (`interview`)

Original questions for the senior Node.js technical interview format described in [README.md](README.md). Content is derived from the official Node.js documentation and this track's modules; nothing reproduces or paraphrases real exam content or NDA material.

- **Question types:** `single` (one correct answer), `multi` (select all that apply), `scenario` (production debugging and incident response), `ordering` (chronological or lifecycle sequence), `hands-on` (live coding verified with deterministic tests).
- **Difficulty:** 1 = solid mid-level, 2 = senior engineer, 3 = deep internals and subtle edge cases.
- **Answers** are collapsed in `<details>` blocks. Each provides the rationale, explains why every distractor is incorrect, and cites the teaching module anchor and official documentation URL.
- Code snippets state explicitly whether execution occurs in CommonJS (`.cjs` / default `type`) or ECMAScript module (`.mjs` / `"type": "module"`) format.

## Domains

| #   | Domain                                      | Weight | Questions | Status |
| --- | ------------------------------------------- | ------ | --------- | ------ |
| D1  | Runtime architecture                        | 6%     | 5         | ✅     |
| D2  | Event loop                                  | 14%    | 10        | ✅     |
| D3  | Modules and packages                        | 10%    | 7         | ✅     |
| D4  | Async control flow and errors               | 10%    | 7         | ✅     |
| D5  | Buffers and streams                         | 12%    | 9         | ✅     |
| D6  | File system, processes and OS               | 8%     | 6         | ✅     |
| D7  | Networking and HTTP                         | 10%    | 7         | ✅     |
| D8  | Building services                           | 8%     | 6         | ✅     |
| D9  | Concurrency and scaling                     | 8%     | 6         | ✅     |
| D10 | Memory and performance                      | 8%     | 6         | ✅     |
| D11 | Testing, security and operations            | 6%     | 5         | ✅     |
| H   | Hands-on coding tasks (span D4, D5, D8, D9) | —      | 6         | ✅     |
|     | **Total**                                   | 100%   | **80**    |        |

---

## D1 · Runtime architecture

### Q-NODE-001 · Runtime architecture · difficulty 1 · single

Which architectural component of Node.js directly provides the cross-platform event loop, non-blocking asynchronous I/O abstractions (sockets, filesystem), and the worker thread pool?

- A) V8 engine
- B) libuv
- C) llhttp
- D) Node-API (n-api)

<details><summary>Answer</summary>

**B.** libuv is the multi-platform C library that handles the event loop, asynchronous I/O polling (epoll, kqueue, IOCP), timers, child processes, and the worker thread pool.

- Why not A: V8 is Google's ECMAScript and WebAssembly engine that compiles and executes JavaScript code, manages call stacks, and handles garbage collection.
- Why not C: llhttp is the C HTTP parser used by Node to parse HTTP requests and responses.
- Why not D: Node-API is the ABI-stable C API for authoring native C/C++ addons across Node versions.
- Ref: [modules/01-runtime-architecture.md](../modules/01-runtime-architecture.md#1-the-four-layers), https://nodejs.org/api/process.html

</details>

### Q-NODE-002 · Runtime architecture · difficulty 2 · scenario

A production microservice writes audit JSON lines to `process.stdout`. Under a deployment where output is piped to a file or log shipper (`node app.js > /var/log/audit.log`), an error triggers `process.exit(1)`. Operators report that the last several log lines prior to termination are consistently missing. What is the root cause and the recommended resolution?

- A) `process.exit()` terminates before V8 runs garbage collection; call `global.gc()` first.
- B) When standard streams point to a file or pipe on POSIX, `process.stdout` is asynchronous; `process.exit(1)` immediately terminates the process without flushing stream buffers. Set `process.exitCode = 1` and let the event loop drain naturally.
- C) Linux kernel drops pipe buffers when SIGTERM is delivered; change logging to `process.stderr`.
- D) Node disables stdio buffering unless `--buffered-stdio` is passed as a CLI flag.

<details><summary>Answer</summary>

**B.** `process.stdout` and `process.stderr` in Node are synchronous only when connected to a TTY (interactive terminal). When redirected to a pipe or file, writes are asynchronous streams. Calling `process.exit()` terminates the native process immediately, discarding unflushed userland and libuv buffers. Setting `process.exitCode = 1` allows pending I/O to flush before exit.

- Why not A: Garbage collection does not flush I/O streams; forcing GC does not drain pending writes.
- Why not C: Pipe buffers are not dropped by the kernel on normal exit; the userland stream buffer inside Node was never sent to the kernel.
- Why not D: There is no `--buffered-stdio` flag; stream synchronicity is determined by whether the file descriptor refers to a TTY.
- Ref: [modules/01-runtime-architecture.md](../modules/01-runtime-architecture.md#5-the-process-object-standard-io-and-signals), https://nodejs.org/api/process.html

</details>

### Q-NODE-003 · Runtime architecture · difficulty 3 · single

In Node 26, what exit code does the runtime produce when an ECMAScript module's top-level `await` never settles (for example `await new Promise(() => {})`) and the event loop exhausts all other work?

- A) 0 (clean exit)
- B) 1 (uncaught exception)
- C) 13 (unsettled top-level await)
- D) 137 (OOM killed)

<details><summary>Answer</summary>

**C.** Node.js assigns exit code 13 specifically to unsettled top-level await promises when the event loop runs out of work while the entry module's top-level execution remains blocked.

- Why not A: An unresolved top-level promise halts execution without finishing the module graph; it is treated as an abnormal failure, not code 0.
- Why not B: Code 1 represents uncaught exceptions or generic failures; Node distinguishes unsettled TLA with code 13.
- Why not D: Code 137 is 128 + 9 (SIGKILL), issued by the OS kernel or container runtime, not Node's process monitor.
- Ref: [modules/01-runtime-architecture.md](../modules/01-runtime-architecture.md#2-the-process-lifecycle), https://nodejs.org/api/process.html

</details>

### Q-NODE-004 · Runtime architecture · difficulty 1 · multi

Which CLI options are permitted inside the `NODE_OPTIONS` environment variable? (Select all that apply.)

- A) `--max-old-space-size=4096`
- B) `--enable-source-maps`
- C) `-e` / `--eval`
- D) `-r` / `--require`

<details><summary>Answer</summary>

**A, B, D.** `NODE_OPTIONS` allows flags that modify V8 settings, execution features, and module preloading (`--require`, `--import`).

- Why not C: Executable code flags such as `-e`, `--eval`, and `-p` are explicitly disallowed in `NODE_OPTIONS` to prevent arbitrary code injection through inherited environment variables in child processes.
- Ref: [modules/01-runtime-architecture.md](../modules/01-runtime-architecture.md#3-configuring-a-process), https://nodejs.org/api/cli.html

</details>

### Q-NODE-005 · Runtime architecture · difficulty 2 · ordering

Place the standard Node.js process startup and shutdown steps in their exact chronological order of execution:

1. Main module code is loaded and evaluated
2. CLI options, environment variables, and config files are parsed
3. `beforeExit` event is emitted on `process`
4. Preload scripts (`-r` or `--import`) execute
5. `exit` event is emitted on `process`
6. libuv event loop runs until the active reference count reaches zero

- A) 2 -> 4 -> 1 -> 6 -> 3 -> 5
- B) 4 -> 2 -> 1 -> 3 -> 6 -> 5
- C) 2 -> 1 -> 4 -> 6 -> 3 -> 5
- D) 2 -> 4 -> 1 -> 3 -> 6 -> 5

<details><summary>Answer</summary>

**A.** Process lifecycle sequence: Node first parses arguments and environment (2), executes preload hooks and scripts (4), evaluates the entry point module (1), runs the event loop until no active handles/requests remain (6), emits `beforeExit` which can schedule further work (3), and finally emits `exit` when no work remains (5).

- Why not B: Environment and CLI flags must be processed before preloaded modules can be loaded.
- Why not C: Preload scripts (`-r` / `--import`) execute strictly before the main module.
- Why not D: `beforeExit` is emitted after the event loop runs out of initial work, not before the event loop runs.
- Ref: [modules/01-runtime-architecture.md](../modules/01-runtime-architecture.md#2-the-process-lifecycle), https://nodejs.org/api/process.html

</details>

---

## D2 · Event loop

### Q-NODE-006 · Event loop · difficulty 1 · single

In which libuv event loop phase are callbacks registered by `setImmediate()` executed?

- A) Timers
- B) Pending callbacks
- C) Poll
- D) Check

<details><summary>Answer</summary>

**D.** `setImmediate()` schedules callbacks in libuv's **check** phase, which runs immediately following the poll (I/O) phase on each iteration of the event loop.

- Why not A: The timers phase executes callbacks scheduled by `setTimeout()` and `setInterval()` whose deadlines have elapsed.
- Why not B: The pending callbacks phase executes deferred I/O callbacks from previous iterations (such as certain TCP socket errors).
- Why not C: The poll phase retrieves new I/O events, executes I/O callbacks, and calculates how long the thread should block waiting for connections.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#2-one-iteration-of-uv_run), https://nodejs.org/api/timers.html

</details>

### Q-NODE-007 · Event loop · difficulty 2 · single

Consider the following top-level code executed in a CommonJS entry file:

```js
// entry.cjs
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
```

What is the execution order when running `node entry.cjs`?

- A) Always `'timeout'`, then `'immediate'`
- B) Always `'immediate'`, then `'timeout'`
- C) Non-deterministic; depends on the process startup time and timer resolution
- D) It throws a `ReferenceError`

<details><summary>Answer</summary>

**C.** When scheduled at the entry point of a CommonJS file, the order between `setTimeout(..., 0)` and `setImmediate(...)` is non-deterministic. If the runtime takes longer than 1 ms to bootstrap and enter libuv's loop, the 1 ms clamped timer will have expired and runs in the timers phase. If the loop enters the timers phase in less than 1 ms, the timer is not yet ready, so the loop advances through poll to check where `setImmediate` runs first.

- Why not A: If the loop enters before the 1 ms threshold expires, `immediate` executes before `timeout`.
- Why not B: If bootstrap takes ≥ 1 ms, `timeout` executes before `immediate`.
- Why not D: Both functions are global functions on the Node.js global object.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#6-timers-in-depth), https://nodejs.org/api/timers.html

</details>

### Q-NODE-008 · Event loop · difficulty 3 · single

Consider the following snippet running inside an active I/O callback:

```js
import fs from 'node:fs';

fs.readFile('data.txt', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
```

Assuming `data.txt` exists, what is the guaranteed output order?

- A) Non-deterministic
- B) `'immediate'`, then `'timeout'`
- C) `'timeout'`, then `'immediate'`
- D) Both execute concurrently in worker threads

<details><summary>Answer</summary>

**B.** Inside an I/O callback, `setImmediate` is guaranteed to execute before `setTimeout(..., 0)`. The `readFile` callback runs in the **poll** phase of libuv. Once the poll phase finishes executing ready I/O callbacks, libuv proceeds directly to the **check** phase where `setImmediate` callbacks run, before looping back to the **timers** phase on the subsequent iteration.

- Why not A: Non-determinism only occurs at top-level script startup, never inside an I/O callback.
- Why not C: To reach timers, the loop must first pass through check, close callbacks, and loop around.
- Why not D: JavaScript timer and immediate callbacks run strictly on the main event loop thread.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#2-one-iteration-of-uv_run), https://nodejs.org/api/timers.html

</details>

### Q-NODE-009 · Event loop · difficulty 2 · ordering

Predict the exact output of the following snippet running as a CommonJS module:

```js
// index.cjs
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
```

- A) `'promise'`, then `'nextTick'`
- B) `'nextTick'`, then `'promise'`
- C) Non-deterministic
- D) It emits an `UnhandledPromiseRejection` warning

<details><summary>Answer</summary>

**B.** In CommonJS, top-level evaluation runs synchronously. When synchronous evaluation finishes, Node drains the `process.nextTick` queue before draining the microtask promise job queue. Therefore, `'nextTick'` logs before `'promise'`.

- Why not A: In CommonJS, the nextTick queue has higher priority than the V8 microtask queue at the tick boundary.
- Why not C: Queue priorities are completely deterministic.
- Why not D: The promise is resolved, not rejected.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#3-processnexttick-vs-microtasks), https://nodejs.org/api/process.html

</details>

### Q-NODE-010 · Event loop · difficulty 3 · ordering

Predict the exact output of the following snippet running as an ES module (`index.mjs`):

```js
// index.mjs
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
```

- A) `'promise'`, then `'nextTick'`
- B) `'nextTick'`, then `'promise'`
- C) Non-deterministic
- D) It exits with code 13

<details><summary>Answer</summary>

**A.** In an ES module, module evaluation is wrapped in a Promise job executed on the V8 microtask queue. When the module body completes, the microtask checkpoint immediately flushes any queued microtasks (including `Promise.resolve().then()`) _before_ returning control back to Node's tick callback runner. Consequently, `'promise'` logs before `'nextTick'`.

- Why not B: In ESM, the promise microtask runs as part of the initial microtask drain of module evaluation, reversing the CommonJS order.
- Why not C: The ECMAScript specification guarantees microtask FIFO ordering.
- Why not D: Code 13 only applies to unsettled top-level await; there is no unsettled await here.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#3-processnexttick-vs-microtasks), https://nodejs.org/api/process.html

</details>

### Q-NODE-011 · Event loop · difficulty 3 · scenario

An HTTP microservice handles user authentication and logging. Under moderate load (200 req/s), event-loop delay spikes to 450 ms, while CPU utilization across the 8-core host remains under 20%. Diagnostics reveal frequent calls to `crypto.scrypt()` for password verification and `dns.lookup()` for external telemetry hosts. What is the root cause and the most effective mitigation?

- A) V8 garbage collection scavenges too frequently; increase `--max-semi-space-size`.
- B) Both `crypto.scrypt()` and `dns.lookup()` execute on libuv's worker thread pool (default size 4). Concurrent requests exhaust all 4 threads, queueing subsequent async I/O in a FIFO backlog. Increase `UV_THREADPOOL_SIZE`, offload password hashing to a dedicated worker thread, and use `dns.resolve4()` for DNS.
- C) Fastify routes are blocking the main loop; wrap handlers in `setImmediate()`.
- D) The OS file descriptor table is exhausted; increase `ulimit -n`.

<details><summary>Answer</summary>

**B.** Both `crypto.scrypt` (and `pbkdf2`) and `dns.lookup` (which uses synchronous `getaddrinfo(3)`) run on libuv's shared thread pool, which defaults to only 4 threads. Saturated thread pool tasks cause long queues where DNS lookups and crypto tasks block one another, while the main event loop thread idles waiting for thread pool responses. Mitigation includes setting `UV_THREADPOOL_SIZE`, offloading CPU tasks to `worker_threads`, and using non-blocking c-ares `dns.resolve4()`.

- Why not A: GC pauses show high V8 CPU activity, not low CPU with thread queue starvation.
- Why not C: Wrapping handlers in `setImmediate` does not relieve thread pool saturation.
- Why not D: File descriptor limits cause `EMFILE` errors, not silent thread pool queue delays.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#5-the-thread-pool), https://nodejs.org/api/cli.html

</details>

### Q-NODE-012 · Event loop · difficulty 2 · multi

Which of the following Node.js operations utilize the libuv worker thread pool by default? (Select all that apply.)

- A) `fs.promises.readFile()`
- B) `crypto.pbkdf2()`
- C) `net.connect()` (TCP socket connection)
- D) `dns.lookup()`

<details><summary>Answer</summary>

**A, B, D.** Filesystem operations (`fs.*`), synchronous OS name resolution (`dns.lookup`), and certain cryptographic primitives (`pbkdf2`, `scrypt`, `randomBytes`) are offloaded to libuv's thread pool.

- Why not C: Network I/O (`net`, `http`, `tls`) is fully non-blocking and uses native OS readiness polling (epoll on Linux, kqueue on macOS, IOCP on Windows) in libuv's poll phase without thread pool threads.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#5-the-thread-pool), https://nodejs.org/api/dns.html

</details>

### Q-NODE-013 · Event loop · difficulty 1 · single

What occurs when a recursive function repeatedly invokes `process.nextTick()` without any base condition?

- A) It throws `RangeError: Maximum call stack size exceeded`.
- B) The event loop advances to the check phase after 100 ticks.
- C) It starves the event loop indefinitely, preventing timers, I/O callbacks, and check callbacks from ever running.
- D) Node terminates with exit code 13.

<details><summary>Answer</summary>

**C.** `process.nextTick()` queues callbacks in Node's tick queue. The runtime continuously drains this queue until it is completely empty before proceeding to event loop phases. Recursive calls repeatedly replenish the queue, causing complete I/O and timer starvation. Because it uses the queue rather than V8 stack frames, no call stack error is thrown.

- Why not A: Callbacks are queued asynchronously, so the V8 call stack unwinds between invocations.
- Why not B: Node does not cap nextTick processing at 100 in modern versions; it starves until killed.
- Why not D: Exit code 13 is for unsettled top-level await.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#4-blocking-and-starvation), https://nodejs.org/api/process.html

</details>

### Q-NODE-014 · Event loop · difficulty 2 · single

What is the effect of calling `timer.unref()` on a `Timeout` instance created with `setTimeout(cb, 1000)`?

- A) The timer is immediately cancelled and `cb` is never executed.
- B) If this timer is the only active handle keeping the event loop alive, the Node.js process is permitted to exit without waiting for `cb`.
- C) The timer callback is offloaded to a worker thread.
- D) The timer interval is reduced to 1 ms.

<details><summary>Answer</summary>

**B.** `.unref()` decrements the reference count that libuv tracks. If all remaining handles and requests in the loop are unreferenced, the loop terminates and the process exits, even if the timer has not fired. If other active handles keep the loop running, the timer fires normally.

- Why not A: Unreferencing does not cancel the timer; `clearTimeout()` cancels it.
- Why not C: Timers run on the event loop, not on worker threads.
- Why not D: It does not alter the timer duration.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#1-definitions), https://nodejs.org/api/timers.html

</details>

### Q-NODE-015 · Event loop · difficulty 3 · single

In Node 26, how does the runtime handle timer delays passed as non-integer or negative numbers, such as `setTimeout(fn, -5)` or `setTimeout(fn, 0)`?

- A) Negative numbers throw a `TypeError`.
- B) Delays less than 1 ms or non-numbers (NaN) are clamped to a minimum of 1 ms.
- C) `0` executes synchronously on the spot.
- D) Delays are rounded up to the nearest multiple of 10 ms.

<details><summary>Answer</summary>

**B.** Node.js adheres to the HTML timer specification: timer values less than 1, greater than 2^31 - 1 (2,147,483,647 ms), or non-numbers are clamped to 1 ms.

- Why not A: Timers do not throw on negative numbers; they are clamped.
- Why not C: `setTimeout` is never synchronous; it always schedules an asynchronous timer handle.
- Why not D: Clamping is to 1 ms, not 10 ms.
- Ref: [modules/02-event-loop.md](../modules/02-event-loop.md#6-timers-in-depth), https://nodejs.org/api/timers.html

</details>

---

## D3 · Modules and packages

### Q-NODE-016 · Modules and packages · difficulty 1 · single

How does Node 26 determine whether a `.js` file is loaded as CommonJS or an ES module when no command-line flags or inline directives are present?

- A) By inspecting the file extension only; `.js` is always CommonJS.
- B) By inspecting the `"type"` field in the nearest ancestor `package.json` (`"module"` loads `.js` as ESM, otherwise CommonJS).
- C) By statically parsing for `import` or `export` keywords.
- D) By checking whether the file starts with `'use strict'`.

<details><summary>Answer</summary>

**B.** Node determines module format for `.js` files using package scope: it traverses parent directories for the nearest `package.json`. If `"type": "module"` is found, `.js` is treated as ESM; otherwise (or if absent), it defaults to CommonJS. `.mjs` is always ESM and `.cjs` is always CommonJS.

- Why not A: `.js` files in `"type": "module"` packages are loaded as ESM.
- Why not C: Node 26 syntax detection exists under experimental modes or entry scripts, but package scope remains the standard package format contract.
- Why not D: `'use strict'` enables strict mode semantics; it does not change the module format.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#1-two-module-systems-in-one-runtime), https://nodejs.org/api/packages.html

</details>

### Q-NODE-017 · Modules and packages · difficulty 2 · single

In Node 26, under what condition can a CommonJS module synchronously require an ECMAScript module using `require('./dep.mjs')`?

- A) Only if `--experimental-require-module` is passed on the command line.
- B) The target ES module graph must be synchronous (it must not contain top-level `await`).
- C) `require(esm)` is forbidden in Node.js; dynamic `import()` must always be used.
- D) Only if the ES module has a default export.

<details><summary>Answer</summary>

**B.** `require(esm)` is enabled by default in modern Node.js. It allows synchronous `require()` of ES modules provided that neither the target module nor any module in its dependency graph contains top-level `await`. If top-level `await` is present, `require()` throws `ERR_REQUIRE_ASYNC_MODULE`.

- Why not A: `require(esm)` is enabled by default in Node 26 without experimental flags.
- Why not C: `require(esm)` was stabilized to ease ecosystem migration.
- Why not D: Named exports are mapped directly to properties on the returned object; default export is available on `.default`.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#4-requireesm), https://nodejs.org/api/modules.html

</details>

### Q-NODE-018 · Modules and packages · difficulty 3 · single

In a package's `package.json` `"exports"` field, what is the purpose of the `"module-sync"` condition?

- A) To force Webpack and Vite to ignore the module during bundling.
- B) To provide a synchronous ESM entry point for `require(esm)` consumers, while providing a potentially async entry point under `"import"`.
- C) To indicate that the module runs synchronously on the main thread rather than a worker thread.
- D) To disable CJS caching for that module.

<details><summary>Answer</summary>

**B.** The `"module-sync"` export condition is matched by Node when an ES module is resolved via synchronous `require(esm)`. It allows dual-mode libraries to provide a synchronous ESM build for CommonJS `require()` consumers without bundling top-level await, while allowing standard `"import"` consumers to use full ESM features.

- Why not A: Bundlers recognize standard conditions; `"module-sync"` is specifically designed for Node's synchronous module loader.
- Why not C: It is a module resolution condition, not a thread affinity setting.
- Why not D: Export conditions do not alter module caching rules.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#4-requireesm), https://nodejs.org/api/packages.html

</details>

### Q-NODE-019 · Modules and packages · difficulty 2 · scenario

A library package ships both CJS and ESM builds: `dist/index.cjs` and `dist/index.mjs`. When an application imports the package via ESM and a third-party dependency requires it via CJS, the library's internal state is duplicated, and `instanceof` checks on exported classes fail. What is this problem called, and how should it be avoided?

- A) Prototype pollution; solve by freezing prototypes.
- B) Dual-package hazard; solve by exporting a single ESM implementation with a thin CJS wrapper, or structuring `"exports"` so both formats point to a single stateful instance.
- C) Dependency confusion; solve by using scoped npm packages.
- D) Zalgo; solve by wrapping exports in `setImmediate()`.

<details><summary>Answer</summary>

**B.** The dual-package hazard occurs when two distinct copies of a package are loaded into memory simultaneously (one by the CJS loader and one by the ESM loader). Module caches are isolated per loader, creating two copies of singletons and classes. The standard solution is to keep state in a single shared file (often CJS required by ESM, or vice versa) so that only one instance is ever created.

- Why not A: Prototype pollution is an injection vulnerability, not duplicate module instance loading.
- Why not C: Dependency confusion is a supply-chain attack involving public vs private package registries.
- Why not D: Zalgo refers to mixed synchronous and asynchronous callback execution.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#5-packages-as-node-reads-them), https://nodejs.org/api/packages.html

</details>

### Q-NODE-020 · Modules and packages · difficulty 1 · single

How does Node 26's built-in TypeScript type stripping execute a `.ts` file?

- A) It runs `tsc` in a worker thread and validates all types before execution.
- B) It replaces type annotations with whitespace (erasable syntax) without performing type checking, executing the resulting JavaScript directly in V8.
- C) It converts TypeScript AST into WebAssembly.
- D) It compiles TypeScript to CommonJS and stores it in `/tmp`.

<details><summary>Answer</summary>

**B.** Node's type stripping removes type annotations by replacing them with equivalent whitespace so line and column numbers remain unaltered. It performs no type checking and rejects non-erasable TypeScript syntax (such as `enum`, namespaces, or parameter properties) unless experimental transformation flags are active.

- Why not A: `tsc` is not bundled with Node; type checking is the developer's build-time responsibility.
- Why not C: V8 executes JavaScript, not WebAssembly transformed from TypeScript AST.
- Why not D: Stripping occurs directly in-memory before V8 compilation.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#7-typescript-type-stripping), https://nodejs.org/api/typescript.html

</details>

### Q-NODE-021 · Modules and packages · difficulty 3 · multi

Which lifecycle hooks can be defined in a module customisation file registered with `module.registerHooks()`? (Select all that apply.)

- A) `initialize`
- B) `resolve`
- C) `load`
- D) `transformSource`

<details><summary>Answer</summary>

**A, B, C.** Modern Node.js module customisation hooks API (`module.registerHooks` / `module.register`) supports `initialize` (for passing worker data), `resolve` (for intercepting module specifiers and URLs), and `load` (for modifying source code, format, or headers).

- Why not D: `transformSource` was the legacy experimental hook that was deprecated and replaced by `load`.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#6-customisation-hooks-moduleregisterhooks), https://nodejs.org/api/module.html

</details>

### Q-NODE-022 · Modules and packages · difficulty 2 · single

What is the effect of running Node with `--enable-compile-cache` (or `NODE_COMPILE_CACHE=path`)?

- A) It saves TypeScript compilation outputs in `node_modules/.cache`.
- B) It persists V8 code cache (bytecode and compilation metadata) on disk to accelerate startup on subsequent executions.
- C) It enables ahead-of-time (AOT) machine code compilation for all dependencies.
- D) It caches HTTP response bodies returned by `fetch()`.

<details><summary>Answer</summary>

**B.** `--enable-compile-cache` persists V8's native code cache to disk. When modules are required or imported again in subsequent runs, V8 reads the cached bytecode directly, bypassing lexical analysis and parsing to reduce process startup latency.

- Why not A: It is a V8 JavaScript bytecode cache, not a TypeScript transpilation cache.
- Why not C: V8 does not compile ahead-of-time to machine code; it caches bytecode and compile metadata.
- Why not D: It has no relation to HTTP caching.
- Ref: [modules/03-modules-and-packages.md](../modules/03-modules-and-packages.md#9-startup-cost-the-compile-cache), https://nodejs.org/api/cli.html

</details>

---

## D4 · Async control flow and errors

### Q-NODE-023 · Async control flow and errors · difficulty 1 · single

In Node.js async design, what is "Zalgo", and why is it considered an anti-pattern?

- A) An unhandled memory leak caused by unreferenced timers.
- B) An API function that invokes its callback synchronously in some branches and asynchronously in others.
- C) A race condition between worker threads accessing shared memory.
- D) An infinite loop in libuv's poll phase.

<details><summary>Answer</summary>

**B.** "Releasing Zalgo" refers to an API that exhibits inconsistent synchronicity: calling its callback synchronously under certain conditions (e.g. cache hits) and asynchronously under others (e.g. cache misses). This violates caller ordering assumptions, leads to re-entrancy bugs, and can cause uncaught exceptions if callers expect async execution.

- Why not A: Memory leaks are resource issues, not Zalgo.
- Why not C: Race conditions across threads are concurrency hazards.
- Why not D: Event loop blockage is starvation, not Zalgo.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#1-three-generations-of-asynchronous-apis), https://nodejs.org/api/process.html

</details>

### Q-NODE-024 · Async control flow and errors · difficulty 2 · single

What occurs when an instance of `EventEmitter` emits an `'error'` event and has zero listeners registered for `'error'`?

- A) The event is silently ignored and execution proceeds.
- B) It logs a warning to `process.stderr` and continues.
- C) The `EventEmitter` throws an uncaught exception, which crashes the process if unhandled.
- D) It queues the error until a listener is added.

<details><summary>Answer</summary>

**C.** In Node's `EventEmitter` implementation, the `'error'` event is special. If an `'error'` event is emitted and no listener is registered for it, the emitter throws the error. If not caught in a try/catch, it becomes an uncaught exception, terminating the process.

- Why not A: Silent failure would mask critical operational errors; EventEmitter guarantees error reporting.
- Why not B: It throws an actual exception, not merely a warning.
- Why not D: EventEmitter does not buffer unhandled events.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#2-eventemitter), https://nodejs.org/api/events.html

</details>

### Q-NODE-025 · Async control flow and errors · difficulty 2 · multi

Which characteristics distinguish Node's `EventEmitter` from standard DOM `EventTarget`? (Select all that apply.)

- A) `EventEmitter.prototype.emit()` synchronously invokes all registered listeners in order and returns a boolean.
- B) `EventTarget.prototype.dispatchEvent()` passes an `Event` object with `type`, `target`, and `bubbles`.
- C) `EventEmitter` throws an exception if `'error'` is emitted with no listener; `EventTarget` does not treat `'error'` specially.
- D) `EventTarget` supports `captureRejections` for asynchronous Promise error handling.

<details><summary>Answer</summary>

**A, B, C.** `EventEmitter` is synchronous, emits arbitrary arguments, and throws when `'error'` has no listeners. `EventTarget` conforms to the WHATWG DOM specification: it accepts an `Event` instance, supports cancellation via `event.preventDefault()`, and does not have special handling for `'error'`.

- Why not D: `captureRejections` is a Node-specific `EventEmitter` feature; DOM `EventTarget` does not implement `captureRejections`.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#2-eventemitter), https://nodejs.org/api/events.html

</details>

### Q-NODE-026 · Async control flow and errors · difficulty 3 · scenario

In Node 26, what is the default behavior when an unhandled Promise rejection occurs in a process that does not register a listener for `process.on('unhandledRejection')`?

- A) The rejection is logged as a warning and the process continues running (mode `warn`).
- B) The rejection is silently swallowed (mode `none`).
- C) The runtime emits `'unhandledRejection'`; because it is unhandled, it treats the rejection as an uncaught exception, prints the error and stack trace to stderr, and exits with code 1 (mode `throw`).
- D) The process enters infinite sleep.

<details><summary>Answer</summary>

**C.** Modern Node.js defaults `--unhandled-rejections=throw`. Unhandled promise rejections emit `unhandledRejection`; if no listener handles the event, the process raises an uncaught exception, prints the error stack trace, and exits with non-zero exit code 1.

- Why not A: Mode `warn` was the legacy default in Node 12–14; it is no longer the default in Node 26.
- Why not B: Mode `none` must be explicitly configured via `--unhandled-rejections=none`.
- Why not D: Unhandled rejections terminate the process, they do not sleep.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#6-process-level-policy-uncaught-exceptions-and-unhandled-rejections), https://nodejs.org/api/cli.html

</details>

### Q-NODE-027 · Async control flow and errors · difficulty 2 · single

Which utility from `node:events` converts an `EventEmitter` event stream into an asynchronous iterable with support for backpressure and cancellation via `AbortSignal`?

- A) `events.once()`
- B) `events.on(emitter, eventName, { signal })`
- C) `events.toAsyncIterable()`
- D) `stream.Readable.from()`

<details><summary>Answer</summary>

**B.** `events.on(emitter, eventName, { signal })` creates an `AsyncIterable` that yields arrays of arguments emitted for `eventName`. It buffers events when consumer iteration pauses, and cleans up event listeners when the loop terminates or when `signal` is aborted.

- Why not A: `events.once()` returns a Promise for a single event occurrence, not an iterable.
- Why not C: There is no `events.toAsyncIterable` method.
- Why not D: `Readable.from()` converts an existing iterable into a Readable stream, not an EventEmitter into an async iterable.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#3-bridging-events-and-asyncawait), https://nodejs.org/api/events.html

</details>

### Q-NODE-028 · Async control flow and errors · difficulty 2 · ordering

Place the error classifications in order from standard JavaScript language errors to low-level operating system errors:

1. `TypeError` / `RangeError` (V8 language runtime validation)
2. `SystemError` (Node syscall failure containing `.code`, `.errno`, `.syscall`)
3. `Error` (Generic JavaScript base class)

- A) 3 -> 1 -> 2
- B) 1 -> 3 -> 2
- C) 2 -> 1 -> 3
- D) 3 -> 2 -> 1

<details><summary>Answer</summary>

**A.** `Error` is the standard generic ECMAScript base class (3); `TypeError` and `RangeError` are standard language subtype errors thrown for type and value boundary violations (1); `SystemError` is Node's specific operational error subclass generated when an OS system call fails (e.g. `ENOENT`, `ECONNRESET`), augmenting the error with `.code`, `.errno`, and `.syscall` properties (2).

- Why not B: Generic base `Error` precedes specific language subtypes.
- Why not C: `SystemError` is a specialized low-level operational error class, not the language base.
- Why not D: `SystemError` is more specialized than language subtypes.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#5-errors), https://nodejs.org/api/errors.html

</details>

### Q-NODE-029 · Async control flow and errors · difficulty 3 · single

Why is it universally recommended in Node.js documentation to shut down and restart a process after an `'uncaughtException'` event, rather than continuing execution?

- A) V8 automatically clears all heap variables when uncaughtException fires.
- B) The process state may be corrupted: resource locks may remain unreleased, closures partially evaluated, and invariants broken, making future execution unreliable and unpredictable.
- C) libuv shuts down all socket connections on uncaughtException.
- D) The operating system marks the process as a zombie process.

<details><summary>Answer</summary>

**B.** When an uncaught exception is thrown, code terminated abruptly without running normal cleanups or `finally` blocks. Shared state, cache entries, file descriptors, and database transaction locks may be in an inconsistent or half-mutated state. Resuming execution risks silent data corruption or cascading deadlocks. The only safe action is logging the crash and exiting.

- Why not A: V8 does not clear heap memory on exception.
- Why not C: libuv does not automatically destroy sockets on exception; they leak.
- Why not D: Zombie processes are terminated processes whose parent has not called `wait()`.
- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#6-process-level-policy-uncaught-exceptions-and-unhandled-rejections), https://nodejs.org/api/process.html

</details>

---

## D5 · Buffers and streams

### Q-NODE-030 · Buffers and streams · difficulty 1 · single

Why is `Buffer.alloc(size)` preferred over `Buffer.allocUnsafe(size)` for general use?

- A) `Buffer.alloc` allocates on the V8 heap, while `Buffer.allocUnsafe` allocates in C++ swap space.
- B) `Buffer.alloc` zeroes the allocated memory segment, preventing uninitialized memory (which may contain sensitive previous process data) from being exposed.
- C) `Buffer.allocUnsafe` is deprecated in Node 26.
- D) `Buffer.alloc` is faster because it bypasses libuv.

<details><summary>Answer</summary>

**B.** `Buffer.allocUnsafe(size)` allocates memory without zero-filling it. The returned Buffer may contain residual uninitialized bytes from previously deallocated memory (such as passwords, private keys, or tokens), introducing a major security vulnerability if transmitted over the network. `Buffer.alloc()` always zero-initializes the allocated memory.

- Why not A: Both allocate in native C++ memory backing `ArrayBuffer`.
- Why not C: `allocUnsafe` is not deprecated; it is reserved for high-throughput paths where the caller immediately overwrites every byte.
- Why not D: Zero-filling has a small CPU cost, so `Buffer.alloc` is slightly slower than `allocUnsafe`.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#1-buffer), https://nodejs.org/api/buffer.html

</details>

### Q-NODE-031 · Buffers and streams · difficulty 2 · single

What is the default internal pool size (`Buffer.poolSize`) used by Node for pre-allocating small Buffer slabs in Node 26.3+?

- A) 8 KiB (8,192 bytes)
- B) 16 KiB (16,384 bytes)
- C) 64 KiB (65,536 bytes)
- D) 1 MiB (1,048,576 bytes)

<details><summary>Answer</summary>

**C.** In Node 26.3, `Buffer.poolSize` was increased to 64 KiB (65,536 bytes), matching the updated default stream `highWaterMark`. Small allocations (`< Buffer.poolSize >>> 1`) are sliced from this shared 64 KiB slab.

- Why not A: 8 KiB was the historic pool size in Node 0.10 through 26.2.
- Why not B: 16 KiB was the historic stream buffer size, not `Buffer.poolSize`.
- Why not D: 1 MiB is far larger than the internal slab allocation size.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#1-buffer), https://nodejs.org/api/buffer.html

</details>

### Q-NODE-032 · Buffers and streams · difficulty 2 · single

What is the default `highWaterMark` for standard byte-oriented `Readable` and `Writable` streams in Node.js?

- A) 8 KiB
- B) 16 KiB
- C) 64 KiB (65,536 bytes)
- D) 128 KiB

<details><summary>Answer</summary>

**C.** The default `highWaterMark` for byte streams in Node.js is 64 KiB (65,536 bytes). When buffered unread or unwritten bytes reach this threshold, backpressure signals are triggered.

- Why not A: 8 KiB was never the stream default highWaterMark.
- Why not B: 16 KiB was the legacy default in Node 18 and earlier; it is 64 KiB in Node 26.
- Why not D: 128 KiB is a custom sizing, not the default.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#2-streams-the-model), https://nodejs.org/api/stream.html

</details>

### Q-NODE-033 · Buffers and streams · difficulty 3 · scenario

A developer uses `readable.pipe(writable)` to forward an HTTP upload to a file write stream. If an error occurs on `readable` (e.g. client disconnects prematurely), what happens to `writable`?

- A) `writable` is automatically destroyed and its file descriptor closed.
- B) `writable` remains open, never receiving `'finish'` or `'close'`, creating a resource leak.
- C) `writable` emits an uncaught exception.
- D) The runtime restarts the pipeline from the beginning.

<details><summary>Answer</summary>

**B.** The legacy `.pipe()` method forwards data and end events, but it explicitly does NOT forward errors. If `readable` emits an `'error'`, `writable` remains open and dangling, leaking file handles or sockets. This fatal flaw is the primary reason why `stream.pipeline()` is required in production code: `pipeline()` ensures all participating streams are destroyed on error.

- Why not A: `.pipe()` does not close or destroy destination streams on source error.
- Why not C: `writable` does not emit an error unless an error occurs on `writable` itself.
- Why not D: Streams cannot be rewound or restarted automatically.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#5-pipe-vs-pipeline), https://nodejs.org/api/stream.html

</details>

### Q-NODE-034 · Buffers and streams · difficulty 2 · single

In the Node.js stream backpressure protocol, what does a return value of `false` from `writable.write(chunk)` signify?

- A) The chunk was rejected and not written; caller must retry immediately.
- B) The chunk was accepted into the internal buffer, but the buffer has now reached or exceeded `highWaterMark`; the producer should pause writing until the `'drain'` event fires.
- C) The writable stream is destroyed or closed.
- D) The chunk contained invalid character encodings.

<details><summary>Answer</summary>

**B.** `writable.write(chunk)` returning `false` is an advisory backpressure signal. The chunk is accepted and buffered in memory, but the stream's internal queue length now meets or exceeds `highWaterMark`. A well-behaved producer must stop calling `write()` until the destination stream flushes its buffer and emits the `'drain'` event.

- Why not A: The chunk is NOT rejected; it was accepted and queued.
- Why not C: Stream destruction causes `write()` to error or throw, not return `false`.
- Why not D: Encodings do not determine boolean backpressure return values.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#4-backpressure), https://nodejs.org/api/stream.html

</details>

### Q-NODE-035 · Buffers and streams · difficulty 2 · multi

Which statements are true regarding `stream.pipeline` (and `stream/promises` `pipeline`)? (Select all that apply.)

- A) It safely destroys all streams in the pipeline if any stream emits an error.
- B) It handles backpressure between all intermediate stages automatically.
- C) It supports async generators, iterables, and Web Streams as valid pipeline participants.
- D) It swallows all errors silently so the process never crashes.

<details><summary>Answer</summary>

**A, B, C.** `stream.pipeline` provides comprehensive flow control: it forwards backpressure across all stages, automatically destroys all streams upon error or completion, and accepts async generators, Node streams, and Web Streams.

- Why not D: `pipeline` does NOT swallow errors; it forwards the error to the completion callback or rejects the returned promise.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#5-pipe-vs-pipeline), https://nodejs.org/api/stream.html

</details>

### Q-NODE-036 · Buffers and streams · difficulty 3 · single

A developer extracts a 10-byte token from a 10 MiB incoming Buffer using `const token = largeBuffer.subarray(0, 10)`. The `largeBuffer` reference is subsequently set to `null`. How does V8 garbage collection treat the 10 MiB allocation?

- A) 9.999 MiB is freed immediately, leaving only 10 bytes allocated.
- B) The entire 10 MiB underlying `ArrayBuffer` remains pinned in memory because `token` shares the same memory slab.
- C) V8 automatically copies the 10 bytes to young generation and frees the rest.
- D) It causes an immediate SIGSEGV.

<details><summary>Answer</summary>

**B.** `Buffer.prototype.subarray()` (and `slice()`) creates a view referencing the _same_ underlying `ArrayBuffer` without copying. As long as `token` is alive, V8 cannot garbage collect any part of the 10 MiB allocation. To release the large buffer, copy the slice explicitly via `Buffer.from(largeBuffer.subarray(0, 10))`.

- Why not A: ArrayBuffers are monolithic allocations; individual sub-regions cannot be partially deallocated.
- Why not C: V8 does not perform automatic compaction across separate ArrayBuffers.
- Why not D: Slicing Buffers is memory-safe; it does not cause segmentation faults.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#1-buffer), https://nodejs.org/api/buffer.html

</details>

### Q-NODE-037 · Buffers and streams · difficulty 1 · single

What is the default `highWaterMark` when a `Readable` or `Writable` stream is initialized with `objectMode: true`?

- A) 16 objects
- B) 64 objects
- C) 1024 objects
- D) 65,536 objects

<details><summary>Answer</summary>

**A.** In `objectMode`, stream buffers count discrete JavaScript objects rather than raw byte lengths. The default `highWaterMark` for object-mode streams is 16 objects.

- Why not B: 64 is the byte highWaterMark in KiB, not objectMode.
- Why not C: 1024 is not a default stream threshold in Node.
- Why not D: 65,536 is the byte stream threshold.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#2-streams-the-model), https://nodejs.org/api/stream.html

</details>

### Q-NODE-038 · Buffers and streams · difficulty 2 · ordering

Place the core methods of a custom `Transform` stream implementation in the order in which they are invoked by Node during a normal stream processing lifecycle:

1. `_transform(chunk, encoding, callback)`
2. `_construct(callback)`
3. `_destroy(err, callback)`
4. `_flush(callback)`

- A) 2 -> 1 -> 4 -> 3
- B) 1 -> 2 -> 4 -> 3
- C) 2 -> 4 -> 1 -> 3
- D) 2 -> 1 -> 3 -> 4

<details><summary>Answer</summary>

**A.** `_construct()` is invoked once before any data is accepted (2); `_transform()` is invoked sequentially for each incoming chunk (1); `_flush()` is called once after all chunks have been processed and the input stream ends (4); `_destroy()` runs at the end when the stream is completely closed or errored (3).

- Why not B: `_construct` runs prior to any `_transform` invocations.
- Why not C: `_flush` runs after all incoming chunks have been transformed.
- Why not D: `_flush` precedes final destruction.
- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#6-implementing-a-transform-correctly), https://nodejs.org/api/stream.html

</details>

---

## D6 · File system, processes and OS

### Q-NODE-039 · File system, processes and OS · difficulty 1 · single

How can a Node.js service achieve atomic file updates on POSIX operating systems so that readers never observe partially written files or corruption during power failure?

- A) Open the file with flag `'w+'` and call `fs.truncate()`.
- B) Write new content to a unique temporary file on the same filesystem/mount point, and then call `fs.promises.rename()` to overwrite the target path atomically.
- C) Wrap writes in `process.nextTick()`.
- D) Call `fs.promises.writeFile()` with `{ flush: true }` directly on the target path.

<details><summary>Answer</summary>

**B.** On POSIX systems, `rename(2)` is an atomic directory operation provided that the source and target paths reside on the same filesystem. Writing to a temporary sibling file and renaming guarantees that any concurrent reader observes either the old version or the complete new version, never an intermediate partial write.

- Why not A: Opening with `'w+'` truncates the file immediately upon opening, exposing an empty file to concurrent readers.
- Why not C: `process.nextTick()` has no effect on OS filesystem atomicity.
- Why not D: Direct `writeFile` overwrites file bytes in place; if the process crashes mid-write, the file is corrupted.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#2-durability-and-atomic-replacement), https://nodejs.org/api/fs.html

</details>

### Q-NODE-040 · File system, processes and OS · difficulty 2 · scenario

A developer opens a file handle with `const fh = await fs.promises.open('log.txt', 'r')`, reads some bytes, and leaves the function without calling `fh.close()`. In Node 26, when V8 garbage collection subsequently collects the abandoned `FileHandle` object, what does the runtime do?

- A) Node silently closes the underlying OS file descriptor without notification.
- B) Node emits an uncaught exception / crash because closing file descriptors during GC finalization is forbidden.
- C) The file descriptor remains leaked until OS reboot.
- D) Node logs a one-time deprecation warning and suspends execution.

<details><summary>Answer</summary>

**B.** In Node 26, abandoning a `FileHandle` to be garbage collected without an explicit `.close()` triggers a fatal runtime error. Automatic file descriptor closing in GC finalizers masks resource leaks and causes use-after-free bugs if descriptors are recycled by the OS. Code must use explicit `await fh.close()` or `await using` disposal.

- Why not A: Silent GC closing was deprecated and removed because it hides descriptor leakage.
- Why not C: Node detects the unclosed handle during GC; it does not silently leak indefinitely.
- Why not D: It is a fatal error, not merely a deprecation warning.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#1-three-apis-for-the-same-system-calls), https://nodejs.org/api/fs.html

</details>

### Q-NODE-041 · File system, processes and OS · difficulty 3 · single

What is the fundamental security distinction between `child_process.exec()` and `child_process.execFile()`?

- A) `exec()` runs on a worker thread, while `execFile()` runs on the main event loop thread.
- B) `exec()` spawns an intermediate system shell (`/bin/sh` or `cmd.exe`) to evaluate the command string, making it vulnerable to shell injection if arguments contain untrusted input; `execFile()` invokes the executable binary directly without a shell, passing arguments as an array.
- C) `execFile()` only works on executable scripts with a shebang (`#!`).
- D) `exec()` buffers stdout up to 64 MiB, while `execFile()` only supports streaming.

<details><summary>Answer</summary>

**B.** `child_process.exec(cmd)` passes the raw command string to a system shell (`/bin/sh -c` on Unix, `cmd.exe /d /s /c` on Windows), which interprets shell metacharacters (`;`, `|`, `&`, `$`). If user input is concatenated into `cmd`, attackers can execute arbitrary shell commands. `child_process.execFile(file, args)` executes the binary directly via `execve(2)` without invoking a shell, ensuring that parameters in `args` cannot be evaluated as shell syntax.

- Why not A: Both spawn separate OS processes asynchronously via libuv.
- Why not C: `execFile` works on any binary executable as well as shebang scripts.
- Why not D: Both functions buffer output into `stdout` and `stderr` up to `maxBuffer`.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#5-child-processes), https://nodejs.org/api/child_process.html

</details>

### Q-NODE-042 · File system, processes and OS · difficulty 2 · multi

Which child process functions support an active Inter-Process Communication (IPC) channel via `child.send()` by default or via configuration? (Select all that apply.)

- A) `child_process.fork()`
- B) `child_process.spawn()` configured with `stdio: ['pipe', 'pipe', 'pipe', 'ipc']`
- C) `child_process.exec()`
- D) `child_process.execFile()`

<details><summary>Answer</summary>

**A, B.** `child_process.fork()` establishes an IPC channel automatically. `child_process.spawn()` establishes an IPC channel when `'ipc'` is included in the `stdio` array configuration.

- Why not C: `exec()` invokes commands through a shell without creating an IPC channel.
- Why not D: `execFile()` does not configure an IPC channel.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#5-child-processes), https://nodejs.org/api/child_process.html

</details>

### Q-NODE-043 · File system, processes and OS · difficulty 2 · single

A web endpoint serves user files using `path.resolve(UPLOAD_DIR, req.query.filename)`. Why is this pattern vulnerable to path traversal even if `UPLOAD_DIR` is an absolute path?

- A) `path.resolve` throws a `RangeError` on paths longer than 255 characters.
- B) If `req.query.filename` starts with `/` or contains `..` sequences, `path.resolve` treats it as an absolute path or ascends out of `UPLOAD_DIR`, allowing access to arbitrary filesystem files.
- C) `path.resolve` follows symbolic links automatically.
- D) `path.resolve` converts all paths to URL strings.

<details><summary>Answer</summary>

**B.** `path.resolve()` processes arguments from right to left until an absolute path is constructed. If the user-supplied filename starts with a leading slash `/`, `path.resolve` discards `UPLOAD_DIR` completely and resolves to the root path. Additionally, relative traversal components (`../`) can escape the upload directory. Code must verify that the normalized resolved path begins with `UPLOAD_DIR` and path separator.

- Why not A: `path.resolve` does not impose a 255-character restriction.
- Why not C: `path.resolve` is purely a string manipulation utility; it does not access the filesystem or resolve symlinks.
- Why not D: It returns standard OS filesystem path strings, not URLs.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#3-paths-and-traversal), https://nodejs.org/api/path.html

</details>

### Q-NODE-044 · File system, processes and OS · difficulty 3 · single

A Node.js parent process spawns a shell script that itself spawns multiple background child processes. When the parent calls `child.kill('SIGTERM')`, the direct child terminates, but its background subprocesses continue running as orphaned processes. What is the standard technique to ensure the entire process tree is terminated?

- A) Call `child.kill('SIGKILL')` instead.
- B) Spawn the child with `detached: true`, making it the leader of a new process group, and send the signal to the negative process group ID: `process.kill(-child.pid, 'SIGTERM')`.
- C) Set `process.env.KILL_CHILDREN = '1'`.
- D) Wrap the spawn call in `setImmediate()`.

<details><summary>Answer</summary>

**B.** On POSIX operating systems, sending a signal to a process PID only delivers the signal to that individual process, not its children. Spawning with `detached: true` calls `setsid()` so the child becomes the group leader of a new process group with PGID equal to `child.pid`. Calling `process.kill(-child.pid, signal)` delivers the signal to all processes in that process group.

- Why not A: `SIGKILL` sent to the parent process still leaves child subprocesses running.
- Why not C: There is no such environment variable in POSIX or Node.
- Why not D: `setImmediate()` has no effect on OS process group signal delivery.
- Ref: [modules/06-filesystem-process-os.md](../modules/06-filesystem-process-os.md#5-child-processes), https://nodejs.org/api/child_process.html

</details>

---

## D7 · Networking and HTTP

### Q-NODE-045 · Networking and HTTP · difficulty 1 · single

In Node's built-in `node:http` module, what is the default server `keepAliveTimeout`?

- A) 1,000 ms (1 second)
- B) 5,000 ms (5 seconds)
- C) 60,000 ms (60 seconds)
- D) Keep-alive is disabled by default

<details><summary>Answer</summary>

**B.** In `node:http`, the default `keepAliveTimeout` on an HTTP server is 5,000 ms (5 seconds). Sockets that remain idle without incoming request data for 5 seconds are closed by the server.

- Why not A: 1,000 ms is too short for typical HTTP connection reuse.
- Why not C: 60,000 ms is the default `headersTimeout`, not `keepAliveTimeout`.
- Why not D: HTTP/1.1 persistent keep-alive connections are enabled by default.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#4-server-timeouts), https://nodejs.org/api/http.html

</details>

### Q-NODE-046 · Networking and HTTP · difficulty 2 · scenario

An edge load balancer (such as an AWS ALB or Nginx reverse proxy) forwards requests to a Node.js HTTP server. The load balancer is configured with an idle keep-alive timeout of 60 seconds. Intermittently under light traffic, clients receive HTTP 502 Bad Gateway errors. What is the root cause and the required configuration fix?

- A) The Node server's V8 heap is thrashing; increase heap size.
- B) The Node server's default `keepAliveTimeout` (5 s) is shorter than the load balancer's idle timeout (60 s). Node closes an idle connection just as the load balancer transmits a reused request over it, causing a TCP reset race condition. Configure Node's `keepAliveTimeout` to be slightly greater than the load balancer's timeout (e.g. 65 s).
- C) The load balancer does not support HTTP/1.1; downgrade to HTTP/1.0.
- D) Node's DNS cache expired; set `dns.setDefaultResultOrder('ipv4first')`.

<details><summary>Answer</summary>

**B.** This is the classic 502 reverse proxy race condition. When a client request arrives at the reverse proxy, the proxy selects an existing pooled keep-alive connection and sends the HTTP request. If Node's `keepAliveTimeout` has elapsed, Node sends a TCP FIN packet at the exact same moment. The proxy receives a connection reset (RST) and returns 502 Bad Gateway. Node's `keepAliveTimeout` must always be configured larger than the upstream proxy's idle timeout (e.g. 65 s vs 60 s), with `headersTimeout` set larger than `keepAliveTimeout` (e.g. 66 s).

- Why not A: 502 errors from connection resets are networking timeout mismatches, not V8 heap memory issues.
- Why not C: Modern reverse proxies and ALBs use HTTP/1.1 keep-alive pools.
- Why not D: DNS resolution occurs upstream of the reverse proxy-to-backend socket.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#4-server-timeouts), https://nodejs.org/api/http.html

</details>

### Q-NODE-047 · Networking and HTTP · difficulty 2 · single

What is the fundamental difference between `dns.lookup()` and `dns.resolve4()` in Node.js?

- A) `dns.lookup()` uses c-ares over UDP, while `dns.resolve4()` uses the OS resolver.
- B) `dns.lookup()` calls the operating system's synchronous `getaddrinfo(3)` on libuv's thread pool, respecting `/etc/hosts` and NSS configuration; `dns.resolve4()` performs asynchronous network DNS queries using the bundled c-ares library, bypassing `/etc/hosts` and the libuv thread pool.
- C) `dns.lookup()` only supports IPv6; `dns.resolve4()` only supports IPv4.
- D) `dns.resolve4()` requires root/administrator privileges.

<details><summary>Answer</summary>

**B.** `dns.lookup()` invokes the host operating system's `getaddrinfo(3)` C library function. Because `getaddrinfo` is synchronous, Node offloads it to the libuv worker thread pool. It adheres to `/etc/hosts`, system resolver configuration, and mDNS. In contrast, `dns.resolve*()` connects directly to configured DNS nameservers using c-ares asynchronously without using thread pool threads, but ignores local `/etc/hosts` mappings.

- Why not A: The mechanisms are reversed: `lookup` uses OS `getaddrinfo`; `resolve` uses c-ares.
- Why not C: `dns.lookup()` supports both IPv4 and IPv6 (`family: 0`, `4`, or `6`).
- Why not D: DNS network queries do not require administrative privileges.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#7-dns-lookup-vs-resolve), https://nodejs.org/api/dns.html

</details>

### Q-NODE-048 · Networking and HTTP · difficulty 3 · single

When an HTTP client transmits request headers exceeding Node's configured `maxHeaderSize` (default 16 KiB), what HTTP response does the built-in HTTP parser (`llhttp`) automatically return before terminating the socket?

- A) 400 Bad Request
- B) 413 Payload Too Large
- C) 431 Request Header Fields Too Large
- D) 500 Internal Server Error

<details><summary>Answer</summary>

**C.** `llhttp` detects when cumulative request headers exceed `server.maxHeaderSize`. Rather than buffering unbounded data into memory (a DoS vulnerability), it automatically responds with HTTP status `431 Request Header Fields Too Large` and closes the socket.

- Why not A: Status 400 is returned for malformed HTTP syntax, not header length violations.
- Why not B: Status 413 applies to request entity bodies, not request header fields.
- Why not D: Server internal errors (500) indicate uncaught application exceptions.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#4-server-timeouts), https://nodejs.org/api/http.html

</details>

### Q-NODE-049 · Networking and HTTP · difficulty 2 · multi

Which statements are true regarding the global `fetch()` implementation in modern Node.js? (Select all that apply.)

- A) It is built upon the high-performance Undici HTTP/1.1 client.
- B) It does not utilize `http.globalAgent` for connection pooling.
- C) Connection pooling, timeouts, and dispatchers are managed through Undici configuration.
- D) It runs synchronous network queries on the libuv thread pool.

<details><summary>Answer</summary>

**A, B, C.** Node's global `fetch()` is implemented using Undici. It bypasses legacy `http.Agent` and `http.globalAgent`, relying instead on Undici's connection pool dispatchers (`Agent`, `Pool`, `Client`).

- Why not D: Undici uses non-blocking TCP socket polling on the event loop; it does not block the thread pool.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#6-fetch-and-undici), https://nodejs.org/api/globals.html

</details>

### Q-NODE-050 · Networking and HTTP · difficulty 2 · ordering

Place the standard HTTP server timeout settings in recommended ascending numerical order to prevent connection leaks and parser starvation:

1. `headersTimeout` (time allowed to receive complete headers, e.g. 60 s)
2. `requestTimeout` (maximum time allowed for entire request reception, e.g. 300 s)
3. `keepAliveTimeout` (idle wait time between requests, aligned above reverse proxy, e.g. 65 s)

- A) 1 -> 3 -> 2
- B) 3 -> 1 -> 2
- C) 1 -> 2 -> 3
- D) 2 -> 1 -> 3

<details><summary>Answer</summary>

**B.** In production configuration behind a 60 s load balancer: `headersTimeout` (e.g. 66 s) must be strictly greater than `keepAliveTimeout` (e.g. 65 s) so that a connection kept alive does not immediately fail header parsing when a new request begins; `requestTimeout` (e.g. 300 s) bounds long-running uploads and exceeds both. Therefore: `keepAliveTimeout` (65 s) < `headersTimeout` (66 s) < `requestTimeout` (300 s).

- Why not A: If `headersTimeout` is less than `keepAliveTimeout`, keep-alive sockets can be closed prematurely during header transmission.
- Why not C: `requestTimeout` should be the largest timeout.
- Why not D: `requestTimeout` is not the shortest timeout.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#4-server-timeouts), https://nodejs.org/api/http.html

</details>

### Q-NODE-051 · Networking and HTTP · difficulty 3 · scenario

When a Node client connects to a dual-stack host (one with both IPv6 and IPv4 AAAA/A records), how does Node negotiate the connection by default, and what timeout governs fallback?

- A) It attempts IPv4 first and never tries IPv6 unless configured.
- B) It implements Happy Eyeballs (RFC 8305) via `autoSelectFamily: true`, attempting IPv6 first and falling back to parallel IPv4 connection establishment after 500 ms if IPv6 has not connected.
- C) It sends parallel requests and takes whichever responds first, immediately killing the other.
- D) It queries the OS routing table and waits up to 30 seconds.

<details><summary>Answer</summary>

**B.** In modern Node, `autoSelectFamily` defaults to `true` (implementing RFC 8305 Happy Eyeballs). It initiates connection to the first resolved IPv6 address; if connection does not complete within `autoSelectFamilyAttemptTimeout` (500 ms in modern Node builds), it concurrently initiates a connection to the first IPv4 address, using whichever TCP handshake completes first.

- Why not A: Modern Node prioritizes IPv6 first by default under Happy Eyeballs.
- Why not C: Connections are staggered by 500 ms, not launched simultaneously from millisecond zero.
- Why not D: Node does not perform 30-second OS route inspection.
- Ref: [modules/07-networking-and-http.md](../modules/07-networking-and-http.md#7-dns-lookup-vs-resolve), https://nodejs.org/api/net.html

</details>

---

## D8 · Building services

### Q-NODE-052 · Building services · difficulty 1 · single

In the Fastify framework, what is the purpose of the encapsulation model established by `fastify.register()`?

- A) It runs each registered plugin in a separate worker thread.
- B) It creates a child context where decorators, hooks, and schemas are isolated to that plugin and its descendants, without polluting parent or sibling scopes.
- C) It freezes all JavaScript prototypes to prevent pollution.
- D) It compiles route handlers ahead-of-time into WebAssembly.

<details><summary>Answer</summary>

**B.** Fastify's encapsulation model creates a hierarchical DAG of contexts. When a plugin is registered, hooks, decorators, and schemas defined within it are scoped to that plugin and child plugins registered inside it. Parent scopes and sibling plugins remain unaffected, preventing global side effects and naming collisions.

- Why not A: Fastify plugins run on the main event loop thread within the same process.
- Why not C: Encapsulation is an architectural scoping model, not prototype freezing.
- Why not D: Fastify compiles JSON schemas into JavaScript validator functions via Ajv, not WebAssembly.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#2-fastifys-architecture), https://fastify.dev/docs/latest/

</details>

### Q-NODE-053 · Building services · difficulty 2 · scenario

A service using Fastify and JSON schema validation defines a request body schema with properties `username` and `email`. When a client sends `{ username: "alice", email: "a@example.com", role: "admin" }`, the route handler receives `req.body` containing only `username` and `email`; `role` has disappeared. What caused this, and why?

- A) V8 garbage collection stripped unreferenced properties.
- B) Fastify configures Ajv with `removeAdditional: true` by default, stripping properties not declared in the schema to protect against mass-assignment vulnerabilities.
- C) The HTTP parser truncated the payload.
- D) Fastify only allows string properties in JSON bodies.

<details><summary>Answer</summary>

**B.** Fastify enables Ajv's `removeAdditional: true` option by default when validating request bodies. Any property not explicitly defined in the `properties` schema or allowed via `additionalProperties: true` is stripped before the handler executes. This prevents mass-assignment attacks where attackers inject unexpected fields (e.g. `role: "admin"`, `isVerified: true`) directly into database models.

- Why not A: GC never mutates or strips object properties.
- Why not C: The HTTP parser parses the complete JSON string into an object before validation.
- Why not D: Fastify supports numbers, booleans, nested objects, and arrays.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#3-schemas-validation-in-serialisation-out), https://fastify.dev/docs/latest/

</details>

### Q-NODE-054 · Building services · difficulty 2 · ordering

Place Fastify's request lifecycle hooks in their exact chronological order of execution for an incoming request:

1. `preValidation`
2. `onRequest`
3. `preHandler`
4. `preParsing`
5. `onResponse`
6. `preSerialization`

- A) 2 -> 4 -> 1 -> 3 -> 6 -> 5
- B) 4 -> 2 -> 1 -> 3 -> 6 -> 5
- C) 2 -> 1 -> 4 -> 3 -> 6 -> 5
- D) 2 -> 4 -> 3 -> 1 -> 6 -> 5

<details><summary>Answer</summary>

**A.** Fastify request lifecycle: `onRequest` runs before body parsing (2); `preParsing` allows custom payload stream transforms (4); `preValidation` runs before schema validation (1); `preHandler` executes authentication and authorization middleware (3); `preSerialization` transforms output data before JSON serialization (6); `onResponse` runs after the HTTP response has been sent to the client (5).

- Why not B: `onRequest` executes before `preParsing`.
- Why not C: `preParsing` must run before `preValidation` because the body must be parsed before it can be validated.
- Why not D: `preValidation` runs before `preHandler`.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#2-fastifys-architecture), https://fastify.dev/docs/latest/

</details>

### Q-NODE-055 · Building services · difficulty 3 · single

In a Kubernetes deployment, what is the primary operational reason why a service should mark its readiness check (`/readyz`) as failing immediately upon receiving `SIGTERM`, and delay calling `server.close()` by several seconds?

- A) To give V8 time to run full Mark-Sweep garbage collection.
- B) Because Kubernetes EndpointSlice and kube-proxy updates propagate asynchronously across cluster nodes; continuing to accept connections briefly prevents clients from receiving connection refused errors while traffic is being rerouted.
- C) Because POSIX mandates a 5-second sleep before closing file descriptors.
- D) To allow DNS TTL to expire on all internet nameservers.

<details><summary>Answer</summary>

**B.** In Kubernetes, pod termination (`SIGTERM`) and endpoint removal from kube-proxy / ingress controllers occur concurrently and asynchronously. If a pod closes its listening socket immediately upon `SIGTERM`, in-flight routing packets from other nodes still reaching the pod encounter closed ports, causing connection reset errors. Failing readiness immediately signals kube-proxy to stop routing new traffic, while a short drain delay (e.g. 2–5 s) ensures in-transit packets are accepted before the server stops listening.

- Why not A: GC timing is irrelevant to cluster traffic routing.
- Why not C: POSIX has no mandatory shutdown delay.
- Why not D: Cluster service routing uses kube-proxy iptables/IPVS, not public DNS TTL.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#6-graceful-shutdown), https://nodejs.org/api/http.html

</details>

### Q-NODE-056 · Building services · difficulty 2 · multi

Which characteristics distinguish Kubernetes liveness probes (`/healthz`) from readiness probes (`/readyz`) for Node.js services? (Select all that apply.)

- A) A failing liveness probe causes Kubernetes to terminate and restart the pod container.
- B) A failing readiness probe removes the pod from the Service load balancer's active endpoints without restarting the process.
- C) Readiness probes may check connectivity to essential downstream databases; liveness probes should only verify that the Node event loop is responsive.
- D) A failing liveness probe initiates a rolling restart of all cluster nodes.

<details><summary>Answer</summary>

**A, B, C.** Liveness indicates whether the process is alive or deadlocked (failure triggers restart); readiness indicates whether the process is currently prepared to accept traffic (failure removes it from routing). Checking downstream dependencies in liveness probes is a dangerous anti-pattern: if a database experiences an outage, all service pods fail liveness simultaneously and enter restart crash loops.

- Why not D: Liveness failures restart only the individual container/pod, not all cluster nodes.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#5-health-checks-rate-limits-and-load-shedding), https://fastify.dev/docs/latest/

</details>

### Q-NODE-057 · Building services · difficulty 3 · scenario

In an operational circuit breaker implementation protecting a third-party payment gateway, what condition triggers the transition from the `open` state to the `half-open` state?

- A) The payment gateway sends an HTTP 200 webhook.
- B) A configurable cooldown duration expires, allowing a single canary/probe request through to test if the dependency has recovered.
- C) The Node process restarts.
- D) The client retries with an exponential backoff header.

<details><summary>Answer</summary>

**B.** In the circuit breaker pattern, when consecutive failures exceed a threshold, the breaker enters `open`, failing incoming calls immediately without calling the dependency. After a configured `coolDownMs` (sleep window), the breaker transitions to `half-open`. In `half-open`, a limited number of trial/probe requests are permitted through. If the probe succeeds, the breaker resets to `closed`; if it fails, the breaker returns to `open` for another cooldown period.

- Why not A: The circuit breaker operates client-side without requiring webhooks.
- Why not C: State transitions occur dynamically in memory during continuous operation without restarting.
- Why not D: The breaker transition is governed by elapsed time, not client retry headers.
- Ref: [modules/08-building-services.md](../modules/08-building-services.md#5-health-checks-rate-limits-and-load-shedding), https://fastify.dev/docs/latest/

</details>

---

## D9 · Concurrency and scaling

### Q-NODE-058 · Concurrency and scaling · difficulty 1 · single

In `node:worker_threads`, what does each `Worker` thread possess?

- A) Its own separate OS process and PID.
- B) Its own independent V8 isolate, libuv event loop, and memory heap, sharing the same operating system process.
- C) A shared JavaScript global scope and shared execution stack with the main thread.
- D) Its own virtual CPU core reserved by the Linux kernel.

<details><summary>Answer</summary>

**B.** A `Worker` in Node runs in an isolated V8 isolate with its own libuv event loop and memory heap inside the same OS process. It does not share global variables with the parent thread, and communication occurs via message passing or `SharedArrayBuffer`.

- Why not A: Worker threads are OS threads within the same process; `child_process` creates separate processes.
- Why not C: Globals and stacks are isolated per V8 isolate; they are never shared directly.
- Why not D: OS thread scheduling is managed by the OS scheduler, not locked to reserved hardware cores.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#2-worker-threads), https://nodejs.org/api/worker_threads.html

</details>

### Q-NODE-059 · Concurrency and scaling · difficulty 2 · single

When passing an `ArrayBuffer` to a worker via `worker.postMessage({ buffer }, [buffer])`, what occurs?

- A) The buffer is serialized to JSON and parsed in the worker.
- B) Ownership of the `ArrayBuffer` memory is transferred with zero-copy: the buffer is detached from the sender (its `byteLength` becomes 0) and attached to the receiver.
- C) A deep copy of the buffer is created in V8 young generation.
- D) The buffer is persisted to `/tmp`.

<details><summary>Answer</summary>

**B.** Including an `ArrayBuffer` (or MessagePort) in the transfer list parameter of `postMessage` transfers ownership of the underlying native memory allocation. Rather than performing an expensive memory copy, V8 detaches the buffer from the sending context (rendering it neutered with `byteLength === 0`) and rebinds the memory address directly into the receiving worker's isolate.

- Why not A: Binary data is not converted to JSON.
- Why not C: Transfer is zero-copy; it specifically avoids deep copying.
- Why not D: Transfer occurs entirely in-memory across threads.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#2-worker-threads), https://nodejs.org/api/worker_threads.html

</details>

### Q-NODE-060 · Concurrency and scaling · difficulty 2 · multi

Which objects can be shared or transferred between worker threads without copying data? (Select all that apply.)

- A) `SharedArrayBuffer`
- B) `MessagePort`
- C) Plain JavaScript `Object` literals
- D) `Uint8Array` backed by a `SharedArrayBuffer`

<details><summary>Answer</summary>

**A, B, D.** `SharedArrayBuffer` allows multiple isolates to point to the same shared memory region concurrently (manipulated via `Atomics`). TypedArrays backed by a `SharedArrayBuffer` share that underlying memory. `MessagePort` can be transferred across threads with zero copy.

- Why not C: Standard JS objects cannot be shared; they are cloned using the HTML structured clone algorithm, creating distinct copies in each isolate.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#4-shared-memory-in-practice), https://nodejs.org/api/worker_threads.html

</details>

### Q-NODE-061 · Concurrency and scaling · difficulty 3 · scenario

When running multiple HTTP server workers using `node:cluster` on Linux, what mechanism distributes incoming TCP connections among the worker processes by default?

- A) The Linux kernel's iptables round-robin module.
- B) The primary (master) process listens on the server socket, accepts incoming connections, and distributes socket handles to worker processes over an internal IPC channel via round-robin (`cluster.SCHED_RR`).
- C) Each worker process binds directly to the port using `SO_REUSEPORT` with kernel load balancing.
- D) DNS round-robin.

<details><summary>Answer</summary>

**B.** In `node:cluster` on all platforms except Windows, the default scheduling policy is `cluster.SCHED_RR` (round-robin). The primary process creates the listening socket and accepts new TCP connections. As connections arrive, the primary distributes socket file descriptors round-robin over internal IPC channels to worker processes. Alternatively, `cluster.SCHED_NONE` leaves socket accepting to workers, which historically suffered from the "thundering herd" problem.

- Why not A: Connection distribution is handled in userland by Node's primary process, not iptables.
- Why not C: `SO_REUSEPORT` is an alternative Linux socket option; standard `node:cluster` uses primary socket distribution.
- Why not D: Cluster operates inside a single host behind a single listening port.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#5-cluster-and-so_reuseport), https://nodejs.org/api/cluster.html

</details>

### Q-NODE-062 · Concurrency and scaling · difficulty 2 · single

How does the built-in `node:sqlite` module execute database queries, and what is the concurrency implication for an event-driven server?

- A) Queries run asynchronously on libuv's thread pool.
- B) Queries execute synchronously on the main thread, blocking the event loop for the entire duration of the query execution.
- C) Queries execute in a separate SQLite daemon process.
- D) Queries are queued and evaluated only during libuv's check phase.

<details><summary>Answer</summary>

**B.** `node:sqlite` provides a synchronous C++ binding to SQLite. Database queries (`db.prepare().all()`, `db.exec()`) execute synchronously on the thread where they are called. If invoked on the main event loop thread, long-running queries block the event loop, causing latency spikes for concurrent network connections. CPU-heavy or slow queries should be offloaded to worker threads.

- Why not A: `node:sqlite` does not offload queries to libuv's thread pool; it is synchronous.
- Why not C: SQLite is an embedded library compiled directly into the Node binary, not a standalone daemon.
- Why not D: Queries execute immediately on the call stack.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#6-nodesqlite-a-synchronous-database-in-the-process), https://nodejs.org/api/sqlite.html

</details>

### Q-NODE-063 · Concurrency and scaling · difficulty 3 · single

What occurs when an unhandled exception or unhandled promise rejection is thrown inside a `Worker` thread in `node:worker_threads`?

- A) The exception is automatically forwarded and thrown as an uncaught exception on the main thread.
- B) The worker thread terminates, emitting an `'error'` event on the parent thread's `Worker` instance, followed by an `'exit'` event with code 1.
- C) The worker thread restarts automatically and retries the task.
- D) The entire operating system process crashes immediately with SIGABRT.

<details><summary>Answer</summary>

**B.** An unhandled error in a worker thread causes only that specific worker isolate to terminate. The parent thread is notified via an `'error'` event on the corresponding `Worker` instance, followed by an `'exit'` event with exit code 1. The main thread continues running and must catch the `'error'` event to prevent an uncaught exception on the main thread, and should spawn a replacement worker if maintaining pool capacity.

- Why not A: The error does not throw synchronously on the main thread; it is delivered as an event.
- Why not C: Node does not auto-restart dead workers; worker pool management is userland responsibility.
- Why not D: The parent process does not abort; only the worker isolate exits.
- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#2-worker-threads), https://nodejs.org/api/worker_threads.html

</details>

---

## D10 · Memory and performance

### Q-NODE-064 · Memory and performance · difficulty 1 · single

In the output of `process.memoryUsage()`, what does the `rss` value represent?

- A) The size of the V8 JavaScript heap currently containing live objects.
- B) Resident Set Size: the total physical RAM occupied by the process in the OS (including V8 heap, code space, native C++ bindings, buffers, and thread stacks).
- C) The virtual memory allocated by the OS swap partition.
- D) The size of the garbage collection young generation semi-space.

<details><summary>Answer</summary>

**B.** `rss` (Resident Set Size) is the total physical memory currently mapped to the process in RAM by the operating system kernel. It encompasses the V8 heap (`heapTotal`), executable bytecode, C++ bindings, external allocations (`external` and `arrayBuffers`), and execution stacks for all threads.

- Why not A: Live JavaScript heap objects are represented by `heapUsed`.
- Why not C: RSS measures resident physical RAM, not swapped virtual memory.
- Why not D: Young generation semi-space is a minor subset of `heapTotal`.
- Ref: [modules/10-v8-memory-and-gc.md](../modules/10-v8-memory-and-gc.md#1-where-a-node-processs-memory-goes), https://nodejs.org/api/process.html

</details>

### Q-NODE-065 · Memory and performance · difficulty 2 · single

Which V8 command-line flag configures the maximum size of the old generation memory heap before V8 triggers out-of-memory termination?

- A) `--max-semi-space-size`
- B) `--max-old-space-size=<megabytes>`
- C) `--v8-heap-limit`
- D) `--max-memory-allocation`

<details><summary>Answer</summary>

**B.** `--max-old-space-size` specifies the maximum Old Space heap allocation in megabytes (e.g. `--max-old-space-size=4096` for 4 GiB). When total live objects in old space exceed this limit and full GC cannot reclaim memory, V8 aborts the process.

- Why not A: `--max-semi-space-size` configures the size of the young generation semi-spaces (New Space).
- Why not C: There is no `--v8-heap-limit` flag.
- Why not D: `--max-memory-allocation` does not exist in V8.
- Ref: [modules/10-v8-memory-and-gc.md](../modules/10-v8-memory-and-gc.md#4-sizing-flags), https://nodejs.org/api/cli.html

</details>

### Q-NODE-066 · Memory and performance · difficulty 3 · scenario

A containerized Node service running on Kubernetes crashes intermittently. In incident A, the container exits with exit code 137. In incident B, the container exits with exit code 134. What is the diagnosis for each incident?

- A) Incident A was killed by the Linux cgroup OOM killer (128 + 9 = SIGKILL) for exceeding the container memory limit; Incident B was aborted by V8 itself (128 + 6 = SIGABRT) for exceeding `--max-old-space-size`.
- B) Incident A was a segmentation fault; Incident B was a graceful shutdown.
- C) Both incidents are identical V8 heap crashes.
- D) Incident A was an uncaught exception; Incident B was a broken pipe.

<details><summary>Answer</summary>

**A.** Exit code 137 represents `128 + 9` (`SIGKILL`), issued by the Linux kernel when the process or container exceeds its cgroup memory limit (`limits.memory`). Exit code 134 represents `128 + 6` (`SIGABRT`), issued by the V8 runtime itself when V8 heap allocation reaches `--max-old-space-size` and garbage collection cannot free memory, prompting V8 to call `abort()`.

- Why not B: SIGSEGV produces exit code 139 (128 + 11).
- Why not C: 137 is an external OS kernel kill; 134 is an internal V8 heap exhaustion abort.
- Why not D: Uncaught exceptions produce exit code 1; broken pipe produces code 141 (128 + 13).
- Ref: [modules/10-v8-memory-and-gc.md](../modules/10-v8-memory-and-gc.md#5-out-of-memory-what-actually-happens), https://nodejs.org/api/cli.html

</details>

### Q-NODE-067 · Memory and performance · difficulty 2 · multi

Which patterns are common causes of memory leaks in long-running Node.js production applications? (Select all that apply.)

- A) Unbounded in-memory `Map` or `Set` collections used as caches without TTL or eviction policies.
- B) Adding event listeners to long-lived objects (`emitter.on()`) inside request handlers without removing them.
- C) Retaining references to small slices of large Buffers or strings, keeping the underlying memory slab pinned.
- D) Defining `const` variables inside short-lived async functions.

<details><summary>Answer</summary>

**A, B, C.** Unbounded caches grow indefinitely; event listeners hold closure references to request contexts; Buffer and string slices retain their parent `ArrayBuffer` slabs in memory.

- Why not D: Local variables declared in functions are garbage collected when the function scope exits and no closures reference them.
- Ref: [modules/10-v8-memory-and-gc.md](../modules/10-v8-memory-and-gc.md#6-memory-leaks-in-node), https://nodejs.org/api/process.html

</details>

### Q-NODE-068 · Memory and performance · difficulty 3 · single

How does Event Loop Utilization (ELU) from `perf_hooks.eventLoopUtilization()` differ fundamentally from Event Loop Delay (ELD)?

- A) ELD measures CPU instruction counts; ELU measures network bandwidth.
- B) ELD measures scheduling lag (how late a timer fires relative to its scheduled deadline); ELU measures the ratio of time the event loop thread spent actively executing JavaScript and libuv callbacks vs idling in the poll phase.
- C) ELU only works on worker threads.
- D) ELD is deprecated and replaced by V8 heap profiling.

<details><summary>Answer</summary>

**B.** Event Loop Delay (ELD) is a latency metric: it measures how far behind schedule the event loop is running by checking timer execution delays. Event Loop Utilization (ELU) is a saturation metric: it calculates `active_time / (active_time + idle_time)`. A process can have high ELU (e.g. 95% busy processing continuous fast requests) with near-zero ELD (because no individual task blocks the loop long enough to delay timers). ELU provides an accurate gauge of capacity for load shedding and horizontal scaling.

- Why not A: Neither metric measures CPU instruction counts or network bandwidth.
- Why not C: ELU is available on both the main thread and worker threads.
- Why not D: ELD remains an active, valid latency metric via `monitorEventLoopDelay()`.
- Ref: [modules/11-diagnostics-and-performance.md](../modules/11-diagnostics-and-performance.md#3-event-loop-delay-and-utilisation), https://nodejs.org/api/perf_hooks.html

</details>

### Q-NODE-069 · Memory and performance · difficulty 2 · single

What is the primary capability provided by `AsyncLocalStorage` in the `node:async_hooks` module?

- A) To persist session data in Redis.
- B) To store and propagate contextual data (such as request IDs, trace contexts, or user authentication) across asynchronous execution chains without explicitly passing arguments through every function.
- C) To allocate shared memory across worker threads.
- D) To speed up V8 promise resolution.

<details><summary>Answer</summary>

**B.** `AsyncLocalStorage` provides async-context propagation (similar to thread-local storage in multi-threaded runtimes). Contextual state passed into `als.run(store, callback)` remains accessible via `als.getStore()` across asynchronous awaits, callbacks, and event ticks throughout that operation's lifecycle, eliminating the need to pass context objects through every intermediate function parameter.

- Why not A: It is an in-memory runtime context tracker, not a database client.
- Why not C: Cross-thread shared memory requires `SharedArrayBuffer`.
- Why not D: It tracks async context; it does not alter V8 promise execution speed.
- Ref: [modules/11-diagnostics-and-performance.md](../modules/11-diagnostics-and-performance.md#5-asynclocalstorage-and-async-context), https://nodejs.org/api/async_context.html

</details>

---

## D11 · Testing, security and operations

### Q-NODE-070 · Testing, security and operations · difficulty 1 · single

In Node's strict assertion module (`node:assert/strict`), what comparison semantics are used by `assert.equal(actual, expected)`?

- A) Abstract equality (`==`) with type coercion.
- B) Strict equality (`===` / `Object.is`), exactly identical to `assert.strictEqual()`.
- C) Deep structural equality.
- D) Reference identity only.

<details><summary>Answer</summary>

**B.** In `node:assert/strict`, non-strict legacy methods are replaced by their strict counterparts: `assert.equal()` is an alias for `assert.strictEqual()`, comparing values using `Object.is()` without type coercion. For structural comparison, `assert.deepEqual()` or `assert.deepStrictEqual()` must be used.

- Why not A: `node:assert/strict` explicitly disables loose coercion (`==`).
- Why not C: Deep structural equality is performed by `assert.deepStrictEqual()`.
- Why not D: Primitive values compare by value under `Object.is()`, not object reference.
- Ref: [modules/12-testing.md](../modules/12-testing.md#7-nodeassert-equality-precisely), https://nodejs.org/api/assert.html

</details>

### Q-NODE-071 · Testing, security and operations · difficulty 2 · single

How does Node 26's built-in Permission Model (`--permission`) restrict application capabilities, and what is its security boundary?

- A) It runs the process in a Linux seccomp container that intercepts OS syscalls.
- B) It restricts access to specific Node.js core APIs (such as `--allow-fs-read`, `--allow-fs-write`, `--allow-child-process`) within the JS runtime, but it does NOT restrict native C++ addons or replace operating system sandboxing.
- C) It prevents all network requests to private IP addresses.
- D) It automatically sanitizes SQL injection queries.

<details><summary>Answer</summary>

**B.** Node's Permission Model acts as an in-process capability restriction mechanism. When active, Node API bindings check capabilities before performing filesystem operations, spawning child processes, or accessing worker threads. However, native C++ addons (`.node` files) bypass these checks because they execute arbitrary native code. The permission model is a defense-in-depth tool for JavaScript dependencies, not an OS-level sandbox.

- Why not A: It is enforced at the Node C++ binding boundary, not via Linux seccomp/kernel namespaces.
- Why not C: Network permission flags restrict network endpoints, but do not provide autonomous private IP detection.
- Why not D: It has no awareness of database query semantics.
- Ref: [modules/13-security.md](../modules/13-security.md#3-the-permission-model), https://nodejs.org/api/permissions.html

</details>

### Q-NODE-072 · Testing, security and operations · difficulty 3 · scenario

A developer proposes executing untrusted third-party code in production by running it inside a `node:vm` context: `vm.runInNewContext(untrustedCode, {})`. Why is this explicitly flagged as a critical security vulnerability?

- A) `node:vm` causes memory leaks.
- B) `node:vm` is not a security sandbox; untrusted code can easily escape the context via object constructors (e.g. `this.constructor.constructor('return process')().mainModule.require('child_process')`) to execute arbitrary host commands.
- C) `node:vm` runs code in a separate process that consumes excessive file descriptors.
- D) `node:vm` is deprecated in Node 26.

<details><summary>Answer</summary>

**B.** Node's documentation explicitly warns: "The node:vm module is not a security sandbox. Do not use it to run untrusted code." In JavaScript, objects created within a VM context share prototype chains and constructors with the host V8 isolate. An attacker can access the host Function constructor through any object reference and invoke host modules like `process` and `child_process`. True isolation requires OS-level virtualization or WebAssembly sandboxes.

- Why not A: While memory management must be handled carefully, the primary risk is code execution escape.
- Why not C: `vm` runs within the same V8 isolate and process, not a separate OS process.
- Why not D: `node:vm` is actively maintained for templating and language runtimes, but not as a security sandbox.
- Ref: [modules/13-security.md](../modules/13-security.md#6-vm-is-not-a-sandbox), https://nodejs.org/api/vm.html

</details>

### Q-NODE-073 · Testing, security and operations · difficulty 2 · scenario

A Docker container runs a Node.js server as PID 1 (`CMD ["node", "server.js"]`). When `docker stop` is issued, the container hangs for 10 seconds and is then forcefully killed with SIGKILL (exit code 137). Why does this occur, and how is it fixed?

- A) Docker requires Node to be compiled with `--enable-docker-signals`.
- B) In Linux, PID 1 has special init process rules: the kernel ignores default signal handlers for `SIGTERM` and `SIGINT` unless the process explicitly registers a signal listener. Because Node has no default SIGTERM handler, `SIGTERM` is ignored until Docker times out and sends `SIGKILL`. Fix by handling `process.on('SIGTERM', ...)` or using an init process like `docker run --init` / `tini`.
- C) The Node event loop was running an infinite synchronous loop.
- D) Node refuses signals unless running as root.

<details><summary>Answer</summary>

**B.** In Linux process management, PID 1 does not receive default signal dispositions. For any normal process, the default action for `SIGTERM` is immediate process termination. For PID 1, the kernel protects the process from accidental termination: if the process has not installed a custom signal handler, the signal is discarded. When `docker stop` sends `SIGTERM`, Node ignores it. After the 10-second grace period expires, Docker issues uncatchable `SIGKILL`. The fix is registering `process.on('SIGTERM', ...)` to trigger graceful shutdown, or using `tini` as the container init process.

- Why not A: There is no such compilation flag.
- Why not C: An idle event loop still ignores SIGTERM as PID 1 without a registered handler.
- Why not D: PID 1 signal semantics apply regardless of whether the user is root or non-root.
- Ref: [modules/14-production-operations.md](../modules/14-production-operations.md#2-node-as-pid-1-and-signal-handling), https://nodejs.org/api/process.html

</details>

### Q-NODE-074 · Testing, security and operations · difficulty 3 · single

In Node 26, how can sourcemaps be automatically parsed and applied to production error stack traces for bundled or transpiled JavaScript code?

- A) By installing the `source-map-support` npm package.
- B) By passing the native CLI flag `--enable-source-maps` or setting `NODE_OPTIONS="--enable-source-maps"`.
- C) Sourcemaps are not supported natively in Node.js.
- D) By naming sourcemap files with a `.v8map` extension.

<details><summary>Answer</summary>

**B.** Node has native, built-in support for Source Maps v3 via the `--enable-source-maps` flag. When enabled, Node inspects inline sourcemaps or referenced `.map` files and maps stack traces, line numbers, and column offsets back to original source files (such as TypeScript or JSX) in error stacks without requiring external runtime dependencies.

- Why not A: `source-map-support` was a userland monkey-patching package; Node now provides native sourcemap support.
- Why not C: Native sourcemap support has been stable in Node for multiple LTS releases.
- Why not D: Node follows standard sourcemap conventions (`//# sourceMappingURL=...`), not custom `.v8map` extensions.
- Ref: [modules/14-production-operations.md](../modules/14-production-operations.md#5-source-maps-and-stack-traces), https://nodejs.org/api/cli.html

</details>

---

## H · Hands-on tasks

### Q-NODE-075 · Hands-on · difficulty 2 · hands-on

Implement `promisifyOnce(fn)`: convert an asynchronous function `fn` that accepts an error-first callback `(err, result) => void` as its final argument into a function returning a Promise. Guard against double-callback invocations: if `fn` invokes its callback more than once (e.g. once with an error and later with a result), only the first settlement must apply; subsequent callback invocations must be ignored without raising unhandled rejections. Additionally, synchronous exceptions thrown inside `fn` must reject the Promise.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H1 · promisifyOnce`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export function promisifyOnce<T = unknown>(
  fn: (...args: any[]) => void,
): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => {
      let settled = false;
      try {
        fn(...args, (err: Error | null | undefined, result: T) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve(result);
        });
      } catch (syncErr) {
        if (!settled) {
          settled = true;
          reject(syncErr);
        }
      }
    });
}
```

- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#1-three-generations-of-asynchronous-apis), https://nodejs.org/api/util.html

</details>

### Q-NODE-076 · Hands-on · difficulty 2 · hands-on

Implement a length-prefixed `FrameDecoder` class extending `stream.Transform` in `objectMode: true`. Incoming chunks consist of concatenated binary frames in format `[4-byte big-endian uint32 payload length][payload bytes]`. Requirements:

1. Reassemble frames split across arbitrary chunk boundaries.
2. If an incoming frame's declared payload length exceeds `maxFrame` (default 1 MiB), emit an error with `.code = 'E_FRAME_TOO_LARGE'` to prevent unbounded memory buffering.
3. When emitting frames via `this.push()`, copy the payload slice to avoid pinning the upstream buffer slab in memory.
4. On stream end (`_flush`), if unconsumed trailing bytes remain that do not form a complete frame, emit an error with `.code = 'E_TRUNCATED'`.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H2 · FrameDecoder`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export class FrameDecoder extends Transform {
  private pending: Buffer = Buffer.alloc(0);
  private readonly maxFrame: number;

  constructor(maxFrame = 1 << 20) {
    super({ readableObjectMode: true });
    this.maxFrame = maxFrame;
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    while (this.pending.length >= 4) {
      const len = this.pending.readUInt32BE(0);
      if (len > this.maxFrame) {
        return cb(
          Object.assign(new Error(`frame of ${len} bytes exceeds max ${this.maxFrame}`), {
            code: 'E_FRAME_TOO_LARGE',
          }),
        );
      }
      if (this.pending.length < 4 + len) break;
      this.push(Buffer.from(this.pending.subarray(4, 4 + len)));
      this.pending = this.pending.subarray(4 + len);
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    if (this.pending.length > 0) {
      cb(
        Object.assign(new Error(`truncated frame: ${this.pending.length} unconsumed bytes`), {
          code: 'E_TRUNCATED',
        }),
      );
    } else {
      cb();
    }
  }
}
```

- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#7-binary-protocols-framing-over-a-byte-stream), https://nodejs.org/api/stream.html

</details>

### Q-NODE-077 · Hands-on · difficulty 2 · hands-on

Implement `writeWithBackpressure(writable, chunks)`: an asynchronous utility that sequentially writes chunks from an iterable or async iterable to a `Writable` stream while adhering to the stream backpressure protocol. Requirements:

1. When `writable.write(chunk)` returns `false`, execution must pause until the stream emits `'drain'`.
2. If `writable` emits an `'error'` or closes prematurely at any point during writing or waiting for drain, the function must reject immediately with that error.
3. Event listeners attached to `writable` must be cleaned up on both completion and rejection to prevent listener leaks.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H3 · writeWithBackpressure`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export async function writeWithBackpressure(
  writable: Writable,
  chunks: Iterable<Uint8Array | string> | AsyncIterable<Uint8Array | string>,
): Promise<void> {
  if (writable.destroyed || (writable as { errored?: Error }).errored) {
    throw (writable as { errored?: Error }).errored ?? new Error('stream already destroyed');
  }

  let streamError: Error | null = null;
  const onError = (err: Error) => {
    streamError = err;
  };
  writable.on('error', onError);

  try {
    for await (const chunk of chunks) {
      if (streamError) throw streamError;
      if (writable.destroyed) throw new Error('stream destroyed while writing');

      const ok = writable.write(chunk);
      if (!ok) {
        await new Promise<void>((resolve, reject) => {
          const onDrain = () => {
            cleanup();
            resolve();
          };
          const onLocalError = (err: Error) => {
            cleanup();
            reject(err);
          };
          const onClose = () => {
            cleanup();
            reject(new Error('stream closed before drain'));
          };
          function cleanup() {
            writable.off('drain', onDrain);
            writable.off('error', onLocalError);
            writable.off('close', onClose);
          }
          writable.once('drain', onDrain);
          writable.once('error', onLocalError);
          writable.once('close', onClose);
        });
      }
    }
  } finally {
    writable.off('error', onError);
  }
}
```

- Ref: [modules/05-buffers-streams-backpressure.md](../modules/05-buffers-streams-backpressure.md#4-backpressure), https://nodejs.org/api/stream.html

</details>

### Q-NODE-078 · Hands-on · difficulty 2 · hands-on

Implement `withTimeout(work, ms, parentSignal)`: an asynchronous control-flow function that executes `work(signal)` with a deadline. Requirements:

1. `work` receives an `AbortSignal` that aborts if either the timeout of `ms` expires or `parentSignal` aborts.
2. If the deadline expires before `work` settles, reject with a `DOMException` named `'TimeoutError'`.
3. If `parentSignal` was already aborted or aborts during execution, cancel immediately with `parentSignal.reason`.
4. Timers and signal listeners must be cleaned up on settlement so no handles outlive the call.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H4 · withTimeout`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  parentSignal?.throwIfAborted();
  const timeout = AbortSignal.timeout(ms);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  signal.throwIfAborted();

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };

    function cleanup() {
      signal.removeEventListener('abort', onAbort);
    }

    signal.addEventListener('abort', onAbort, { once: true });

    work(signal).then(
      (val) => {
        cleanup();
        resolve(val);
      },
      (err) => {
        cleanup();
        reject(err);
      },
    );
  });
}
```

- Ref: [modules/04-async-control-flow-and-errors.md](../modules/04-async-control-flow-and-errors.md#4-cancellation-in-node-apis), https://nodejs.org/api/globals.html

</details>

### Q-NODE-079 · Hands-on · difficulty 3 · hands-on

Implement a fixed-size `WorkerPool` using `node:worker_threads` with a bounded task backlog. Requirements:

1. The constructor accepts `(file: URL, size: number, maxQueue: number)`. Spawns exactly `size` workers.
2. `run<T>(msg, transfer)`: dispatches the task to an idle worker immediately. If all workers are busy, queues the task. If the waiting queue has reached `maxQueue`, rejects immediately with `Error('queue full')`.
3. When a task completes on a worker, the next queued task is dispatched in FIFO order.
4. If a worker crashes or errors, only that worker's active task is rejected; the pool automatically spawns a replacement worker to restore capacity.
5. `close()`: terminates all workers and rejects any pending queued tasks.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H5 · WorkerPool`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export class WorkerPool {
  private readonly idle: Worker[] = [];
  private readonly busy = new Map<Worker, WorkerTask>();
  private readonly queue: WorkerTask[] = [];
  private nextId = 0;
  private closed = false;
  peakConcurrency = 0;
  private readonly file: URL;
  private readonly maxQueue: number;

  constructor(file: URL, size: number, maxQueue = 100) {
    this.file = file;
    this.maxQueue = maxQueue;
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  private spawn(): Worker {
    const w = new Worker(this.file);
    w.on('message', (m: { id: number; result: unknown }) => {
      const task = this.busy.get(w);
      this.busy.delete(w);
      task?.resolve(m.result);
      this.release(w);
    });
    w.on('error', (err) => {
      const task = this.busy.get(w);
      this.busy.delete(w);
      task?.reject(err as Error);
    });
    w.on('exit', () => {
      const i = this.idle.indexOf(w);
      if (i >= 0) this.idle.splice(i, 1);
      if (!this.closed) this.release(this.spawn());
    });
    return w;
  }

  private release(w: Worker): void {
    const next = this.queue.shift();
    if (next) this.start(w, next);
    else this.idle.push(w);
  }

  private start(w: Worker, t: WorkerTask): void {
    this.busy.set(w, t);
    this.peakConcurrency = Math.max(this.peakConcurrency, this.busy.size);
    w.postMessage({ id: t.id, ...t.msg }, t.transfer);
  }

  run<T>(msg: Record<string, unknown>, transfer: TransferList = []): Promise<T> {
    if (this.closed) return Promise.reject(new Error('pool closed'));
    if (this.idle.length === 0 && this.queue.length >= this.maxQueue) {
      return Promise.reject(new Error('queue full'));
    }
    return new Promise<T>((resolve, reject) => {
      const t: WorkerTask = {
        id: this.nextId++,
        msg,
        transfer,
        resolve: resolve as (v: unknown) => void,
        reject,
      };
      const w = this.idle.pop();
      if (w) this.start(w, t);
      else this.queue.push(t);
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const t of this.queue) t.reject(new Error('pool closed'));
    this.queue.length = 0;
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()));
  }
}
```

- Ref: [modules/09-concurrency-and-scaling.md](../modules/09-concurrency-and-scaling.md#3-worker-pools), https://nodejs.org/api/worker_threads.html

</details>

### Q-NODE-080 · Hands-on · difficulty 3 · hands-on

Implement a graceful shutdown function `gracefulShutdown(server, deadlineMs)` for a `node:http` Server. Requirements:

1. Immediately close idle keep-alive connections via `server.closeIdleConnections()`.
2. Stop accepting new connections via `server.close()`.
3. Allow active in-flight requests to complete normally.
4. As active requests complete, close their keep-alive connections so the server can terminate cleanly.
5. If in-flight requests do not finish within `deadlineMs`, force termination of all remaining sockets via `server.closeAllConnections()` and resolve `{ forced: true }`; otherwise resolve `{ forced: false }`.

- A) Implement in `examples/exam-solutions.ts` and verify with `examples/exam-hands-on.test.ts` suite `H6 · gracefulShutdown`.

<details><summary>Answer</summary>

**A.** Reference implementation:

```ts
export function gracefulShutdown(server: Server, deadlineMs = 5000): Promise<{ forced: boolean }> {
  return new Promise((resolve) => {
    let forced = false;
    let finished = false;

    const timer = setTimeout(() => {
      forced = true;
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, deadlineMs);
    timer.unref?.();

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    const interval = setInterval(() => {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
    }, 10);
    interval.unref?.();

    server.close(() => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(interval);
      resolve({ forced });
    });
  });
}
```

- Ref: [modules/08-building-services.md](../modules/08-building-services.md#6-graceful-shutdown), https://nodejs.org/api/http.html

</details>

---

## Mock interview (60 minutes)

This mock interview presents 40 questions sampled from the question bank, matching the domain proportions specified in [exams/README.md](README.md#interview-format-primary-target):

- D2 Event loop: 6 questions
- D3 Modules and packages: 4 questions
- D4 Async control flow and errors: 4 questions
- D5 Buffers and streams: 5 questions
- D6 File system, processes and OS: 3 questions
- D7 Networking and HTTP: 4 questions
- D8 Building services: 3 questions
- D9 Concurrency and scaling: 3 questions
- D10 Memory and performance: 4 questions
- D11 Testing, security and operations: 2 questions
- H Hands-on coding tasks: 2 tasks

### Selected questions

1. [Q-NODE-006](#q-node-006--event-loop--difficulty-1--single) · D2 · Check phase and `setImmediate`
2. [Q-NODE-007](#q-node-007--event-loop--difficulty-2--single) · D2 · Top-level timer vs immediate non-determinism
3. [Q-NODE-008](#q-node-008--event-loop--difficulty-3--single) · D2 · Poll phase I/O callback immediate ordering
4. [Q-NODE-009](#q-node-009--event-loop--difficulty-2--ordering) · D2 · CommonJS nextTick vs microtask ordering
5. [Q-NODE-011](#q-node-011--event-loop--difficulty-3--scenario) · D2 · Thread pool saturation diagnostics
6. [Q-NODE-014](#q-node-014--event-loop--difficulty-2--single) · D2 · Handle reference counting and `.unref()`
7. [Q-NODE-016](#q-node-016--modules-and-packages--difficulty-1--single) · D3 · Package scope format determination
8. [Q-NODE-017](#q-node-017--modules-and-packages--difficulty-2--single) · D3 · Synchronous `require(esm)` requirements
9. [Q-NODE-019](#q-node-019--modules-and-packages--difficulty-2--scenario) · D3 · Dual-package hazard resolution
10. [Q-NODE-020](#q-node-020--modules-and-packages--difficulty-1--single) · D3 · Built-in TypeScript type stripping
11. [Q-NODE-023](#q-node-023--async-control-flow-and-errors--difficulty-1--single) · D4 · Zalgo anti-pattern mechanics
12. [Q-NODE-024](#q-node-024--async-control-flow-and-errors--difficulty-2--single) · D4 · EventEmitter `'error'` without listeners
13. [Q-NODE-026](#q-node-026--async-control-flow-and-errors--difficulty-3--scenario) · D4 · Default unhandled rejections mode
14. [Q-NODE-027](#q-node-027--async-control-flow-and-errors--difficulty-2--single) · D4 · Event stream to AsyncIterable conversion
15. [Q-NODE-030](#q-node-030--buffers-and-streams--difficulty-1--single) · D5 · Buffer allocation safety
16. [Q-NODE-032](#q-node-032--buffers-and-streams--difficulty-2--single) · D5 · Byte stream default highWaterMark
17. [Q-NODE-033](#q-node-033--buffers-and-streams--difficulty-3--scenario) · D5 · Failure mode of legacy `.pipe()`
18. [Q-NODE-034](#q-node-034--buffers-and-streams--difficulty-2--single) · D5 · Backpressure protocol and `'drain'`
19. [Q-NODE-035](#q-node-035--buffers-and-streams--difficulty-2--multi) · D5 · Guarantees of `stream.pipeline`
20. [Q-NODE-039](#q-node-039--file-system-processes-and-os--difficulty-1--single) · D6 · POSIX atomic file replacement
21. [Q-NODE-040](#q-node-040--file-system-processes-and-os--difficulty-2--scenario) · D6 · GC cleanup of unclosed `FileHandle`
22. [Q-NODE-041](#q-node-041--file-system-processes-and-os--difficulty-3--single) · D6 · Shell execution safety: `exec` vs `execFile`
23. [Q-NODE-045](#q-node-045--networking-and-http--difficulty-1--single) · D7 · HTTP server keepAliveTimeout default
24. [Q-NODE-046](#q-node-046--networking-and-http--difficulty-2--scenario) · D7 · Reverse proxy 502 keep-alive race
25. [Q-NODE-047](#q-node-047--networking-and-http--difficulty-2--single) · D7 · `dns.lookup` vs `dns.resolve4`
26. [Q-NODE-049](#q-node-049--networking-and-http--difficulty-2--multi) · D7 · Undici architecture in global `fetch`
27. [Q-NODE-052](#q-node-052--building-services--difficulty-1--single) · D8 · Fastify plugin encapsulation
28. [Q-NODE-053](#q-node-053--building-services--difficulty-2--scenario) · D8 · Schema validation and `removeAdditional`
29. [Q-NODE-055](#q-node-055--building-services--difficulty-3--single) · D8 · Kubernetes endpoint propagation delay
30. [Q-NODE-058](#q-node-058--concurrency-and-scaling--difficulty-1--single) · D9 · Worker thread isolate architecture
31. [Q-NODE-059](#q-node-059--concurrency-and-scaling--difficulty-2--single) · D9 · Zero-copy ArrayBuffer transfer
32. [Q-NODE-061](#q-node-061--concurrency-and-scaling--difficulty-3--scenario) · D9 · Cluster socket distribution mechanics
33. [Q-NODE-064](#q-node-064--memory-and-performance--difficulty-1--single) · D10 · Memory metric definitions (RSS vs Heap)
34. [Q-NODE-065](#q-node-065--memory-and-performance--difficulty-2--single) · D10 · V8 old space heap sizing flag
35. [Q-NODE-066](#q-node-066--memory-and-performance--difficulty-3--scenario) · D10 · OOM triage: Exit 137 vs Exit 134
36. [Q-NODE-068](#q-node-068--memory-and-performance--difficulty-3--single) · D10 · Event Loop Utilization (ELU) vs Delay
37. [Q-NODE-071](#q-node-071--testing-security-and-operations--difficulty-2--single) · D11 · Permission model capabilities and limits
38. [Q-NODE-073](#q-node-073--testing-security-and-operations--difficulty-2--scenario) · D11 · Container PID 1 signal semantics
39. [Q-NODE-077](#q-node-077--hands-on--difficulty-2--hands-on) · H · Live coding: `writeWithBackpressure`
40. [Q-NODE-080](#q-node-080--hands-on--difficulty-3--hands-on) · H · Live coding: `gracefulShutdown`

### Scoring key and evaluation

- **Knowledge and scenario questions (1–38):** 1 point each. Multi-select questions require all correct options selected to score. Maximum: 38 points.
- **Hands-on tasks (39–40):** 5 points each upon passing all verification tests in `examples/exam-hands-on.test.ts`. Maximum: 10 points.
- **Total possible points:** 48 points.
- **Pass threshold:** 70% (34 out of 48 points).
