# Study path: Just JavaScript → this track

Dan Abramov's _Just JavaScript_ (illustrated by Maggie Appleton, <https://justjavascript.com>) teaches the same language this track specifies, in a different register: it builds four mental models with drawings and prediction exercises, and it deliberately stops short of the specification. This page maps its ten episodes onto the modules, records where the book simplifies the language, and says what this track adds that the book does not.

Read this page when you are learning the language for the first time, or when a prediction you were confident about turned out wrong. Read the modules when you need the normative answer.

> **Status of the mapping (2026-11-05).** Episode texts were read from the public lesson pages. The eight episodes' interactive quizzes are rendered client-side and were not captured, so quiz items are marked _unknown_ here rather than guessed. The book's chapters on `Object`s, prototype chains and equality, which the free lessons sketch, are covered by the modules cited below.

## Episode map

| Episode | What it teaches | Where this track teaches it | Verdict |
| --- | --- | --- | --- |
| 01 Mental models | Introspection: the internal model that runs while you read code, and how a wrong one survives for years | [module 02 §0](modules/02-types-values-coercion.md#0-mental-models-values-wires-and-properties) | **added here**: the track was written for readers who already predict correctly |
| 02 The JavaScript universe | Values versus code; primitive values versus objects and functions; `typeof` | [module 02 §1](modules/02-types-values-coercion.md#1-the-eight-language-types), [module 04](modules/04-objects-prototypes-classes.md#1-properties-and-descriptors) | covered, more precisely |
| 03 Values and variables | Primitive values are immutable; a variable is a wire, not a box; the rules of assignment | [module 03 §2](modules/03-execution-contexts-scope-closures.md#2-environment-records), [module 02 §0](modules/02-types-values-coercion.md#0-mental-models-values-wires-and-properties) | covered; the wire framing is now stated explicitly |
| 04 Studying from the inside | Predict before running; reconcile the surprise | [module 02 §0 Predict, then run](modules/02-types-values-coercion.md#predict-then-run) and [`exercises/`](exercises/README.md) | **added here**: there was no prediction target, only assertions that already pass |
| 05 Meeting the primitive values | `undefined`, `null`, booleans, numbers and their special values, BigInt, strings, symbols | [module 02 §1–§5](modules/02-types-values-coercion.md#2-number-ieee-754-binary64), [NaN and the two zeros](modules/02-types-values-coercion.md#nan-and-the-two-zeros), [module 11](modules/11-binary-data-memory-model.md) | covered; the book's "primitives have no properties" is the one line to unlearn (see below) |
| 06 Meeting objects and functions | Objects as collections of properties; functions as values you can call | [module 04 §1–§4](modules/04-objects-prototypes-classes.md#1-properties-and-descriptors), [module 03 §5 `this`](modules/03-execution-contexts-scope-closures.md#5-this) | covered |
| 07 Equality of values | Same-value equality (`Object.is`), strict equality, `NaN`, `-0`, loose equality | [module 02 §7](modules/02-types-values-coercion.md#7-equality-four-algorithms) | covered, and the book omits SameValueZero, which `Map`, `Set`, and `includes` use (unlike `indexOf`, which uses `IsStrictlyEqual` / `===`) |
| 08 Properties | Reading properties, missing properties, property names, assignment | [module 04 §1–§2](modules/04-objects-prototypes-classes.md#2-the-essential-internal-methods), [`exercises/05-properties`](exercises/05-properties.test.mjs) | covered after this pass: `in` versus `undefined`, `delete` and `?.` were only implied before |
| 09 Mutation | Mutating shared objects, `let` versus `const`, whether mutation is bad | [module 04 §2.2](modules/04-objects-prototypes-classes.md#22-set-1019-ordinaryset-and-the-override-mistake), [module 13 §1](modules/13-correctness-security-pitfalls.md#1-prototype-pollution), [`exercises/06-mutation`](exercises/06-mutation.test.mjs) | covered; "`const` does not freeze" is now stated in the [cheatsheet](CHEATSHEET.md#objects-04) |
| 10 Prototypes | The prototype chain, shadowing, assignment through the chain, `Object.prototype`, `__proto__` versus `prototype`, pollution | [module 04 §3](modules/04-objects-prototypes-classes.md#3-prototypes), [module 09](modules/09-metaprogramming.md), [module 13 §1](modules/13-correctness-security-pitfalls.md#1-prototype-pollution) | covered; the book stops at "do not pollute", the track gives the mitigations |

## Where the book simplifies, and what the specification says

The book is a teaching text and simplifies on purpose. Use the right-hand column when you need the answer a reviewer or an engine will hold you to.

| Book phrasing | The specification | Use it when |
| --- | --- | --- |
| "A variable is a wire" | An identifier resolves through an Environment Record to a _binding_; the thing on the left of `=` is a Reference Record (ECMA-262 §9.1.1, §6.2.5). The wire picture predicts behaviour correctly and is not the mechanism | always, for prediction; §9.1.1 when you are reading the spec or writing a linter |
| "Primitive values have no properties" | Property access on a primitive runs ToObject first (§7.1.18), producing a temporary wrapper object (such as a String exotic object, §10.4.3, §22.1) whose prototype provides methods | when explaining `"abc".length`, `new String('abc')`, or why `Object.assign` on a primitive "works" |
| "Objects don't disappear" | An object stays alive while it is reachable; nothing in the language guarantees _when_ memory is reclaimed (§§ on memory; V8's collector is an implementation, [module 12](modules/12-engine-internals-v8.md)) | with `WeakRef`, `FinalizationRegistry` and leak investigations |
| "`Object.is(a, b)` is the real equality" | `Object.is` is SameValue (§7.2.9); `===` is IsStrictlyEqual (§7.2.14); `includes`, `Set` and `Map` keys use SameValueZero (§7.2.10), which differs from both on `NaN` and `±0` | choosing a comparison in library code |
| "`NaN` is not equal to itself" | True for `===` and `Object.is(NaN, NaN)` is instead `true`; `-0` and `+0` are `===` but not SameValue | any deduplication, cache key or assertion |
| "`__proto__` is how you set the prototype" | `__proto__` is the §20.1.3.8 legacy accessor on `Object.prototype` (and Annex B.3.1 in object initializers); standard operations are `Object.create`, `Object.getPrototypeOf`, `Object.setPrototypeOf` and `Reflect.*` | code that must not depend on browser legacy |
| "Do not mutate prototypes" | Correct advice; the mitigations are `Object.hasOwn`, null-prototype dictionaries, schema validation at the boundary and (optionally) a frozen `Object.prototype` — [module 13 §1](modules/13-correctness-security-pitfalls.md#1-prototype-pollution) | reviewing a merge or a config loader |

Two conventions the book teaches that the track only mentions in passing, because neither is enforced by the language: `null` as "intentionally empty" versus `undefined` as "not provided", and preferring immutable updates. Both are team conventions. The language allows every alternative, so pick one per repository and enforce it with lint rules, not with comments.

## What this track deliberately does not take from the book

- **Drawing as the only check.** The drawings here are a first step; every claim ends in an executable assertion, because a picture cannot fail.
- **Quiz format without a runner.** The book's multiple-choice checks cannot distinguish "I guessed" from "I know". The suites in [`exercises/`](exercises/README.md) re-run any time, and their titles state the prediction so a guess is visible.
- **"Every conceivable string already exists."** Strings are sequences of UTF-16 code units (§6.1.4); the poetic framing hides surrogate pairs, which [module 02 §4](modules/02-types-values-coercion.md#4-string-sequences-of-utf-16-code-units) covers.
- **BigInt and Symbol as trivia.** Both get normative treatment in [module 02 §3](modules/02-types-values-coercion.md#3-bigint) and [§5](modules/02-types-values-coercion.md#5-symbol-and-the-well-known-symbols) because the failure modes (mixing with Number, symbol keys that vanish under `JSON.stringify`) are production bugs.

## How to use the two together

1. Read the episode, then [module 02 §0](modules/02-types-values-coercion.md#0-mental-models-values-wires-and-properties).
2. Run the matching exercise suite **before** reading the module: `mise exec -- npm run exercises`. Write each prediction down; the failure message is the lesson.
3. Read the module section the exercise maps to, and reconcile any surprise with a named spec operation.
4. Take the [Interview Drill](modules/02-types-values-coercion.md#interview-drill) at the end of the module; it asks the questions an interviewer asks about exactly these models.
5. When the models hold, move to [modules 05–13](README.md#syllabus), where the book stops.

## Sources

- Just JavaScript, episodes 01–10: <https://justjavascript.com/learn/01-mental-models> (and the sibling URLs).
- ECMA-262 17th edition (ES2026): <https://262.ecma-international.org/17.0/>. Section numbers verified against the 17.0 table of contents on 2026-11-05: §6.2.5 Reference Records, §7.1.18 ToObject, §7.2.9 SameValue, §7.2.10 SameValueZero, §7.2.14 IsStrictlyEqual, §7.3.11 HasProperty, §7.3.12 HasOwnProperty, §9.1.1 Environment Records, §10.1.7 `[[HasProperty]]`, §10.1.8 `[[Get]]`, §10.1.9 `[[Set]]`, §10.4.3 String Exotic Objects, §14.3.1 Let and Const Declarations, §20.1.2.2 `Object.create`, §20.1.3.8 `Object.prototype.__proto__`, §22.1 String Objects, Annex B.3.1 `__proto__` in Object Initializers.
- Johnson-Laird, P. N., _Mental Models_ (1983); Kahneman, D., _Thinking, Fast and Slow_ (2011) — the two modes of judgement the first episode borrows.
