# Senior JavaScript Interview: Question Bank (`interview`)

Original questions for the senior JavaScript technical interview format described in [README.md](README.md). Everything is based on ECMA-262, the HTML Standard and this track's modules; nothing reproduces any real exam or interview content.

- **Question types:** `single` (one answer), `multi` (select all that apply), `scenario` (production situation), `ordering` (put steps or outputs in order), `hands-on` (live-coding task with a verification script).
- **Difficulty:** 1 = solid mid-level, 2 = senior, 3 = harder than typical interviews (spec-level or engine-level detail).
- **Answers** are collapsed. Each lists why the distractors are wrong and references the teaching module and an official page (MDN or the specification).
- Unless stated otherwise, code runs as an ES module (strict mode) in Node 26.

## Domains

The interview format has no official weights. These weights reflect how often each area appears in senior frontend/full-stack JavaScript loops, as described in [README.md](README.md#domains-and-weights).

| # | Domain | Weight | Questions |
|---|---|---|---|
| D1 | Types, values and coercion | 8% | 6 |
| D2 | Scope, closures and `this` | 12% | 8 |
| D3 | Objects, prototypes and classes | 12% | 8 |
| D4 | Iterators and generators | 8% | 5 |
| D5 | Event loop and job queue | 14% | 9 |
| D6 | Async patterns | 14% | 9 |
| D7 | Modules | 8% | 5 |
| D8 | Metaprogramming, memory and binary data | 8% | 6 |
| D9 | Modern ECMAScript (ES2024–ES2027) | 6% | 5 |
| D10 | Performance and security | 10% | 6 |
| H | Hands-on coding tasks (span D2, D5, D6) | — | 6 |
| | **Total** | 100% | **73** |

---

## D1 · Types, values and coercion

### Q-JSI-001 · Types and coercion · difficulty 1 · single
What does `typeof null` evaluate to?
- A) `"null"`
- B) `"object"`
- C) `"undefined"`
- D) It throws a `TypeError`

<details><summary>Answer</summary>

**B.** `typeof` is a table lookup on the language type; Null maps to `"object"`, a historic bug kept for web compatibility.
- Why not A: a proposal to return `"null"` was rejected because it broke existing code.
- Why not C: only Undefined (and `document.all`) report `"undefined"`.
- Why not D: `typeof` never throws for `null`; it throws only for bindings in their TDZ.
- Ref: [modules/02-types-values-coercion.md](../modules/02-types-values-coercion.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
</details>

### Q-JSI-002 · Types and coercion · difficulty 2 · multi
Which expressions evaluate to `true`? (Select all that apply.)
- A) `[NaN].includes(NaN)`
- B) `[NaN].indexOf(NaN) !== -1`
- C) `Object.is(0, -0)`
- D) `new Set([0, -0]).size === 1`
- E) `null == 0`

<details><summary>Answer</summary>

**A, D.** `includes` and `Set` use SameValueZero, which treats NaN as equal to NaN and +0 as equal to −0.
- Why not B: `indexOf` uses IsStrictlyEqual, where `NaN !== NaN`, so it returns −1.
- Why not C: `Object.is` is SameValue, which distinguishes +0 and −0.
- Why not E: under `==`, `null` is loosely equal only to `undefined` (and itself).
- Ref: [modules/02-types-values-coercion.md](../modules/02-types-values-coercion.md) §7, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness
</details>

### Q-JSI-003 · Types and coercion · difficulty 2 · ordering
An object defines `valueOf() { log('v'); return {}; }` and `toString() { log('s'); return '7'; }`, and no `Symbol.toPrimitive`. Put the log entries of `obj * 2` in order, and give the result.
- A) `v`, `s`, result `14`
- B) `s`, result `14`
- C) `s`, `v`, result `NaN`
- D) `v`, result `NaN`

<details><summary>Answer</summary>

**A.** `*` calls ToNumeric → ToPrimitive with hint "number" → OrdinaryToPrimitive tries `valueOf` first; it returns an object (not primitive), so `toString` is tried and returns `"7"`, and ToNumber("7") × 2 = 14.
- Why not B: with hint "number", `valueOf` is tried first; only hint "string" starts with `toString`.
- Why not C: the order is reversed, and `"7"` converts to 7, not NaN.
- Why not D: a non-primitive `valueOf` result is ignored, not converted.
- Ref: [modules/02-types-values-coercion.md](../modules/02-types-values-coercion.md) §6.1, https://tc39.es/ecma262/#sec-toprimitive
</details>

### Q-JSI-004 · Types and coercion · difficulty 2 · scenario
An API returns `{"orderId": 9007199254740993}`. After `JSON.parse`, the service looks the order up and fails to find it. What is the root cause and the best fix on Node 26?
- A) `JSON.parse` truncates numbers to 32 bits; parse with `parseInt`.
- B) The integer exceeds 2⁵³ − 1 and is rounded to the nearest double (9007199254740992); use a reviver that reads `context.source` and returns `BigInt(context.source)`.
- C) `JSON.parse` rejects large integers; wrap the call in `try/catch`.
- D) The ID needs `Number.parseFloat` to keep its precision.

<details><summary>Answer</summary>

**B.** Numbers are IEEE binary64; above `Number.MAX_SAFE_INTEGER` not every integer is representable. ES2026 gives revivers the source text, so `BigInt(ctx.source)` is exact.
- Why not A: there is no 32-bit truncation; the issue is 53-bit significand precision.
- Why not C: no error is thrown; the precision loss is silent.
- Why not D: `parseFloat` produces the same binary64 value.
- Ref: [modules/13-correctness-security-pitfalls.md](../modules/13-correctness-security-pitfalls.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
</details>

### Q-JSI-005 · Types and coercion · difficulty 1 · single
What does `1 + 2 + '3'` evaluate to?
- A) `'123'`
- B) `6`
- C) `'33'`
- D) `'15'`

<details><summary>Answer</summary>

**C.** `+` is left-associative: `1 + 2` is 3 (both numbers), then `3 + '3'` concatenates because one operand is a String.
- Why not A: that is `'1' + 2 + 3`.
- Why not B: once a String is involved, `+` concatenates.
- Why not D: no operator produces this result.
- Ref: [modules/02-types-values-coercion.md](../modules/02-types-values-coercion.md) §8, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition
</details>

### Q-JSI-006 · Types and coercion · difficulty 3 · multi
Which statements about BigInt are true? (Select all that apply.)
- A) `1n + 1` throws `TypeError`.
- B) `1n < 2` evaluates to `true`.
- C) `+1n` evaluates to `1`.
- D) `-7n / 2n` evaluates to `-3n`.
- E) `JSON.stringify({ n: 1n })` evaluates to `'{"n":"1"}'`.

<details><summary>Answer</summary>

**A, B, D.** Arithmetic does not mix BigInt and Number; comparisons are exact across types; BigInt division truncates toward zero.
- Why not C: unary `+` on a BigInt throws `TypeError` (asm.js relies on `+x` always producing a Number).
- Why not E: `JSON.stringify` throws `TypeError` on BigInt unless a `toJSON` or replacer handles it.
- Ref: [modules/02-types-values-coercion.md](../modules/02-types-values-coercion.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
</details>

---

## D2 · Scope, closures and `this`

### Q-JSI-007 · Scope and closures · difficulty 1 · single
What does this print?
```js
const fs = [];
for (var i = 0; i < 3; i++) fs.push(() => i);
console.log(fs.map((f) => f()).join(','));
```
- A) `0,1,2`
- B) `3,3,3`
- C) `undefined,undefined,undefined`
- D) `2,2,2`

<details><summary>Answer</summary>

**B.** `var i` is one binding in the function (or module) scope; every arrow reads it after the loop ends at 3.
- Why not A: that is the result with `let i`, which creates a fresh binding per iteration.
- Why not C: the closures capture the binding, which holds 3, not undefined.
- Why not D: the loop increments `i` to 3 before the condition fails.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closure
</details>

### Q-JSI-008 · Scope and closures · difficulty 2 · single
Which line throws?
```js
function readLater() { return value; }   // line 1
console.log(typeof undeclaredName);      // line 2
console.log(readLater.name);             // line 3
let value = 1;                           // line 4
console.log(readLater());                // line 5
```
- A) Line 1
- B) Line 2
- C) Line 5
- D) None

<details><summary>Answer</summary>

**D.** The TDZ is temporal: `readLater` reads `value` only when called at line 5, after line 4 initialised it. `typeof` on an unresolvable reference returns `"undefined"` without throwing.
- Why not A: declaring a function that mentions a later `let` is fine.
- Why not B: `typeof` special-cases unresolvable references.
- Why not C: by line 5, `value` is initialised.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz
</details>

### Q-JSI-009 · `this` · difficulty 2 · single
In an ES module:
```js
const obj = { name: 'o', who() { return this?.name; } };
const results = [obj.who(), (obj.who)(), (0, obj.who)()];
```
What is `results`?
- A) `['o', 'o', 'o']`
- B) `['o', undefined, undefined]`
- C) `['o', 'o', undefined]`
- D) `['o', 'o', '']`

<details><summary>Answer</summary>

**C.** Parentheses around a member expression keep the Reference Record, so `this` is `obj`. The comma operator calls GetValue and yields a plain function value; a plain call in strict (module) code passes `this = undefined`.
- Why not A: the comma form loses the base object.
- Why not B: `(obj.who)()` still has a Reference with base `obj`.
- Why not D: `undefined?.name` is `undefined`, not an empty string.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this
</details>

### Q-JSI-010 · `this` · difficulty 2 · multi
Which statements about `fn.bind(a)` are true? (Select all that apply.)
- A) `fn.bind(a).bind(b)()` calls `fn` with `this === a`.
- B) `new (fn.bind(a))()` calls `fn` with `this === a`.
- C) The bound function's `name` is `"bound fn"`.
- D) Arrow functions ignore `bind` for `this`.
- E) The bound function has its own `prototype` property.

<details><summary>Answer</summary>

**A, C, D.** The first bind fixes `[[BoundThis]]`; later binds only append arguments. Bound functions are named `"bound " + name`. Arrows have lexical `this`.
- Why not B: `new` on a bound function ignores `[[BoundThis]]` and constructs the target with a fresh object.
- Why not E: bound function exotic objects have no `prototype` property; `instanceof` delegates to the target.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
</details>

### Q-JSI-011 · Scope and closures · difficulty 3 · scenario
A Node service's memory grows per request. A heap snapshot shows large `Buffer`s retained through a `context` of a small `() => 'ok'` callback stored in a long-lived cache. The callback never mentions the buffer. What is the most likely mechanism?
- A) A bug in V8's garbage collector.
- B) Another closure created in the same scope references the buffer, so V8 put it in the scope's shared Context object, which the cached callback also retains.
- C) Arrow functions always capture every variable in scope.
- D) `Buffer`s are never garbage-collected.

<details><summary>Answer</summary>

**B.** V8 allocates captured variables in one Context per scope, shared by all closures created there. Retaining any of those closures retains the whole Context.
- Why not A: this is documented, deliberate behaviour of the allocation strategy.
- Why not C: V8 only context-allocates variables referenced by some inner function; the arrow alone would not capture an unused variable.
- Why not D: buffers are collected when unreachable.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closure#performance_considerations
</details>

### Q-JSI-012 · `this` · difficulty 1 · scenario
A class component passes `onClick={this.handleClick}`, and the handler throws `Cannot read properties of undefined (reading 'setState')`. Which fix is correct?
- A) Add `"use strict"` to the file.
- B) Declare the handler as a class field arrow function: `handleClick = () => { ... }`.
- C) Rename the method to `onClick`.
- D) Call `super()` in the handler.

<details><summary>Answer</summary>

**B.** The method is extracted from its object and later called as a plain function; class bodies are strict, so `this` is `undefined`. A class field arrow captures the instance's `this` at construction.
- Why not A: class code is already strict; that is why `this` is `undefined` rather than the global object.
- Why not C: the name does not affect `this` binding.
- Why not D: `super()` is only valid in derived constructors.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields
</details>

### Q-JSI-013 · Scope and closures · difficulty 3 · single
In a sloppy-mode function, `eval('var added = 1')` followed by `typeof added` gives `"number"`. What does the same code give inside a strict-mode function?
- A) `"number"`
- B) `"undefined"`
- C) It throws `SyntaxError`
- D) It throws `ReferenceError`

<details><summary>Answer</summary>

**B.** Strict direct eval gets its own variable environment, so `var` declarations do not leak into the caller.
- Why not A: that is sloppy-mode behaviour.
- Why not C: `var` inside eval is valid syntax.
- Why not D: `typeof` of an unresolvable name returns `"undefined"`.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §7, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
</details>

### Q-JSI-014 · Scope and closures · difficulty 2 · single
Why does `let x = 1` at the top level of a classic script not create `globalThis.x`?
- A) `let` declarations are hoisted to the nearest function.
- B) The global Environment Record has a declarative part for `let`/`const`/`class` and an object part (the global object) for `var` and function declarations.
- C) `let` is block-scoped, and the script body is a block.
- D) It does create it, but as non-enumerable.

<details><summary>Answer</summary>

**B.** Only the object record's bindings are properties of the global object.
- Why not A: `let` is block-scoped, never function-hoisted.
- Why not C: a script body is not a block; the reason is the two-part global record.
- Why not D: `'x' in globalThis` is false.
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §3, https://tc39.es/ecma262/#sec-global-environment-records
</details>

---

## D3 · Objects, prototypes and classes

### Q-JSI-015 · Objects and prototypes · difficulty 2 · single
```js
const proto = Object.freeze({ toString() { return 'p'; } });
const o = Object.create(proto);
o.toString = () => 'own';   // in strict code
```
What happens on the last line?
- A) `o` gets an own `toString`.
- B) `TypeError`, because an inherited non-writable data property blocks assignment.
- C) `proto.toString` is replaced.
- D) Nothing; the assignment is silently ignored even in strict code.

<details><summary>Answer</summary>

**B.** OrdinarySet walks the prototype chain first; if it finds a non-writable data property, the assignment fails (TypeError in strict code). This is the "override mistake". `Object.defineProperty(o, 'toString', ...)` works.
- Why not A: assignment cannot shadow an inherited read-only property.
- Why not C: assignment never writes to the prototype, and `proto` is frozen.
- Why not D: the silent failure happens only in sloppy code.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §2.2, https://tc39.es/ecma262/#sec-ordinaryset
</details>

### Q-JSI-016 · Objects and prototypes · difficulty 1 · single
What does `Object.keys({ b: 1, 2: 1, a: 1, 1: 1 })` return?
- A) `['b', '2', 'a', '1']`
- B) `['1', '2', 'b', 'a']`
- C) `['a', 'b', '1', '2']`
- D) The order is unspecified.

<details><summary>Answer</summary>

**B.** OrdinaryOwnPropertyKeys lists integer-index keys in ascending numeric order, then string keys in insertion order, then symbols.
- Why not A: integer keys are not kept in insertion order.
- Why not C: string keys are not sorted alphabetically.
- Why not D: the order has been specified for own keys since ES2015 (and for `for...in` since ES2020).
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §2.3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
</details>

### Q-JSI-017 · Classes · difficulty 2 · single
```js
class Base { constructor() { this.init(); } init() {} }
class Derived extends Base {
  value = 'field';
  init() { this.seen = this.value; }
}
console.log(new Derived().seen);
```
- A) `'field'`
- B) `undefined`
- C) `ReferenceError`
- D) `TypeError`

<details><summary>Answer</summary>

**B.** Derived-class fields are defined after `super()` returns. The base constructor calls the overridden `init` before the field exists.
- Why not A: the field is not yet defined during the base constructor.
- Why not C: `this` is initialised (the base constructor is running); only the field is missing.
- Why not D: reading a missing property is not an error.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields
</details>

### Q-JSI-018 · Classes · difficulty 3 · scenario
A reactive library wraps class instances in a `Proxy`. Calling a method that reads `this.#count` through the proxy throws `TypeError: Cannot read private member`. Why?
- A) Private fields are non-enumerable.
- B) Private names are not properties; the access checks that the receiver (the proxy) has the private element, and proxies do not forward private names.
- C) Proxies cannot wrap class instances.
- D) The class was not declared with `accessor`.

<details><summary>Answer</summary>

**B.** `this` inside the method is the proxy, which lacks the private element, so the brand check fails.
- Why not A: enumerability concerns properties; private names are not properties at all.
- Why not C: proxies can wrap any object; only private access fails.
- Why not D: `accessor` is a Stage 2.7 decorators feature and unrelated to private name forwarding.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements
</details>

### Q-JSI-019 · Objects and prototypes · difficulty 2 · multi
Which differences between `Object.assign(target, src)` and `{ ...src }` are real? (Select all that apply.)
- A) `Object.assign` triggers setters on the target; spread does not.
- B) Spread copies non-enumerable properties.
- C) Both invoke getters on the source.
- D) Both copy the source's prototype.
- E) Both copy own Symbol-keyed enumerable properties.

<details><summary>Answer</summary>

**A, C, E.** `Object.assign` uses `[[Set]]`; spread uses `[[DefineOwnProperty]]` on a fresh object. Both read own enumerable String and Symbol keys with `[[Get]]`.
- Why not B: neither copies non-enumerable properties.
- Why not D: neither copies the prototype; spread produces a plain object.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §6, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
</details>

### Q-JSI-020 · Objects and prototypes · difficulty 2 · single
Why is `value instanceof Array` unreliable for arrays received from an iframe or a `vm` context?
- A) Arrays created in other realms are array-like objects, not arrays.
- B) Each realm has its own `Array.prototype`, and `instanceof` checks prototype identity.
- C) `instanceof` does not work with built-ins.
- D) The array was frozen during transfer.

<details><summary>Answer</summary>

**B.** OrdinaryHasInstance walks the prototype chain looking for this realm's `Array.prototype`. Use `Array.isArray`, which checks for an Array exotic object.
- Why not A: they are genuine Array exotic objects.
- Why not C: `instanceof Array` works within one realm.
- Why not D: nothing is frozen; same-thread realms share objects directly.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
</details>

### Q-JSI-021 · Objects and prototypes · difficulty 1 · single
What do `Object.freeze` guarantees cover?
- A) The object and every nested object become immutable.
- B) The object's own properties become non-writable and non-configurable, and the object non-extensible; nested objects and internal slots (`Map` contents, `Date` value) are unaffected.
- C) The object and its prototype chain become immutable.
- D) Only property additions are prevented.

<details><summary>Answer</summary>

**B.** `freeze` is shallow and applies only to properties of that object.
- Why not A: nested objects stay mutable.
- Why not C: the prototype is not frozen.
- Why not D: that is `Object.preventExtensions`.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
</details>

### Q-JSI-022 · Classes · difficulty 2 · single
Why does `class Stack extends Array {}` produce instances whose `length` updates automatically, while the ES5 pattern `function Stack() { Array.call(this); } Stack.prototype = Object.create(Array.prototype)` does not?
- A) Classes copy Array's methods onto the subclass.
- B) In a derived class, the base constructor (`Array`) allocates the object with `new.target.prototype`, so the instance is a real Array exotic object; `Array.call(this)` creates and discards a separate array.
- C) ES5 constructors cannot set `length`.
- D) `Object.create` returns a frozen object.

<details><summary>Answer</summary>

**B.** Allocation happens in the base constructor for derived classes, which is what makes subclassing built-ins with internal behaviour (exotic `length`) work.
- Why not A: methods are inherited through the prototype chain, not copied.
- Why not C: they can, but the object is ordinary, so `length` is a plain property.
- Why not D: `Object.create` returns an ordinary extensible object.
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends
</details>

---

## D4 · Iterators and generators

### Q-JSI-023 · Iterators · difficulty 2 · multi
In which situations does a consumer call the iterator's `return()` method? (Select all that apply.)
- A) `break` inside `for...of`
- B) The iterator returns `{ done: true }`
- C) `const [first] = iterable` on an iterator with more elements
- D) An exception thrown inside the `for...of` body
- E) The iterator's own `next()` throws

<details><summary>Answer</summary>

**A, C, D.** IteratorClose runs when the consumer stops before exhaustion: break, destructuring that takes fewer elements, or an abrupt exit of the loop body.
- Why not B: an exhausted iterator is not closed.
- Why not E: if `next()` throws, the iterator is considered broken and is not closed.
- Ref: [modules/05-iterators-generators.md](../modules/05-iterators-generators.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
</details>

### Q-JSI-024 · Generators · difficulty 2 · single
```js
function* g() { const x = yield 1; return x * 2; }
const it = g();
const r = [it.next(5), it.next(10)];
```
What is `r`?
- A) `[{ value: 1, done: false }, { value: 20, done: true }]`
- B) `[{ value: 1, done: false }, { value: 10, done: true }]`
- C) `[{ value: 5, done: false }, { value: 20, done: true }]`
- D) `[{ value: 1, done: false }, { value: NaN, done: true }]`

<details><summary>Answer</summary>

**A.** The first `next` starts the body (its argument is discarded) and pauses at `yield 1`. The second `next(10)` makes `yield` evaluate to 10, and the function returns 20.
- Why not B: the return value is `x * 2`.
- Why not C: the first argument is ignored; the yielded value is 1.
- Why not D: `x` is 10, not undefined.
- Ref: [modules/05-iterators-generators.md](../modules/05-iterators-generators.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next
</details>

### Q-JSI-025 · Iterators · difficulty 1 · single
Why does a second `for...of` over the same generator object produce no iterations?
- A) Generators are one-shot: their `[Symbol.iterator]()` returns the generator itself, which is already exhausted.
- B) Generators cannot be used with `for...of` twice in strict mode.
- C) The second loop throws, and the error is swallowed.
- D) Generators cache values only for the first consumer.

<details><summary>Answer</summary>

**A.** To make a reusable sequence, expose an iterable whose `[Symbol.iterator]` calls the generator function each time.
- Why not B: strict mode is irrelevant.
- Why not C: the second loop simply sees `done: true` immediately.
- Why not D: generators do not cache values at all.
- Ref: [modules/05-iterators-generators.md](../modules/05-iterators-generators.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator
</details>

### Q-JSI-026 · Iterators · difficulty 2 · multi
Which statements about iterator helpers (`Iterator.prototype.map/filter/take/...`) are true? (Select all that apply.)
- A) They are lazy and can work on infinite iterators.
- B) Their callbacks receive `(value, index, iterator)`.
- C) `take(n)` closes the underlying iterator when it stops early.
- D) The result of `map` can be iterated twice.
- E) `Iterator.concat` is part of ES2026.

<details><summary>Answer</summary>

**A, C, E.**
- Why not B: callbacks receive `(value, counter)`; there is no third argument.
- Why not D: helper results are one-shot iterators.
- Ref: [modules/05-iterators-generators.md](../modules/05-iterators-generators.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator
</details>

### Q-JSI-027 · Async iteration · difficulty 3 · scenario
A Node script does `for await (const r of [slowFetch(), failingFetch()])`. `failingFetch()` rejects after 5 ms; `slowFetch()` resolves after 50 ms. The process exits with code 1 before printing anything. Why?
- A) `for await` cannot iterate arrays.
- B) `for await` attaches a handler to each promise only when it reaches it; the second promise rejects while unhandled, and Node's default `--unhandled-rejections=throw` terminates the process.
- C) `for await` runs both promises sequentially, so the second never starts.
- D) The array must be wrapped in `Promise.all`.

<details><summary>Answer</summary>

**B.** The loop is still awaiting the first promise when the second rejects without a handler.
- Why not A: arrays are iterated through AsyncFromSyncIterator.
- Why not C: both operations were already started when the array was created.
- Why not D: `Promise.all` (or `allSettled`) is a fix, not the explanation; the question asks why it crashes.
- Ref: [modules/05-iterators-generators.md](../modules/05-iterators-generators.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
</details>

---

## D5 · Event loop and job queue

### Q-JSI-028 · Event loop · difficulty 1 · ordering
Put the logs in order:
```js
setTimeout(() => console.log('A'), 0);
Promise.resolve().then(() => console.log('B'));
queueMicrotask(() => console.log('C'));
console.log('D');
```
- A) D, A, B, C
- B) D, B, C, A
- C) B, C, D, A
- D) D, C, B, A

<details><summary>Answer</summary>

**B.** Synchronous code first, then the microtask queue in FIFO order of enqueueing, then the timer task.
- Why not A: microtasks run before the next task.
- Why not C: microtasks wait until the current script finishes.
- Why not D: B was enqueued before C.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop
</details>

### Q-JSI-029 · Event loop · difficulty 2 · ordering
Put the logs in order:
```js
async function f() { console.log('1'); await null; console.log('2'); }
f();
Promise.resolve().then(() => console.log('3'));
console.log('4');
```
- A) 1, 4, 2, 3
- B) 1, 4, 3, 2
- C) 4, 1, 2, 3
- D) 1, 2, 4, 3

<details><summary>Answer</summary>

**A.** The async function runs synchronously until `await`, logging 1; its continuation is enqueued first, then the `then` reaction; 4 is logged synchronously; then 2 and 3 in FIFO order.
- Why not B: the continuation of `await null` was enqueued before the `then` callback.
- Why not C: the body before `await` runs synchronously in the call.
- Why not D: `await` always yields, even for non-promises.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
</details>

### Q-JSI-030 · Event loop · difficulty 3 · ordering
Order the settle notifications (all started in the same synchronous turn):
- P: `(async () => { await Promise.resolve(); log('await'); })()`
- Q: `Promise.resolve({ then(r) { r(); } }).then(() => log('thenable'))`
- R: `new Promise((r) => r(Promise.resolve())).then(() => log('resolve(promise)'))`
- A) await, thenable, resolve(promise)
- B) resolve(promise), thenable, await
- C) thenable, await, resolve(promise)
- D) All three log in the same microtask turn.

<details><summary>Answer</summary>

**A.** `await` on a native promise takes 1 tick (PromiseResolve returns it unchanged); resolving with a thenable takes 2 (NewPromiseResolveThenableJob, then the reaction); resolving with a native promise from the executor takes 3.
- Why not B: it is the reverse of the tick counts.
- Why not C: the `await` continuation needs the fewest turns.
- Why not D: the thenable resolution jobs add whole microtask turns.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §3, https://tc39.es/ecma262/#sec-newpromiseresolvethenablejob
</details>

### Q-JSI-031 · Event loop · difficulty 2 · single
Where does a `requestAnimationFrame` callback run in the HTML event loop?
- A) In the microtask checkpoint after every task.
- B) Inside the "update the rendering" work, after resize/scroll/media-query/animation steps and before style, layout and paint.
- C) After paint, so DOM changes appear in the next frame.
- D) In the idle period, like `requestIdleCallback`.

<details><summary>Answer</summary>

**B.** rAF callbacks run as part of updating the rendering at a rendering opportunity, immediately before style recalculation, layout and paint.
- Why not A: microtasks are a separate queue.
- Why not C: they run before paint, which is why DOM writes in rAF are visible in the same frame.
- Why not D: idle callbacks run only when no task or rendering work is pending.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §4, https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model
</details>

### Q-JSI-032 · Event loop · difficulty 2 · scenario
A page freezes and never repaints while a "background" job processes 200,000 items with `await Promise.resolve()` between items. What is wrong?
- A) `await` blocks the thread.
- B) Each `await` on an already-resolved promise continues in the same microtask drain; the microtask queue never empties, so no task or rendering can run until the job ends.
- C) The browser throttles promises in the background.
- D) `Promise.resolve()` is synchronous.

<details><summary>Answer</summary>

**B.** Microtasks run to exhaustion after each task, so a long chain of resolved awaits starves tasks and rendering. Yield with a task (`scheduler.yield()`, `setTimeout`, `MessageChannel`) or move the work to a worker.
- Why not A: `await` suspends the function and does not block, but here it resumes immediately.
- Why not C: no such throttling applies to microtasks.
- Why not D: `.then`/`await` continuations always run asynchronously, but within the same checkpoint.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §4, https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
</details>

### Q-JSI-033 · Event loop · difficulty 2 · single
In Node 26, a promise is rejected without a handler, and `.catch()` is attached inside a `setTimeout(..., 0)` callback. With default settings, what happens?
- A) Nothing; the late handler catches it.
- B) The process emits `unhandledRejection`, which by default is raised as an uncaught exception and exits with code 1, before the timer runs.
- C) A warning is printed and the process continues.
- D) The rejection is queued until a handler is attached.

<details><summary>Answer</summary>

**B.** Node checks rejections after the microtask queue drains; the default mode is `throw` (since Node 15).
- Why not A: one macrotask later is too late.
- Why not C: that was the default before Node 15 (`warn`).
- Why not D: the host reports unhandled rejections at a defined point; it does not wait.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §3, https://nodejs.org/api/cli.html#--unhandled-rejectionsmode
</details>

### Q-JSI-034 · Event loop · difficulty 3 · multi
Which statements about ECMA-262 jobs and HTML task queues are true? (Select all that apply.)
- A) ECMA-262 defines the timer task queue.
- B) Promise jobs must run in FIFO order relative to each other.
- C) In HTML, a task queue is a set; the loop picks the first runnable task from a queue of its choosing.
- D) Tasks from different task sources are guaranteed to run in enqueue order.
- E) The microtask queue is drained completely after each task.

<details><summary>Answer</summary>

**B, C, E.**
- Why not A: ECMA-262 has no timers; HTML (and Node) define them.
- Why not D: ordering is guaranteed only within one task source; browsers prioritise sources.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §3–§4, https://html.spec.whatwg.org/multipage/webappapis.html#event-loops
</details>

### Q-JSI-035 · Event loop · difficulty 2 · single
`MutationObserver` callbacks are delivered...
- A) synchronously after each DOM mutation.
- B) as a microtask, so mutations made by one script are batched into one callback at the checkpoint.
- C) as a task on the DOM manipulation task source.
- D) during the rendering steps.

<details><summary>Answer</summary>

**B.** Mutation records are queued, and a microtask is scheduled once to notify observers.
- Why not A: the synchronous mutation events (`DOMNodeInserted`) were deprecated for that reason.
- Why not C: it uses the microtask queue, not a task source.
- Why not D: delivery is not tied to rendering.
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §4, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
</details>

### Q-JSI-036 · Event loop · difficulty 2 · single
Inside an async function's `try` block, why is `return await p` preferred to `return p`?
- A) `return p` makes the function synchronous.
- B) With `return p`, the function leaves the `try` before `p` settles, so a rejection of `p` bypasses the `catch`; `return await p` keeps the rejection inside the `try`, and since ES2019 it costs no extra ticks.
- C) `return await p` is required by the spec.
- D) `return p` returns a nested promise.

<details><summary>Answer</summary>

**B.**
- Why not A: async functions always return promises.
- Why not C: both are valid.
- Why not D: promises adopt thenables; there are no nested promises.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
</details>

---

## D6 · Async patterns

### Q-JSI-037 · Async patterns · difficulty 1 · single
What does `Promise.all` do when one input rejects while others are still pending?
- A) It cancels the pending operations and rejects.
- B) It rejects immediately with that reason; the other operations keep running and their results are ignored.
- C) It waits for all inputs, then rejects with an `AggregateError`.
- D) It resolves with `undefined` for the rejected slot.

<details><summary>Answer</summary>

**B.** Promises represent results, not running work; nothing is cancelled.
- Why not A: cancellation needs explicit plumbing (`AbortSignal`).
- Why not C: that describes neither `all` nor `allSettled`; `AggregateError` comes from `Promise.any`.
- Why not D: that resembles `allSettled`, which never rejects and reports `{ status, reason }`.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
</details>

### Q-JSI-038 · Async patterns · difficulty 2 · multi
Which statements about the combinators are true? (Select all that apply.)
- A) `Promise.race([])` never settles.
- B) `Promise.any([])` rejects with an `AggregateError`.
- C) `Promise.all([])` resolves with `[]`.
- D) `Promise.allSettled` rejects if any input rejects.
- E) `Promise.all` results are in completion order.

<details><summary>Answer</summary>

**A, B, C.**
- Why not D: `allSettled` never rejects for input rejections.
- Why not E: results are in input order.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
</details>

### Q-JSI-039 · Async patterns · difficulty 2 · scenario
A job imports 50,000 records with `await Promise.all(records.map(upload))`. Production sees `EMFILE` errors and HTTP 429 responses. What is the best fix?
- A) Replace it with a `for...of` loop and `await` each upload.
- B) Run the uploads through a concurrency-limited pool (for example 16 in flight), with retries using exponential backoff and jitter for 429s.
- C) Use `Promise.allSettled` instead.
- D) Increase the process file-descriptor limit and retry immediately on 429.

<details><summary>Answer</summary>

**B.** Bounded concurrency keeps resource use constant; backoff with jitter respects rate limits without synchronised retry storms.
- Why not A: correct but needlessly slow (latency adds up across 50,000 sequential calls).
- Why not C: it still starts all 50,000 at once.
- Why not D: it treats the symptom and amplifies the overload with immediate retries.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §3–§4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
</details>

### Q-JSI-040 · Async patterns · difficulty 2 · single
How do you give a `fetch` a 5-second timeout while still honouring the caller's `AbortSignal`?
- A) `fetch(url, { timeout: 5000, signal })`
- B) `fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })`
- C) `Promise.race([fetch(url, { signal }), sleep(5000)])`
- D) `setTimeout(() => signal.abort(), 5000)`

<details><summary>Answer</summary>

**B.** `AbortSignal.any` aborts when either input aborts, with that input's reason, and the request is actually aborted.
- Why not A: `fetch` has no `timeout` option.
- Why not C: the race resolves early, but the request keeps running in the background.
- Why not D: `AbortSignal` has no `abort` method (only `AbortController` does), and you must not abort the caller's signal.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §4, https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
</details>

### Q-JSI-041 · Async patterns · difficulty 1 · single
What does `[1, 2, 3].forEach(async (x) => { await save(x); })` return, and when?
- A) A promise that resolves after all saves.
- B) `undefined`, synchronously; the saves run concurrently and their rejections are unhandled.
- C) An array of promises.
- D) `undefined`, after the saves finish sequentially.

<details><summary>Answer</summary>

**B.** `forEach` ignores callback return values.
- Why not A: `forEach` never returns a promise.
- Why not C: that is `map`.
- Why not D: nothing waits; the calls start concurrently.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
</details>

### Q-JSI-042 · Async patterns · difficulty 2 · single
What is the difference between `Promise.try(fn)` (ES2025) and `Promise.resolve().then(fn)`?
- A) None.
- B) `Promise.try` calls `fn` synchronously and turns a synchronous throw into a rejection; the `then` form defers the call by a microtask.
- C) `Promise.try` swallows errors.
- D) `Promise.try` only accepts async functions.

<details><summary>Answer</summary>

**B.**
- Why not A: the timing of the call differs.
- Why not C: errors become rejections; nothing is swallowed.
- Why not D: any function works; its return value or promise is adopted.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try
</details>

### Q-JSI-043 · Async patterns · difficulty 3 · scenario
A retry helper retries every failure 5 times with delays of exactly 1, 2, 4, 8, 16 s. During an outage, the recovering service is knocked over again at regular intervals. Which change addresses the cause?
- A) Use a fixed delay of 1 s.
- B) Add jitter (for example "full jitter": a random delay in [0, cap]) so clients that failed together do not retry together; also retry only retryable errors.
- C) Retry 10 times instead of 5.
- D) Retry in parallel to finish sooner.

<details><summary>Answer</summary>

**B.** Deterministic backoff synchronises clients that failed at the same moment into load spikes (thundering herd). Randomising the delay spreads them out.
- Why not A: fixed delays synchronise even more.
- Why not C: more retries add more load.
- Why not D: parallel retries multiply load.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §4, https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
</details>

### Q-JSI-044 · Async patterns · difficulty 2 · multi
Which are good practices for a cancellable async function? (Select all that apply.)
- A) Accept `{ signal }` in an options object and pass it to every API that accepts one.
- B) Call `signal.throwIfAborted()` at await boundaries in long loops.
- C) Register `'abort'` listeners and never remove them.
- D) Reject with `signal.reason` when aborted.
- E) Catch and ignore `AbortError` everywhere inside the function.

<details><summary>Answer</summary>

**A, B, D.**
- Why not C: listeners on long-lived signals retain closures (leaks); use `{ once: true }` and remove them on completion.
- Why not E: swallowing the abort hides it from the caller, who must see the rejection.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §4, https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
</details>

### Q-JSI-045 · Async patterns · difficulty 3 · single
What is the status of AsyncContext, and what do Node applications use today for request-scoped context across `await`?
- A) Stage 4; `AsyncContext.Variable`.
- B) Stage 2; `AsyncLocalStorage` from `node:async_hooks`.
- C) Withdrawn; thread-locals.
- D) Stage 3; `zone.js`.

<details><summary>Answer</summary>

**B.** AsyncContext was at Stage 2 as of 2026-10-28 and is not shipped unflagged anywhere; Node's `AsyncLocalStorage` is the production mechanism.
- Why not A: it is not standard.
- Why not C: it was not withdrawn, and JavaScript has no thread-locals.
- Why not D: `zone.js` is an Angular library, not a TC39 proposal.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §6, https://nodejs.org/api/async_context.html
</details>

---

## D7 · Modules

### Q-JSI-046 · Modules · difficulty 2 · single
`counter.js` exports `export let count = 0; export function inc() { count++; }`. `main.js` does `import { count, inc } from './counter.js'; inc(); console.log(count);`. What is printed?
- A) `0`
- B) `1`
- C) `ReferenceError`
- D) `TypeError`

<details><summary>Answer</summary>

**B.** ESM imports are live bindings: reading `count` reads the exporter's variable now.
- Why not A: that is CommonJS destructuring behaviour (a copy).
- Why not C: the binding is initialised before `main.js` runs.
- Why not D: only *assigning* to an import throws `TypeError`.
- Ref: [modules/08-modules.md](../modules/08-modules.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
</details>

### Q-JSI-047 · Modules · difficulty 2 · scenario
After moving an import line, the app crashes at startup with `ReferenceError: Cannot access 'User' before initialization` in `admin.js`, which contains `class Admin extends User`. `user.js` imports `admin.js`. What is happening?
- A) A missing export.
- B) A circular import: `admin.js` is now evaluated before `user.js` finished, so `User` is still in its TDZ.
- C) Classes cannot be exported.
- D) A top-level await deadlock.

<details><summary>Answer</summary>

**B.** Evaluation is depth-first post-order; in a cycle, the module visited first finishes last. The import order decides which module sees uninitialised bindings. Break the cycle.
- Why not A: a missing export is a `SyntaxError` at link time, before anything runs.
- Why not C: classes can be exported.
- Why not D: a deadlock hangs instead of throwing.
- Ref: [modules/08-modules.md](../modules/08-modules.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
</details>

### Q-JSI-048 · Modules · difficulty 3 · ordering
`entry.js` imports `consumer.js` then `sibling.js`. `consumer.js` imports `slow.js`, which logs `slow:start`, awaits a 30 ms timer at top level, then logs `slow:end`. Each other module logs its name. Order the logs.
- A) slow:start, slow:end, consumer, sibling, entry
- B) slow:start, sibling, slow:end, consumer, entry
- C) sibling, slow:start, slow:end, consumer, entry
- D) slow:start, consumer, sibling, slow:end, entry

<details><summary>Answer</summary>

**B.** While the async module awaits, modules that do not depend on it (sibling) continue; dependents (consumer, then entry) wait for it.
- Why not A: siblings are not blocked by an unrelated async module.
- Why not C: evaluation follows import order, so `slow.js` starts first.
- Why not D: `consumer` depends on `slow` and cannot run before it finishes.
- Ref: [modules/08-modules.md](../modules/08-modules.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#top_level_await
</details>

### Q-JSI-049 · Modules · difficulty 2 · multi
A package's `exports` is `{ ".": { "development": "./dev.js", "node": "./node.js", "default": "./index.js" } }`. Which statements are true? (Select all that apply.)
- A) Under `node --conditions=development`, `./dev.js` is used.
- B) Under plain `node`, `./node.js` is used.
- C) `import 'pkg/dev.js'` works because the file exists.
- D) If `"default"` were listed first, it would always win.
- E) Conditions are matched alphabetically.

<details><summary>Answer</summary>

**A, B, D.** Keys are tested in object order; the first active condition wins.
- Why not C: subpaths not listed in `exports` are encapsulated (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Why not E: order is the object's key order, not alphabetical.
- Ref: [modules/08-modules.md](../modules/08-modules.md) §6, https://nodejs.org/api/packages.html#conditional-exports
</details>

### Q-JSI-050 · Modules · difficulty 1 · single
Why must a JSON module be imported with `with { type: 'json' }`?
- A) For performance.
- B) The importer declares the expected type, so a server cannot make a `.json` URL execute JavaScript; hosts reject JSON imports without it.
- C) To allow comments in JSON.
- D) To enable live bindings for JSON.

<details><summary>Answer</summary>

**B.** Import attributes are a security mechanism.
- Why not A: they do not change parsing speed.
- Why not C: JSON modules use strict JSON parsing.
- Why not D: JSON modules export one `default` value.
- Ref: [modules/08-modules.md](../modules/08-modules.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with
</details>

---

## D8 · Metaprogramming, memory and binary data

### Q-JSI-051 · Metaprogramming · difficulty 2 · single
Why should a Proxy `get` trap forward with `Reflect.get(target, key, receiver)` rather than `target[key]`?
- A) `Reflect.get` is faster.
- B) So inherited getters run with `this` set to the proxy (the receiver), keeping their own property reads observable by the trap.
- C) `target[key]` throws for symbols.
- D) `Reflect.get` bypasses invariants.

<details><summary>Answer</summary>

**B.**
- Why not A: speed is not the reason.
- Why not C: symbol keys work with bracket access.
- Why not D: invariants are always checked against the trap's result.
- Ref: [modules/09-metaprogramming.md](../modules/09-metaprogramming.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/get
</details>

### Q-JSI-052 · Metaprogramming · difficulty 3 · single
`new Proxy(Object.freeze({ x: 1 }), { get: () => 2 }).x` evaluates to...
- A) `2`
- B) `1`
- C) It throws `TypeError` because the trap violates an invariant.
- D) `undefined`

<details><summary>Answer</summary>

**C.** For a non-configurable, non-writable own data property, the `get` trap must return the actual value.
- Why not A: the result is checked and rejected.
- Why not B: the trap's value is not silently replaced.
- Why not D: no path produces `undefined`.
- Ref: [modules/09-metaprogramming.md](../modules/09-metaprogramming.md) §1, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get#invariants
</details>

### Q-JSI-053 · Memory · difficulty 2 · multi
Which statements about `WeakRef` and `FinalizationRegistry` are true? (Select all that apply.)
- A) Cleanup callbacks may run late or never.
- B) They are a reliable way to close file handles.
- C) Within one synchronous job, `ref.deref()` keeps returning the same answer.
- D) `WeakMap` is iterable so you can inspect live entries.
- E) A good use is a cache of large, re-creatable objects.

<details><summary>Answer</summary>

**A, C, E.**
- Why not B: never rely on finalisation for correctness; use `using` or `try/finally`.
- Why not D: WeakMaps are not iterable, which keeps GC unobservable.
- Ref: [modules/09-metaprogramming.md](../modules/09-metaprogramming.md) §4, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef
</details>

### Q-JSI-054 · Binary data · difficulty 2 · multi
Which statements about `structuredClone` are true? (Select all that apply.)
- A) It preserves cycles and shared references.
- B) Class instances keep their prototype.
- C) Functions throw `DataCloneError`.
- D) Getters are invoked and replaced by data properties.
- E) A `SharedArrayBuffer` is shared, not copied.

<details><summary>Answer</summary>

**A, C, D, E.**
- Why not B: prototypes are not serialised; instances come back as plain objects.
- Ref: [modules/11-binary-data-memory-model.md](../modules/11-binary-data-memory-model.md) §4, https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
</details>

### Q-JSI-055 · Memory model · difficulty 3 · scenario
Four workers each run `counter[0]++` 100,000 times on an `Int32Array` over a `SharedArrayBuffer`. The total is often below 400,000. Which statement is correct?
- A) A V8 bug; the result should always be 400,000.
- B) `counter[0]++` is a read, an add and a write; concurrent unordered accesses form a data race, so updates are lost. `Atomics.add(counter, 0, 1)` fixes it.
- C) `SharedArrayBuffer` copies memory per worker.
- D) Workers run sequentially, so the result must be exact.

<details><summary>Answer</summary>

**B.** Only data-race-free programs get sequentially consistent behaviour.
- Why not A: the memory model explicitly allows this outcome for racy programs.
- Why not C: the memory is shared; that is why the race exists.
- Why not D: worker agents run in parallel.
- Ref: [modules/11-binary-data-memory-model.md](../modules/11-binary-data-memory-model.md) §6, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics
</details>

### Q-JSI-056 · Metaprogramming · difficulty 3 · single
What is the TC39 status of decorators as of 2026-10-28, and can Node 26 run `@decorator` syntax natively?
- A) Stage 4; yes.
- B) Stage 3; yes, behind `--js-decorators`.
- C) Stage 2.7 (moved back from Stage 3 in May 2026); no, even `--js-decorators` only parses `accessor`; transpilers (TypeScript, Babel, esbuild) implement them.
- D) Withdrawn; no.

<details><summary>Answer</summary>

**C.**
- Why not A and B: they are not standard; V8 14.6 rejects `@dec` syntax even with the flag.
- Why not D: the proposal is active at Stage 2.7.
- Ref: [modules/09-metaprogramming.md](../modules/09-metaprogramming.md) §5, https://github.com/tc39/proposals
</details>

---

## D9 · Modern ECMAScript (ES2024–ES2027)

### Q-JSI-057 · Modern ECMAScript · difficulty 2 · single
In Europe/Prague, 2026-03-29 has 23 hours. `zdt` is 2026-03-28T12:00 in Prague. Which is true?
- A) `zdt.add({ days: 1 })` and `zdt.add({ hours: 24 })` are equal.
- B) `zdt.add({ days: 1 })` is 2026-03-29T12:00, and `zdt.add({ hours: 24 })` is 2026-03-29T13:00.
- C) Both give 2026-03-29T11:00.
- D) `add` throws across DST transitions.

<details><summary>Answer</summary>

**B.** Days are calendar units (same wall-clock time); hours are exact elapsed time.
- Why not A: the day has 23 hours.
- Why not C: no operation moves the clock backwards here.
- Why not D: Temporal handles DST explicitly.
- Ref: [modules/10-resource-management-temporal.md](../modules/10-resource-management-temporal.md) §7, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/add
</details>

### Q-JSI-058 · Modern ECMAScript · difficulty 2 · single
In a block with `using a = A; using b = B;`, the body throws `E0`, and `b`'s dispose throws `E1`. What propagates?
- A) `E0`
- B) `E1`
- C) A `SuppressedError` with `error = E1` and `suppressed = E0`, after `a` was also disposed.
- D) An `AggregateError` of `[E0, E1]`.

<details><summary>Answer</summary>

**C.** Resources are disposed in reverse order; each new error wraps the pending one, and every resource is still disposed.
- Why not A: the disposal error is not dropped.
- Why not B: the body error is not dropped either.
- Why not D: explicit resource management uses `SuppressedError`, not `AggregateError`.
- Ref: [modules/10-resource-management-temporal.md](../modules/10-resource-management-temporal.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/using
</details>

### Q-JSI-059 · Modern ECMAScript · difficulty 1 · multi
Which of these are part of ES2026? (Select all that apply.)
- A) `Map.prototype.getOrInsertComputed`
- B) `Math.sumPrecise`
- C) Temporal
- D) `Error.isError`
- E) `using` declarations

<details><summary>Answer</summary>

**A, B, D.**
- Why not C and E: Temporal and explicit resource management reached Stage 4 after the ES2026 cut-off and are slated for ES2027 (both already ship in Node 26).
- Ref: [modules/01-reading-the-spec.md](../modules/01-reading-the-spec.md) §5, https://github.com/tc39/proposals/blob/main/finished-proposals.md
</details>

### Q-JSI-060 · Modern ECMAScript · difficulty 3 · scenario
Code that calls `Math.sumPrecise` works in a browser but throws `TypeError: Math.sumPrecise is not a function` on Node 26.12.1, although Node 26 ships Temporal. Why?
- A) Node does not implement ES2026.
- B) Engines ship features individually; in V8 14.6, `Math.sumPrecise` is still behind `--js-sum-precise` while Temporal is enabled by default. Feature-detect and fall back.
- C) `Math.sumPrecise` is browser-only.
- D) It requires `"type": "module"`.

<details><summary>Answer</summary>

**B.** Edition membership does not determine shipping status.
- Why not A: Node 26 ships most of ES2026 (Upsert, `Iterator.concat`, base64, `Error.isError`, ...).
- Why not C: it is a language built-in, not a web API.
- Why not D: built-ins do not depend on the module format.
- Ref: [modules/01-reading-the-spec.md](../modules/01-reading-the-spec.md) §6, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sumPrecise
</details>

### Q-JSI-061 · Modern ECMAScript · difficulty 2 · single
Which way of building a constructor that acquires several resources releases the already-acquired ones if a later acquisition throws, and keeps them on success?
- A) `try/catch` that closes everything in the `catch`.
- B) A `using stack = new DisposableStack()` in the constructor, registering each resource, and `this.#resources = stack.move()` at the end.
- C) A `FinalizationRegistry`.
- D) `await using` on `this`.

<details><summary>Answer</summary>

**B.** `move()` transfers ownership to a new stack; the original, now empty, is disposed harmlessly at block exit. On failure, the `using` disposes what was acquired.
- Why not A: workable but error-prone (it must track what was acquired), and cleanup errors overwrite the original.
- Why not C: finalisers are non-deterministic.
- Why not D: `this` is not a disposable resource being acquired, and that would dispose the object immediately.
- Ref: [modules/10-resource-management-temporal.md](../modules/10-resource-management-temporal.md) §3, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DisposableStack/move
</details>

---

## D10 · Performance and security

### Q-JSI-062 · Security · difficulty 2 · scenario
After a recursive `merge(config, JSON.parse(body))`, every object in the process has `isAdmin === true`. Which fix addresses the root cause?
- A) Use `structuredClone(JSON.parse(body))` before merging.
- B) Validate the body with a schema into fresh objects, or merge into null-prototype objects and skip `__proto__`, `constructor` and `prototype` keys.
- C) Wrap the merge in `try/catch`.
- D) Use `JSON.parse` with a reviver that returns `undefined` for `isAdmin`.

<details><summary>Answer</summary>

**B.** `JSON.parse` creates an own `__proto__` key; the merge's `target['__proto__']` reaches `Object.prototype` through the Annex B accessor.
- Why not A: the clone keeps the own `__proto__` data property; the next merge is still vulnerable.
- Why not C: nothing throws.
- Why not D: it blocks one key name, not the pollution path.
- Ref: [modules/13-correctness-security-pitfalls.md](../modules/13-correctness-security-pitfalls.md) §1, https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html
</details>

### Q-JSI-063 · Security · difficulty 2 · single
Which regular expression is vulnerable to catastrophic backtracking on inputs like `"aaaa…a!"`?
- A) `/^a+$/`
- B) `/(a+)+$/`
- C) `/^[a-z]+!$/`
- D) `/a{1,3}/`

<details><summary>Answer</summary>

**B.** The nested quantifiers give exponentially many ways to split the `a`s before failing.
- Why not A, C: single unambiguous quantifiers backtrack linearly.
- Why not D: bounded repetition without nesting.
- Ref: [modules/13-correctness-security-pitfalls.md](../modules/13-correctness-security-pitfalls.md) §2, https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS
</details>

### Q-JSI-064 · Performance · difficulty 2 · multi
Which changes typically make a hot V8 property-access site faster? (Select all that apply.)
- A) Creating all objects passed to it with the same factory or class, assigning fields in the same order.
- B) Deleting properties that are no longer needed.
- C) Assigning `undefined` instead of using `delete`.
- D) Adding optional properties only to some objects.
- E) Keeping numeric arrays packed and of one element kind.

<details><summary>Answer</summary>

**A, C, E.** Stable shapes keep inline caches monomorphic; `delete` usually moves the object to dictionary mode; packed, homogeneous arrays avoid hole checks and boxing.
- Why not B: see above.
- Why not D: optional properties create additional maps (polymorphism).
- Ref: [modules/12-engine-internals-v8.md](../modules/12-engine-internals-v8.md) §2–§4, https://v8.dev/blog/fast-properties
</details>

### Q-JSI-065 · Performance · difficulty 3 · single
`--trace-deopt` repeatedly shows `reason: not a Smi` for a hot `add(p, q)` function. What does it indicate?
- A) A syntax error.
- B) The optimised code assumed small integers based on feedback, then received another type (a double or a string), so it deoptimised; repeated cycles suggest the call site is type-unstable.
- C) The function is too large to optimise.
- D) Garbage collection pressure.

<details><summary>Answer</summary>

**B.** Speculative optimisation relies on type feedback; violations deoptimise back to the interpreter.
- Why not A: the code runs.
- Why not C: size limits produce different messages and no deopt.
- Why not D: GC is unrelated to this deopt reason.
- Ref: [modules/12-engine-internals-v8.md](../modules/12-engine-internals-v8.md) §1, https://v8.dev/docs/
</details>

### Q-JSI-066 · Correctness · difficulty 1 · single
What does `[10, 1, 2].sort()` return?
- A) `[1, 2, 10]`
- B) `[1, 10, 2]`
- C) `[10, 2, 1]`
- D) `[10, 1, 2]`

<details><summary>Answer</summary>

**B.** The default comparator compares the elements' string forms.
- Why not A: that needs `(a, b) => a - b`.
- Why not C, D: no ordering rule produces these.
- Ref: [modules/13-correctness-security-pitfalls.md](../modules/13-correctness-security-pitfalls.md) §6, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
</details>

### Q-JSI-067 · Correctness · difficulty 3 · multi
Which comparators violate the "consistent comparator" contract, making the sort order implementation-defined? (Select all that apply.)
- A) `(a, b) => a > b`
- B) `() => Math.random() - 0.5`
- C) `(a, b) => a - b` on an array containing `NaN`
- D) `(a, b) => a.localeCompare(b)` on strings
- E) `(a, b) => a.date - b.date` when some dates are `undefined`

<details><summary>Answer</summary>

**A, B, C, E.** A returns Booleans (never negative); B is inconsistent; C and E produce `NaN`, which is treated as 0 and breaks transitivity.
- Why not D: `localeCompare` returns a consistent negative, zero or positive number.
- Ref: [modules/13-correctness-security-pitfalls.md](../modules/13-correctness-security-pitfalls.md) §6, https://tc39.es/ecma262/#sec-array.prototype.sort
</details>

---

## H · Hands-on coding tasks

Each task has a verification script: [`examples/exam-hands-on.test.js`](../examples/exam-hands-on.test.js). Write your solution in a file exporting the named function and run

```bash
SOLUTIONS=./my-solutions.js node --test examples/exam-hands-on.test.js
```

from the track directory (the path is resolved relative to `examples/`). Reference solutions are in [`examples/exam-solutions.js`](../examples/exam-solutions.js).

### Q-JSI-068 · Async patterns · difficulty 2 · hands-on
**H1.** Implement `promiseAll(iterable)` with the semantics of `Promise.all`: results in input order, non-promise values allowed, `[]` for empty input, rejection with the first reason. Time: 15 minutes.

<details><summary>Answer</summary>

**Reference:** `promiseAll` in [`examples/07-async-utils.ts`](../examples/07-async-utils.ts). Key points: store by index, count pending, resolve when the count reaches zero, handle the empty iterable after the loop, pass `reject` directly.
- Common mistakes: pushing results in completion order; forgetting the empty case (the promise never settles); wrapping each item with `new Promise` instead of `Promise.resolve`.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §2, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
</details>

### Q-JSI-069 · Async patterns · difficulty 2 · hands-on
**H2.** Implement `mapWithConcurrency(items, limit, fn)`: run `fn(item, index)` with at most `limit` calls in flight and return results in input order; reject if any call rejects. Time: 20 minutes.

<details><summary>Answer</summary>

**Reference:** `mapWithConcurrency` in [`examples/07-async-utils.ts`](../examples/07-async-utils.ts): `limit` workers pulling from one shared iterator.
- Common mistakes: batching in fixed groups of `limit` (idle slots while the slowest item in a batch finishes); racing on a shared index without a single iterator; losing order.
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §3
</details>

### Q-JSI-070 · Event loop · difficulty 1 · hands-on
**H3.** Implement a trailing-edge `debounce(fn, ms, clock)` where `clock` provides `setTimeout` and `clearTimeout`. Time: 10 minutes.

<details><summary>Answer</summary>

**Reference:** `debounce` in [`examples/07-async-utils.ts`](../examples/07-async-utils.ts). Clear the pending timer on every call; call `fn` with the latest arguments when the timer fires.
- Common mistakes: calling with the first arguments; losing `this` (use an arrow wrapper or forward `this`).
- Ref: [modules/07-async-in-depth.md](../modules/07-async-in-depth.md) §4
</details>

### Q-JSI-071 · Scope and closures · difficulty 3 · hands-on
**H4.** Implement `myBind(fn, thisArg, ...args)` without `Function.prototype.bind`: partial application, `name` = `"bound " + fn.name`, `length` reduced by the bound arguments, and `new` ignoring the bound `this`. Time: 20 minutes.

<details><summary>Answer</summary>

**Reference:** `myBind` in [`examples/exam-solutions.js`](../examples/exam-solutions.js). Detect construction with `new.target` and use `Reflect.construct(fn, args, newTarget)`.
- Common mistakes: using `fn.apply(thisArg)` under `new` (the instance gets the wrong `this`); forgetting that `name` and `length` are non-writable (use `Object.defineProperty`).
- Ref: [modules/03-execution-contexts-scope-closures.md](../modules/03-execution-contexts-scope-closures.md) §5, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
</details>

### Q-JSI-072 · Objects and prototypes · difficulty 3 · hands-on
**H5.** Implement `deepClone(value)` supporting cycles, shared references, arrays, plain objects, class instances (keep the prototype), `Map`, `Set` and `Date`. Time: 25 minutes.

<details><summary>Answer</summary>

**Reference:** `deepClone` in [`examples/exam-solutions.js`](../examples/exam-solutions.js): a `Map` from source to clone, registered *before* recursing (that is what makes cycles work), and `Object.create(Object.getPrototypeOf(value))` with copied descriptors.
- Common mistakes: registering the clone after recursion (infinite recursion on cycles); `JSON.parse(JSON.stringify(x))`; `structuredClone` (loses prototypes, which the task forbids).
- Ref: [modules/04-objects-prototypes-classes.md](../modules/04-objects-prototypes-classes.md) §6, [modules/11-binary-data-memory-model.md](../modules/11-binary-data-memory-model.md) §4
</details>

### Q-JSI-073 · Event loop · difficulty 2 · hands-on
**H6.** Implement `createSignal(initial)` returning `{ get, set, subscribe }`, where several synchronous `set` calls produce **one** notification in a microtask with the latest value, and setting a value that is `Object.is`-equal to the current one notifies nothing. Time: 15 minutes.

<details><summary>Answer</summary>

**Reference:** `createSignal` in [`examples/exam-solutions.js`](../examples/exam-solutions.js): a `scheduled` flag plus `queueMicrotask(flush)`.
- Common mistakes: notifying synchronously; using `===` (NaN never equals itself, causing endless notifications); scheduling with `setTimeout` (a task, so the UI could render intermediate state).
- Ref: [modules/06-agents-realms-job-queue.md](../modules/06-agents-realms-job-queue.md) §4, [modules/09-metaprogramming.md](../modules/09-metaprogramming.md) §1
</details>

---

## Mock exams

### Mock A · Senior JavaScript technical screen (interview format)

**Format:** 60 minutes. Part 1: 20 knowledge questions, 30 minutes, no tools. Part 2: one hands-on task, 30 minutes, with a Node 26 runtime, followed by the verification script.

| Part | Questions | Domain mix |
|---|---|---|
| 1 | 002, 004, 008, 009, 011, 015, 017, 020, 023, 027, 029, 030, 032, 037, 039, 040, 046, 047, 055, 062 | D1 ×2, D2 ×3, D3 ×3, D4 ×2, D5 ×3, D6 ×3, D7 ×2, D8 ×1, D10 ×1 |
| 2 | 069 (H2) | D6 |

**Scoring key:**
- Part 1: 1 point per correct answer; `multi` questions score only if every correct option and no incorrect option is selected. Maximum 20.
- Part 2: 10 points if all H2 tests pass; 5 points if they pass but the solution batches in fixed groups; 0 otherwise. Explain the design for up to 5 more points (shared iterator, ordering, failure behaviour).
- **Total 35.** Indicative bands for a senior loop: ≥ 28 strong hire signal; 22–27 hire signal; 15–21 mixed; < 15 not yet senior on JavaScript fundamentals.

### Mock B · JSA-41-01-shaped practice (40 items, 60 minutes)

Mirrors the published structure of OpenEDG JS Institute's JSA-41-01 (40 items, 60 minutes, four sections). The section weights are from the official voucher page; the questions are this bank's, so the difficulty is higher than an associate exam (deliberately). Hands-on items are excluded because JSA-41-01 is not performance-based.

| JSA section (weight) | Items | Questions |
|---|---|---|
| Classless Objects (25%) | 10 | 015, 016, 019, 021, 051, 052, 053, 054, 062, 064 |
| Classes and Class-Based Approach (23%) | 9 | 012, 017, 018, 020, 022, 056, 061, 010, 014 |
| Built-in Objects (27%) | 11 | 002, 004, 006, 026, 038, 057, 058, 059, 060, 066, 067 |
| Advanced Functions (25%) | 10 | 007, 008, 009, 011, 013, 024, 025, 029, 041, 042 |

**Coverage note:** the bank has only seven class-specific questions, so the Classes section is filled with two function and scope questions (010, 014) that JSA's class objectives touch indirectly (`this` binding and declarations). This is recorded in the review file as a partial-coverage item.

**Scoring key:** 1 point per item (all-or-nothing for `multi`); maximum 40. The official passing score was not published on the pages checked; this track uses 70% (28/40) as a practice threshold.
