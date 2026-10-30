# JavaScript (ECMAScript 2026) Cheatsheet

Fast lookup for the rules taught in [modules/](modules/). Every rule here is exercised by a test in [examples/](examples/). Runtime: Node 26.12.1 (V8 14.6).

## Types and coercion ([02](modules/02-types-values-coercion.md))

| Value | `typeof` | ToBoolean | ToNumber | ToString |
|---|---|---|---|---|
| `undefined` | `"undefined"` | false | `NaN` | `"undefined"` |
| `null` | **`"object"`** | false | `0` | `"null"` |
| `true` / `false` | `"boolean"` | — | `1` / `0` | `"true"` / `"false"` |
| `""` / `" 12\n"` / `"12px"` | `"string"` | false / true / true | `0` / `12` / `NaN` | — |
| `0`, `-0`, `NaN` | `"number"` | false | — | `"0"`, **`"0"`**, `"NaN"` |
| `0n` / `1n` | `"bigint"` | false / true | **TypeError** (use `Number(x)`) | `"0"` / `"1"` |
| `Symbol()` | `"symbol"` | true | TypeError | **TypeError** (use `String(s)`) |
| `[]` / `[7]` / `[1,2]` | `"object"` | true | `0` / `7` / `NaN` | `""` / `"7"` / `"1,2"` |
| `{}` | `"object"` | true | `NaN` | `"[object Object]"` |
| `() => {}`, `class {}` | `"function"` | true | `NaN` | source text |

**Falsy:** `false 0 -0 0n NaN "" null undefined` (+ `document.all`). Everything else is truthy.

**ToPrimitive hints:** `+` and `==` → `"default"`; arithmetic, `<`, `Number()` → `"number"` (`valueOf` first); template literals, `String()`, property keys → `"string"` (`toString` first). `Date` treats `"default"` as `"string"`.

| Algorithm | Used by | NaN = NaN | +0 = −0 |
|---|---|---|---|
| IsStrictlyEqual | `===`, `indexOf`, `switch` | ✗ | ✓ |
| IsLooselyEqual | `==` (coerces; `null == undefined` only) | ✗ | ✓ |
| SameValue | `Object.is` | ✓ | ✗ |
| SameValueZero | `includes`, `Map`/`Set` keys | ✓ | ✓ |

Numbers: `Number.MAX_SAFE_INTEGER = 2**53 - 1`; `0.1 + 0.2 = 0.30000000000000004`; `x | 0` is ToInt32 (wraps mod 2³²), not floor. BigInt: no mixing in arithmetic, `1n < 2` ok, `+1n` throws, `/` truncates.

## Declarations and scope ([03](modules/03-execution-contexts-scope-closures.md))

| Declaration | Scope | Before declaration | Global property (script) |
|---|---|---|---|
| `var` | function | `undefined` | yes |
| `function f(){}` | function (block in strict code) | callable | yes |
| `let` / `const` | block | **ReferenceError (TDZ)** | no |
| `class` | block | ReferenceError (TDZ) | no |
| `import` | module | live binding | no |

`for (let i …)` creates a new binding per iteration; `for (var i …)` shares one.

## `this` ([03](modules/03-execution-contexts-scope-closures.md))

Precedence: **arrow (lexical) › `new` › `bind` › `call`/`apply` › method call `o.m()` › plain call** (`undefined` in strict code, `globalThis` in sloppy code).

| Call | `this` |
|---|---|
| `o.m()`, `(o.m)()`, `o?.m()` | `o` |
| `(0, o.m)()`, `const f = o.m; f()` | `undefined` (strict) |
| `new F()` | new object (derived classes: after `super()`) |
| `f.bind(a).bind(b)()` | `a` |
| `new (f.bind(a))()` | new object (bound `this` ignored) |
| class field `h = () => this` | the instance |

## Objects ([04](modules/04-objects-prototypes-classes.md))

- Key order: integer indices ascending → strings by insertion → symbols by insertion.
- `defineProperty` defaults: `writable/enumerable/configurable: false`. Assignment defaults: all `true`.
- `freeze` is shallow; private fields, `Map` contents and `Date` values stay mutable.
- `[[Set]]` looks up the chain first: inherited setters run; inherited read-only properties block assignment (override mistake).
- `Object.assign` uses `[[Set]]` (setters fire); `{...o}` defines (no setters). Both shallow, own enumerable, invoke getters.
- Class fields are *defined* after `super()` returns; private names are not forwarded by Proxy.
- Use `Object.hasOwn`, `Array.isArray`, `Error.isError` (realm-safe), `Object.create(null)` or `Map` for dictionaries.

## Iteration ([05](modules/05-iterators-generators.md))

- Iterable: `[Symbol.iterator]()` → iterator with `next()` → `{ value, done }`; optional `return()` for cleanup.
- `return()` is called on `break`, early destructuring, body `throw`, `take`/`find`/`some`/`every`; not on exhaustion or when `next()` throws.
- Generators are one-shot; the first `next(x)` ignores `x`; `gen.return(v)` runs `finally`.
- Helpers (lazy, one-shot, callback `(value, counter)`): `map filter take drop flatMap` / eager `toArray reduce forEach some every find`; `Iterator.from`, `Iterator.concat` (ES2026). `Iterator.zip`, `chunks` are ES2027 and **not** in Node 26.
- `Array.fromAsync` awaits elements **sequentially**.

## Event loop ([06](modules/06-agents-realms-job-queue.md))

```
task → drain ALL microtasks → (rendering opportunity? → rendering task:
  resize → scroll → media queries → animations → rAF callbacks → style/layout (+ResizeObserver)
  → IntersectionObserver → paint) → next task
```

- Microtasks: promise reactions, `queueMicrotask`, `await` continuations, `MutationObserver`. FIFO. Can starve tasks and rendering.
- Tasks: timers, events, messages, I/O. Ordered only within a task source.
- Ticks after a sync turn: `await nativePromise` 1 · `Promise.resolve(thenable).then` 2 · `new Promise(r => r(promise)).then` 3 · async `return promise` 3.
- Node: unhandled rejection after the microtask drain → exit code 1 (default `--unhandled-rejections=throw`).

## Async ([07](modules/07-async-in-depth.md))

| Combinator | Fulfils | Rejects | Empty input |
|---|---|---|---|
| `all` | all fulfil (input order) | first rejection | `[]` |
| `allSettled` | all settle | never | `[]` |
| `any` | first fulfilment | all reject → `AggregateError` | rejects |
| `race` | first settles | first settles rejected | never settles |

No combinator cancels anything. Use `AbortSignal`: `AbortSignal.timeout(ms)`, `AbortSignal.any([a, b])`, `signal.throwIfAborted()`, `addEventListener(t, fn, { signal })`. `Promise.withResolvers()` (ES2024), `Promise.try(fn)` (ES2025). Inside `try`: `return await p`. Never `forEach(async …)`; use `for…of` + `await`, `Promise.all(map(...))`, or a bounded pool.

## Modules ([08](modules/08-modules.md))

- Phases: load → link (missing export = SyntaxError, nothing runs) → evaluate (depth-first post-order, once per realm; errors cached).
- Imports are live and read-only; `export default <expr>` is a snapshot.
- Cycles: the module visited first finishes last → TDZ errors depend on import order.
- TLA: dependents wait, siblings continue; rejection fails all dependents.
- `import data from './x.json' with { type: 'json' }` (`assert` is removed). `import.meta.url/resolve/dirname/filename`.
- `exports` conditions: object key order, first active wins; unlisted subpaths are blocked.

## Metaprogramming and memory ([09](modules/09-metaprogramming.md), [11](modules/11-binary-data-memory-model.md))

- Proxy traps must respect invariants (non-configurable, non-extensible targets); forward with `Reflect.*(…, receiver)`; internal slots are not forwarded (wrap `Map` methods).
- `WeakMap`/`WeakSet`: object (or non-registered symbol) keys, not iterable. `WeakRef`/`FinalizationRegistry`: caches and leak detection only, never cleanup.
- Decorators: **Stage 2.7** (since May 2026), not in any engine; TypeScript/Babel/esbuild transpile them.
- `structuredClone`: keeps cycles, Map/Set/Date/RegExp/BigInt/errors; drops prototypes and symbol keys; invokes getters; functions/symbols/WeakMap throw `DataCloneError`; `{ transfer: [buf] }` detaches.
- `ArrayBuffer(n, { maxByteLength })` + `resize`; `buf.transfer()` detaches. `bytes.toBase64({ alphabet: 'base64url', omitPadding: true })`, `Uint8Array.fromBase64(s, { lastChunkHandling: 'strict' })`, `toHex`/`fromHex` (ES2026).
- Shared memory: plain `a[i]++` races; use `Atomics.add/compareExchange/load/store`; `Atomics.wait` (workers, Node main), `waitAsync` (anywhere), `notify`, `pause` (spin hint). Browsers need COOP + COEP.

## ES2027 in Node 26 ([10](modules/10-resource-management-temporal.md))

```js
{ using a = res1(), b = res2(); }          // disposes b, then a; errors → SuppressedError
await using conn = await pool.get();       // awaits [Symbol.asyncDispose]
const stack = new DisposableStack(); stack.use(r); stack.defer(fn); stack.adopt(v, close); stack.move();
```

| Need | Temporal type |
|---|---|
| timestamp | `Instant` |
| human time in a place, DST-correct math | `ZonedDateTime` |
| birthday / due date | `PlainDate` |
| opening hours | `PlainTime` |
| amount of time | `Duration` (calendar units need `relativeTo`) |

`zdt.add({ days: 1 })` keeps wall-clock time; `add({ hours: 24 })` adds elapsed time. Gaps/folds: `disambiguation: 'compatible' | 'earlier' | 'later' | 'reject'`. Overflow: `constrain` (default) or `reject`. Compare with `Temporal.X.compare`, never `<` (throws).

## Performance in V8 ([12](modules/12-engine-internals-v8.md))

- Same constructor, same field order → one hidden class → monomorphic ICs (> 4 shapes at a site = megamorphic).
- Avoid `delete` on hot objects (dictionary mode); avoid optional properties on hot records.
- Keep arrays packed and single-kind (Smi → double → generic, never back); `-0`/`NaN` force doubles.
- Diagnose with `--cpu-prof`, `--trace-deopt` (read `reason:`), heap snapshots (retainers).

## Security and correctness ([13](modules/13-correctness-security-pitfalls.md))

- Never merge untrusted JSON into objects; skip `__proto__`/`constructor`/`prototype`; validate with a schema.
- No nested quantifiers (`(a+)+`); bound input; `RegExp.escape(userText)`; beware shared `/g` regexes (`lastIndex`).
- Big integers in JSON: `JSON.parse(t, (k, v, { source }) => …BigInt(source))`, `JSON.rawJSON(big.toString())`.
- `[10,1,2].sort()` → `[1,10,2]`; comparators must return numbers consistently; `toSorted` does not mutate; sort is stable since ES2019.
- `new Date('2026-03-29')` is UTC, `'2026-03-29T00:00'` is local, `'2026-02-30'` silently becomes 2 March in V8.

## Node 26.12.1 feature support (pinned in [examples/01](examples/01-reading-the-spec.test.js))

| Shipped | Flag only | Absent |
|---|---|---|
| Upsert, `JSON.rawJSON`, `Iterator.concat`, base64/hex, `Error.isError`, `Array.fromAsync`, Temporal, `using`/`DisposableStack`, `Atomics.pause`, `Promise.try`, `RegExp.escape`, `Float16Array` | `Math.sumPrecise` (`--js-sum-precise`), `import defer` (`--js-defer-import-eval`), ShadowRealm (`--harmony-shadow-realm`) | `Iterator.zip`, `Iterator.prototype.chunks`, decorator syntax, AsyncContext |
