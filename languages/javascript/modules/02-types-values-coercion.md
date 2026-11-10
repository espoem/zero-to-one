# 02 · Types, Values and Coercion

> **Spec anchors (ECMA-262 17th edition):** §6.1 _ECMAScript Language Types_ (§6.1.1–§6.1.7), §6.1.5.1 _Well-Known Symbols_, §6.1.6.1 _The Number Type_, §6.1.6.2 _The BigInt Type_, §7.1 _Type Conversion_ (§7.1.1 ToPrimitive, §7.1.1.1 OrdinaryToPrimitive, §7.1.2 ToBoolean, §7.1.3 ToNumeric, §7.1.4 ToNumber, §7.1.5 ToIntegerOrInfinity, §7.1.6 ToInt32, §7.1.13 ToBigInt, §7.1.17 ToString, §7.1.18 ToObject, §7.1.19 ToPropertyKey), §7.2 _Testing and Comparison Operations_ (§7.2.9 SameValue, §7.2.10 SameValueZero, §7.2.12 IsLessThan, §7.2.13 IsLooselyEqual, §7.2.14 IsStrictlyEqual), §13.5.3 `typeof`, §13.8.1 addition, §21.3.2.34 `Math.sumPrecise`.
>
> **Executable proof:** [`examples/02-types-values-coercion.test.js`](../examples/02-types-values-coercion.test.js) (includes fast-check property tests)

Coercion is where JavaScript has the worst reputation and the most precise specification. Every conversion is an abstract operation with a short algorithm. Once you know about ten of them, "JavaScript is weird" becomes "the algorithm says so", and you can predict any expression.

---

## 0. Mental models: values, wires and properties

Every rule in this track is easier to hold if four models are right, because a wrong model produces confident wrong predictions that no amount of syntax knowledge repairs. This section states the models, the specification mechanism each one stands for, and how to test whether yours is the right one. Everything here has a full treatment later; the point of the section is the ordering, so that the later sections attach to something.

**Definition (mental model).** A _mental model_ is the internal, usually non-verbal representation a reader builds of a system and runs to predict its behaviour (Johnson-Laird, _Mental Models_, 1983; the fast pattern-matching and slow deliberate modes are Kahneman's System 1 and System 2, _Thinking, Fast and Slow_, 2011). A model can be useful and still be wrong: it was accurate for the cases it was learned from and silently fails outside them. Code reading runs on the fast mode, which is exactly why a wrong model survives for years.

### Model 1: a binding is a wire, not a box

The box model says a variable is a container that holds a copy of the value, so `let b = a` gives `b` its own box. The specification has no boxes: an identifier resolves through an Environment Record to a **binding**, and a binding is an association between a name and a value (ECMA-262 §9.1.1, §9.1.1.4). Assignment replaces the value the binding points at; it does not copy a container.

```js
let a = 10;
let b = a; // b is bound to the same value 10, not to a
a = 0; // reassignment moves a's wire; b's wire is untouched
// a === 0, b === 10
```

```mermaid
flowchart LR
  subgraph after["after let a = 10#59; let b = a#59; a = 0"]
    A["binding a"] -->|"wire"| Z["value 0"]
    B["binding b"] -->|"wire"| T["value 10"]
  end
```

There is no `a` inside `b`, so there is nothing for `a = 0` to reach. The same wire model explains `const` (it removes the ability to re-point the wire, not the ability to mutate the value — §14.3.1, and see [module 03 §3](03-execution-contexts-scope-closures.md#3-hoisting-formally)) and the temporal dead zone (the wire exists but is uninitialised until the declaration is evaluated).

### Model 2: a value is either a primitive or an identity

A primitive value (Undefined, Null, Boolean, Number, BigInt, String, Symbol) is immutable and has no identity apart from its content: `10` is `10` wherever it appears, and nothing you do to a variable can change any of its digits (ECMA-262 §6.1.1–§6.1.6.2). Every object — including arrays, functions, `Map`s and instances — is a _reference_ value: the value is an entry in a set of properties with its own identity, and two variables can point at the same object.

So `"abc".toUpperCase()` does not mutate the string; it produces a new one. Property access on a primitive runs `ToObject` (§7.1.18, producing a String exotic object, §10.4.3, §22.1) to expose prototype methods, producing a temporary wrapper; explicitly constructed wrapper objects (`new String('abc')`) are persistent objects and are never strictly equal to the primitive.

### Model 3: a property slot points at a value

An object is a set of properties, and each property is a name (String or Symbol) plus a value or an accessor (§6.1.7.1). `sherlock.address.street` walks two properties: read `address` from `sherlock` (§10.1.8 `[[Get]]`), then read `street` from whatever that value is. Two objects holding the same _reference_ in a property are aliases, not copies:

```mermaid
flowchart LR
  S["object sherlock"] -->|"address"| ADDR["address object"]
  J["object john"] -->|"address"| ADDR
```

Consequences worth predicting before running anything: assigning an object property copies the _reference_, so mutating through either name is visible through both; reading a property that does not exist yields `undefined`, which is indistinguishable from a property whose value is `undefined` unless you test with `in` or `Object.hasOwn` (`[[HasProperty]]` §10.1.7, HasProperty §7.3.11, HasOwnProperty §7.3.12); and assignment to a property that exists only on the prototype behaves differently from reading it ([module 04 §2.2](04-objects-prototypes-classes.md#22-set-1019-ordinaryset-and-the-override-mistake)).

### Model 4: nothing is destroyed, only unreachable

There is no `delete` of values, no "the object disappears". An object lives as long as something reachable points at it; the engine reclaims it when no execution context, binding, property or internal slot reaches it any more (reachability is the specification's observable requirement; the generational collector is V8's implementation, [module 12](12-engine-internals-v8.md)). This is why a stale closure keeps a whole tree alive ([module 03 §4](03-execution-contexts-scope-closures.md#4-closures)) and why `delete obj.x` removes a _property_, never a value that something else still points at.

### Where each model is proved

| Model | Formal treatment | Executable proof |
| --- | --- | --- |
| Binding as a wire | [03 §2 Environment Records](03-execution-contexts-scope-closures.md#2-environment-records), §6.2.5 Reference Records in [01 §3.4](01-reading-the-spec.md#34-reference-records-625) | [`exercises/01-values-and-wires.test.mjs`](../exercises/01-values-and-wires.test.mjs) |
| Primitive vs identity | §1 below, §6.1 | [`exercises/02-primitive-values.test.mjs`](../exercises/02-primitive-values.test.mjs) |
| Objects & functions as values | [04 §1](04-objects-prototypes-classes.md#1-properties-and-descriptors), [03 §5](03-execution-contexts-scope-closures.md#5-this) | [`exercises/03-objects-and-functions.test.mjs`](../exercises/03-objects-and-functions.test.mjs) |
| Sameness algorithms | §7 below, §7.2 | [`exercises/04-equality.test.mjs`](../exercises/04-equality.test.mjs) |
| Property points at a value | [04 §1–§2](04-objects-prototypes-classes.md#1-properties-and-descriptors) | [`exercises/05-properties.test.mjs`](../exercises/05-properties.test.mjs) |
| Mutating shared objects | [04 §2.2](04-objects-prototypes-classes.md#22-set-1019-ordinaryset-and-the-override-mistake) | [`exercises/06-mutation.test.mjs`](../exercises/06-mutation.test.mjs) |
| Prototype delegation | [04 §3](04-objects-prototypes-classes.md#3-prototypes) | [`exercises/07-prototypes.test.mjs`](../exercises/07-prototypes.test.mjs) |
| Reachability, not deletion | [03 §4](03-execution-contexts-scope-closures.md#4-closures), [12 §GC](12-engine-internals-v8.md) | `--expose-gc` + `WeakRef` in [03's suite](../examples/03-execution-contexts-scope-closures.test.js) |

### Predict, then run

Use this protocol on every snippet in this track, and on real code before you debug it:

1. **Commit to an answer.** Say or write the exact value of every variable on the left-hand side. A prediction you did not commit to teaches nothing, because hindsight will accept either answer.
2. **Run it.** `node -e '…'` or the exercise suite. The run costs a second; the disagreement is the whole value.
3. **Reconcile the surprise.** Name which of the four models was wrong, not merely what the right answer was, then find the specification operation that decides it. A surprise you cannot attribute to a model is a gap, not a fix.

The suites in [`exercises/`](../exercises/) are built as prediction targets: each test title states the prediction, and several assert against the answer the wrong model would have produced.

---

## 1. The eight language types

**Definition (§6.1).** An _ECMAScript language value_ is a value whose type is one of: **Undefined, Null, Boolean, String, Symbol, Number, BigInt, Object**. The first seven are _primitive_ types; their values are immutable and have no identity beyond their content. An Object is a collection of properties with identity.

| Type | Values | `typeof` | Notes |
| --- | --- | --- | --- |
| Undefined | `undefined` | `"undefined"` | Default for missing things. `undefined` is a non-writable property of the global object, not a keyword |
| Null | `null` | **`"object"`** | Historic bug from the first implementation (type tag 0 shared with objects); kept for web compatibility |
| Boolean | `true`, `false` | `"boolean"` |  |
| String | finite sequences of 16-bit unsigned integers (UTF-16 code units), length ≤ 2⁵³ − 1 | `"string"` | Engines impose lower limits (V8: 2²⁹ − 24) |
| Symbol | unique, non-String property keys | `"symbol"` | Optional `[[Description]]` |
| Number | IEEE 754-2019 binary64 values, including ±0, ±∞ and NaN | `"number"` |  |
| BigInt | arbitrary-precision integers | `"bigint"` | ES2020 |
| Object | collections of properties | `"object"` or **`"function"`** | `"function"` iff the object has a `[[Call]]` internal method |

`typeof` (§13.5.3) is a table lookup on the type, with two special cases: callables report `"function"`, and objects with the Annex B `[[IsHTMLDDA]]` slot (only `document.all` in browsers) report `"undefined"`. There is no reliable `typeof` test for "array" (use `Array.isArray`, which sees through Proxies) or for "null" (use `=== null`).

> **A common miscount.** Beginner texts sometimes say "nine types" by listing functions separately. The specification has **eight** language types; a function is an Object with a `[[Call]]` internal method, and `typeof` is what reports `"function"`. Counting `typeof` results gives eight labels (`"undefined"`, `"object"`, `"function"`, `"boolean"`, `"number"`, `"bigint"`, `"string"`, `"symbol"`), not nine types.

### Primitives behave like values, wrappers behave like objects

Accessing a property on a primitive (`"abc".length`, `(1).toFixed(2)`) runs `ToObject` (§7.1.18) to create a temporary wrapper (`String`, `Number`, ...) whose prototype provides the methods. The wrapper is not observable unless you create it explicitly:

```js
const s = 'abc';
s.custom = 1; // sloppy: ignores write to primitive receiver (§10.1.9.2); strict: TypeError (§6.2.5.6 PutValue)
typeof new String('a'); // 'object'
new Boolean(false) ? 'truthy' : 'falsy'; // 'truthy': every object is truthy
```

Never construct wrappers with `new`. Calling them as functions (`String(x)`, `Number(x)`, `Boolean(x)`, `BigInt(x)`) is the idiomatic explicit conversion.

---

## 2. Number: IEEE 754 binary64

**Definition (§6.1.6.1).** The Number type has exactly 2⁶⁴ − 2⁵³ + 3 values: the double-precision 64-bit format IEEE 754-2019 values, except that the 2⁵³ − 2 distinct NaN bit patterns are represented as a **single** NaN value, plus the two infinities and the two zeros.

Layout of a binary64 value:

| Field        | Bits | Meaning                                                      |
| ------------ | ---- | ------------------------------------------------------------ |
| sign _s_     | 1    |                                                              |
| exponent _e_ | 11   | biased by 1023; all ones = ∞/NaN; all zeros = subnormal/zero |
| fraction _f_ | 52   | 53 bits of precision with the implicit leading 1             |

For normal numbers the value is $(-1)^s \times 1.f \times 2^{e-1023}$.

Consequences:

| Fact | Value | Why |
| --- | --- | --- |
| Largest integer _n_ such that all integers in [−n, n] are exact | `Number.MAX_SAFE_INTEGER` = 2⁵³ − 1 = 9007199254740991 | 53 bits of significand |
| `2 ** 53 + 1 === 2 ** 53` | `true` | 2⁵³ + 1 is not representable; round-to-nearest-even |
| `0.1 + 0.2 === 0.3` | `false` (`0.30000000000000004`) | 0.1, 0.2, 0.3 are not representable in binary; each literal is rounded, then the sum is rounded |
| `Number.EPSILON` | 2⁻⁵² | Gap between 1 and the next double; useless as a universal tolerance for large magnitudes |
| `Number.MIN_VALUE` | 5e-324 | Smallest positive _subnormal_ |
| `1 / 0`, `-1 / 0` | `Infinity`, `-Infinity` | IEEE semantics; no exception |
| `0 / 0`, `Infinity - Infinity` | `NaN` |  |

### NaN and the two zeros

- `NaN` is the only value not equal to itself under `===` and `==`. Use `Number.isNaN(x)` (no coercion) or `Object.is(x, NaN)`. The global `isNaN` coerces first (`isNaN('abc')` is `true`), which is almost never what you want.
- `+0 === -0` is `true`, but they are distinguishable: `1 / -0 === -Infinity`, `Object.is(0, -0) === false`, `Math.sign(-0)` is `-0`. `-0` arises from `-1 * 0`, `Math.round(-0.4)`, `-x` when `x` is 0. `String(-0)` and `JSON.stringify(-0)` both give `"0"`, so a round-trip through text loses the sign.

### Number to string: shortest round-trip

`Number::toString` (§6.1.6.1.20) produces the **shortest** decimal string that converts back to the same Number. This is why `0.1` prints as `0.1` although the stored double is 0.1000000000000000055511151231257827.... The property "for every finite double _x_, `Number(String(x)) === x`" holds and is checked by a fast-check property in the example file.

### Then vs now: float summation

| Then (any version) | Now (ES2026) |
| --- | --- |
| `xs.reduce((a, b) => a + b, 0)`: error grows with _n_ and with cancellation | `Math.sumPrecise(xs)` (§21.3.2.34) returns the correctly rounded sum of the _exact_ mathematical values |
| Hand-written Kahan/Neumaier summation | Keep it as a fallback: **Node 26.12.1 does not ship `Math.sumPrecise` without `--js-sum-precise`** |

`Math.sumPrecise` accepts an iterable of Numbers, throws `TypeError` on non-Numbers (no coercion), returns `-0` for an empty iterable, and propagates NaN and infinities.

Neumaier's compensated summation, the portable fallback, in CLRS-style pseudocode:

```
NEUMAIER-SUM(A[1..n])
1  s ← 0;  c ← 0                     ▷ s: running sum, c: running compensation
2  for i ← 1 to n
3      t ← s + A[i]                   ▷ rounded
4      if |s| ≥ |A[i]|
5          c ← c + ((s − t) + A[i])   ▷ low-order bits of A[i] lost in t
6      else
7          c ← c + ((A[i] − t) + s)   ▷ low-order bits of s lost in t
8      s ← t
9  return s + c
```

**Loop invariant.** At the start of iteration _i_, s + c approximates the exact sum Σ₁^{i−1} A[k] with error bounded by O(ε)·Σ|A[k]| independent of _i_ (to first order), where ε = 2⁻⁵³; whereas naive summation has an error bound of O(nε)·Σ|A[k]|. **Termination:** the loop runs exactly _n_ times. The fallback is still not _exactly_ rounded like `Math.sumPrecise`; the example test shows a case where naive summation returns 0, Neumaier returns the right answer, and `Math.sumPrecise` (under the flag) agrees.

---

## 3. BigInt

**Definition (§6.1.6.2).** The BigInt type represents mathematical integers of arbitrary magnitude. Literals end in `n` (`10n`, `0x1fn`).

Rules that matter:

1. **No implicit mixing in arithmetic.** `1n + 1` throws `TypeError` ("Cannot mix BigInt and other types"). Convert explicitly: `BigInt(1)`, `Number(1n)`. The committee chose this because any implicit choice silently loses precision either way.
2. **Comparisons across types are allowed and exact.** `1n < 2` is `true`; `2n == 2` is `true`; `2n === 2` is `false` (different types).
3. **Unary `+` throws** (`+1n`), because asm.js relies on `+x` always producing a Number. Unary `-` works.
4. **Division truncates** toward zero: `7n / 2n === 3n`, `-7n / 2n === -3n`.
5. **No `>>>`** (unsigned shift has no meaning for unbounded integers): `TypeError`.
6. `BigInt(1.5)` throws `RangeError` (not an integer); `BigInt('0x10')` is `16n`; `BigInt('1.0')` throws `SyntaxError`.
7. `JSON.stringify({ n: 1n })` throws `TypeError` unless you define `BigInt.prototype.toJSON` or use a replacer. [Module 13](13-correctness-security-pitfalls.md) shows lossless JSON with `JSON.rawJSON`.
8. `BigInt.asIntN(64, x)` / `asUintN(64, x)` wrap to fixed widths (interop with `BigInt64Array`, database IDs).

BigInt is slower than Number for small values (heap-allocated in V8). Use it for identifiers above 2⁵³, cryptography-adjacent arithmetic, and exact money in minor units when amounts may exceed 2⁵³.

---

## 4. String: sequences of UTF-16 code units

**Definition (§6.1.4).** A String value is a finite ordered sequence of zero or more 16-bit unsigned integer values ("elements" or **code units**). ECMAScript does not require them to be valid UTF-16; where an operation interprets them as text, it treats them as UTF-16.

| Operation                                            | Unit                                   |
| ---------------------------------------------------- | -------------------------------------- |
| `.length`, `[i]`, `charCodeAt`, `slice`              | code units                             |
| `for...of`, `[...s]`, `Array.from(s)`, `codePointAt` | code points (surrogate pairs combined) |
| `Intl.Segmenter` with `granularity: 'grapheme'`      | user-perceived characters              |

```js
const s = '👍🏽'; // U+1F44D U+1F3FD
s.length; // 4 code units
[...s].length; // 2 code points
[...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length; // 1 grapheme
```

A **lone surrogate** (a high surrogate not followed by a low one, or vice versa) makes a string _ill-formed_. `encodeURIComponent` throws `URIError` on it; `TextEncoder` replaces it with U+FFFD. ES2024 added `String.prototype.isWellFormed()` and `toWellFormed()`. Truncating with `slice(0, n)` can cut a pair in half: a classic bug in "show the first 100 characters".

String comparison with `<` compares **code unit by code unit** (§7.2.12 IsLessThan), not by locale or code point: `'Z' < 'a'` is `true`, and `'～' > '\u{1F600}'` is `true` although U+1F600 is the larger code point. Use `localeCompare` or `Intl.Collator` for human ordering.

---

## 5. Symbol and the well-known symbols

**Definition (§6.1.5).** A Symbol value is a unique, non-String value usable as a property key. `Symbol('x') !== Symbol('x')`. `Symbol.for('x')` returns the symbol registered under `'x'` in the **GlobalSymbolRegistry**, which is shared by all realms, so `Symbol.for('x') === Symbol.for('x')` even across iframes.

Symbols are not private: `Object.getOwnPropertySymbols` and `Reflect.ownKeys` list them. They avoid _collisions_, not access. For privacy, use `#private` fields ([module 04](04-objects-prototypes-classes.md)).

**Well-known symbols (§6.1.5.1)** are the protocol hooks of the language:

| Symbol | Consulted by | Module |
| --- | --- | --- |
| `Symbol.toPrimitive` | ToPrimitive | this module |
| `Symbol.iterator`, `Symbol.asyncIterator` | `for...of`, spread, destructuring, `for await` | [05](05-iterators-generators.md) |
| `Symbol.hasInstance` | `instanceof` | [04](04-objects-prototypes-classes.md) |
| `Symbol.toStringTag` | `Object.prototype.toString` | [04](04-objects-prototypes-classes.md) |
| `Symbol.species` | derived object creation in `map`, `then`, ... | [09](09-metaprogramming.md) |
| `Symbol.isConcatSpreadable` | `Array.prototype.concat` |  |
| `Symbol.match`, `matchAll`, `replace`, `search`, `split` | String methods delegating to RegExp-like objects |  |
| `Symbol.unscopables` | `with` statement |  |
| `Symbol.dispose`, `Symbol.asyncDispose` (ES2027 draft) | `using`, `await using` | [10](10-resource-management-temporal.md) |

---

## 6. Conversions: the abstract operations

### 6.1 ToPrimitive (§7.1.1)

```mermaid
flowchart TD
  A["ToPrimitive(input, preferredType?)"] --> B{input is an Object?}
  B -- no --> R1[return input]
  B -- yes --> C["exoticToPrim = ? GetMethod(input, @@toPrimitive)"]
  C --> D{exoticToPrim defined?}
  D -- yes --> E["hint = 'default' | 'string' | 'number'<br/>result = ? Call(exoticToPrim, input, « hint »)"]
  E --> F{result is an Object?}
  F -- yes --> T1[throw TypeError]
  F -- no --> R2[return result]
  D -- no --> G["preferredType absent → number"]
  G --> H["OrdinaryToPrimitive(input, preferredType)"]
  H --> I{"hint string?"}
  I -- yes --> J["try toString(), then valueOf()"]
  I -- no --> K["try valueOf(), then toString()"]
  J --> L{first primitive result?}
  K --> L
  L -- found --> R3[return it]
  L -- none --> T2[throw TypeError]
```

Which hint each operator uses:

| Context | Hint | Example |
| --- | --- | --- |
| Binary `+`, `==` against a primitive | `"default"` | `obj + ''`, `obj == 1` |
| Arithmetic (`-`, `*`, `/`, `%`, `**`, unary `+`, `-`), relational (`<`, `>=`), `Number(x)` | `"number"` | `obj * 2` |
| Template literals, `String(x)`, property keys, `${}` | `"string"` | `` `${obj}` `` |

`Date` is the one built-in whose `@@toPrimitive` treats `"default"` as `"string"`, so `date + 1` concatenates while `date - 1` subtracts. `Symbol.prototype[@@toPrimitive]` returns the symbol itself, so `` `${sym}` `` throws `TypeError` (ToString of a Symbol throws) whereas `String(sym)` works (the `String` function special-cases symbols).

### 6.2 ToBoolean (§7.1.2)

ToBoolean never calls user code. The **falsy** values are exactly:

`false`, `+0`, `-0`, `0n`, `NaN`, `""`, `null`, `undefined`, and objects with `[[IsHTMLDDA]]` (`document.all`).

Everything else is truthy, including `"0"`, `"false"`, `[]`, `{}`, `new Boolean(false)`, and `-1n`.

### 6.3 ToNumber (§7.1.4) and ToNumeric (§7.1.3)

| Argument | Result |
| --- | --- |
| `undefined` | `NaN` |
| `null` | `+0` |
| `true` / `false` | `1` / `+0` |
| String | `StringToNumber`: trim whitespace and line terminators; empty → `0`; `"0x1F"`, `"0o17"`, `"0b11"` accepted; `"Infinity"` accepted; `"1_000"` → `NaN` (separators are only for literals); `"12px"` → `NaN` |
| Symbol | throws `TypeError` |
| BigInt | throws `TypeError` (use `Number(big)`, which special-cases BigInt) |
| Object | `ToNumber(? ToPrimitive(arg, number))` |

`ToNumeric` returns BigInt unchanged, otherwise ToNumber. Arithmetic operators call ToNumeric on both sides and then require both results to have the _same_ type.

`parseInt`/`parseFloat` are _not_ ToNumber: they parse a prefix and ignore the rest. `parseInt('12px')` is 12, `parseInt('')` is NaN, and `parseInt(0.0000005)` is **5**, because the argument is first converted to the string `"5e-7"`. Always pass the radix: `parseInt(s, 10)`. Prefer `Number(s)` plus `Number.isFinite` for validation.

### 6.4 ToString (§7.1.17)

| Argument | Result |
| --- | --- |
| `undefined`, `null`, booleans | `"undefined"`, `"null"`, `"true"`/`"false"` |
| Number | `Number::toString`: `-0` → `"0"`, `1e21` → `"1e+21"`, `NaN` → `"NaN"` |
| BigInt | decimal digits, no `n` |
| Symbol | throws `TypeError` |
| Object | `ToString(? ToPrimitive(arg, string))`; arrays join with `,` (`[1,[2,3]]` → `"1,2,3"`, `[null]` → `""`) |

### 6.5 ToPropertyKey (§7.1.19)

`ToPrimitive(arg, string)`, then Symbol stays Symbol, everything else becomes a String. So `obj[1]` and `obj['1']` are the same property, `obj[{}]` is `obj['[object Object]']` (a classic cache-collision bug), and array indices are strings that happen to be canonical numeric strings ([module 04](04-objects-prototypes-classes.md)).

### 6.6 ToIntegerOrInfinity (§7.1.5) and ToInt32 (§7.1.6)

- `ToIntegerOrInfinity`: NaN → 0, truncate toward zero, keep ±∞. Used for indices (`at`, `slice`, `Array(len)` uses ToUint32 with a range check instead).
- `ToInt32`: ToNumber, NaN/±∞ → 0, truncate, then **modulo 2³²** into [−2³¹, 2³¹ − 1]. Every bitwise operator (`|`, `&`, `^`, `~`, `<<`, `>>`) uses ToInt32; `>>>` uses ToUint32. Hence `x | 0` truncates only within the 32-bit range: `(2 ** 32 + 5) | 0` is `5` and `2 ** 31 | 0` is `-2147483648`. Using `| 0` for "floor" is a bug for large or negative inputs.

---

## 7. Equality: four algorithms

| Algorithm | Spec | Exposed as | NaN equals NaN? | +0 equals −0? | Coerces? |
| --- | --- | --- | --- | --- | --- |
| IsStrictlyEqual | §7.2.14 | `===`, `!==`, `indexOf`, `lastIndexOf`, `switch` | no | yes | no |
| IsLooselyEqual | §7.2.13 | `==`, `!=` | no | yes | **yes** |
| SameValue | §7.2.9 | `Object.is`, `Object.defineProperty` change detection, React's dependency comparison | **yes** | **no** | no |
| SameValueZero | §7.2.10 | `includes`, `Map`/`Set` keys, `TypedArray#includes` | **yes** | yes | no |

```js
[NaN].indexOf(NaN); // -1   (IsStrictlyEqual)
[NaN].includes(NaN); // true (SameValueZero)
new Set([0, -0]).size; // 1   (SameValueZero)
Object.is(0, -0); // false (SameValue)
```

### 7.1 IsLooselyEqual (§7.2.13)

The full algorithm, in order:

1. If `Type(x)` is `Type(y)`, return `IsStrictlyEqual(x, y)`.
2. If one is `null` and the other `undefined`, return **true**.
3. _(Annex B)_ If one is an object with `[[IsHTMLDDA]]` and the other is `null` or `undefined`, return true.
4. Number vs String: compare `x == ToNumber(y)` (or the mirror).
5. BigInt vs String: `n = StringToBigInt(string)`; if undefined (unparsable), return **false**; else compare.
6. Boolean vs anything: convert the Boolean with `ToNumber` and compare again. (So `true == '1'` → `1 == '1'` → true, and `[] == false` → `[] == 0` → `'' == 0` → `0 == 0` → true.)
7. Object vs String/Number/BigInt/Symbol: `ToPrimitive(object)` (hint default) and compare again.
8. BigInt vs Number: if either is NaN or ±∞, false; otherwise compare mathematical values (`2n == 2` true, `2n == 2.5` false).
9. Otherwise false. (In particular, `null == 0` is **false**: null and undefined are only loosely equal to each other.)

```mermaid
flowchart TD
  S["x == y"] --> A{same type?}
  A -- yes --> STRICT["x === y"]
  A -- no --> B{"null/undefined pair?"}
  B -- yes --> TRUE[true]
  B -- no --> C{"Number vs String?"}
  C -- yes --> N1["compare with ToNumber(string)"]
  C -- no --> D{"Boolean involved?"}
  D -- yes --> N2["ToNumber(boolean), compare again"]
  D -- no --> E{"Object vs primitive?"}
  E -- yes --> P["ToPrimitive(object), compare again"]
  E -- no --> F{"BigInt vs Number/String?"}
  F -- yes --> M[compare mathematical values]
  F -- no --> FALSE[false]
```

**`==` is not transitive**: `'0' == 0` and `0 == ''` but `'0' != ''`. It is also not an equivalence relation on NaN. The example file contains this counterexample and a property test proving SameValue _is_ an equivalence relation.

The one idiom that survives code review: `x == null` to test "null or undefined" in one comparison. Everywhere else, use `===`.

### 7.2 Relational comparison: IsLessThan (§7.2.12)

`a < b` calls `ToPrimitive` with hint number on both. If both are Strings, compare code units lexicographically. Otherwise convert to numeric (BigInt and Number compare mathematically; a String compared to a BigInt is parsed with StringToBigInt). Any NaN makes the result _undefined_, which the operators turn into `false`. `a <= b` is defined as `!(b < a)` with the undefined case mapped to false, which yields:

```js
null >= 0; // true  (ToNumber(null) is 0, and !(0 < 0))
null == 0; // false (null is only == undefined)
null > 0; // false
NaN <= NaN; // false
```

---

## 8. The binary `+` operator

`ApplyStringOrNumericBinaryOperator` (§13.15.3) for `+`:

1. `lprim = ? ToPrimitive(lval)`, `rprim = ? ToPrimitive(rval)` (default hint, **left first**).
2. If either is a String: `ToString(lprim) + ToString(rprim)`.
3. Else `ToNumeric` both; if the types differ (Number vs BigInt), throw `TypeError`; else add.

```js
1 + '2'; // '12'
'3' - 1; // 2      (- is numeric only)
1 + null; // 1
1 + undefined; // NaN
[1, 2] + [3]; // '1,23'
true + true; // 2
1n + 2n; // 3n
1 + 2 + '3'; // '33'  (left-associative: (1 + 2) + '3')
'1' + 2 + 3; // '123'
```

---

## 9. Explicit conversion: the idioms

| Goal | Write | Avoid | Reason |
| --- | --- | --- | --- |
| to Number, strict | `Number(s)` and check `Number.isFinite` | `+s`, `parseFloat(s)` | `parseFloat` accepts garbage suffixes; `+` fails on BigInt with a TypeError |
| to integer from user input | `Number.parseInt(s, 10)` then range-check | `~~s`, `s \| 0` | 32-bit truncation |
| to String | `String(x)` | `x + ''` | `x + ''` throws for Symbols and runs `valueOf` first |
| to Boolean | `Boolean(x)` or `!!x` |  |  |
| NaN check | `Number.isNaN(x)` | `isNaN(x)`, `x !== x` | global `isNaN` coerces; `x !== x` is correct but obscure |
| integer check | `Number.isSafeInteger(x)` | `Number.isInteger(x)` alone | `Number.isInteger(2 ** 60)` is true but imprecise |
| equality including NaN | `Object.is(a, b)` |  |  |

### Then vs now

| Then | Now | Changed in |
| --- | --- | --- |
| `isNaN(x)`, `isFinite(x)` (coercing globals) | `Number.isNaN`, `Number.isFinite` | ES2015 |
| `x !== x` for NaN, `1/x === -Infinity` for −0 | `Object.is` | ES2015 |
| Integers above 2⁵³ as strings or libraries (bignumber.js) | `BigInt` | ES2020 |
| Money as floating point dollars | integer minor units (Number up to 2⁵³ − 1, BigInt beyond), or a decimal library; _Decimal_ is only a Stage 1 proposal | — |
| Hand-written compensated summation | `Math.sumPrecise` | ES2026 (flagged in Node 26) |
| Numeric separators unavailable | `1_000_000` in literals (not in `Number('1_000')`) | ES2021 |

---

## 10. Production failure modes

| Failure | Mechanism | Defence (and test) |
| --- | --- | --- |
| Totals drift by a cent | float addition of decimal fractions | integer minor units; `Math.sumPrecise` where available |
| IDs from an API change after `JSON.parse` | IDs > 2⁵³ lose precision as Numbers | reviver with `context.source` + BigInt ([module 13](13-correctness-security-pitfalls.md)) |
| `if (count)` skips the zero case | 0 is falsy | `if (count !== undefined)` or `count ?? default` |
| `value \|\| default` overwrites a legitimate `''`, `0` or `false` | `\|\|` tests truthiness | `??` (nullish coalescing, ES2020) |
| Cache keyed by objects collapses to one entry | `obj[{}]` uses `ToPropertyKey`, giving `'[object Object]'` | `Map` with object keys |
| `x \| 0` wraps large timestamps negative | ToInt32 modulo 2³² | `Math.trunc` |
| Sorting numbers gives `[1, 10, 2]` | default comparator compares `ToString` values | `(a, b) => a - b` ([module 13](13-correctness-security-pitfalls.md)) |
| `JSON.stringify` silently turns `NaN`/`Infinity` into `null` and drops `undefined` | JSON has no such values | validate before serialising |
| Template string with a Symbol crashes logging | ToString(Symbol) throws | `String(sym)` or `sym.description` |

---

## Interview Drill

<details><summary>1. List the falsy values.</summary>

`false`, `0`, `-0`, `0n`, `NaN`, `""`, `null`, `undefined`, plus objects with the `[[IsHTMLDDA]]` slot (`document.all`). Everything else, including `[]`, `{}`, `"0"` and `new Boolean(false)`, is truthy.
</details>

<details><summary>2. Why is `typeof null === "object"`?</summary>

In the first implementation, values carried a type tag and objects had tag 0; `null` was the null pointer, which also had tag 0. The bug was preserved for web compatibility; an ES Harmony-era proposal to change it to `"null"` was rejected because it broke existing code.
</details>

<details><summary>3. Walk through `[] == ![]`.</summary>

`![]` is `false` (objects are truthy). `[] == false`: Boolean operand → ToNumber(false) = 0, so `[] == 0`. Object vs Number → ToPrimitive([]) = "" so `"" == 0`. String vs Number → ToNumber("") = 0, so `0 == 0` is true.
</details>

<details><summary>4. What is the difference between `===`, `Object.is` and SameValueZero? Where is each used?</summary>

`===` (IsStrictlyEqual) treats NaN as unequal to itself and +0 equal to −0; used by `indexOf` and `switch`. `Object.is` (SameValue) treats NaN equal to NaN and +0 different from −0; used for property-redefinition checks and by React for state comparison. SameValueZero treats NaN equal and ±0 equal; used by `includes`, `Map`, `Set`.
</details>

<details><summary>5. Why does `0.1 + 0.2 !== 0.3`, and what do you do about money?</summary>

0.1, 0.2 and 0.3 are not representable in binary64; each literal is rounded to the nearest double, and the sum is rounded again, giving 0.30000000000000004. For money, store integer minor units (cents) as Number while below 2⁵³, BigInt beyond, or use a decimal library; format with `Intl.NumberFormat`. For summing many floats, use `Math.sumPrecise` where shipped or compensated summation.
</details>

<details><summary>6. Why does `1n + 1` throw but `1n < 2` works?</summary>

Arithmetic requires both ToNumeric results to be the same numeric type, because any implicit conversion could lose precision (BigInt → Number loses magnitude bits, Number → BigInt loses fractions). Comparison can be decided exactly on mathematical values, so it is permitted across types.
</details>

<details><summary>7. What does `parseInt(0.0000005)` return and why?</summary>

5. `parseInt` converts its argument to a String first; ToString(5e-7) is "5e-7", and parseInt reads the leading digits "5" and stops at "e".

</details>

<details><summary>8. How do you make an object that adds as a number but prints as a string?</summary>

Implement `[Symbol.toPrimitive](hint)` returning a Number for hints "number" and "default", and a String for "string". `+obj` and `obj * 2` use the number hint, template literals use the string hint, and `obj + ''` uses default.
</details>

<details><summary>9. Why is `'abc'.length` 3 but `'😀'.length` 2?</summary>

String length counts UTF-16 code units. U+1F600 is outside the Basic Multilingual Plane and is encoded as a surrogate pair (two code units). Iteration (`for...of`, spread) works by code points; `Intl.Segmenter` gives graphemes.
</details>

<details><summary>10. Is `==` transitive? Prove it.</summary>

No: `'0' == 0` (ToNumber('0') = 0) and `0 == ''` (ToNumber('') = 0), but `'0' == ''` compares two Strings without conversion and is false.
</details>
