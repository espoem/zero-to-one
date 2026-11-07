# Node.js Bilingual Terminology Glossary (EN ↔ CZ)

A standardized index of core runtime architecture, event-loop mechanics, module resolution, stream protocols, and production systems concepts for Node.js 26 LTS ("Lithium").

All definitions, classifications, and notes are written in English; each term provides its canonical English nomenclature and established Czech technical equivalent. Where Czech developer practice retains the English API name or runtime concept (common for _backpressure_, _event emitter_, _thread pool_), the table explicitly indicates this rather than introducing synthetic neologisms. Concepts shared with the [root glossary](../../GLOSSARY.md) reproduce their formal definitions and Czech terms verbatim. Every term maps directly to its theoretical and executable treatment in this track's modules.

---

## 1. Runtime Architecture & Process Model

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **libuv** | **libuv (_anglický termín_)** | The cross-platform C library providing Node.js with its event loop, non-blocking asynchronous I/O primitives, thread pool, child-process control, and OS system-call abstractions. | [Module 01](modules/01-runtime-architecture.md#1-the-four-layers) |
| **Binding (`internalBinding`)** | **Vazba na nativní kód (binding)** | Internal C++ glue code exposing native engine functions, libuv primitives, OpenSSL, and zlib routines directly to Node's internal JavaScript layer. | [Module 01](modules/01-runtime-architecture.md#1-the-four-layers) |
| **Primordials** | **Primordiální objekty (primordials)** | Frozen internal snapshots of ECMAScript built-in prototypes and intrinsics used within Node core to protect internal logic against user-space prototype tampering. | [Module 01](modules/01-runtime-architecture.md#1-the-four-layers) |
| **Startup Snapshot** | **Spouštěcí snímek haldy (startup snapshot)** | A pre-serialized V8 heap state created at build time that deserializes initialized built-in contexts to significantly reduce process bootstrap latency. | [Module 01](modules/01-runtime-architecture.md#1-the-four-layers) |
| **Handle / Request (libuv)** | **Handle / požadavek libuv** | A long-lived active resource (`uv_handle_t`, such as a listening server, socket, or timer) versus a short-lived asynchronous operation (`uv_req_t`, such as an `fs` operation or DNS lookup). | [Module 01](modules/01-runtime-architecture.md#2-the-process-lifecycle) |
| **Referenced / Unreferenced Handle (`unref`)** | **Referencovaný / dereferencovaný handle** | A state indicating whether an active libuv handle keeps the event loop alive (`ref`) or allows the process to terminate when no other work remains (`unref`). | [Module 01](modules/01-runtime-architecture.md#2-the-process-lifecycle) |
| **Exit Code** | **Návratový kód procesu** | The integer status code returned to the parent operating system on process exit (0 for clean drain, 1 for uncaught errors, 13 for unsettled top-level await, >128 for signal termination). | [Module 01](modules/01-runtime-architecture.md#2-the-process-lifecycle) |
| **`NODE_OPTIONS`** | **Proměnná prostředí `NODE_OPTIONS`** | An environment variable containing command-line options that are prepended to the process arguments and inherited across child Node processes. | [Module 01](modules/01-runtime-architecture.md#3-configuring-a-process) |
| **Node-API** | **Node-API (dříve N-API)** | An Application Binary Interface (ABI) stable C API for authoring native addons that remain binary compatible across major Node and V8 versions without recompilation. | [Module 01](modules/01-runtime-architecture.md#6-native-code-addons-and-node-api) |
| **`NODE_MODULE_VERSION`** | **Verze ABI modulu (`NODE_MODULE_VERSION`)** | The internal module ABI number identifying native C++ addon binary compatibility, checked by Node on load to reject incompatible native binaries. | [Module 01](modules/01-runtime-architecture.md#4-release-lines-and-choosing-a-version) |
| **LTS (Active / Maintenance)** | **Dlouhodobá podpora (LTS – aktivní a údržbová fáze)** | The 30-month release cycle tier providing backward-compatible stability, progressing from 12 months of Active LTS (new backported features) to Maintenance LTS (critical bug and security fixes). | [Module 01](modules/01-runtime-architecture.md#4-release-lines-and-choosing-a-version) |
| **Current / Alpha Channel** | **Aktuální vydání / kanál Alpha (Current / Alpha)** | The stable non-LTS production release channel versus the signed, automated pre-release test channel used from Node 27 onward for yearly release staging. | [Module 01](modules/01-runtime-architecture.md#4-release-lines-and-choosing-a-version) |
| **End of Life (EOL)** | **Ukončení životnosti (EOL)** | The retirement point of a major Node.js release line after which it receives no further security patches, maintenance releases, or official support. | [Module 01](modules/01-runtime-architecture.md#4-release-lines-and-choosing-a-version) |

---

## 2. The Event Loop & Asynchronous Scheduling

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Event Loop** | **Smyčka událostí** | The host mechanism that repeatedly selects a task, runs it, drains the microtask queue and updates the rendering. | [Module 02](modules/02-event-loop.md#1-definitions) |
| **Event Loop Phase** | **Fáze smyčky událostí** | A discrete stage of one `uv_run` iteration executing a specific queue of callbacks: timers, pending callbacks, idle/prepare, poll, check, and close callbacks. | [Module 02](modules/02-event-loop.md#2-one-iteration-of-uv_run) |
| **Poll Timeout** | **Časový limit fáze poll** | The calculated duration libuv blocks inside kernel I/O multiplexing (`epoll_wait`/`kevent`), set to 0 if immediates or pending callbacks exist, or bounded by the earliest timer. | [Module 02](modules/02-event-loop.md#2-one-iteration-of-uv_run) |
| **`process.nextTick` Queue** | **Fronta `process.nextTick`** | A Node-specific JavaScript FIFO task queue processed immediately after the currently running operation and before V8 drains microtasks or the event loop yields to libuv. | [Module 02](modules/02-event-loop.md#3-processnexttick-vs-microtasks) |
| **Microtask Queue** | **Fronta mikroúloh** | The FIFO queue of promise reaction callbacks and `queueMicrotask` jobs drained by V8 after the tick queue at every task boundary. | [Module 02](modules/02-event-loop.md#3-processnexttick-vs-microtasks) |
| **Macrotask** | **Makroúloha (task)** | A discrete unit of work executed during an event-loop phase (timer, I/O event, `setImmediate` callback), separated by intermediate tick and microtask drains. | [Module 02](modules/02-event-loop.md#3-processnexttick-vs-microtasks) |
| **Starvation** | **Vyhladovění (starvation)** | A pathological condition where continuous scheduling of higher-priority tasks (`process.nextTick` or microtask recursion) prevents the event loop from advancing to subsequent phases or processing I/O. | [Module 02](modules/02-event-loop.md#4-blocking-and-starvation) |
| **Blocking the Event Loop** | **Blokování smyčky událostí** | Executing long-running synchronous JavaScript or blocking system calls on the main thread, delaying all subsequent timers, callbacks, and network responses. | [Module 02](modules/02-event-loop.md#4-blocking-and-starvation) |
| **Thread Pool (`UV_THREADPOOL_SIZE`)** | **Fond vláken libuv (thread pool)** | A fixed-size pool of background worker threads (default 4) used by libuv to execute blocking operations like file I/O, `dns.lookup()`, crypto hashing, and compression without stalling the main loop. | [Module 02](modules/02-event-loop.md#5-the-thread-pool) |
| **Event-Loop Delay** | **Zpoždění smyčky událostí (event-loop delay)** | The measured latency delta between when a timer or callback was scheduled to execute and when the event loop actually dispatched it. | [Module 02](modules/02-event-loop.md#10-measuring-the-loop) |
| **Event-Loop Utilisation (ELU)** | **Využití smyčky událostí (ELU)** | The ratio of wall-clock time the event loop spent actively executing user code and callbacks relative to total time outside poll waiting. | [Module 02](modules/02-event-loop.md#10-measuring-the-loop) |

---

## 3. Module Systems & Package Resolution

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **CommonJS (CJS)** | **Modulový systém CommonJS** | Node's legacy synchronous module system evaluated inside a function wrapper where `require()` returns `module.exports`. | [Module 03](modules/03-modules-and-packages.md#1-two-module-systems-in-one-runtime) |
| **ES Module (ESM)** | **ES modul** | The standard module system with static `import`/`export`, linked before evaluation. | [Module 03](modules/03-modules-and-packages.md#1-two-module-systems-in-one-runtime) |
| **Module Wrapper** | **Obalovací funkce modulu (module wrapper)** | The hidden function closure `(function(exports, require, module, __filename, __dirname) { ... })` into which CommonJS file contents are wrapped prior to evaluation. | [Module 03](modules/03-modules-and-packages.md#2-the-commonjs-loader) |
| **Module Cache** | **Mezipaměť modulů (module cache)** | The internal dictionary (`require.cache`) keyed by resolved absolute filenames that stores exported module instances to ensure singleton evaluation per file. | [Module 03](modules/03-modules-and-packages.md#2-the-commonjs-loader) |
| **`require(esm)`** | **Synchronní načtení ESM přes `require()`** | The runtime capability enabling CommonJS code to load non-top-level-await ES modules synchronously via `require()`, returning the module namespace object. | [Module 03](modules/03-modules-and-packages.md#4-requireesm) |
| **Syntax Detection** | **Syntaktická detekce formátu modulu** | Node's automatic format detection that parses ambiguous `.js` files lacking `"type"` in `package.json` as CommonJS, falling back to ESM if ES module syntax is discovered. | [Module 03](modules/03-modules-and-packages.md#1-two-module-systems-in-one-runtime) |
| **Package Exports (`exports`)** | **Exporty balíčku (package exports)** | A `package.json` field defining the explicit public subpaths and entry points of a package, encapsulating all unexported private internal files against external imports. | [Module 03](modules/03-modules-and-packages.md#5-packages-as-node-reads-them) |
| **Subpath Imports (`imports`)** | **Vnitřní importy balíčku (package imports)** | A `package.json` field defining private `#`-prefixed path aliases accessible only within the package, resolving identically across CJS and ESM. | [Module 03](modules/03-modules-and-packages.md#5-packages-as-node-reads-them) |
| **Conditional Exports** | **Podmíněné exporty** | Package `exports` entries chosen by active conditions such as `import`, `node` or `development`. | [Module 03](modules/03-modules-and-packages.md#5-packages-as-node-reads-them) |
| **`module-sync` Condition** | **Podmínka `module-sync`** | An export condition that matches for both `import` and `require()` when `require(esm)` is supported, enabling packages to serve a single shared ESM implementation. | [Module 03](modules/03-modules-and-packages.md#5-packages-as-node-reads-them) |
| **Dual-Package Hazard** | **Riziko dvojího balíčku (dual-package hazard)** | The critical failure mode where separate CJS and ESM builds of the same package are loaded concurrently in one process, causing singleton state divergence and broken `instanceof` checks. | [Module 03](modules/03-modules-and-packages.md#5-packages-as-node-reads-them) |
| **Customisation Hooks (`module.registerHooks`)** | **Háčky přizpůsobení zavaděče (customisation hooks)** | In-thread hook functions (`resolve`, `load`) registered via `module.registerHooks()` that customize module resolution and transformation. | [Module 03](modules/03-modules-and-packages.md#6-customisation-hooks-moduleregisterhooks) |
| **Type Stripping** | **Odstraňování typů (type stripping)** | The native runtime capability of executing `.ts` files directly by erasing TypeScript-only type syntax into whitespace without performing type checking or reading `tsconfig.json`. | [Module 03](modules/03-modules-and-packages.md#7-typescript-type-stripping) |
| **Erasable Syntax** | **Smazatelná syntaxe (erasable syntax)** | The subset of TypeScript syntax containing only compile-time annotations that can be stripped to valid JavaScript without altering runtime semantics. | [Module 03](modules/03-modules-and-packages.md#7-typescript-type-stripping) |
| **Compile Cache** | **Mezipaměť kompilace (compile cache)** | On-disk caching of V8 bytecode and code cache data enabled via `module.enableCompileCache()` or `NODE_COMPILE_CACHE` to accelerate subsequent script startup. | [Module 03](modules/03-modules-and-packages.md#9-startup-cost-the-compile-cache) |
| **Lockfile** | **Uzamykací soubor závislostí (lockfile)** | A deterministic record (`package-lock.json`) specifying exact package versions, dependency graphs, and cryptographic integrity hashes across installations. | [Module 03](modules/03-modules-and-packages.md#8-package-managers-and-lockfiles) |

---

## 4. Asynchronous Control Flow & Error Handling

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Error-First Callback** | **Zpětné volání s chybou na prvním místě (error-first callback)** | The standard Node callback pattern `(err, result) => void` where a falsy first argument indicates success and a truthy error instance indicates failure. | [Module 04](modules/04-async-control-flow-and-errors.md#1-three-generations-of-asynchronous-apis) |
| **Zalgo** | **Vypuštění Zalgo (nepředvídatelná synchronnost)** | The anti-pattern where an asynchronous API function executes its callback synchronously under some conditions and asynchronously under others, breaking caller invariants. | [Module 04](modules/04-async-control-flow-and-errors.md#1-three-generations-of-asynchronous-apis) |
| **`EventEmitter`** | **Emitent událostí (`EventEmitter`)** | Node's core class implementing synchronous event publishing and subscription via `on()` and `emit()`. | [Module 04](modules/04-async-control-flow-and-errors.md#2-eventemitter) |
| **`EventTarget`** | **Cíl událostí (`EventTarget`)** | The DOM-standard event interface implemented in Node for Web-interoperable event dispatching, where errors in listeners do not halt subsequent listener execution. | [Module 04](modules/04-async-control-flow-and-errors.md#2-eventemitter) |
| **`AbortController` / `AbortSignal`** | **Řadič a signál přerušení (AbortController / AbortSignal)** | The platform protocol for cancelling asynchronous work through an `AbortController` and its signal. | [Module 04](modules/04-async-control-flow-and-errors.md#4-cancellation-in-node-apis) |
| **Operational Error vs Programmer Error** | **Provozní vs programátorská chyba** | A predictable runtime failure condition (network disconnection, invalid user input, missing file) versus an unhandled software bug or assertion failure (type errors, syntax bugs). | [Module 04](modules/04-async-control-flow-and-errors.md#5-errors) |
| **System Error** | **Systémová chyba (system error)** | A low-level operating system error wrapped in an `Error` instance with `code`, `syscall`, `errno`, and `address` properties (e.g. `ENOENT`, `ECONNREFUSED`). | [Module 04](modules/04-async-control-flow-and-errors.md#5-errors) |
| **Unhandled Rejection** | **Neošetřené zamítnutí** | A rejected promise without a handler at the host's check point, reported through HostPromiseRejectionTracker. | [Module 04](modules/04-async-control-flow-and-errors.md#6-process-level-policy-uncaught-exceptions-and-unhandled-rejections) |
| **Uncaught Exception** | **Neodchycená výjimka** | An unhandled JavaScript exception escaping the execution stack back to the event loop, causing the process to exit with code 1 by default. | [Module 04](modules/04-async-control-flow-and-errors.md#6-process-level-policy-uncaught-exceptions-and-unhandled-rejections) |
| **`captureRejections`** | **Automatický záchyt zamítnutí (`captureRejections`)** | An `EventEmitter` configuration that catches unhandled promise rejections returned from `async` event listeners and re-routes them to the emitter's `'error'` event. | [Module 04](modules/04-async-control-flow-and-errors.md#2-eventemitter) |

---

## 5. Buffers, Streams & Backpressure

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Buffer** | **Bajtová vyrovnávací paměť (Buffer)** | A `Uint8Array` subclass representing fixed-size raw binary byte allocations stored in external memory outside the V8 garbage-collected heap. | [Module 05](modules/05-buffers-streams-backpressure.md#1-buffer) |
| **Buffer Pool** | **Fond vyrovnávací paměti (buffer pool)** | A shared 64 KiB memory slab from which Node carves small `Buffer.allocUnsafe` and string allocations to eliminate frequent native memory allocations. | [Module 05](modules/05-buffers-streams-backpressure.md#1-buffer) |
| **Stream (Readable / Writable / Duplex / Transform)** | **Proud dat (stream)** | An abstract event-driven interface for reading or writing data sequentially in chunks, categorized into Readable, Writable, Duplex (bidirectional), and Transform (mutating). | [Module 05](modules/05-buffers-streams-backpressure.md#2-streams-the-model) |
| **Object Mode** | **Objektový režim proudu (object mode)** | A stream configuration allowing chunks to be arbitrary JavaScript values rather than binary Buffers or strings, with high-water marks measured in item counts. | [Module 05](modules/05-buffers-streams-backpressure.md#2-streams-the-model) |
| **High-Water Mark** | **Hladinová značka (high-water mark)** | The byte threshold (default 64 KiB, or 16 items in object mode) at which an internal stream buffer signals that it has sufficient data buffered. | [Module 05](modules/05-buffers-streams-backpressure.md#2-streams-the-model) |
| **Backpressure** | **Zpětný tlak (_backpressure_)** | The flow-control protocol where a slow consumer indicates that intermediate buffers are full by returning `false` from `write()`, pausing the producer until `'drain'`. | [Module 05](modules/05-buffers-streams-backpressure.md#4-backpressure) |
| **`pipeline`** | **Zřetězení proudů (`pipeline`)** | A utility function connecting multiple streams with automated backpressure, bi-directional error forwarding, and guaranteed resource cleanup on completion or failure. | [Module 05](modules/05-buffers-streams-backpressure.md#5-pipe-vs-pipeline) |
| **Framing** | **Rámcování binárního protokolu (framing)** | The protocol technique of prefixing or delimiting byte chunks (e.g. length-prefixed headers) to reconstruct discrete application messages over a continuous byte stream. | [Module 05](modules/05-buffers-streams-backpressure.md#7-binary-protocols-framing-over-a-byte-stream) |
| **Decompression Bomb** | **Dekompresní bomba (zip bomb)** | A maliciously crafted compressed stream payload with an enormous expansion ratio designed to exhaust memory during decompression. | [Module 05](modules/05-buffers-streams-backpressure.md#8-compression-and-other-cpu-bound-streams) |

---

## 6. Operating System, File System & Child Processes

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **File Descriptor & `FileHandle`** | **Souborový deskriptor a `FileHandle`** | An integer representing an open file table entry in the OS kernel, wrapped in Node by an object implementing explicit disposal via `await using`. | [Module 06](modules/06-filesystem-process-os.md#1-three-apis-for-the-same-system-calls) |
| **Atomic Rename** | **Atomické přejmenování souboru** | A filesystem replacement pattern using `fs.rename` within the same filesystem mount to guarantee that readers observe either the old file or the new file without partial writes. | [Module 06](modules/06-filesystem-process-os.md#2-durability-and-atomic-replacement) |
| **Time-of-Check to Time-of-Use (TOCTOU)** | **Souběh mezi kontrolou a použitím (TOCTOU)** | A security vulnerability where a filesystem state (permissions, path target) is altered by an adversary in the interval between checking existence and performing the operation. | [Module 06](modules/06-filesystem-process-os.md#3-paths-and-traversal) |
| **Path Traversal** | **Podtečení cesty (path traversal)** | A directory traversal vulnerability where untrusted input containing `../` sequences escapes the intended root directory to read or write arbitrary system files. | [Module 06](modules/06-filesystem-process-os.md#3-paths-and-traversal) |
| **Child Process (`spawn`, `execFile`, `exec`, `fork`)** | **Dceřiný proces (child process)** | An operating system process spawned by Node: `spawn` streams stdio; `execFile` buffers output without a shell; `exec` runs via a system shell; `fork` establishes an IPC channel. | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |
| **IPC Channel** | **Komunikační kanál mezi procesy (IPC channel)** | A bidirectional operating system pipe (file descriptor 3) established between parent and forked child Node processes for message exchange. | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |
| **Structured Clone** | **Strukturovaný klon** | A deep copy produced by the HTML structured serialisation algorithm, used by `structuredClone` and `postMessage`. | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |
| **Shell Injection** | **Vstříknutí příkazů shellu (shell injection)** | A command injection vulnerability arising when untrusted input is interpolated into command strings executed by shell interpreters (`exec` or `shell: true`). | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |
| **Process Group** | **Skupina procesů (process group)** | A collection of related processes sharing a process group identifier (PGID) in POSIX systems, allowing group-wide signal dispatch. | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |
| **PID 1 & Zombie Process** | **Proces PID 1 a proces zombie** | The init process responsible for reaping orphaned child processes; Node running as PID 1 without an init supervisor fails to reap terminated children that exit. | [Module 06](modules/06-filesystem-process-os.md#5-child-processes) |

---

## 7. Networking, Protocols & Services

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Keep-Alive** | **Trvalé HTTP spojení (keep-alive)** | The protocol mechanism allowing multiple sequential HTTP requests and responses to reuse a single open TCP connection without repeated handshakes. | [Module 07](modules/07-networking-and-http.md#4-server-timeouts) |
| **`http.Agent`** | **Fond síťových spojení (`http.Agent`)** | A client connection pool managing socket creation, reuse, queuing, and destruction for outbound HTTP requests across destinations. | [Module 07](modules/07-networking-and-http.md#5-the-classic-http-client-and-httpagent) |
| **HTTP Request Smuggling** | **Pašování HTTP požadavků (request smuggling)** | An attack exploiting discrepancies between front-end reverse proxies and back-end servers in interpreting `Content-Length` versus `Transfer-Encoding: chunked`. | [Module 07](modules/07-networking-and-http.md#1-the-networking-stack-inside-node) |
| **Slowloris Attack** | **Útok Slowloris** | A denial-of-service attack that exhausts server connection tables by opening numerous connections and transmitting headers or bodies at agonizingly slow byte intervals. | [Module 07](modules/07-networking-and-http.md#4-server-timeouts) |
| **Happy Eyeballs** | **Algoritmus Happy Eyeballs** | The dual-stack connection algorithm (RFC 8305) that attempts IPv6 and IPv4 addresses concurrently with a slight delay, using whichever connects first. | [Module 07](modules/07-networking-and-http.md#7-dns-lookup-vs-resolve) |
| **undici & Dispatcher** | **undici a dispečer (Dispatcher)** | The high-performance client library powering Node's global `fetch`, structured around composable `Dispatcher` pipelines and interceptors. | [Module 07](modules/07-networking-and-http.md#6-fetch-and-undici) |
| **Encapsulation (Fastify)** | **Zapouzdření kontextu (encapsulation)** | Fastify's plugin architecture where registered plugins inherit parent decorators and hooks within an isolated context without leaking them to siblings. | [Module 08](modules/08-building-services.md#2-fastifys-architecture) |
| **Liveness & Readiness Probes** | **Sondy živosti a připravenosti (liveness/readiness)** | Orchestrator health checks: liveness determines whether a crashed process must be restarted; readiness determines whether the service is ready to accept incoming traffic. | [Module 08](modules/08-building-services.md#5-health-checks-rate-limits-and-load-shedding) |
| **Graceful Shutdown** | **Řádné ukončení služby (graceful shutdown)** | The coordinated shutdown procedure of stopping traffic ingestion, finishing in-flight requests within a timeout, closing persistent connections, and releasing resources. | [Module 08](modules/08-building-services.md#6-graceful-shutdown) |
| **Load Shedding & Circuit Breaker** | **Shazování zátěže a jistič (load shedding & circuit breaker)** | Overload defense patterns: shedding drops excessive requests when event-loop delay or queue length spikes; circuit breakers trip to fail-fast when an upstream dependency fails. | [Module 08](modules/08-building-services.md#5-health-checks-rate-limits-and-load-shedding) |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | [Module 08](modules/08-building-services.md#7-restful-design-and-proxies-jsnsd-domains) |

---

## 8. Concurrency & Scaling

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Worker Thread** | **Pracovní vlákno (worker thread)** | An operating system thread executing JavaScript in its own V8 isolate and libuv event loop while sharing process memory and the libuv thread pool. | [Module 09](modules/09-concurrency-and-scaling.md#2-worker-threads) |
| **V8 Isolate** | **Izolovaná instance V8 (isolate)** | An independent instance of the V8 JavaScript virtual machine with its own execution heap, garbage collector, and microtask queue. | [Module 09](modules/09-concurrency-and-scaling.md#2-worker-threads) |
| **Transfer List** | **Seznam přenášených objektů (transfer list)** | An array passed to `postMessage` transferring exclusive ownership of binary buffers (`ArrayBuffer`) to the recipient, detaching them from the sender. | [Module 09](modules/09-concurrency-and-scaling.md#2-worker-threads) |
| **`SharedArrayBuffer` & Atomics** | **Sdílená paměť a atomické operace** | Shared binary memory accessible concurrently by multiple threads, requiring synchronized read-write operations via `Atomics` to prevent data races. | [Module 09](modules/09-concurrency-and-scaling.md#4-shared-memory-in-practice) |
| **Worker Pool** | **Fond pracovních vláken (worker pool)** | A managed collection of reusable worker threads executing CPU-bound tasks from a bounded FIFO queue without per-task thread creation overhead. | [Module 09](modules/09-concurrency-and-scaling.md#3-worker-pools) |
| **Cluster & `SO_REUSEPORT`** | **Shlukování procesů (cluster) a `SO_REUSEPORT`** | Concurrency architectures running multiple Node processes on a single machine: `cluster` shares listening sockets via IPC handoff; `SO_REUSEPORT` balances connections at the kernel socket layer. | [Module 09](modules/09-concurrency-and-scaling.md#5-cluster-and-so_reuseport) |

---

## 9. Memory Management & Diagnostics

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Generational Garbage Collection** | **Generační garbage collection (generační úklid paměti)** | Collection that separates young and old objects, collecting young ones frequently. | [Module 10](modules/10-v8-memory-and-gc.md#2-the-generational-heap) |
| **Scavenger / Mark-Compact** | **Scavenger / Mark-Compact** | V8's fast semi-space copy collector for short-lived young objects versus the comprehensive marking, sweeping, and compaction collector for the old generation. | [Module 10](modules/10-v8-memory-and-gc.md#2-the-generational-heap) |
| **Write Barrier & Tri-Colour Marking** | **Zápisová bariéra a tříbarevné značení** | Garbage collection mechanisms: write barriers track old-to-young pointers during assignment; tri-colour marking (white, grey, black) tracks object reachability during concurrent collection. | [Module 10](modules/10-v8-memory-and-gc.md#2-the-generational-heap) |
| **Heap Snapshot & Retaining Path** | **Snímek haldy a cesta zachycení (retaining path)** | A diagnostic dump of the complete V8 object graph; retaining paths trace the chain of references keeping an object reachable from GC roots. | [Module 10](modules/10-v8-memory-and-gc.md#6-memory-leaks-in-node) |
| **Retained Size** | **Zachycená velikost paměti (retained size)** | The total amount of heap memory that would be freed if a given object were collected and its exclusively held descendants became unreachable. | [Module 10](modules/10-v8-memory-and-gc.md#6-memory-leaks-in-node) |
| **Out-of-Memory (OOM) Kill** | **Ukončení procesu z důvodu nedostatku paměti (OOM)** | Process termination caused either by V8 reaching its heap limit (`--max-old-space-size`, SIGABRT, exit 134) or the OS kernel killer terminating the container (SIGKILL, exit 137). | [Module 10](modules/10-v8-memory-and-gc.md#5-out-of-memory-what-actually-happens) |
| **Diagnostic Report** | **Diagnostická zpráva (diagnostic report)** | A comprehensive JSON summary generated by Node containing call stacks, heap statistics, libuv handles, OS resource limits, and environment details. | [Module 11](modules/11-diagnostics-and-performance.md#7-diagnostic-reports) |
| **`AsyncLocalStorage` & AsyncContextFrame** | **Kontextové úložiště `AsyncLocalStorage`** | An API enabling request-scoped context propagation across asynchronous boundaries without manual parameter passing, backed in modern Node by V8's AsyncContextFrame. | [Module 11](modules/11-diagnostics-and-performance.md#5-asynclocalstorage-and-async-context) |
| **`diagnostics_channel`** | **Diagnostický kanál (`diagnostics_channel`)** | A named publish-subscribe bus built into Node enabling zero-overhead runtime telemetry and instrumentation for internal and external libraries. | [Module 11](modules/11-diagnostics-and-performance.md#8-tracing-your-own-operations) |

---

## 10. Testing, Security & Supply Chain

| English Term | Czech Term | Definition & Context | Reference |
| :-- | :-- | :-- | :-- |
| **Test Double (Mock / Stub / Spy)** | **Testovací dvojník (mock, stub, spy)** | Stand-in test objects: stubs provide canned responses; spies observe and record invocations; mocks verify expected interaction assertions. | [Module 12](modules/12-testing.md#4-mocking-functions-timers-and-modules) |
| **Fake Timers** | **Simulovaný čas (fake timers)** | Deterministic test clocks replacing `setTimeout`, `setInterval`, and `Date` with controllable time advancing via `mock.timers.tick()`. | [Module 12](modules/12-testing.md#4-mocking-functions-timers-and-modules) |
| **Snapshot Testing** | **Testování snímků (snapshot testing)** | Comparing serialized test data structures against stored reference baselines to detect unintentional behavioral regressions. | [Module 12](modules/12-testing.md#5-snapshots) |
| **Permission Model** | **Model oprávnění (permission model)** | A Node security mechanism enabled by `--permission` that denies access to the filesystem, network, child processes, and workers unless explicitly granted. | [Module 13](modules/13-security.md#3-the-permission-model) |
| **Prototype Pollution** | **Znečištění prototypu (prototype pollution)** | An attack that writes attacker-controlled properties to a shared prototype such as `Object.prototype`. | [Module 13](modules/13-security.md#4-prototype-pollution-in-node) |
| **ReDoS** | **ReDoS (odepření služby regulárním výrazem)** | Denial of service by inputs that make a backtracking regular-expression engine take exponential time. | [Module 13](modules/13-security.md#5-redos) |
| **Server-Side Request Forgery (SSRF)** | **Falšování požadavků na straně serveru (SSRF)** | A vulnerability where an attacker induces a server to perform outbound HTTP requests against private internal network targets or cloud metadata services. | [Module 13](modules/13-security.md#8-ssrf-in-node) |
| **DNS Rebinding** | **Útok přemazáním DNS (DNS rebinding)** | An SSRF evasion attack where a domain resolves to an allowed public IP during validation but subsequently resolves to an internal private IP when fetched. | [Module 13](modules/13-security.md#8-ssrf-in-node) |
| **Supply-Chain Attack** | **Útok na dodavatelský řetězec (supply-chain attack)** | Compromising application dependencies via malicious npm packages, typosquatting, hijacked publish credentials, or rogue install scripts. | [Module 13](modules/13-security.md#7-supply-chain) |
| **Single Executable Application (SEA)** | **Samostatná spustitelná aplikace (SEA)** | A deployment mechanism bundling a compiled Node runtime blob and JavaScript application code into a single distribution binary. | [Module 14](modules/14-production-operations.md#4-single-executable-applications) |
| **Source Map** | **Mapování zdrojového kódu (source map)** | A mapping file translating runtime stack trace line and column numbers back to original TypeScript or bundled source files. | [Module 14](modules/14-production-operations.md#5-source-maps-and-stack-traces) |
