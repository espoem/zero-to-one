# 11 · Binary Data, Serialisation and the Memory Model

> **Spec anchors (ECMA-262 17th edition):** §25.1 *ArrayBuffer Objects* (§25.1.2 resizable buffers, §25.1.6.6 `resize`, §25.1.6.8 `transfer`), §25.2 *SharedArrayBuffer Objects*, §25.3 *DataView Objects*, §23.2 *TypedArray Objects*, §10.4.5 *TypedArray Exotic Objects*, §23.3.1.1 `Uint8Array.fromBase64` (ES2026 base64/hex), §25.4 *The Atomics Object* (§25.4.13 `wait`, §25.4.14 `waitAsync`, §25.4.15 `notify`), §29 *Memory Model* (§29.1 fundamentals, §29.4 candidate executions, §29.6.6 happens-before, §29.7.3 tear free, §29.7.4 sequentially consistent, §29.8 races, §29.9 data races). ES2027 draft: `Atomics.pause`. HTML Living Standard §2.7 *Safe passing of structured data* (structured serialisation, `structuredClone`); HTML cross-origin isolation (`COOP`/`COEP`).
>
> **Executable proof:** [`examples/11-binary-data-memory-model.test.js`](../examples/11-binary-data-memory-model.test.js)

This module covers everything that crosses a boundary as bytes or as cloned values: raw memory (`ArrayBuffer`, typed arrays), encodings (base64, hex), copying values between realms and agents (`structuredClone`, `postMessage`), and sharing memory between agents (`SharedArrayBuffer`, `Atomics`, and the memory model that defines what concurrent reads may see). Language-neutral concurrency theory (locks, lock-free algorithms) is owned by the DSA track ([`../../../algorithms/dsa/`](../../../algorithms/dsa/)); Node's `worker_threads` API by the Node.js track.

---

## 1. ArrayBuffer: raw bytes

**Definition (§25.1).** An `ArrayBuffer` holds a *Data Block* (a sequence of bytes) in `[[ArrayBufferData]]` with a length. It has no element type and cannot be read directly; views interpret it.

### Resizable buffers (ES2024)

```js
const rab = new ArrayBuffer(2, { maxByteLength: 8 });
const tracking = new Uint8Array(rab);          // length-tracking view: no explicit length
rab.resize(6);
tracking.length;                               // 6
const fixed = new Uint8Array(rab, 0, 4);
rab.resize(2);
fixed.length;                                  // 0: the fixed view is now out of bounds
rab.resize(9);                                 // RangeError: above maxByteLength
```

Engines can reserve `maxByteLength` of virtual address space up front, so growth does not copy. This is the JavaScript side of WebAssembly memory growth and of streaming parsers that append data.

### Transfer and detachment (ES2024)

`buf.transfer(newLength?)` returns a new buffer with the contents and **detaches** the original: its `byteLength` becomes 0, `detached` is true, views on it report length 0, reads return `undefined` and writes are silently ignored; creating a new view on it throws `TypeError`. `transferToFixedLength()` does the same but yields a non-resizable buffer. Detachment also happens when a buffer is listed in the `transfer` option of `postMessage`/`structuredClone`.

| Then | Now |
|---|---|
| Copy into a bigger buffer by hand to grow (`new Uint8Array(bigger).set(old)`) | `new ArrayBuffer(n, { maxByteLength })` + `resize` (ES2024) |
| Detach only via `postMessage(…, [buf])` | `buf.transfer()` (ES2024) |
| `btoa(String.fromCharCode(...bytes))` (Latin-1 only, stack overflow on large arrays) | `bytes.toBase64()` (ES2026) |
| Node `Buffer.from(s, 'base64')` (Node-only) | `Uint8Array.fromBase64(s)` (portable) |

---

## 2. Typed arrays and DataView

**Definition (§23.2).** A *TypedArray* is a view over a buffer region with a fixed element type: `Int8`, `Uint8`, `Uint8Clamped`, `Int16`, `Uint16`, `Int32`, `Uint32`, `Float16` (ES2025), `Float32`, `Float64`, `BigInt64`, `BigUint64`.

| Fact | Detail |
|---|---|
| Endianness | the **platform's** byte order (little-endian on x86-64 and ARM64 in practice) |
| Conversion on write | integers wrap modulo 2ⁿ (`Uint8` 257 → 1), `Uint8Clamped` clamps and rounds half to even, floats round to the element precision (`Float16Array` 65520 → `Infinity`, max finite is 65504) |
| Keys | canonical numeric strings never reach the prototype; out-of-bounds reads give `undefined`, writes are ignored ([module 04](04-objects-prototypes-classes.md)) |
| Alignment | `new Int32Array(buf, byteOffset)` requires `byteOffset % 4 === 0` (RangeError otherwise) |
| Methods | most `Array` methods, plus `set`, `subarray` (a view, no copy) vs `slice` (a copy) |

`DataView` reads and writes any type at any byte offset with **explicit endianness** (`getUint16(offset, littleEndian)`; big-endian when the flag is omitted). Use `DataView` for file formats and network protocols, typed arrays for homogeneous numeric data.

---

## 3. Base64 and hex (ES2026)

```js
new Uint8Array([251, 255]).toBase64();                                   // '+/8='
new Uint8Array([251, 255]).toBase64({ alphabet: 'base64url', omitPadding: true }); // '-_8'
Uint8Array.fromBase64('+/8=', { alphabet: 'base64url' });                // SyntaxError: wrong alphabet
Uint8Array.fromBase64('AQ', { lastChunkHandling: 'strict' });            // SyntaxError: missing padding
Uint8Array.fromBase64('AQ');                                             // [1]   ('loose' is the default)
new Uint8Array([1, 171]).toHex();                                        // '01ab'
Uint8Array.fromHex('abc');                                               // SyntaxError: odd length
target.setFromBase64('AQID');                                            // { read: 4, written: 3 }: decode into existing memory
```

`lastChunkHandling` is `'loose'` (accept missing padding), `'strict'` (require canonical padding and zero overflow bits) or `'stop-before-partial'` (for streaming decoders). Prefer `'strict'` when validating untrusted input such as JWT segments (with `base64url`).

---

## 4. Structured serialisation and `structuredClone`

**Definition (HTML §2.7).** The *structured serialize* / *deserialize* algorithms convert a value into a realm-independent record and recreate it in a target realm. They are used by `structuredClone`, `postMessage` (windows, workers, `MessageChannel`, `BroadcastChannel`), IndexedDB, `history.pushState`, and Node's `worker_threads` and `v8.serialize`.

| Supported | Not supported (`DataCloneError`) | Silently changed |
|---|---|---|
| primitives except Symbol (incl. BigInt, `-0`, `NaN`) | functions, classes | **prototype lost**: class instances become plain objects |
| plain objects, arrays (incl. holes), `Map`, `Set` | Symbols (as values) | Symbol-keyed properties dropped |
| `Date`, `RegExp` (flags, but `lastIndex` reset), boxed primitives | `WeakMap`, `WeakSet`, `WeakRef` | non-enumerable properties dropped |
| `ArrayBuffer`, typed arrays, `DataView`, `Blob`, `File`, `ImageData` | DOM nodes | **getters are invoked** and their values copied; accessors become data |
| `Error` and native error subtypes (name, message, `cause`; stack in some hosts) | `Proxy`? (cloned as its target's data in some hosts; do not rely on it) | property attributes reset (frozen objects become unfrozen) |
| cycles and shared references (preserved) | promises | `SharedArrayBuffer`: shared, not copied (same memory, new object) |

**Transfer** moves ownership instead of copying: `structuredClone(value, { transfer: [buffer] })` detaches the source buffer (O(1), no copy). `MessagePort`, `ReadableStream`, `ImageBitmap`, `OffscreenCanvas` are transferable in browsers.

When to use what:

| Need | Use |
|---|---|
| deep copy of plain data in-process | `structuredClone` |
| copy that preserves class instances | a class-specific `clone()` method or a serialisation library |
| wire format across processes or languages | JSON (with a reviver for dates, BigInts, [module 13](13-correctness-security-pitfalls.md)) or a binary format |
| send large binary data to a worker | `postMessage(msg, [buffer])` (transfer) |
| share memory with a worker | `SharedArrayBuffer` |

Framework serialisers extend structured clone's ideas for server→client transfer: React's Flight protocol and Solid's seroval can serialise promises, iterators, `Map`/`Set` and cycles across the network; their tracks link here for the baseline.

---

## 5. SharedArrayBuffer and cross-origin isolation

**Definition (§25.2).** A `SharedArrayBuffer` holds a *Shared Data Block* that can be referenced by several agents in one agent cluster at the same time. Sending it via `postMessage` or `structuredClone` shares the block instead of copying it.

After Spectre (January 2018), browsers disabled `SharedArrayBuffer` because it enables high-resolution timers. It returned behind **cross-origin isolation**: the page must be served with

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   (or credentialless)
```

and then `self.crossOriginIsolated === true`. Without it, `SharedArrayBuffer` is undefined (or cannot be posted). Node has no such restriction. Growable SABs (`new SharedArrayBuffer(n, { maxByteLength })`, `grow`) exist since ES2024; they can grow but never shrink.

---

## 6. The memory model

ECMA-262 §29 defines which values a read of shared memory may observe when agents run in parallel. It follows the C++/Java tradition (Boehm & Adve, "Foundations of the C++ Concurrency Memory Model", PLDI 2008) adapted to JavaScript.

### Definitions

- **Events** (§29.2): every access to a Shared Data Block is a *ReadSharedMemory*, *WriteSharedMemory* or *ReadModifyWriteSharedMemory* event, with an **order**: `SeqCst` (sequentially consistent, used by `Atomics`), `Unordered` (normal reads and writes), or `Init`.
- **Candidate execution** (§29.4): a set of events plus relations: *agent-order* (program order within one agent), *reads-bytes-from*, *synchronizes-with* (an `Atomics` write and a `SeqCst` read of it), and *happens-before*.
- **Happens-before** (§29.6.6): the transitive closure of agent-order and synchronizes-with (plus init ordering). If write W happens-before read R, and nothing writes in between, R sees W.
- **Race** (§29.8): two events race if they access overlapping memory, at least one is a write, and neither happens-before the other.
- **Data race** (§29.9): a race where at least one of the events is not `SeqCst` (or they access different ranges in a way atomics cannot order).

### What you are guaranteed

| Program kind | Guarantee |
|---|---|
| **Data-race-free** (every conflicting access ordered by happens-before, typically via `Atomics`) | **sequential consistency**: the program behaves as if all events were interleaved in one global order (§29.7.4, the "DRF-SC" theorem) |
| Has data races | reads may observe a set of possible values (no "out of thin air" values, but very weak ordering); results can differ between runs, engines and CPUs |
| Plain accesses | aligned accesses of the element size are *tear free* where the spec requires (§29.7.3): a racing 32-bit read sees one of the written values, not a mix; `Float64` and `BigInt64` accesses may tear |

The language guarantees no undefined behaviour in the C sense: a data race cannot crash the engine or corrupt unrelated memory. It just makes the results of the racing accesses non-deterministic.

### Lost updates: the canonical data race

`a[0]++` is three steps (read, add, write). Two agents doing it concurrently can both read 5 and both write 6. The example file runs four workers, each incrementing a plain counter and an atomic counter 200,000 times:

```
plain 611766    atomic 800000    expected 800000     (one run on Node 26)
```

`Atomics.add(a, 0, 1)` is an indivisible read-modify-write with `SeqCst` order.

### The Atomics API

| Function | Semantics |
|---|---|
| `load`, `store` | `SeqCst` read/write |
| `add`, `sub`, `and`, `or`, `xor`, `exchange` | atomic read-modify-write; return the **old** value |
| `compareExchange(ta, i, expected, replacement)` | CAS: write only if the current value equals `expected`; returns the old value. Building block for lock-free structures and mutexes |
| `wait(ta, i, value, timeout?)` | if `ta[i] === value`, **block** the agent until notified or timed out; returns `'ok'`, `'not-equal'` or `'timed-out'`. Only on `Int32Array`/`BigInt64Array` over a SAB. Throws `TypeError` where `[[CanBlock]]` is false (browser main thread); allowed in workers and Node's main thread |
| `waitAsync(ta, i, value, timeout?)` (ES2024) | non-blocking variant: returns `{ async: false, value: 'not-equal' \| 'timed-out' }` or `{ async: true, value: Promise<'ok' \| 'timed-out'> }`. Usable on the main thread |
| `notify(ta, i, count?)` | wake up to `count` waiters on that index; returns how many woke |
| `pause(n?)` (ES2027, shipped in Node 26) | a CPU hint for spin-wait loops (x86 `PAUSE`, ARM `YIELD`): reduces power and contention while spinning before falling back to `wait` |
| `isLockFree(n)` | whether `n`-byte atomics are lock-free on this platform |

A minimal mutex, to show the pattern (production code should use well-tested libraries, and the theory of locks belongs to the DSA track):

```js
const UNLOCKED = 0, LOCKED = 1;
function lock(i32, idx) {
  for (let spins = 0; Atomics.compareExchange(i32, idx, UNLOCKED, LOCKED) !== UNLOCKED; spins++) {
    if (spins < 100) Atomics.pause(spins);           // brief spin
    else Atomics.wait(i32, idx, LOCKED);             // then sleep until notified
  }
}
function unlock(i32, idx) {
  Atomics.store(i32, idx, UNLOCKED);
  Atomics.notify(i32, idx, 1);
}
```

**Invariant.** At most one agent holds the lock: the only transition into LOCKED is a successful `compareExchange` from UNLOCKED, which is atomic, so two agents cannot both observe UNLOCKED and succeed. **Progress:** a waiting agent is woken by `notify` after the holder's `store`; the `wait` re-checks the value, so a notify between the failed CAS and the wait is not lost (wait returns `'not-equal'` immediately if the value already changed).

---

## 7. Production failure modes

| Failure | Mechanism | Defence (tested) |
|---|---|---|
| Counter totals wrong under load with workers | data race on `a[i]++` | `Atomics.add` or per-worker counters merged at the end |
| Main thread freezes (browser) or throws | `Atomics.wait` on a thread that cannot block | `Atomics.waitAsync` |
| `TypeError: Cannot perform … on a detached ArrayBuffer` / silent zero-length views | buffer transferred to a worker or with `transfer()` | do not keep views after transferring; copy if both sides need the data |
| Corrupted binary parsing on another platform | relying on typed-array platform endianness for file formats | `DataView` with explicit endianness |
| Class instances lose methods after `postMessage`/`structuredClone` | prototypes are not serialised | re-hydrate on the receiving side |
| `DataCloneError` when posting objects with functions or class instances with private state | not serialisable | send plain data |
| Base64 decoding accepts malformed input | loose padding handling | `lastChunkHandling: 'strict'` |
| `SharedArrayBuffer is not defined` in production | missing COOP/COEP headers | cross-origin isolation |

---

## Interview Drill

<details><summary>1. What is the difference between `subarray` and `slice` on a typed array?</summary>

`subarray` returns a new view over the same buffer (no copy: writes are visible in both); `slice` copies the elements into a new buffer.
</details>

<details><summary>2. What happens to a buffer after `postMessage(msg, [buffer])`?</summary>

Ownership is transferred: the sender's buffer is detached (byteLength 0, views have length 0, new views throw), and the receiver gets the data without a copy.
</details>

<details><summary>3. List what `structuredClone` cannot clone and what it changes silently.</summary>

Cannot: functions, Symbols, WeakMap/WeakSet/WeakRef, DOM nodes, promises (DataCloneError). Silently changes: prototypes (class instances become plain objects), Symbol-keyed and non-enumerable properties are dropped, getters are invoked and replaced by data, property attributes and frozenness are reset. It preserves cycles, Map/Set, Date, RegExp, typed arrays, BigInt and native Error types.
</details>

<details><summary>4. Why does `counter[0]++` from several workers lose increments, and what fixes it?</summary>

The increment is a read, an add and a write; two agents can interleave between the read and the write and overwrite each other's results. This is a data race, so the memory model gives no sequentially consistent result. `Atomics.add` performs an indivisible read-modify-write.
</details>

<details><summary>5. What does "data-race-free programs are sequentially consistent" mean in JavaScript?</summary>

If every pair of conflicting accesses to shared memory is ordered by happens-before (established through Atomics operations and their synchronizes-with edges), every execution behaves as some interleaving of the agents' operations in program order. Only programs with data races can observe the weaker, reordered behaviours.
</details>

<details><summary>6. Why do browsers require cross-origin isolation for SharedArrayBuffer?</summary>

Shared memory plus a worker incrementing a counter gives a high-resolution timer, which makes Spectre-class side-channel attacks practical. COOP/COEP guarantee that the page cannot share a process with cross-origin documents that did not opt in, so the timer cannot be used to read their data.
</details>

<details><summary>7. When do you use `Atomics.wait` vs `Atomics.waitAsync` vs `Atomics.pause`?</summary>

`wait` blocks the agent; use it in workers (and Node) for efficient sleeping until notified. `waitAsync` returns a promise and is usable on the browser main thread. `pause` is a hint inside short spin loops before falling back to waiting.
</details>

<details><summary>8. How do you encode bytes as URL-safe base64 portably?</summary>

`bytes.toBase64({ alphabet: 'base64url', omitPadding: true })` (ES2026, Node 26); decode with `Uint8Array.fromBase64(s, { alphabet: 'base64url', lastChunkHandling: 'loose' })`, or `'strict'` when padding is required.
</details>
