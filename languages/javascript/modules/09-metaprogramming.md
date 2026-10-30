# 09 · Metaprogramming: Proxy, Reflect, Symbols, Tagged Templates, Weak References and Decorators

> **Spec anchors (ECMA-262 17th edition):** §10.5 *Proxy Object Internal Methods and Internal Slots*, §28.1 *The Reflect Object*, §28.2 *Proxy Objects*, §6.1.5.1 *Well-Known Symbols*, §13.3.11 tagged templates (GetTemplateObject), §24.3 *WeakMap Objects*, §24.4 *WeakSet Objects*, §26.1 *WeakRef Objects*, §26.2 *FinalizationRegistry Objects*, §9.9 *Processing Model of WeakRef and FinalizationRegistry Targets*, §9.10 *ClearKeptObjects*. Decorators: TC39 proposal-decorators (**Stage 2.7**) and proposal-decorator-metadata (**Stage 2.7**).
>
> **Executable proof:** [`examples/09-metaprogramming.test.js`](../examples/09-metaprogramming.test.js)

Metaprogramming means writing code that changes how *other* code's operations behave: what a property read does, how `instanceof` answers, how a template literal is assembled, or what happens to a class method at definition time. JavaScript exposes this through three layers: well-known symbols (protocol hooks), Proxy (replacing an object's internal methods), and decorators (transforming class elements, not yet standard). Weak references sit alongside, because the classic metaprogramming use case, attaching hidden data to objects you do not own, needs them.

---

## 1. Proxy

**Definition (§10.5, §28.2).** A *Proxy* is an exotic object with `[[ProxyTarget]]` and `[[ProxyHandler]]` slots whose essential internal methods call the matching **trap** on the handler, falling back to the target's internal method when the trap is absent.

| Internal method | Trap | Triggered by |
|---|---|---|
| `[[GetPrototypeOf]]` | `getPrototypeOf` | `Object.getPrototypeOf`, `instanceof`, `__proto__` |
| `[[SetPrototypeOf]]` | `setPrototypeOf` | `Object.setPrototypeOf` |
| `[[IsExtensible]]` | `isExtensible` | `Object.isExtensible`, `isFrozen` |
| `[[PreventExtensions]]` | `preventExtensions` | `Object.preventExtensions`, `freeze`, `seal` |
| `[[GetOwnProperty]]` | `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor`, `hasOwn`, spread |
| `[[DefineOwnProperty]]` | `defineProperty` | `Object.defineProperty`, class fields on a proxied `this` |
| `[[HasProperty]]` | `has` | `in`, `with` |
| `[[Get]]` | `get` | property reads |
| `[[Set]]` | `set` | assignments |
| `[[Delete]]` | `deleteProperty` | `delete` |
| `[[OwnPropertyKeys]]` | `ownKeys` | `Object.keys`, `Reflect.ownKeys`, `for...in`, spread |
| `[[Call]]` | `apply` | calls (only when the target is callable) |
| `[[Construct]]` | `construct` | `new` (only when the target is a constructor) |

### Invariants

Proxies may lie, but not about things the language promises are fixed. After each trap, the spec checks invariants against the target. Examples (each violation throws `TypeError`):

- `get` must report the actual value of a **non-configurable, non-writable** own data property of the target.
- `getOwnPropertyDescriptor` cannot report a property as non-configurable unless it is non-configurable on the target, and cannot hide a non-configurable target property.
- `ownKeys` must include every non-configurable own key of the target, and exactly the target's keys if the target is non-extensible.
- `has` cannot hide a non-configurable property, or any property of a non-extensible target.
- `getPrototypeOf` must return the target's prototype if the target is non-extensible.
- `set`/`defineProperty`/`deleteProperty` returning `false` makes the operation fail (`TypeError` in strict code).

These invariants are why **frozen objects cannot be meaningfully virtualised** by a proxy that wraps them directly: proxy a mutable shadow target instead.

### Reflect: the default behaviour as functions

`Reflect` (§28.1) has one function per internal method, with the same signatures as the traps. Its main job inside a handler is to **forward with the correct receiver**:

```js
const handler = {
  get(target, key, receiver) {
    track(target, key);
    return Reflect.get(target, key, receiver); // getters on target run with this === receiver (the proxy)
  },
};
```

Writing `target[key]` instead of `Reflect.get(target, key, receiver)` runs inherited getters with `this === target`, so property reads made *inside* the getter bypass the proxy and are not tracked. Other differences from the older `Object.*` functions: `Reflect.defineProperty` returns a boolean instead of throwing; `Reflect.ownKeys` returns strings and symbols; `Reflect.apply` is `Function.prototype.apply` that cannot be shadowed by an own `apply` property.

### What proxies can and cannot do

| Can | Cannot |
|---|---|
| validation, defaults, negative array indices, logging, access control | intercept `#private` field access (private names are not properties, [module 04](04-objects-prototypes-classes.md)) |
| reactivity: track reads in `get`, notify in `set` | intercept internal slots: `Map.prototype.get.call(proxyOfMap)` throws (no `[[MapData]]` on the proxy) |
| virtual objects (remote objects, lazy loading) | make `typeof proxy` differ from the target's (`'function'` only if the target is callable) |
| membranes (wrap everything crossing a boundary) | be detected reliably by user code, except through identity or brand checks (`Array.isArray` sees through proxies) |

`Proxy.revocable(target, handler)` returns `{ proxy, revoke }`; after `revoke()`, every operation on the proxy throws `TypeError`, which is the basis of capability revocation in membranes.

### Reactivity with proxies (bridge to SolidJS and Vue)

A minimal tracking store:

```js
let activeEffect = null;
const subscribers = new WeakMap();                      // target → Map<key, Set<effect>>

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (activeEffect) {
        const byKey = subscribers.get(target) ?? subscribers.set(target, new Map()).get(target);
        byKey.getOrInsertComputed(key, () => new Set()).add(activeEffect);   // ES2026 upsert
      }
      const value = Reflect.get(target, key, receiver);
      return typeof value === 'object' && value !== null ? reactive(value) : value; // deep, lazy
    },
    set(target, key, value, receiver) {
      const ok = Reflect.set(target, key, value, receiver);
      subscribers.get(target)?.get(key)?.forEach((fn) => fn());
      return ok;
    },
  });
}
function effect(fn) { activeEffect = fn; try { fn(); } finally { activeEffect = null; } }
```

Real implementations add batching (flush in a microtask, [module 06](06-agents-realms-job-queue.md)), cleanup of stale subscriptions, a cache so the same object always maps to the same proxy, and array-method instrumentation. Solid's stores and projections are proxies built on this idea; the framework-specific design is in the SolidJS track ([`../../../technologies/solidjs/`](../../../technologies/solidjs/)).

Performance: every property access through a proxy is a function call that V8 cannot inline as well as a normal property load. Proxies in hot loops are measurably slower (often 5–50×); keep raw objects for computation and proxies at the boundary.

---

## 2. Well-known symbols as hooks

The table in [module 02](02-types-values-coercion.md#5-symbol-and-the-well-known-symbols) lists them. The interesting ones for metaprogramming:

| Symbol | Hook | Example use |
|---|---|---|
| `Symbol.toPrimitive` | conversion with a hint | money objects that add as numbers and print with currency |
| `Symbol.hasInstance` | `instanceof` | structural "is a" checks; avoid in libraries (surprising) |
| `Symbol.toStringTag` | `Object.prototype.toString` | `[object MyType]` in logs |
| `Symbol.species` | which constructor derived results use (`map`, `filter`, `then`, `slice`) | subclass returning base instances; considered a design mistake, a proposal to remove most uses exists; V8 deoptimises when it is touched |
| `Symbol.isConcatSpreadable` | `Array.prototype.concat` | array-likes that concat like arrays |
| `Symbol.unscopables` | `with` | hiding newer `Array.prototype` methods from legacy `with` code |
| `Symbol.iterator` / `asyncIterator` | iteration ([module 05](05-iterators-generators.md)) | |
| `Symbol.dispose` / `asyncDispose` | `using` ([module 10](10-resource-management-temporal.md)) | |
| `Symbol.metadata` | decorator metadata (Stage 2.7, not shipped in Node 26) | |

---

## 3. Tagged templates

**Definition (§13.3.11).** A *tagged template* `` tag`a${x}b${y}c` `` calls `tag(strings, x, y)` where `strings` is a **template object**: a frozen array `['a', 'b', 'c']` with a frozen `raw` property holding the raw source text (escape sequences unprocessed).

Properties that libraries rely on:

- **Identity per call site.** `GetTemplateObject` caches the template object per *source location* (Parse Node) and realm, so the same code location always passes the same `strings` array. Libraries (lit-html, GraphQL tags, styled-components, SQL builders) use it as a `WeakMap` key to cache parsing.
- **Invalid escapes are allowed in tagged templates** (ES2018): `` tag`\unicode` `` gives `strings[0] === undefined` and `strings.raw[0] === '\\unicode'`, which lets DSLs like LaTeX use backslashes. Untagged templates with invalid escapes are still syntax errors.
- `String.raw` is the built-in tag that concatenates `raw` strings.

Security pattern: **tags separate code from data**. A SQL tag receives the literal parts and the interpolated values separately, so it can bind values as parameters instead of concatenating them:

```js
function sql(strings, ...values) {
  return { text: strings.reduce((acc, s, i) => acc + '$' + i + s), values };
}
sql`SELECT * FROM users WHERE id = ${userId}`; // { text: 'SELECT * FROM users WHERE id = $1', values: [userId] }
```

---

## 4. Weak collections and weak references

### WeakMap and WeakSet: ephemerons

**Definition (§24.3).** A *WeakMap* is a collection of key/value pairs whose keys are objects (or non-registered symbols, since ES2023) and **do not keep the key alive**. If the key is otherwise unreachable, the entry disappears and the value becomes collectible too, *even if the value references the key* (ephemeron semantics). WeakMaps are not iterable and have no `size`: making them enumerable would make garbage collection observable.

Uses: private data for objects you do not own, caches keyed by object identity (parsed templates, computed layouts, DOM node metadata), cycle detection in deep clone and deep equal, "visited" sets.

`WeakMap.prototype.getOrInsert` / `getOrInsertComputed` (ES2026 Upsert) remove the `has`/`get`/`set` dance:

```js
const cache = new WeakMap();
const layoutOf = (node) => cache.getOrInsertComputed(node, computeLayout);
```

### WeakRef and FinalizationRegistry (ES2021)

**Definition (§26.1, §26.2).** A *WeakRef* holds a target object (or non-registered symbol) without keeping it alive; `deref()` returns the target or `undefined` if it has been collected. A *FinalizationRegistry* lets you register a target with a held value; **at some point after** the target is collected, the host **may** call the cleanup callback with the held value.

The spec deliberately gives few guarantees (§9.9):

1. Within one synchronous job, a target observed via `deref()` or passed to `new WeakRef` is kept alive until the end of that job (`AddToKeptObjects`; `ClearKeptObjects` runs at the microtask checkpoint in HTML). So `ref.deref()` returns the same answer twice in a row.
2. Collection timing is unspecified. Engines may never collect a target (for example, short-lived programs, or a generational GC that has not run).
3. Cleanup callbacks may run late, in batches, or **never** (for example, when the process exits or the page is closed).

The proposal's own README says: *"avoid them if you can"*. Legitimate uses: caches of large, re-creatable objects (`WeakRef` values in a `Map`, with a FinalizationRegistry removing stale keys), and as a **safety net** that logs leaked resources ("this file handle was never closed"). **Never** rely on finalization for correctness: closing files, releasing locks, flushing data. Use explicit disposal (`using`, `try/finally`, [module 10](10-resource-management-temporal.md)).

---

## 5. Decorators (Stage 2.7, runtime semantics)

> **Status check (2026-10-28):** the Decorators proposal was at Stage 3 from March 2022 and **was moved back to Stage 2.7 at the May 2026 TC39 meeting**; Decorator Metadata is also at 2.7. No JavaScript engine ships decorators unflagged; V8 14.6's `--js-decorators` parses only the `accessor` keyword. TypeScript (since 5.0) and Babel/esbuild implement the 2023 version of the proposal by transpilation. Everything below may still change; the example file verifies it against esbuild 0.28's implementation, not against an engine.

**Definition.** A *decorator* is an expression (`@expr`) applied to a class or class element at **class definition time**. It is called as `decorator(value, context)` and may return a replacement.

| Decorated | `value` received | May return | `context.kind` |
|---|---|---|---|
| class | the class | a replacement class | `'class'` |
| method | the method function | a replacement function | `'method'` |
| getter / setter | the getter / setter | a replacement | `'getter'` / `'setter'` |
| field | `undefined` | an **initializer** `(initialValue) => newValue`, run per instance | `'field'` |
| auto-accessor (`accessor x = 1`) | `{ get, set }` of the hidden storage | `{ get?, set?, init? }` | `'accessor'` |

`context` has `name`, `static`, `private`, `access` (`{ get, set, has }` functions that read the element on a given object, which also works for `#private` elements), `addInitializer(fn)` (runs during construction for instance elements, at class definition for static elements and classes), and `metadata` (a per-class object, exposed on the class as `C[Symbol.metadata]`, inherited prototypically from the parent's metadata).

Evaluation order, as implemented by esbuild 0.28 and checked in the example: decorator *expressions* are evaluated in document order; then element decorators are **applied** to non-field elements (methods, getters/setters, auto-accessors; static elements first) before fields; class decorators are applied last; class `addInitializer` callbacks run after the class is fully defined.

Key semantic differences from TypeScript's **legacy** `experimentalDecorators` (owned by the TypeScript track):

| Legacy (`experimentalDecorators: true`) | TC39 (2023 proposal) |
|---|---|
| receive `(target, key, descriptor)`, can mutate the prototype directly | receive `(value, context)`, return replacements; no direct prototype access |
| field decorators get no value and cannot change initialisation | field decorators return initialisers |
| parameter decorators | **none** (Angular/NestJS DI relies on them, a reason those frameworks still use legacy mode) |
| `emitDecoratorMetadata` (reflect-metadata) | `context.metadata` + `Symbol.metadata` |
| evaluated at definition with descriptor-based semantics | different ordering and `accessor` keyword |

The two are **incompatible**; a decorator library targets one or the other.

### Then vs now

| Then | Now |
|---|---|
| `Object.defineProperty`-based method wrapping after the class definition | decorators (transpiled), or keep explicit wrapping until engines ship them |
| `Object.observe` (proposed for ES2016, withdrawn in 2015) | Proxy (ES2015) |
| `__defineGetter__`, `__lookupGetter__` (Annex B) | `Object.defineProperty`, `Object.getOwnPropertyDescriptor` |
| Hidden properties via underscores or `Symbol` keys | `WeakMap` or `#private` |
| "Finalizers" emulated with timers or manual reference counts | `FinalizationRegistry` only as a safety net; explicit disposal for correctness |

---

## 6. Production failure modes

| Failure | Mechanism | Defence |
|---|---|---|
| `TypeError: 'get' on proxy: property 'x' is a read-only and non-configurable data property...` | proxy trap violates an invariant of a frozen target | proxy a mutable shadow target |
| `TypeError: Method Map.prototype.get called on incompatible receiver` | proxying an object with internal slots (`Map`, `Date`, `Promise`, DOM nodes) | forward methods with `target` as `this`, or wrap the API instead |
| Reactive store misses updates inside getters | `target[key]` instead of `Reflect.get(target, key, receiver)` | always forward the receiver |
| Hot path 10× slower after "just adding a proxy" | trap calls defeat inline caches | unwrap for computation ([module 12](12-engine-internals-v8.md)) |
| Files left open, locks never released | relying on `FinalizationRegistry` callbacks | explicit disposal (`using`) |
| Cache never shrinks | `Map` keyed by objects keeps them alive | `WeakMap` |
| Decorator library breaks on a TypeScript upgrade or config change | legacy vs TC39 decorators are incompatible; proposal still at Stage 2.7 | pin the mode; isolate decorator usage; avoid them in libraries meant to be long-lived |
| SQL injection through template strings | untagged template concatenation | tagged templates that bind parameters |

---

## Interview Drill

<details><summary>1. What are Proxy invariants and why do they exist?</summary>

Constraints the spec checks after each trap so that a proxy cannot contradict facts the language guarantees about its target: non-configurable properties, non-extensibility, and the prototype of non-extensible objects. Without them, `Object.freeze` and similar guarantees could be faked, breaking security and optimisation assumptions. A violation throws TypeError.
</details>

<details><summary>2. Why use `Reflect.get(target, key, receiver)` instead of `target[key]` in a get trap?</summary>

So that getters on the target or its prototype chain run with `this` set to the receiver (the proxy, or an object inheriting from it). Otherwise the getter's own property reads bypass the proxy and are invisible to tracking or validation.
</details>

<details><summary>3. Implement a minimal reactive store with Proxy.</summary>

See §1: a `get` trap records `(target, key) → activeEffect` in a WeakMap of Maps of Sets, and returns nested objects wrapped lazily; a `set` trap writes with `Reflect.set` and runs the subscribers for that key. Production versions batch notifications in a microtask, cache proxies per target, and clean up subscriptions.
</details>

<details><summary>4. Why are WeakMaps not iterable?</summary>

Iteration (or `size`) would reveal which keys the garbage collector has already removed, making GC timing observable and programs non-deterministic across engines and runs. Without iteration, a WeakMap's behaviour is indistinguishable from a Map whose entries for unreachable keys can never be looked up anyway.
</details>

<details><summary>5. When would you use WeakRef and FinalizationRegistry, and when must you not?</summary>

For caches of expensive but re-creatable objects, and as a leak detector. Never for correctness-critical cleanup (closing files, releasing locks, flushing writes): collection and cleanup callbacks may happen late or never. Use explicit disposal.
</details>

<details><summary>6. What does a tag function receive, and why do template objects have stable identity?</summary>

A frozen array of cooked strings with a frozen `raw` array, followed by the substitution values. The array is cached per call site, so libraries can use it as a cache key for parsed templates (lit-html, GraphQL) without re-parsing on every call.
</details>

<details><summary>7. What is the status of decorators, and how do TC39 decorators differ from TypeScript's legacy ones?</summary>

Stage 2.7 since the May 2026 meeting (previously Stage 3); not shipped in any engine. TC39 decorators receive `(value, context)` and return replacements or initialisers, support `accessor`, `addInitializer` and metadata, and have no parameter decorators. Legacy decorators receive `(target, key, descriptor)` and mutate prototypes. The two are incompatible.
</details>

<details><summary>8. Why can't a Proxy around a `Map` call `get`?</summary>

`Map.prototype.get` checks that `this` has a `[[MapData]]` internal slot. The proxy object has none (slots are not forwarded), so it throws. Wrap the methods: in the `get` trap, return `value.bind(target)` for functions, or expose a façade object instead.
</details>
