# 07 · Async Programming in Depth

> **Spec anchors (ECMA-262 17th edition):** §27.2 *Promise Objects* (§27.2.4.1 `Promise.all`, §27.2.4.2 `allSettled`, §27.2.4.3 `any`, §27.2.4.5 `race`, §27.2.4.8 `try`, §27.2.4.9 `withResolvers`, §27.2.5.4 `then`), §27.7 *AsyncFunction Objects* (§27.7.5.3 Await), §15.8 *Async Function Definitions*, §20.5.7 *AggregateError*. DOM Standard §3.1 *Interface AbortController* / §3.2 *Interface AbortSignal* (`AbortSignal.any`, `AbortSignal.timeout`). TC39 AsyncContext proposal (Stage 2).
>
> **Executable proof:** [`examples/07-async-in-depth.test.js`](../examples/07-async-in-depth.test.js), implementations in [`examples/07-async-utils.ts`](../examples/07-async-utils.ts)

[Module 06](06-agents-realms-job-queue.md) explained *when* promise jobs run. This module is about *using* promises correctly: combinators, how `async`/`await` desugars, cancellation, error propagation, and controlling concurrency. These are the most common senior-interview coding tasks ("implement `Promise.all`", "write a concurrency-limited pool", "add retry with backoff and cancellation").

---

## 1. A promise is a state machine plus a reaction list

**Definition.** A *promise* is an object that represents the eventual result of an asynchronous operation. It is in exactly one state: *pending*, *fulfilled* with a value, or *rejected* with a reason. A settled promise never changes state.

Properties you can rely on:

1. **Settles once.** Extra `resolve`/`reject` calls are ignored.
2. **Callbacks are asynchronous.** `then` callbacks run as jobs, never synchronously.
3. **`then` returns a new promise** resolved with the callback's return value; if the callback throws, the new promise rejects. Returning a thenable *adopts* its state.
4. **Errors propagate down the chain** until a rejection handler. `.catch(f)` is `.then(undefined, f)`; `.finally(f)` runs `f` without arguments and passes the original outcome through (unless `f` throws or returns a rejecting promise).
5. **The executor runs synchronously.** `new Promise(executor)` calls `executor(resolve, reject)` immediately; an exception thrown by the executor rejects the promise.

### `Promise.withResolvers` (ES2024) and `Promise.try` (ES2025)

```js
const { promise, resolve, reject } = Promise.withResolvers(); // "deferred" without the executor dance

const p = Promise.try(() => maybeSyncMaybeAsync(arg));
// calls the function now; a synchronous throw becomes a rejection, a return value or promise is adopted
```

| Then | Now |
|---|---|
| `let resolve; const p = new Promise(r => { resolve = r; });` | `Promise.withResolvers()` (ES2024) |
| `new Promise(r => r(fn()))` or `Promise.resolve().then(fn)` (the latter defers `fn` by a tick) | `Promise.try(fn)` (ES2025): runs `fn` synchronously, captures sync throws |

---

## 2. The combinators

| Combinator | Fulfils when | Rejects when | Result | Short-circuits |
|---|---|---|---|---|
| `Promise.all(it)` | all fulfil | **first** rejection | array of values in **input order** | on first rejection |
| `Promise.allSettled(it)` (ES2020) | all settle | never | array of `{ status, value }` / `{ status, reason }` | no |
| `Promise.any(it)` (ES2021) | **first** fulfilment | all reject | value / `AggregateError` with `.errors` | on first fulfilment |
| `Promise.race(it)` | first settles (either way) | first settles with rejection | the first outcome | yes |

Key facts:

- They accept any **iterable**, not just arrays, and pass each element through `Promise.resolve` (looked up as `this.resolve`, so subclasses work).
- `Promise.all([])` fulfils with `[]` (asynchronously); `Promise.any([])` rejects with an `AggregateError`; `Promise.race([])` **never settles**.
- **Short-circuiting does not cancel anything.** When `Promise.all` rejects, the other operations keep running, keep consuming sockets and CPU, and their later rejections are silently absorbed (the combinator attached handlers, so they are not reported as unhandled). Cancellation must be wired separately (§4).

### Implementing `Promise.all`

```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const results = [];
    let pending = 0;
    let index = 0;
    for (const item of iterable) {
      const i = index++;
      pending++;
      Promise.resolve(item).then((value) => {
        results[i] = value;                 // keep input order, not completion order
        if (--pending === 0) resolve(results);
      }, reject);                           // first rejection wins; later calls are ignored
    }
    if (pending === 0) resolve(results);    // empty iterable
  });
}
```

**Invariant.** After the loop, `pending` equals the number of input promises that have not fulfilled yet, and `results[i]` is defined exactly for the fulfilled indices. The promise resolves when `pending` reaches 0, which happens exactly once because each fulfilment decrements it exactly once.

---

## 3. `async`/`await`

**Definition (§15.8, §27.7).** An `async function` always returns a promise. Its body runs synchronously until the first `await`; `await v` suspends the function's execution context, resolves `v` with `PromiseResolve`, and resumes it in a job when that promise settles: with the value, or by **throwing** the reason at the `await` site.

Desugaring (conceptually, with the generator driver from [module 05](05-iterators-generators.md)):

```js
async function f(x) { const a = await g(x); return a + 1; }
// ≈
function f(x) {
  return run(function* () { const a = yield g(x); return a + 1; });
}
```

Consequences:

1. **Code before the first `await` runs synchronously** in the caller's turn. A synchronous throw there still becomes a *rejection*, not a thrown exception.
2. `try/catch` around `await` catches rejections, because the rejection is rethrown at the `await`.
3. `return p` inside `try` does not catch `p`'s rejection: the function returns *before* `p` settles. Write `return await p` inside `try` blocks ([module 06](06-agents-realms-job-queue.md) shows it is not slower).
4. Top-level `await` exists only in modules ([module 08](08-modules.md)).
5. Async stack traces: V8 reconstructs "await" frames for native promises (`at async f`), which is another reason to prefer `await` over hand-built `.then` chains.

### Sequential vs concurrent

```js
// Sequential: total time = sum of durations
for (const url of urls) results.push(await fetchJson(url));

// Concurrent, unbounded: total time ≈ max duration, but N simultaneous requests
const results = await Promise.all(urls.map(fetchJson));

// Concurrent, bounded: at most k in flight
const results = await mapWithConcurrency(urls, 8, fetchJson);
```

The first form is correct when each step depends on the previous one or when the server must not be hit concurrently. It is a performance bug otherwise. The second form is a resource bug for large `N`: 10,000 sockets, file descriptor exhaustion (`EMFILE`), rate-limit bans, memory spikes. The third form is what production code wants.

### A concurrency-limited pool

```ts
export async function mapWithConcurrency<T, R>(
  items: Iterable<T>, limit: number, fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const iterator = Array.from(items).entries();     // shared cursor: workers pull from it
  async function worker() {
    for (const [i, item] of iterator) results[i] = await fn(item, i);
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
}
```

**Invariant.** At any time, the number of `fn` calls in flight is ≤ `limit`, because each of the `limit` workers awaits its call before pulling the next index from the shared iterator. Every index is pulled exactly once because a single iterator is shared. On the first rejection, `Promise.all` rejects, but the remaining workers continue pulling items (no cancellation): combine with an `AbortSignal` to stop them, as the example implementation does.

---

## 4. Cancellation: `AbortController` and `AbortSignal`

ECMAScript has no cancellation primitive. The web platform's `AbortController`/`AbortSignal` (DOM Standard) is the de facto standard, implemented in Node, Deno, Bun and Workers, and accepted by `fetch`, `addEventListener`, Node's `fs`, `stream`, `timers/promises`, `child_process`, and most modern libraries.

```js
const controller = new AbortController();
const { signal } = controller;
fetch(url, { signal });           // rejects with signal.reason (an AbortError DOMException by default)
controller.abort(new Error('user navigated away'));
```

| API | Since | Purpose |
|---|---|---|
| `signal.aborted`, `signal.reason`, `'abort'` event | DOM | observe |
| `signal.throwIfAborted()` | 2022 | check at safe points in your own loops |
| `AbortSignal.timeout(ms)` | 2022 | signal that aborts with a `TimeoutError` DOMException |
| `AbortSignal.any([s1, s2])` | 2023 | aborts when any input aborts, with that input's reason |
| `addEventListener(type, fn, { signal })` | DOM | removes the listener on abort (prevents closure leaks) |

Writing cancellable functions:

1. Accept `{ signal }` in an options object.
2. Call `signal?.throwIfAborted()` before starting and at each await boundary in long loops.
3. Pass the signal to every API that accepts one.
4. For resources you manage (timers, sockets), listen for `'abort'` with `{ once: true }` and clean up; remove the listener when the operation finishes, or the signal (often long-lived) retains your closure.

Combining a caller's signal with a per-attempt timeout: `AbortSignal.any([callerSignal, AbortSignal.timeout(5000)])`.

### Retry with exponential backoff and jitter

```ts
export async function retry<T>(op: (attempt: number, signal: AbortSignal) => Promise<T>, {
  retries = 3, baseMs = 100, maxMs = 5_000, signal, sleep = defaultSleep, random = Math.random,
  isRetryable = (_e: unknown) => true,
}: RetryOptions = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await op(attempt, signal ?? new AbortController().signal);
    } catch (e) {
      if (attempt >= retries || !isRetryable(e) || signal?.aborted) throw e;
      const cap = Math.min(maxMs, baseMs * 2 ** attempt);
      await sleep(random() * cap, signal);           // "full jitter" (AWS Architecture Blog, 2015)
    }
  }
}
```

Rules: retry only idempotent operations (or use idempotency keys); never retry on 4xx validation errors; add jitter so that many clients do not retry in lockstep (thundering herd); respect `Retry-After`; cap total time with a signal.

### Debounce and throttle

- **Debounce** (trailing): run `fn` only after `ms` without new calls (search-as-you-type).
- **Throttle**: run at most once per `ms` (scroll handlers).

Both are implemented and tested with fake time in [`examples/07-async-utils.ts`](../examples/07-async-utils.ts). In UI code, prefer `requestAnimationFrame` coalescing for anything visual ([module 06](06-agents-realms-job-queue.md)).

---

## 5. Error handling patterns

| Situation | Pattern |
|---|---|
| Fire-and-forget that must not crash | `void task().catch(logError)`: always attach the catch immediately |
| Several independent operations, need all outcomes | `Promise.allSettled`, then partition |
| First successful mirror/replica | `Promise.any`, handle `AggregateError.errors` |
| Timeout around an operation that accepts a signal | `AbortSignal.timeout(ms)` passed through |
| Timeout around one that does not | `Promise.race([op, timeoutPromise])`, knowing the operation keeps running |
| Cleanup regardless of outcome | `try/finally`, or `using`/`await using` ([module 10](10-resource-management-temporal.md)) |
| Re-throw with context | `throw new Error('loading user', { cause: e })` (ES2022 `cause`) |

A **floating promise** (an async call not awaited and without `.catch`) is the most frequent production async bug: its rejection is unhandled and, in Node, terminates the process. TypeScript-ESLint's `no-floating-promises` and `no-misused-promises` (async callbacks passed where a void return is expected, e.g. `array.forEach(async ...)` or event handlers) catch most cases statically.

`array.forEach(async (x) => { await save(x); })` does not wait for anything: `forEach` ignores returned promises. Use `for...of` with `await` (sequential), `Promise.all(array.map(...))` (concurrent) or a pool (bounded).

---

## 6. AsyncContext (Stage 2)

Some state must follow a logical async operation across `await`s and callbacks (request IDs for logging, tracing spans, React/Solid owner context). Thread-locals do not exist in a single-threaded language, and passing the value explicitly through every function is invasive.

The TC39 **AsyncContext** proposal (Stage 2 as of 2026-10-28) adds `AsyncContext.Variable` and `AsyncContext.Snapshot`, propagated automatically through promise jobs, `await`, and host callbacks. It is not shipped in any engine without flags. Today:

- Node: `AsyncLocalStorage` (`node:async_hooks`), stable and widely used by OpenTelemetry; owned by the Node.js track.
- Browsers: no equivalent; frameworks use their own owner/context stacks and lose them across `await` (one motivation for Solid 2.0's design; see the SolidJS track).

---

## 7. Production failure modes

| Failure | Mechanism | Defence (tested) |
|---|---|---|
| `EMFILE`, 429s, memory spikes | `Promise.all` over thousands of items starts them all at once | concurrency-limited pool |
| Work continues after the user left the page / the request timed out | combinators do not cancel; no signal plumbing | `AbortSignal` passed everywhere; `AbortSignal.any` |
| Process exits with code 1 | floating promise rejection | `await` or `.catch` immediately; lint |
| `catch` never runs | `return p` instead of `return await p` inside `try` | `return await` |
| Loop "finishes" before the work | `forEach(async ...)` | `for...of` or `Promise.all(map(...))` |
| Retries amplify an outage | immediate retries without backoff or jitter, retrying non-idempotent calls | exponential backoff with full jitter, `isRetryable`, idempotency keys |
| Listener leak on long-lived signals | `'abort'` listeners never removed | `{ once: true }` and remove on completion |
| Latency is the *sum* of calls | sequential awaits of independent operations | start first, await later, or `Promise.all` |

---

## Interview Drill

<details><summary>1. Implement `Promise.all`. What edge cases matter?</summary>

See §2. Edge cases: preserve input order, not completion order; accept any iterable; wrap non-promises with `Promise.resolve`; resolve `[]` for an empty input; reject on the first rejection and ignore later ones; do not resolve twice.
</details>

<details><summary>2. Does `Promise.all` cancel the remaining operations when one rejects?</summary>

No. Promises are results, not handles to the work. The other operations continue, and their outcomes are ignored (their rejections are not reported as unhandled because `all` attached handlers). To stop the work, pass an `AbortSignal` and abort it when the first error occurs.
</details>

<details><summary>3. Write a function that runs async tasks with at most `k` in flight.</summary>

See `mapWithConcurrency` in §3: start `k` workers that pull from one shared iterator and await each task before pulling the next. Results are stored by index. Add a signal to stop pulling after the first failure if required.
</details>

<details><summary>4. What is the difference between `Promise.race` and `Promise.any`?</summary>

`race` settles with the first settled input, whether fulfilled or rejected. `any` fulfils with the first fulfilment and rejects only when all reject, with an `AggregateError` whose `errors` lists the reasons in input order. `race([])` never settles; `any([])` rejects.
</details>

<details><summary>5. Why can `return promise` inside `try` skip the `catch`?</summary>

`return p` resolves the async function's result promise with `p` and leaves the `try` block immediately; `p` rejects later, outside the `try`. `return await p` waits inside the `try`, so the rejection is thrown at the `await` and caught.
</details>

<details><summary>6. How do you add a timeout to `fetch` and also respect a caller's cancellation?</summary>

`fetch(url, { signal: AbortSignal.any([callerSignal, AbortSignal.timeout(ms)]) })`. The fetch rejects with the reason of whichever signal aborted first (`TimeoutError` or the caller's reason), and the underlying request is actually aborted.
</details>

<details><summary>7. Why add jitter to exponential backoff?</summary>

Without jitter, many clients that failed at the same time retry at the same times (1 s, 2 s, 4 s ...), producing synchronised load spikes that keep the service overloaded. Randomising the delay (full jitter: uniform in [0, cap]) spreads retries out.
</details>

<details><summary>8. What does `[1, 2, 3].forEach(async (x) => await save(x))` do?</summary>

It starts all three `save` calls concurrently, ignores the returned promises, and returns `undefined` synchronously. Errors become unhandled rejections. Use `for...of` with `await`, or `await Promise.all(xs.map(save))`.
</details>

<details><summary>9. What problem does AsyncContext solve, and what do you use today?</summary>

Propagating contextual values (request IDs, tracing spans) implicitly across async boundaries without passing them through every call. It is a Stage 2 proposal. In Node, `AsyncLocalStorage` does this today; in browsers there is no standard equivalent.
</details>
