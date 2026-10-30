# 13 · Correctness and Security Pitfalls, and the Version History

> **Spec anchors (ECMA-262 17th edition):** §25.5.2 `JSON.parse` (reviver `context.source`, ES2026), §25.5.3 `JSON.rawJSON` (ES2026), §23.1.3.30 `Array.prototype.sort` (§23.1.3.30.1 SortIndexedProperties, §23.1.3.30.2 CompareArrayElements), §23.1.3.34 `toSorted`, §22.2 *RegExp Objects* (§22.2.2 pattern semantics), `RegExp.escape` (ES2025), §21.4.1.32 *Date Time String Format*, §21.4.3.2 `Date.parse`, Annex B.2.2.1 `__proto__`. OWASP: *Prototype Pollution Prevention Cheat Sheet*, *Regular expression Denial of Service (ReDoS)*. Node-specific hardening flags and the permission model belong to the Node.js track ([`../../../technologies/nodejs/`](../../../technologies/nodejs/)); cross-cutting security theory belongs to the security-identity track ([`../../../architecture/security-identity/`](../../../architecture/security-identity/)).
>
> **Executable proof:** [`examples/13-correctness-security-pitfalls.test.js`](../examples/13-correctness-security-pitfalls.test.js)

This final module collects the language-level bugs that reach production most often, explains each with the mechanism taught in the earlier modules, and gives a tested defence. It ends with the version history table required by this repository's version-currency rules.

---

## 1. Prototype pollution

**Definition.** *Prototype pollution* is a vulnerability in which attacker-controlled property keys cause a write to a shared prototype (usually `Object.prototype`), changing the behaviour of every object in the realm.

Mechanism ([module 04](04-objects-prototypes-classes.md)): `JSON.parse` creates an **own** property named `"__proto__"` (it uses `CreateDataProperty`, not the Annex B setter). A naive recursive merge then reads `source.__proto__` and does `target['__proto__'][key] = value`, which goes through the `__proto__` **accessor** on `Object.prototype` and returns `Object.prototype` itself:

```js
function naiveMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] ??= {};
      naiveMerge(target[key], source[key]);   // target['__proto__'] is Object.prototype!
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
naiveMerge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
({}).isAdmin; // true: every object in the realm is now "admin"
```

Other gadgets: `constructor.prototype` paths (`{"constructor": {"prototype": {...}}}`), query-string parsers that build nested objects from `a[__proto__][x]=1`, and path-based setters (`set(obj, 'a.__proto__.x', v)`). Consequences range from logic bypass (`if (user.isAdmin)`) to remote code execution when a polluted property reaches a template engine, `child_process` options (`shell`, `env`), or a module loader.

Defences, strongest first:

1. **Do not merge untrusted data into objects.** Validate with a schema (Zod and Standard Schema, see the TypeScript track) that produces fresh objects with known keys.
2. Use `Map` for dynamic keys, or **null-prototype objects** (`Object.create(null)`) as merge targets: there is no `__proto__` accessor to hit.
3. Skip dangerous keys in any recursive copy: `__proto__`, `constructor`, `prototype`.
4. Check `Object.hasOwn(source, key)` and iterate with `Object.keys` (own enumerable), never `for...in` without a check.
5. Defence in depth: `Object.freeze(Object.prototype)` at startup (breaks libraries that extend built-ins, and triggers the override mistake, [module 04](04-objects-prototypes-classes.md)); Node's `--disable-proto=delete|throw` removes the accessor.

`structuredClone(JSON.parse(input))` does **not** sanitise: the own `__proto__` data property is cloned as an own data property, harmless by itself, but the next naive merge is still vulnerable.

---

## 2. Regular-expression denial of service (ReDoS)

**Definition.** *ReDoS* is a denial of service in which a crafted input makes a backtracking regular-expression engine take time exponential (or high-degree polynomial) in the input length.

V8's default engine (Irregexp) is a **backtracking** engine, as ECMAScript semantics require for backreferences and lookaround. Patterns with **nested or overlapping quantifiers** can explore exponentially many ways to match before failing:

```js
/(a+)+$/.test('a'.repeat(40) + '!');   // ~2^40 paths: effectively never finishes
/^(\w+\s?)*$/.test(longSentence + '!'); // classic in validation code
/^(a|aa)+$/                             // overlapping alternatives
```

The regex runs on the main thread: one request pins a CPU core, and in Node the whole event loop stops ([module 06](06-agents-realms-job-queue.md)).

Defences:

| Defence | Notes |
|---|---|
| Rewrite without ambiguity | `/(a+)+$/` → `/a+$/`; make alternatives mutually exclusive; prefer possessive-style structure through lookahead + backreference tricks only if you understand them |
| Bound input length before matching | cheap and effective for user input |
| Linear-time engine | V8 has an **experimental** non-backtracking engine: `node --enable-experimental-regexp-engine` and the `l` flag (`/(a+)+$/l`) run in linear time but reject backreferences and lookarounds. Not production-ready; the RE2 library (`re2` npm package) is the production option |
| Lint | `eslint-plugin-regexp` (`no-super-linear-backtracking`), `safe-regex` checks in CI |
| Escape user text inserted into patterns | `RegExp.escape(userText)` (ES2025). Before it, hand-written escapers often missed characters |

Related regex correctness traps:

- **`lastIndex` statefulness**: a regex with `g` or `y` is stateful. `re.test(s)` advances `re.lastIndex`, so calling it repeatedly on the same string alternates `true`, `false`, `true`. Shared module-level `/.../g` regexes used with `test` are a classic intermittent bug.
- **The `v` flag** (ES2024) supersedes `u`: set operations (`[\p{L}--[a-z]]`, `&&`), string properties (`\p{RGI_Emoji}` matches a whole multi-code-point emoji), and stricter escaping rules in classes.
- **Unicode**: without `u`/`v`, `.` matches one UTF-16 code unit, so it matches half of an astral character ([module 02](02-types-values-coercion.md)).

---

## 3. JSON and numbers

`JSON.parse` turns every number into a Number (IEEE binary64): integers above 2⁵³ − 1 silently lose precision. Twitter/X and Discord IDs (Snowflake, 64-bit), database `BIGINT` keys, and financial amounts in minor units hit this.

```js
JSON.parse('{"id":12345678901234567890}').id;   // 12345678901234567000
```

### Then vs now: lossless JSON

| Then | Now (ES2026, Node 26) |
|---|---|
| Ask the API for IDs as strings (`id_str`), or use a third-party parser (`json-bigint`) | Reviver receives the **source text**: `JSON.parse(text, (key, value, { source }) => ...)` |
| `JSON.stringify` cannot emit an unquoted big integer; `BigInt` throws `TypeError` | `JSON.rawJSON('12345678901234567890')` inserts raw JSON text, validated to be a primitive JSON value |

```js
const data = JSON.parse(text, (key, value, ctx) =>
  key === 'id' && typeof value === 'number' ? BigInt(ctx.source) : value);

JSON.stringify({ id: JSON.rawJSON(data.id.toString()) }); // '{"id":12345678901234567890}'
```

`context.source` is provided only for primitive values (not objects or arrays), and only reflects the original text while the reviver has not replaced the value. `JSON.rawJSON` throws `SyntaxError` for objects, arrays, or text with leading/trailing whitespace.

Other JSON traps: `NaN`/`Infinity` serialise as `null`; `undefined`, functions and Symbols are dropped from objects and become `null` in arrays; `Date` becomes a string and is not revived; `toJSON` methods run; duplicate keys keep the last value; `JSON.parse` of untrusted input is safe from code execution but not from pollution (§1) or huge payloads (limit request bodies).

---

## 4. Floating-point money

Covered in [module 02](02-types-values-coercion.md): binary64 cannot represent most decimal fractions. Store integer minor units (`Number` while below 2⁵³, `BigInt` beyond), round only at defined points with an explicit rounding mode, format with `Intl.NumberFormat(locale, { style: 'currency', currency })`, and sum with `Math.sumPrecise` where shipped (behind a flag in Node 26). `Number.prototype.toFixed` rounds the binary value (`(1.005).toFixed(2)` is `'1.00'`, because 1.005 is stored as 1.00499999999999989...).

---

## 5. Dates

Covered in [module 10](10-resource-management-temporal.md). The parsing traps worth repeating:

| Input | Result | Why |
|---|---|---|
| `new Date('2026-03-29')` | UTC midnight | date-only ISO forms are UTC |
| `new Date('2026-03-29T00:00')` | local midnight | date-time without offset is local |
| `new Date('2026-02-30')` | **2 March 2026** in V8 (not `Invalid Date`) | an out-of-range ISO string is not valid in the Date Time String Format (§21.4.1.32), so V8 falls back to its legacy, implementation-specific parser, which rolls over |
| `Date.parse('2026/03/29')` | local midnight in V8; implementation-defined | non-ISO formats are not specified |

Validate date input with Temporal (`Temporal.PlainDate.from('2026-02-30', { overflow: 'reject' })` throws) or a strict regex before constructing a `Date`.

---

## 6. Sorting

- **Default comparator** converts elements to strings: `[10, 1, 2].sort()` is `[1, 10, 2]`. Always pass `(a, b) => a - b` for numbers (or `Intl.Collator` for human-readable text).
- **Comparator contract** (§23.1.3.30): the comparator must be a *consistent comparator*: it must return a negative, zero or positive Number, consistently, and define a total preorder (antisymmetric, transitive). If it does not, **the sort order is implementation-defined**, which in practice means "wrong in some cases, differently per engine":
  - `(a, b) => a > b` returns a Boolean; `true`→1 and `false`→0 never say "less than". On V8 14.6, `[3, 1, 2].sort((a, b) => a > b)` returns `[3, 1, 2]` unchanged.
  - `() => Math.random() - 0.5` is not a shuffle: inconsistent results produce a biased permutation. Use Fisher–Yates.
  - `(a, b) => a.date - b.date` with some `undefined` dates returns `NaN`, which is treated as 0 and breaks transitivity.
- **Stability** is guaranteed since ES2019: elements comparing equal keep their original order. Before, V8 used an unstable quicksort for arrays longer than 10.
- `sort` mutates and returns the same array; `toSorted` (ES2023) returns a copy. Sorting a prop or state array in place in React or Solid is a classic bug.
- Holes and `undefined` are always sorted to the end, without calling the comparator.

---

## 7. A quick reference of other language-level traps

| Trap | Module |
|---|---|
| `==` coercion, `typeof null`, NaN | [02](02-types-values-coercion.md) |
| `this` lost in callbacks | [03](03-execution-contexts-scope-closures.md) |
| closure retaining large objects | [03](03-execution-contexts-scope-closures.md) |
| `for...in` over arrays, inherited keys | [04](04-objects-prototypes-classes.md) |
| `instanceof` across realms | [06](06-agents-realms-job-queue.md) |
| floating promises, unhandled rejections | [06](06-agents-realms-job-queue.md), [07](07-async-in-depth.md) |
| `Promise.all` with 10,000 items | [07](07-async-in-depth.md) |
| circular imports and TDZ | [08](08-modules.md) |
| finalizers for cleanup | [09](09-metaprogramming.md), [10](10-resource-management-temporal.md) |
| data races on shared memory | [11](11-binary-data-memory-model.md) |
| megamorphic hot paths, `delete` | [12](12-engine-internals-v8.md) |

---

## 8. Version history (ES2015 → ES2027)

The major features practitioners meet, by edition. Each edition is the year's ECMA-262 publication; ES2027 lists features already at Stage 4 in the living draft as of 2026-10-28.

| Edition | Highlights | Taught in |
|---|---|---|
| **ES2015** (6th) | `let`/`const`, arrow functions, classes, modules, promises, iterators and generators, `Symbol`, `Map`/`Set`/`WeakMap`/`WeakSet`, `Proxy`/`Reflect`, template literals, destructuring, default/rest/spread parameters, typed arrays standardised, `Object.is` | 03, 04, 05, 07, 08, 09 |
| ES2016 | `Array.prototype.includes`, `**` | 02 |
| ES2017 | `async`/`await`, `Object.values`/`entries`, `padStart`/`padEnd`, `Object.getOwnPropertyDescriptors`, `SharedArrayBuffer`, `Atomics` | 07, 11 |
| ES2018 | async iteration (`for await`, async generators), object rest/spread, `Promise.prototype.finally`, RegExp named groups, lookbehind, `s` flag, Unicode property escapes, template literal revision (invalid escapes in tagged templates) | 05, 07, 09 |
| ES2019 | `flat`/`flatMap`, `Object.fromEntries`, `trimStart`/`trimEnd`, optional `catch` binding, `Symbol.prototype.description`, **stable `sort`**, well-formed `JSON.stringify` | 13 |
| ES2020 | `BigInt`, `Promise.allSettled`, `globalThis`, optional chaining `?.`, nullish coalescing `??`, dynamic `import()`, `import.meta`, `matchAll`, specified `for...in` order | 02, 07, 08 |
| ES2021 | `Promise.any`/`AggregateError`, `replaceAll`, logical assignment (`&&=`, `\|\|=`, `??=`), numeric separators, `WeakRef`/`FinalizationRegistry` | 07, 09 |
| ES2022 | class fields, private methods/accessors, static blocks, `#x in obj`, top-level `await`, `.at()`, `Object.hasOwn`, `Error` `cause`, RegExp `d` flag | 04, 07, 08 |
| ES2023 | `findLast`/`findLastIndex`, change-array-by-copy (`toSorted`, `toReversed`, `toSpliced`, `with`), hashbang grammar, Symbols as WeakMap keys | 09, 13 |
| ES2024 | `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, resizable `ArrayBuffer` and `transfer`, growable `SharedArrayBuffer`, `Atomics.waitAsync`, RegExp `v` flag, `isWellFormed`/`toWellFormed` | 02, 07, 11, 13 |
| ES2025 | iterator helpers, `Set` methods (`union`, `intersection`, ...), JSON modules and import attributes, `RegExp.escape`, RegExp modifiers, duplicate named groups, `Promise.try`, `Float16Array`/`Math.f16round` | 05, 07, 08, 11, 13 |
| **ES2026** (17th) | Upsert (`getOrInsert`, `getOrInsertComputed`), JSON.parse source text access (`context.source`, `JSON.rawJSON`), `Iterator.concat`, `Uint8Array` base64/hex, `Math.sumPrecise`, `Error.isError`, `Array.fromAsync` | 02, 05, 06, 09, 11, 13 |
| ES2027 (draft) | Temporal, explicit resource management (`using`, `DisposableStack`), `Atomics.pause`, `Iterator.zip`, iterator chunking, `includes`, `join` | 10, 11, 05 |

Proposals at Stage 3 or below (decorators at 2.7, `import defer`, AsyncContext, Signals) are not standard; [module 01](01-reading-the-spec.md) has the snapshot.

---

## 9. Production failure modes (summary)

| Failure | Mechanism | Defence (tested) |
|---|---|---|
| Every user becomes admin after one request | prototype pollution via recursive merge of parsed JSON | schema validation, null-prototype targets, key filtering |
| Service hangs on one input | catastrophic backtracking | rewrite pattern, bound input, linear engine/RE2 |
| Regex check passes and fails alternately | `lastIndex` on a shared `g` regex | no `g` with `test`; create regexes per call or reset `lastIndex` |
| IDs corrupted after a round-trip | JSON numbers > 2⁵³ | `context.source` + BigInt, `JSON.rawJSON` |
| "Invalid date" accepted as a valid date | V8 fallback parser rolls 30 Feb over | strict validation (Temporal with `overflow: 'reject'`) |
| Numbers sorted 1, 10, 2 | default string comparator | numeric comparator |
| Sort "works" in tests, not in production | inconsistent comparator (boolean, random, NaN) | return numbers; total preorder; Fisher–Yates for shuffles |
| UI shows mutated props | in-place `sort` | `toSorted` |

---

## Interview Drill

<details><summary>1. How does prototype pollution happen through `JSON.parse`, and how do you prevent it?</summary>

`JSON.parse` creates an own `"__proto__"` property; a recursive merge then evaluates `target["__proto__"]`, which hits the `Object.prototype.__proto__` accessor and returns `Object.prototype`, and writes attacker keys into it. Prevent it by validating input with a schema, merging into `Object.create(null)` or using `Map`, skipping `__proto__`/`constructor`/`prototype` keys, and optionally freezing `Object.prototype` or disabling `__proto__`.
</details>

<details><summary>2. Why is `/(a+)+$/` dangerous and how do you fix it?</summary>

On a non-matching input like `"aaaa…!"`, the backtracking engine tries every way to split the `a`s between the inner and outer quantifiers: exponential time. It is equivalent to `/a+$/`, which is linear. General fixes: remove nested/overlapping quantifiers, bound input length, or use a linear-time engine (RE2, V8's experimental `l` flag).
</details>

<details><summary>3. Why does `re.test('a')` alternate between true and false?</summary>

With the `g` (or `y`) flag, `test` starts at `re.lastIndex` and updates it after a match; the next call starts after the match, fails, and resets `lastIndex` to 0.
</details>

<details><summary>4. How do you parse and re-serialise a JSON payload with 64-bit integer IDs without losing precision?</summary>

Parse with a reviver that converts based on the source text: `(k, v, { source }) => typeof v === 'number' && !Number.isSafeInteger(v) ? BigInt(source) : v`. Serialise BigInts with `JSON.rawJSON(big.toString())` in a replacer. Both are ES2026 and available in Node 26.
</details>

<details><summary>5. What is wrong with `arr.sort((a, b) => a > b)`?</summary>

The comparator returns a Boolean, which converts to 1 or 0, never negative, so it is not a consistent comparator; the resulting order is implementation-defined and in V8 small arrays come back unsorted. Return `a - b` (numbers) or `a < b ? -1 : a > b ? 1 : 0`.
</details>

<details><summary>6. Is `Array.prototype.sort` stable? Since when?</summary>

Yes, required since ES2019. V8 switched to TimSort in 2018 (V8 7.0); before, arrays longer than 10 elements used an unstable quicksort.
</details>

<details><summary>7. Name five features of ES2026 and two of ES2027.</summary>

ES2026: `Map.prototype.getOrInsert`/`getOrInsertComputed`, `JSON.rawJSON` and reviver `context.source`, `Iterator.concat`, `Uint8Array.fromBase64`/`toHex`, `Math.sumPrecise`, `Error.isError`, `Array.fromAsync`. ES2027: Temporal, `using`/`DisposableStack`, `Atomics.pause`, `Iterator.zip`.
</details>

<details><summary>8. Why might `new Date(userInput)` accept "2026-02-30"?</summary>

The string is not a valid instance of the ECMAScript Date Time String Format (day out of range), so engines may use implementation-specific heuristics; V8's legacy parser accepts it and rolls over to 2 March. Validate with Temporal (`overflow: 'reject'`) or a strict parser.
</details>
