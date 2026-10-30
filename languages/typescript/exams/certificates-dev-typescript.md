# Question Bank: certificates.dev TypeScript Certification (Mid-Level & Senior)

Original practice questions written from the public topic list (<https://certificates.dev/typescript>, checked 2026-10-29) and the TypeScript documentation. Domain weights are not published, so domains are weighted equally. Difficulty: 1 (recall) · 2 (applied) · 3 (harder than the exam). Answers assume TypeScript 7.0 with `strict` unless a question names another version; see the exam delta in [README.md](./README.md).

Contents: [Mid-Level](#mid-level) (M-001–M-035) · [Senior](#senior) (S-001–S-035) · [Hands-on](#hands-on-challenges) (H-001–H-002) · [Mock exam](#mock-exam)

---

## Mid-Level

### Q-TSC-M-001 · Modeling states with unions and type guards · difficulty 1 · single
Which declaration makes the states "loading without data" and "success with an error" unrepresentable?
- A) `type S = { loading: boolean; data?: Data; error?: Error }`
- B) `type S = { status: "loading" } | { status: "success"; data: Data } | { status: "error"; error: Error }`
- C) `type S = Partial<{ loading: true; data: Data; error: Error }>`
- D) `interface S { status: string; data: Data | null; error: Error | null }`
<details><summary>Answer</summary>

**B.** A discriminated union lists only legal combinations; narrowing on `status` gives exactly the fields of that state.
- Why not A: any combination of the optional fields is allowed.
- Why not C: everything optional, same problem.
- Why not D: `status: string` is not a discriminant and nulls allow mixed states.
- Ref: [modules/03](../modules/03-unions-narrowing-and-control-flow.md#lesson-33-discriminated-unions--exhaustiveness-checking), https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
</details>

### Q-TSC-M-002 · Modeling states with unions and type guards · difficulty 2 · single
```ts
function label(n: number | null) { if (n) return `#${n}`; return "none"; }
```
What does `label(0)` return, and what is the fix?
- A) `"#0"`; no fix needed
- B) `"none"`; use `n !== null`
- C) A compile error, because `n` may be `0`
- D) `"none"`; use `typeof n === "object"`
<details><summary>Answer</summary>

**B.** Truthiness removes `null` but also `0`.
- Why not A: `0` is falsy.
- Why not C: truthiness checks are legal.
- Why not D: `typeof null === "object"`, so that test is true for `null`, not a fix for numbers.
- Ref: [modules/03](../modules/03-unions-narrowing-and-control-flow.md), https://www.typescriptlang.org/docs/handbook/2/narrowing.html#truthiness-narrowing
</details>

### Q-TSC-M-003 · Modeling states with unions and type guards · difficulty 2 · multi
Which of these narrow `x: string | number[]` to `number[]` in the true branch? (Select all.)
- A) `Array.isArray(x)`
- B) `typeof x === "object"`
- C) `x instanceof Array`
- D) `"length" in x`
<details><summary>Answer</summary>

**A, B, C.** `Array.isArray` is declared as a predicate; `typeof … === "object"` removes `string`; `instanceof Array` narrows to the array member.
- Why not D: `in` on a primitive-containing union is an error (`"length" in x` requires an object), and strings also have `length`.
- Ref: [modules/03](../modules/03-unions-narrowing-and-control-flow.md), https://www.typescriptlang.org/docs/handbook/2/narrowing.html
</details>

### Q-TSC-M-004 · Modeling states with unions and type guards · difficulty 2 · scenario
A reducer switches on `action.type` and has `default: { const _x: never = action; }`. A teammate adds a new action member but no case. What happens?
- A) It compiles; the new action silently falls into `default`
- B) Compile error in `default`: the new member is not assignable to `never`
- C) Runtime error only
- D) Compile error where the action union is declared
<details><summary>Answer</summary>

**B.** In `default`, the narrowed type is the union of unhandled members, which is no longer `never`.
- Why not A: that is exactly what the check prevents.
- Why not C: it fails at compile time (and may also throw if you call `assertNever`).
- Why not D: the union declaration is valid.
- Ref: [modules/03](../modules/03-unions-narrowing-and-control-flow.md), https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
</details>

### Q-TSC-M-005 · Modeling states with unions and type guards · difficulty 3 · single
```ts
type M = { kind: "n"; v: number } | { kind: "s"; v: string };
function f(m: M) { let { kind, v } = m; if (kind === "n") { const x: number = v; } }
```
Why is `const x: number = v` an error?
- A) Destructuring never narrows
- B) The destructured variables are `let`, so TypeScript does not correlate them
- C) `v` is `any`
- D) `kind` is not a literal type
<details><summary>Answer</summary>

**B.** Correlated narrowing of destructured unions (TS 4.6+) works for `const` declarations and non-reassigned parameters only.
- Why not A: with `const { kind, v } = m` it narrows.
- Why not C: `v` is `number | string`.
- Why not D: `kind` is `"n" | "s"`.
- Ref: [modules/03](../modules/03-unions-narrowing-and-control-flow.md), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-6.html
</details>

### Q-TSC-M-006 · Generics · difficulty 1 · single
What does `function first<T>(xs: T[]): T | undefined { return xs[0]; }` return for `first(["a", "b"])`?
- A) `string | undefined`
- B) `"a" | undefined`
- C) `"a" | "b" | undefined`
- D) `unknown`
<details><summary>Answer</summary>

**A.** The array literal is inferred as `string[]`, so `T` is `string`.
- Why not B, C: literals widen for an unconstrained `T` without `const`.
- Why not D: inference succeeds.
- Ref: [modules/07](../modules/07-generics-and-inference.md#how-inference-works), https://www.typescriptlang.org/docs/handbook/2/generics.html
</details>

### Q-TSC-M-007 · Generics · difficulty 2 · single
Which signature makes `pick(user, ["id", "name"])` return `{ id: …; name: … }` and reject unknown keys?
- A) `pick<T>(obj: T, keys: string[]): Partial<T>`
- B) `pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>`
- C) `pick<T, K>(obj: T, keys: K[]): T[K]`
- D) `pick(obj: object, keys: PropertyKey[]): object`
<details><summary>Answer</summary>

**B.** `K` is constrained to the keys of `T` and inferred from the array.
- Why not A: no key checking and no precise result.
- Why not C: `T[K]` requires `K extends keyof T`; it also returns a property type, not an object.
- Why not D: untyped.
- Ref: [modules/07](../modules/07-generics-and-inference.md), https://www.typescriptlang.org/docs/handbook/2/generics.html#using-type-parameters-in-generic-constraints
</details>

### Q-TSC-M-008 · Generics · difficulty 2 · single
`function machine<S extends string>(states: S[], initial: S)`; the call `machine(["idle", "busy"], "done")` compiles. Which change makes it an error?
- A) `initial: Exclude<S, never>`
- B) `initial: NoInfer<S>`
- C) `<const S extends string>`
- D) `initial: string & S`
<details><summary>Answer</summary>

**B.** `NoInfer` removes `initial` as an inference site, so `S` is inferred only from `states` and `"done"` is rejected.
- Why not A: still an inference site.
- Why not C: `const` keeps literals but `"done"` still contributes a candidate.
- Why not D: still an inference site.
- Ref: [modules/07](../modules/07-generics-and-inference.md), https://www.typescriptlang.org/docs/handbook/utility-types.html#noinfertype
</details>

### Q-TSC-M-009 · Generics · difficulty 2 · single
Which is a "useless generic" (a type parameter that adds no checking)?
- A) `function id<T>(x: T): T`
- B) `function parse<T>(json: string): T`
- C) `function map<T, U>(xs: T[], f: (x: T) => U): U[]`
- D) `function keys<T extends object>(o: T): (keyof T)[]`
<details><summary>Answer</summary>

**B.** `T` appears only in the return type: the caller picks it and nothing verifies it; it is a cast in disguise.
- Why not A, C, D: each relates at least two positions.
- Ref: [modules/07](../modules/07-generics-and-inference.md), https://www.typescriptlang.org/docs/handbook/2/functions.html#guidelines-for-writing-good-generic-functions
</details>

### Q-TSC-M-010 · Generics · difficulty 3 · single
For `function get<T, K extends keyof T>(o: T, k: K): T[K]`, what does `get<User>(user, "name")` produce?
- A) It infers `K` from `"name"`
- B) Error: expected 2 type arguments (no partial inference)
- C) `K` defaults to `keyof User`
- D) `K` becomes `never`
<details><summary>Answer</summary>

**B.** Type arguments are all-or-nothing (TS2558) unless the rest have defaults.
- Why not A: inference is disabled once you pass type arguments.
- Why not C: `K` has no default.
- Why not D: no instantiation happens.
- Ref: [modules/07](../modules/07-generics-and-inference.md#how-inference-works), https://www.typescriptlang.org/docs/handbook/2/generics.html
</details>

### Q-TSC-M-011 · Utility types and type operators · difficulty 1 · single
`const ROUTES = ["/", "/users"] as const;` Which type is `"/" | "/users"`?
- A) `typeof ROUTES`
- B) `(typeof ROUTES)[number]`
- C) `keyof typeof ROUTES`
- D) `ReturnType<typeof ROUTES>`
<details><summary>Answer</summary>

**B.** Indexing a tuple type with `number` gives the union of element types.
- Why not A: that is the readonly tuple.
- Why not C: gives index keys and array methods.
- Why not D: `ROUTES` is not a function.
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md), https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html
</details>

### Q-TSC-M-012 · Utility types and type operators · difficulty 2 · single
```ts
type E = { type: "a"; x: 1 } | { type: "b"; y: 2 };
type R = Omit<E, "x">;
```
What is `R`?
- A) `{ type: "a" } | { type: "b"; y: 2 }`
- B) `{ type: "a" | "b" }`
- C) `{ type: "a" | "b"; y: 2 }`
- D) `never`
<details><summary>Answer</summary>

**B.** `Omit` maps over `keyof E`, which for a union is only the common key `type`.
- Why not A: that needs a distributive `Omit`.
- Why not C: `y` is not a common key.
- Why not D: the result is a valid object type.
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md), https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys
</details>

### Q-TSC-M-013 · Utility types and type operators · difficulty 1 · single
Which utility type produces the resolved value type of `async function load(): Promise<User[]>`?
- A) `ReturnType<typeof load>`
- B) `Awaited<ReturnType<typeof load>>`
- C) `Parameters<typeof load>`
- D) `InstanceType<typeof load>`
<details><summary>Answer</summary>

**B.** `ReturnType` gives `Promise<User[]>`; `Awaited` unwraps it (recursively).
- Why not A: still a promise.
- Why not C: the parameter tuple.
- Why not D: for constructors.
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md), https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype
</details>

### Q-TSC-M-014 · Utility types and type operators · difficulty 2 · multi
Which statements about `keyof` are true? (Select all.)
- A) `keyof { [k: string]: unknown }` is `string | number`
- B) `keyof (A | B)` contains only keys present in both
- C) `keyof (A & B)` contains keys of either
- D) `keyof never` is `never`
<details><summary>Answer</summary>

**A, B, C.**
- Why not D: `keyof never` is `string | number | symbol` (every key).
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md#the-type-operators-precisely), https://www.typescriptlang.org/docs/handbook/2/keyof-types.html
</details>

### Q-TSC-M-015 · Utility types and type operators · difficulty 2 · single
`type Variant = "primary" | "secondary" | string;` loses editor suggestions. Which keeps them while accepting any string?
- A) `"primary" | "secondary" | String`
- B) `"primary" | "secondary" | (string & {})`
- C) `Extract<string, "primary" | "secondary">`
- D) `"primary" | "secondary" | unknown`
<details><summary>Answer</summary>

**B.** `string & {}` is not absorbed by subtype reduction, so the literals remain members.
- Why not A: `String` is the boxed wrapper type; using it is discouraged and it is not a reliable way to keep suggestions.
- Why not C: `Extract<string, "primary" | "secondary">` is `never`, because `string` is not assignable to either literal.
- Why not D: collapses to `unknown`.
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md)
</details>

### Q-TSC-M-016 · Typed classes and decorators · difficulty 1 · single
Which member is inaccessible at runtime from outside the class?
- A) `private token: string`
- B) `#token: string`
- C) `protected token: string`
- D) `readonly token: string`
<details><summary>Answer</summary>

**B.** ECMAScript private names are enforced by the runtime; the others are erased checks.
- Why not A, C: TypeScript-only, reachable via `obj["token"]` or casts.
- Why not D: only blocks writes at compile time.
- Ref: [modules/05](../modules/05-classes-mutability-and-ts-only-syntax.md), https://www.typescriptlang.org/docs/handbook/2/classes.html#caveats
</details>

### Q-TSC-M-017 · Typed classes and decorators · difficulty 2 · single
With `noImplicitOverride`, a subclass declares `override describ()` while the base has `describe()`. Result?
- A) Compiles; adds a new method
- B) Error TS4113: the member does not exist in the base class
- C) Runtime error
- D) The base method is renamed
<details><summary>Answer</summary>

**B.**
- Why not A: that is what happens *without* `override`.
- Why not C, D: purely a compile-time check.
- Ref: [modules/05](../modules/05-classes-mutability-and-ts-only-syntax.md), https://www.typescriptlang.org/tsconfig#noImplicitOverride
</details>

### Q-TSC-M-018 · Typed classes and decorators · difficulty 2 · single
A standard (TC39) method decorator receives which arguments?
- A) `(target, propertyKey, descriptor)`
- B) `(value, context)` where `context` is e.g. `ClassMethodDecoratorContext`
- C) `(constructor)` only
- D) `(target, key, parameterIndex)`
<details><summary>Answer</summary>

**B.**
- Why not A: the legacy `experimentalDecorators` signature.
- Why not C: class decorators receive the class (and a context in the standard form).
- Why not D: legacy parameter decorators; no standard equivalent.
- Ref: [modules/10](../modules/10-type-safe-api-design-patterns.md#lesson-106-typing-decorators), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators
</details>

### Q-TSC-M-019 · Typed classes and decorators · difficulty 2 · single
A method returns `this`. What does `new UserRepo().save(u).count()` need to compile, where `count` exists only on the subclass `UserRepo` and `save` is declared in the base class?
- A) `save` must return the base class type
- B) `save(): this` (polymorphic `this`)
- C) A cast
- D) It cannot be typed
<details><summary>Answer</summary>

**B.** The `this` type resolves to the receiver's type.
- Why not A: loses `count`.
- Why not C: unnecessary.
- Ref: [modules/05](../modules/05-classes-mutability-and-ts-only-syntax.md), https://www.typescriptlang.org/docs/handbook/2/classes.html#this-types
</details>

### Q-TSC-M-020 · Typed classes and decorators · difficulty 3 · scenario
A NestJS app relies on `design:paramtypes` metadata. The team wants to run its TypeScript with Node's built-in type stripping. What is the problem?
- A) None; Node emits metadata
- B) Decorators are not erasable and metadata needs type information, so `tsc` (or a full transform) must compile the code
- C) Only `emitDecoratorMetadata` must be enabled in `tsconfig.json`
- D) Switch to standard decorators, which emit the same metadata
<details><summary>Answer</summary>

**B.** Node strips types only; it cannot run decorator syntax, and metadata emit requires the checker.
- Why not A: Node does not read tsconfig or emit metadata.
- Why not C: Node ignores tsconfig.
- Why not D: standard decorators have no type metadata.
- Ref: [modules/10](../modules/10-type-safe-api-design-patterns.md), [modules/01](../modules/01-toolchain-and-compiler-model.md)
</details>

### Q-TSC-M-021 · Async code, iterators and errors · difficulty 1 · single
Under `strict`, what is the type of `e` in `catch (e) {}`?
- A) `any`
- B) `Error`
- C) `unknown`
- D) `never`
<details><summary>Answer</summary>

**C.** `useUnknownInCatchVariables` is part of `strict`.
- Why not A: the pre-4.4/non-strict behaviour.
- Why not B: anything can be thrown.
- Ref: [modules/02](../modules/02-essential-types-and-functions.md), https://www.typescriptlang.org/tsconfig#useUnknownInCatchVariables
</details>

### Q-TSC-M-022 · Async code, iterators and errors · difficulty 2 · single
`const [a, b] = await Promise.all([fetchUser(), fetchCount()])` where they return `Promise<User>` and `Promise<number>`. Types of `a`, `b`?
- A) `User | number` each
- B) `User` and `number`
- C) `unknown` each
- D) `Promise<User>` and `Promise<number>`
<details><summary>Answer</summary>

**B.** `Promise.all` maps over the tuple, preserving positions, and awaits each.
- Ref: [modules/02](../modules/02-essential-types-and-functions.md), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html
</details>

### Q-TSC-M-023 · Async code, iterators and errors · difficulty 2 · single
What does the third type argument of `Generator<number, string, boolean>` describe?
- A) The yielded values
- B) The return value
- C) The value passed to `next(x)` (and produced by `yield` inside)
- D) The error type
<details><summary>Answer</summary>

**C.**
- Why not A, B: first and second arguments.
- Why not D: generators have no typed error channel.
- Ref: [modules/02](../modules/02-essential-types-and-functions.md#lesson-24-typing-iteration-and-generators), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-6.html
</details>

### Q-TSC-M-024 · Async code, iterators and errors · difficulty 2 · single
In TS 5.6+ with `strict`, what is `it.next().value` when `done` is `true` for `const it = [1, 2].values()`?
- A) `any`
- B) `undefined` (`BuiltinIteratorReturn`)
- C) `number`
- D) `never`
<details><summary>Answer</summary>

**B.** `strictBuiltinIteratorReturn` makes built-in iterators' return type `undefined`.
- Why not A: the pre-5.6 behaviour.
- Ref: [modules/02](../modules/02-essential-types-and-functions.md#lesson-24-typing-iteration-and-generators), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html
</details>

### Q-TSC-M-025 · Async code, iterators and errors · difficulty 3 · single
`async function f(): Promise<void> { return 1; }` — what happens?
- A) Compiles; `1` is ignored
- B) Error: `number` is not assignable to `void`
- C) Compiles and resolves to `1` typed as `void`
- D) Runtime error
<details><summary>Answer</summary>

**B.** An explicitly declared `void` (or `Promise<void>`) return type forbids returning a value; the "void means ignored" rule applies to function *types* used as callbacks, not to declared return types.
- Ref: [modules/02](../modules/02-essential-types-and-functions.md), https://www.typescriptlang.org/docs/handbook/2/functions.html#return-type-void
</details>

### Q-TSC-M-026 · Resources, external data and the DOM · difficulty 1 · single
What is the safest type for `JSON.parse(body)` before validation?
- A) `any`
- B) `unknown`
- C) `object`
- D) The expected DTO type via `as`
<details><summary>Answer</summary>

**B.** Forces narrowing or schema parsing before use.
- Why not A: disables checks.
- Why not C: JSON can be a primitive.
- Why not D: an unchecked claim.
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md)
</details>

### Q-TSC-M-027 · Resources, external data and the DOM · difficulty 2 · single
```ts
const S = z.object({ n: z.string().transform(Number), on: z.boolean().default(false) });
```
What is `z.input<typeof S>`?
- A) `{ n: number; on: boolean }`
- B) `{ n: string; on?: boolean | undefined }`
- C) `{ n: string; on: boolean }`
- D) `{ n: number; on?: boolean }`
<details><summary>Answer</summary>

**B.** Inputs are pre-transform, and a default makes the input optional.
- Why not A: that is the output (`z.infer`).
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md#2-how-a-schema-library-computes-static-types), https://zod.dev/api
</details>

### Q-TSC-M-028 · Resources, external data and the DOM · difficulty 2 · single
`document.querySelector("#email")` returns `Element | null`. How do you get an `HTMLInputElement` safely?
- A) `document.querySelector("#email") as HTMLInputElement`
- B) `const el = document.querySelector("#email"); if (el instanceof HTMLInputElement) …`
- C) `document.querySelector<HTMLInputElement>("#email")!`
- D) `<HTMLInputElement>document.querySelector("#email")`
<details><summary>Answer</summary>

**B.** A runtime check narrows soundly.
- Why not A, C: assertions; wrong element or `null` crashes later.
- Why not D: an assertion (and banned under `erasableSyntaxOnly`).
- Ref: [modules/04](../modules/04-objects-assignability-and-weird-parts.md), https://www.typescriptlang.org/docs/handbook/dom-manipulation.html
</details>

### Q-TSC-M-029 · Resources, external data and the DOM · difficulty 2 · single
Which value can be bound with `using r = …`?
- A) `{ close(): void }`
- B) `{ [Symbol.dispose](): void }`
- C) `Promise<void>`
- D) `() => void`
<details><summary>Answer</summary>

**B.** `using` requires `Disposable | null | undefined`.
- Ref: [modules/10](../modules/10-type-safe-api-design-patterns.md#lesson-105-typing-explicit-resource-management), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
</details>

### Q-TSC-M-030 · Resources, external data and the DOM · difficulty 3 · scenario
A library accepts "any schema" from users. Which parameter type keeps it independent of Zod/Valibot versions?
- A) `z.ZodType`
- B) `StandardSchemaV1`
- C) `(x: unknown) => boolean`
- D) `unknown`
<details><summary>Answer</summary>

**B.** Standard Schema is the shared interface (`~standard.validate`, phantom `types`).
- Why not A: couples to one library and major version.
- Why not C: loses the output type and issues.
- Why not D: untyped.
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md#4-standard-schema-a-library-neutral-contract), https://standardschema.dev
</details>

### Q-TSC-M-031 · Modules and shipping in a real project · difficulty 1 · single
Under `module: "nodenext"`, how do you import `./util.ts` from an ES module (no extension rewriting)?
- A) `import { x } from "./util"`
- B) `import { x } from "./util.js"`
- C) `import { x } from "util"`
- D) `import x = require("./util")`
<details><summary>Answer</summary>

**B.** Specifiers name the emitted file; TS maps `.js` back to `.ts`.
- Why not A: TS2835 under nodenext.
- Why not C: a bare package specifier.
- Why not D: not allowed in ESM.
- Ref: [modules/06](../modules/06-modules-declarations-and-tsconfig.md#3-module-resolution-nodenext-vs-bundler), https://www.typescriptlang.org/docs/handbook/modules/reference.html
</details>

### Q-TSC-M-032 · Modules and shipping in a real project · difficulty 2 · single
After upgrading to TypeScript 6.0/7.0, `process` is "Cannot find name". Why?
- A) `@types/node` was removed from npm
- B) `types` now defaults to `[]`
- C) `lib` no longer includes Node
- D) `strict` hides globals
<details><summary>Answer</summary>

**B.** Add `"types": ["node"]`.
- Why not C: Node types never came from `lib`.
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#4-defaults-and-removals-ts-5x--60--70), https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
</details>

### Q-TSC-M-033 · Modules and shipping in a real project · difficulty 2 · single
`import { User } from "./user.js"` where `User` is an interface, with `verbatimModuleSyntax`. Result?
- A) Elided silently
- B) Error TS1484: use a type-only import
- C) Runtime import of `User`
- D) Converted to `import type` automatically
<details><summary>Answer</summary>

**B.**
- Why not A: elision is what `verbatimModuleSyntax` removes.
- Ref: [modules/06](../modules/06-modules-declarations-and-tsconfig.md#4-import-elision-and-verbatimmodulesyntax), https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax
</details>

### Q-TSC-M-034 · Modules and shipping in a real project · difficulty 2 · multi
Which are hard errors in TypeScript 7.0? (Select all.)
- A) `"baseUrl": "."`
- B) `"moduleResolution": "node"`
- C) `"module": "nodenext"`
- D) `"target": "es5"`
<details><summary>Answer</summary>

**A, B, D.** Deprecated in 6.0, removed in 7.0 (TS5102/TS5108).
- Why not C: the recommended setting for Node.
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#42-removed-in-70-deprecated-in-60), https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
</details>

### Q-TSC-M-035 · Modules and shipping in a real project · difficulty 3 · scenario
A Vite app adds `import "./global.css"` and TS 7 reports TS2882. Best fix?
- A) Disable `strict`
- B) Add `declare module "*.css";` in an included `.d.ts`
- C) Use `// @ts-ignore`
- D) Switch to `moduleResolution: "node"`
<details><summary>Answer</summary>

**B.** `noUncheckedSideEffectImports` is on by default; an ambient pattern declaration satisfies it (Vite's `vite/client` types also provide such declarations when listed in `types`).
- Why not A: unrelated flag.
- Why not C: hides the signal per import.
- Why not D: removed in 7.0.
- Ref: [modules/06](../modules/06-modules-declarations-and-tsconfig.md#52-ambient-modules-for-non-code-assets), https://www.typescriptlang.org/tsconfig#noUncheckedSideEffectImports
</details>

---

## Senior

### Q-TSC-S-001 · How the type system works · difficulty 2 · single
Why does `const p: Point = { x: 1, y: 2, z: 3 }` fail while `const q = { x: 1, y: 2, z: 3 }; const p: Point = q;` compiles?
- A) `q` is widened to `any`
- B) Excess-property checks apply only to fresh object literals
- C) Variables are compared nominally
- D) `z` is removed from `q` at runtime
<details><summary>Answer</summary>

**B.** Freshness is lost once the literal is stored; width subtyping then allows extra properties.
- Why not A: `q` has a precise type.
- Why not C: TypeScript is structural.
- Why not D: no runtime change.
- Ref: [modules/04](../modules/04-objects-assignability-and-weird-parts.md#assignability-formally), https://www.typescriptlang.org/docs/handbook/2/objects.html#excess-property-checks
</details>

### Q-TSC-S-002 · How the type system works · difficulty 3 · single
With `strictFunctionTypes`, which assignment still compiles even though it is unsound?
- A) `const h: { handle: (a: Animal) => void } = { handle: (d: Dog) => {} }`
- B) `const h: { handle(a: Animal): void } = { handle: (d: Dog) => {} }`
- C) `const f: (a: Animal) => void = (d: Dog) => {}`
- D) None of them
<details><summary>Answer</summary>

**B.** Method-shorthand parameters are compared bivariantly.
- Why not A, C: function-typed properties and function types are checked contravariantly and reject `Dog`.
- Ref: [modules/04](../modules/04-objects-assignability-and-weird-parts.md), https://www.typescriptlang.org/tsconfig#strictFunctionTypes
</details>

### Q-TSC-S-003 · How the type system works · difficulty 2 · single
Why does `Object.keys(obj)` return `string[]` instead of `(keyof T)[]`?
- A) A bug kept for compatibility
- B) Values may have more keys than their static type (width subtyping), so `(keyof T)[]` would be unsound
- C) `keyof` cannot be computed for objects
- D) Symbol keys
<details><summary>Answer</summary>

**B.**
- Why not D: `Object.keys` excludes symbols anyway; that is not the reason.
- Ref: [modules/04](../modules/04-objects-assignability-and-weird-parts.md)
</details>

### Q-TSC-S-004 · How the type system works · difficulty 2 · single
`type AB = { k: 1; a: string } & { k: 2; b: string }`. What is `AB`?
- A) `{ k: 1 | 2; a: string; b: string }`
- B) `{ k: never; a: string; b: string }`
- C) `never`
- D) A compile error
<details><summary>Answer</summary>

**C.** An intersection of object types whose shared literal-typed property is disjoint reduces to `never` (TS 3.9+).
- Why not B: the property-level `never` is reduced to the whole type.
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md#the-type-operators-precisely)
</details>

### Q-TSC-S-005 · How the type system works · difficulty 3 · single
Which declaration triggers TS2636 (variance annotation contradicts usage)?
- A) `interface P<out T> { get(): T }`
- B) `interface C<in T> { accept: (v: T) => void }`
- C) `interface W<out T> { accept: (v: T) => void }`
- D) `interface M<out T> { accept(v: T): void }`
<details><summary>Answer</summary>

**C.** `T` is used contravariantly in a function-typed property but annotated `out`.
- Why not D: method parameters are bivariant, so the annotation is not contradicted (verified with tsc 7.0.2).
- Ref: [modules/07](../modules/07-generics-and-inference.md#variance-and-variance-annotations), https://www.typescriptlang.org/docs/handbook/2/generics.html#variance-annotations
</details>

### Q-TSC-S-006 · Conditional and mapped types · difficulty 1 · single
`type ToArray<T> = T extends unknown ? T[] : never;` What is `ToArray<string | number>`?
- A) `(string | number)[]`
- B) `string[] | number[]`
- C) `never`
- D) `unknown[]`
<details><summary>Answer</summary>

**B.** Naked type parameter → distributive.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md#formal-semantics-in-brief), https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
</details>

### Q-TSC-S-007 · Conditional and mapped types · difficulty 2 · single
`type IsNever<T> = T extends never ? true : false;` What is `IsNever<never>`?
- A) `true`
- B) `false`
- C) `never`
- D) `boolean`
<details><summary>Answer</summary>

**C.** Distribution over the empty union yields `never`. Use `[T] extends [never]`.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md)
</details>

### Q-TSC-S-008 · Conditional and mapped types · difficulty 2 · single
Which mapped type preserves `readonly` and `?` modifiers of `T` and maps tuples to tuples?
- A) `{ [K in keyof T]: F<T[K]> }`
- B) `{ [K in string]: F<K> }`
- C) `{ [K in "a" | "b"]: F<K> }` (an explicit key union)
- D) `Record<keyof T, F<unknown>>`
<details><summary>Answer</summary>

**A.** A homomorphic mapped type over `keyof T` copies modifiers and handles arrays/tuples.
- Why not C: a mapped type over a literal key union knows nothing about `T`'s modifiers.
- Why not D: `Record` is not homomorphic.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md#formal-semantics-in-brief), https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
</details>

### Q-TSC-S-009 · Conditional and mapped types · difficulty 2 · single
Which expression removes all function-valued properties from `T`?
- A) `{ [K in keyof T]: T[K] extends Function ? never : T[K] }`
- B) `{ [K in keyof T as T[K] extends (...a: never[]) => unknown ? never : K]: T[K] }`
- C) `Omit<T, Function>`
- D) `Exclude<T, Function>`
<details><summary>Answer</summary>

**B.** Remapping a key to `never` drops it.
- Why not A: keeps the keys with type `never`.
- Why not C: `Omit` takes keys, not types.
- Why not D: filters union members, not properties.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md)
</details>

### Q-TSC-S-010 · Conditional and mapped types · difficulty 3 · single
`type F<T> = T extends [infer H extends number, ...unknown[]] ? H : never;` What is `F<["1", 2]>`?
- A) `1`
- B) `"1"`
- C) `never`
- D) `number`
<details><summary>Answer</summary>

**C.** The head `"1"` does not satisfy `extends number`, so the false branch is taken.
- Why not A: no conversion happens for tuple elements (only template literals parse with `infer N extends number`).
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md)
</details>

### Q-TSC-S-011 · Type-level programming · difficulty 2 · single
In TypeScript 7.0, what is `HeadTail<"😀ab">` for ``type HeadTail<S> = S extends `${infer H}${infer T}` ? [H, T] : never``?
- A) `["\ud83d", "\ude00ab"]`
- B) `["😀", "ab"]`
- C) `never`
- D) `[string, string]`
<details><summary>Answer</summary>

**B.** 7.0 infers by code point. A was the ≤ 6.0 behaviour (exam delta: older material shows A).
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md#952-then-vs-now-template-literal-inference-by-code-point-ts-70), https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
</details>

### Q-TSC-S-012 · Type-level programming · difficulty 2 · single
Which version is tail-recursive (evaluated as a loop with a 1000-iteration limit)?
- A) `type B<N, A extends unknown[] = []> = A["length"] extends N ? A : [...B<N, [...A, 0]>]`
- B) `type B<N, A extends unknown[] = []> = A["length"] extends N ? A : B<N, [...A, 0]>`
- C) Both
- D) Neither; TS has no tail-call handling
<details><summary>Answer</summary>

**B.** The recursive reference must be the whole branch. A wraps it in a spread and hits TS2589 at ~48 elements in 7.0.2.
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#42-recursion-limits), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html
</details>

### Q-TSC-S-013 · Type-level programming · difficulty 3 · scenario
`` type D = "0"|…|"9"; type Five = `${D}${D}${D}${D}${D}`; `` reports TS2590. Why?
- A) Template literals cannot contain unions
- B) The cross product (100,000 members) exceeds the union size limit
- C) Recursion depth
- D) `D` must be a `number`
<details><summary>Answer</summary>

**B.** Measured in 7.0.2: 50,000 members compile, 100,000 fail with "too complex to represent".
- Ref: [modules/08](../modules/08-type-derivation-and-template-literals.md)
</details>

### Q-TSC-S-014 · Type-level programming · difficulty 2 · single
What does `` `${infer N extends number}` `` do when matched against `"42"`?
- A) Fails to match
- B) Infers `N = 42` (a numeric literal)
- C) Infers `N = number`
- D) Infers `N = "42"`
<details><summary>Answer</summary>

**B.** Constrained `infer` in a template literal parses the text into the literal type.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-8.html
</details>

### Q-TSC-S-015 · Type-level programming · difficulty 3 · ordering
Order the steps TypeScript performs to evaluate `C<A | B>` where `type C<T> = T extends X ? Y<T> : Z`:
1. Union the results
2. Check whether `T` is a naked type parameter
3. Evaluate the conditional for `A` and for `B` separately
4. Instantiate `T` with `A | B`
<details><summary>Answer</summary>

**4 → 2 → 3 → 1.** Instantiation reveals a union in a distributive position, each member is evaluated, and results are unioned.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md#formal-semantics-in-brief)
</details>

### Q-TSC-S-016 · Designing types others will use · difficulty 2 · single
A function accepts `id: UserId` where `type UserId = string & { readonly __brand: "UserId" }`. How should callers obtain a `UserId`?
- A) `"abc" as UserId` anywhere
- B) Through a parser/smart constructor that validates and returns `UserId`
- C) `new UserId("abc")`
- D) It is impossible
<details><summary>Answer</summary>

**B.** Brands are only meaningful if one audited function creates them.
- Why not A: compiles but defeats the purpose.
- Why not C: a type alias has no constructor.
- Ref: [modules/10](../modules/10-type-safe-api-design-patterns.md), [modules/11](../modules/11-runtime-boundaries-validation.md)
</details>

### Q-TSC-S-017 · Designing types others will use · difficulty 2 · single
What does a `const` type parameter (`<const T>`) change for callers?
- A) `T` must be a constant
- B) Arguments are inferred as if written with `as const` (literal, readonly tuple types)
- C) The function cannot mutate its argument at runtime
- D) Explicit type arguments are forbidden
<details><summary>Answer</summary>

**B.**
- Why not C: no runtime effect.
- Ref: [modules/07](../modules/07-generics-and-inference.md), https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#const-type-parameters
</details>

### Q-TSC-S-018 · Designing types others will use · difficulty 3 · scenario
A UI library wants users to add their own theme tokens with autocompletion. Which API shape allows that?
- A) `export type Tokens = { primary: string }`; users redeclare it
- B) `export interface Tokens {}`; users augment it with `declare module "lib" { interface Tokens { … } }`
- C) `export const tokens = {} as any`
- D) A generic parameter on every component
<details><summary>Answer</summary>

**B.** Interfaces merge; type aliases do not (duplicate identifier).
- Why not D: works but burdens every call site.
- Ref: [modules/06](../modules/06-modules-declarations-and-tsconfig.md#62-module-augmentation)
</details>

### Q-TSC-S-019 · Designing types others will use · difficulty 2 · single
How do you type a polymorphic React component whose props depend on an `as` prop?
- A) `props: any`
- B) `<E extends ElementType = "span">(p: { as?: E } & Omit<ComponentProps<E>, "as">)`
- C) Overloads for every HTML tag
- D) `React.FC<HTMLAttributes<HTMLElement>>`
<details><summary>Answer</summary>

**B.** `E` is inferred from `as`; `ComponentProps<E>` supplies the matching attributes.
- Why not D: accepts attributes of no particular element.
- Ref: [modules/12](../modules/12-typing-ui-frameworks.md#26-polymorphic-components-as-prop)
</details>

### Q-TSC-S-020 · Designing types others will use · difficulty 3 · single
In React 19 types, why does `<div ref={(el) => (node = el)} />` fail to compile?
- A) Refs must be objects
- B) A ref callback may return a cleanup function, so returning the assigned element is a type error
- C) `node` is `const`
- D) `el` is `never`
<details><summary>Answer</summary>

**B.** React 19 types the callback return as `void | (() => void)`.
- Ref: [modules/12](../modules/12-typing-ui-frameworks.md#33-ref-callbacks-may-return-a-cleanup)
</details>

### Q-TSC-S-021 · Authoring and shipping typed libraries · difficulty 2 · single
Why should `"types"` be the first key in an `exports` condition object?
- A) JSON requires it
- B) Conditions match in order; a preceding `import`/`default` is chosen first and TS falls back to looking next to the JS file
- C) Node reads only the first key
- D) npm rejects the package otherwise
<details><summary>Answer</summary>

**B.** publint flags it; attw reports `FallbackCondition` when declarations are not adjacent.
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#21-the-minimal-correct-esm-only-package), https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports
</details>

### Q-TSC-S-022 · Authoring and shipping typed libraries · difficulty 2 · single
What does `isolatedDeclarations` require?
- A) No imports between files
- B) Exported declarations must have types that can be emitted without inference (explicit return types, etc.)
- C) One declaration per file
- D) `declaration: false`
<details><summary>Answer</summary>

**B.** It enables per-file declaration emit; violations are TS9007–TS9013-family errors (TS9013 in the track's fixture).
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#12-isolateddeclarations), https://www.typescriptlang.org/tsconfig#isolatedDeclarations
</details>

### Q-TSC-S-023 · Authoring and shipping typed libraries · difficulty 3 · scenario
A dual package points both `import` and `require` at `dist/index.d.ts` (ESM). CJS consumers see wrong default-import types. What does attw call this, and the fix?
- A) "NoResolution"; add `main`
- B) "Masquerading as ESM"; ship `index.d.cts` for the `require` branch
- C) "Untyped"; add `typesVersions`
- D) Nothing; it is correct
<details><summary>Answer</summary>

**B.** A `.d.ts` is interpreted in one module format; each format needs its own declarations (or ship ESM only).
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#22-dual-esmcjs-packages-and-masquerading), https://arethetypeswrong.github.io
</details>

### Q-TSC-S-024 · Authoring and shipping typed libraries · difficulty 2 · single
Exporting `const router = createRouter({ … })` without an annotation yields TS2742 ("inferred type cannot be named"). Fix?
- A) Add `skipLibCheck`
- B) Annotate the export with a public, importable type
- C) Disable `declaration`
- D) Use `export default`
<details><summary>Answer</summary>

**B.** The emitted `.d.ts` would need a path into another package's internals.
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#11-what-a-dts-file-is)
</details>

### Q-TSC-S-025 · Authoring and shipping typed libraries · difficulty 2 · single
Why are `// @ts-expect-error` lines preferred over `// @ts-ignore` in type tests?
- A) They are faster
- B) They fail (TS2578) when the expected error disappears, so the negative test can fail
- C) They suppress all errors in the file
- D) They work in JavaScript only
<details><summary>Answer</summary>

**B.**
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#31-ts-expect-error-as-a-negative-test)
</details>

### Q-TSC-S-026 · Performance and the native compiler · difficulty 1 · single
What is the main source of TypeScript 7's speed-up?
- A) A new type system with fewer features
- B) A native Go port with shared-memory parallel parsing and type checking
- C) Skipping type checking
- D) Incremental builds only
<details><summary>Answer</summary>

**B.** 7.7×–11.9× full-build speed-ups were reported at the default `--checkers 4`.
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#3-typescript-7-the-native-compiler), https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
</details>

### Q-TSC-S-027 · Performance and the native compiler · difficulty 2 · single
What does `--checkers 8` change?
- A) Runs eight separate compilations of the project
- B) Splits type checking of the program across eight checker workers
- C) Enables eight extra strictness checks
- D) Builds eight project references in parallel
<details><summary>Answer</summary>

**B.**
- Why not D: that is `--builders`.
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#32-the-new-cli-knobs)
</details>

### Q-TSC-S-028 · Performance and the native compiler · difficulty 2 · single
Your typescript-eslint setup breaks after moving to TS 7.0. Why?
- A) ESLint does not support TS syntax
- B) 7.0's `typescript` package has no classic compiler API; use the `@typescript/typescript6` bridge for API consumers
- C) The rules require `strict: false`
- D) 7.0 removed `.d.ts` files
<details><summary>Answer</summary>

**B.** Alias `typescript` to `npm:@typescript/typescript6@^6.0.2` and keep 7.0's `tsc` (e.g. via `@typescript/native`).
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#5-no-classic-api-in-70-and-the-60-bridge)
</details>

### Q-TSC-S-029 · Performance and the native compiler · difficulty 2 · multi
Which help diagnose slow type checking? (Select all.)
- A) `tsc --extendedDiagnostics`
- B) `tsc --generateTrace dir`
- C) `tsc --listFilesOnly`
- D) Replacing large object intersections with `interface … extends`
<details><summary>Answer</summary>

**A, B, D.** A and B measure; D is a known fix (interfaces are cached).
- Why not C: lists files, no timing.
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#4-type-performance)
</details>

### Q-TSC-S-030 · Performance and the native compiler · difficulty 3 · scenario
After upgrading to 7.0, snapshot tests of generated `.d.ts` files fail although nothing changed semantically: `"b" | "a"` became `"a" | "b"`. Explanation?
- A) A 7.0 bug
- B) `stableTypeOrdering` (always on in 7.0) orders union members deterministically
- C) `strict` changed
- D) `rootDir` changed
<details><summary>Answer</summary>

**B.** Regenerate snapshots once; assert codes rather than message text.
- Ref: [modules/01](../modules/01-toolchain-and-compiler-model.md#33-determinism-stabletypeordering)
</details>

### Q-TSC-S-031 · Runtime validation and migration · difficulty 2 · single
Which is a parser in the sense of "parse, don't validate"?
- A) `isEmail(s: string): boolean`
- B) `parseEmail(s: string): Email | null` where `Email` is branded
- C) `s as Email`
- D) `assert(s.includes("@"))`
<details><summary>Answer</summary>

**B.** It returns a more precise type that records the evidence.
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md#11-parse-dont-validate)
</details>

### Q-TSC-S-032 · Runtime validation and migration · difficulty 2 · single
In Zod 4, what is the difference between `.default(v)` and `.prefault(v)` on `undefined` input?
- A) None
- B) `.default` returns `v` as output without parsing; `.prefault` parses `v` as input
- C) `.prefault` is deprecated
- D) `.default` throws
<details><summary>Answer</summary>

**B.** Exam delta: Zod 3's `.default` behaved like Zod 4's `.prefault`.
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md#21-default-vs-prefault-zod-4-semantics), https://zod.dev/v4/changelog
</details>

### Q-TSC-S-033 · Runtime validation and migration · difficulty 2 · ordering
Order a safe 5.x → 7.0 migration:
1. Switch CI type checking to 7.0
2. Upgrade to 6.0 and fix deprecations
3. Make `types`/`rootDir` explicit and add asset declarations
4. Move API consumers (linters) to the `@typescript/typescript6` bridge
<details><summary>Answer</summary>

**2 → 3 → 4 → 1.**
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#62-typescript-5x--60--70)
</details>

### Q-TSC-S-034 · Runtime validation and migration · difficulty 3 · scenario
A JS project type-checked with JSDoc uses `@enum` and Closure-style `function(string): number` types. What happens under TS 7.0?
- A) Nothing changes
- B) Those JSDoc forms are no longer understood; types degrade or new errors appear
- C) TS 7 refuses to check JS files
- D) They are converted automatically
<details><summary>Answer</summary>

**B.** 7.0 reworked JSDoc support; `@enum` is not special and Closure function syntax is unsupported.
- Ref: [modules/13](../modules/13-library-authoring-performance-and-type-tests.md#5-javascript-with-jsdoc-checkjs-in-ts-7)
</details>

### Q-TSC-S-035 · Runtime validation and migration · difficulty 2 · single
Why must a React/Solid server function validate its arguments even when they are typed?
- A) Types are erased and the function is a public HTTP endpoint
- B) TypeScript cannot type async functions
- C) Serialization changes the types
- D) It does not need to
<details><summary>Answer</summary>

**A.**
- Ref: [modules/11](../modules/11-runtime-boundaries-validation.md#54-server-functions-and-rpc), [modules/12](../modules/12-typing-ui-frameworks.md#38-server-function-arguments-a-type-level-serializability-constraint)
</details>

---

## Hands-on challenges

### Q-TSC-H-001 · Type-level programming · difficulty 3 · hands-on
Implement `PathParams<P>` and `buildPath(pattern, params)` so that `buildPath("/users/:id/posts/:postId", { id: 7, postId: "a b" })` returns `"/users/7/posts/a%20b"`, a missing or unknown parameter is a compile error, and a pattern without parameters accepts `{}`.
<details><summary>Answer</summary>

Reference solution and verification: [`examples/exams/h001-build-path.test.ts`](../examples/exams/h001-build-path.test.ts) (run `node --test examples/exams/h001-build-path.test.ts` and `npm run typecheck`). Key points: recursive template-literal parsing, a mapped type over the parameter-name union, `const P` to keep the literal, one audited cast in the implementation.
- Ref: [modules/09](../modules/09-conditional-mapped-and-recursive-types.md)
</details>

### Q-TSC-H-002 · Designing types others will use · difficulty 3 · hands-on
Implement `createEmitter<Events>()` with `on(name, listener): Disposable`, `off` and `emit(name, ...payload)`, typed by an event map where `void` events take no payload; unknown events and wrong payloads must not compile, and `using` a subscription must unsubscribe it.
<details><summary>Answer</summary>

Reference solution and verification: [`examples/exams/h002-typed-emitter.test.ts`](../examples/exams/h002-typed-emitter.test.ts). Key points: `K extends keyof Events`, conditional rest parameters `Events[K] extends void ? [] : [Events[K]]`, returning a `Disposable`.
- Ref: [modules/10](../modules/10-type-safe-api-design-patterns.md), [modules/07](../modules/07-generics-and-inference.md)
</details>

---

## Mock exam

Format mirrors the Senior exam: **40 multiple-choice questions + 2 coding challenges, 135 minutes** (allow ~30 min for the questions and 105 min for the challenges). Answer without opening the modules.

**Questions (40):** S-001 to S-035 (all), plus M-005, M-010, M-020, M-030, M-035.

**Challenges (2):** H-001, H-002. A challenge counts as passed when its test file passes and `npm run typecheck` reports no errors.

**Scoring key.** Single/scenario/ordering: 1 point if exactly right. Multi-select: 1 point only if all correct options and no incorrect ones are selected. Pass: ≥ 28/40 (70%) **and** both challenges passed, mirroring the published pass rule.

| Domain | Questions in mock |
|---|---|
| How the type system works | S-001–S-005 |
| Conditional and mapped types | S-006–S-010 |
| Type-level programming | S-011–S-015 |
| Designing types others will use | S-016–S-020, M-020 |
| Authoring and shipping typed libraries | S-021–S-025, M-035 |
| Performance and the native compiler | S-026–S-030 |
| Runtime validation and migration | S-031–S-035, M-030 |
| Mid-level carry-over | M-005, M-010 |
