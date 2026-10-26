# TypeScript & Modern JavaScript Glossary

This glossary defines standard technical terms used throughout the `languages/typescript/` learning track. All definitions and context descriptions are written in English; terms provide their canonical English name and established Czech equivalent. Terminology is based on the official TypeScript specification and handbook, the ECMA-262 (ECMAScript) standard, and fundamental type systems literature (Benjamin C. Pierce: *Types and Programming Languages*).

---

## 1. Type System Foundations

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Type World vs. Value World** | **Typový prostor vs. prostor hodnot** | The fundamental separation in TypeScript: the *Type World* exists solely during compilation and is erased during emit (*type erasure*); the *Value World* represents executable JavaScript runtime memory and state. | TypeScript Handbook |
| **Structural Typing (Duck Typing)** | **Strukturální typování** | A type system model where type compatibility and equivalence are based exclusively on an object's shape, properties, and methods, rather than on explicit declarations or class inheritance. | TS Handbook (Type Compatibility), Pierce (TAPL) |
| **Type Erasure** | **Vymazání typů** | The compile-time transformation where all type annotations, interface declarations, type aliases, and assertions are stripped, producing standard executable JavaScript. | TypeScript Design Goals |
| **Type Annotation** | **Typová anotace** | Explicit syntax (`: T`) instructing the compiler on the required type of a variable, function parameter, or return value. May trigger type widening from literal values. | TS Handbook (Everyday Types) |
| **Type Inference** | **Typová inference (odvozování typů)** | The compiler's automatic deduction of an expression's type without requiring explicit manual annotations. | TS Handbook (Type Inference) |
| **Type Widening** | **Rozšíření typu (zobecnění)** | The automatic heuristic where the compiler widens a specific literal value (e.g., `'admin'`, `42`) to its broader primitive base type (`string`, `number`), unless explicitly constrained or frozen (`as const`). | TS Handbook |
| **Type Narrowing** | **Zúžení typu (zpřesnění)** | The process where the compiler refines a broad type (e.g., union `string \| number`) into a more specific subtype based on runtime flow analysis. | TS Handbook (Narrowing) |
| **Control-Flow Analysis (CFA)** | **Analýza toku řízení** | Static flow analysis performed by the compiler along branching statements (`if`, `switch`, `throw`, ternary operators) to track reachability and narrow types. | TypeScript Compiler Architecture |
| **Exhaustiveness Checking** | **Kontrola úplnosti (vyčerpání variant)** | A pattern verifying that every possible variant in a discriminated union has been handled; any unhandled branch falls through to `never`, triggering a compile error if new variants are added. | TS Handbook (Narrowing / The never type) |

---

## 2. Types & Combinators

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Union Type (`A \| B`)** | **Typ sjednocení (unijní typ)** | A type representing a value that can be any one of several specified types (the set union of allowable values). | TS Handbook (Everyday Types) |
| **Intersection Type (`A & B`)** | **Typ průniku (průnikový typ)** | A type representing a value that simultaneously satisfies all combined types (merging their requirements and properties). | TS Handbook (Everyday Types) |
| **Discriminated Union** | **Rozlišená (diskriminovaná) unie / tagované sjednocení** | A union of object types where each variant shares a common literal property (*discriminant / tag*), allowing type-safe branching and narrowing. | TS Handbook (Narrowing), Pierce (TAPL) |
| **Discriminant (Tag)** | **Diskriminant (značka)** | A literal property present on all variants of a discriminated union, allowing the compiler to identify the active type uniquely. | TS Handbook |
| **Tuple** | **N-tice (uspořádaná n-tice / tuple)** | An array-like structure with a fixed number of elements where each index position has a distinct, known type. | TS Handbook |
| **Literal Type** | **Literálový typ** | A type representing exactly one specific scalar value (e.g., `'success'`, `200`, `true`), rather than an open primitive domain. | TS Handbook |
| **Index Access Type (`T[K]`)** | **Indexovaný přístupový typ** | An operator used to look up the type of a specific property `K` (or union of keys) on type `T`. | TS Handbook (Indexed Access Types) |
| **Index Signature (`[key: string]: V`)** | **Indexová signatura** | A declaration in an object type defining that dynamic property keys of a given key type map to values of type `V`. | TS Handbook (Object Types) |
| **Excess Property Checks** | **Kontrola nadbytečných vlastností** | Strict compiler validation applied to fresh object literals upon assignment, preventing undeclared properties from being passed. | TS Handbook (Object Types) |

---

## 3. Advanced Type-Level Mechanics

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Generics (Parametric Polymorphism)** | **Generika (parametrický polymorfismus)** | The facility to parameterize types, functions, and interfaces over type variables, providing code reuse while maintaining end-to-end type safety. | TS Handbook (Generics), Pierce (TAPL) |
| **Type Parameter Constraint (`T extends U`)** | **Omezení typového parametru** | A rule restricting a type parameter `T` to only types that are assignable to `U`. | TS Handbook (Generics) |
| **Const Type Parameters (`<const T>`)** | **Literálové typové parametry** | A feature introduced in TS 5.0 that automatically infers the most specific literal/tuple type for arguments passed to generic functions without requiring `as const`. | TypeScript 5.0 Release Notes |
| **Conditional Types (`T extends U ? X : Y`)** | **Podmíněné typy** | A type expression that selects one of two possible types based on a subtyping relationship test (`extends`). | TS Handbook (Conditional Types) |
| **Distributive Conditional Types** | **Distributivní podmíněné typy** | The behavior of conditional types where an unchecked naked type parameter distributes over union members automatically. | TS Handbook (Conditional Types) |
| **`infer` Keyword** | **Klíčové slovo `infer`** | A pattern-matching declaration inside the `extends` clause of a conditional type used to deduce and extract an unknown inner type. | TS Handbook (Conditional Types) |
| **Mapped Types (`{ [K in Keys]: ... }`)** | **Mapované typy** | A type-level construct that produces a new object type by iterating over a union of keys and transforming property types. | TS Handbook (Mapped Types) |
| **Key Remapping (`as`)** | **Přemapování klíčů (klíčové slovo `as`)** | Syntax within mapped types allowing property names to be filtered or transformed (often in combination with template literal types). | TypeScript 4.1 Release Notes |
| **Template Literal Types** | **Šablonové literálové typy** | Types that allow string literal types to be composed, concatenated, and transformed using ES template literal syntax. | TS Handbook (Template Literal Types) |
| **Branded Types (Nominal Flavoring)** | **Značkované (brandované) typy** | A design pattern that attaches a unique symbol or phantom property to a primitive type to simulate nominal typing in a structural type system. | TypeScript FAQ / Total TypeScript |
| **Type Predicate (`x is T`)** | **Typový predikát (uživatelský type guard)** | A function return type annotation informing the compiler that a `true` return guarantees the argument `x` is narrowed to `T`. | TS Handbook (Narrowing) |
| **Assertion Function (`asserts x is T`)** | **Asertivní funkce** | A function that asserts a condition, throwing if false, guaranteeing to the compiler that `x` is of type `T` for subsequent execution lines. | TypeScript 3.7 Release Notes |

---

## 4. Subtyping Variance

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Covariance** | **Kovariance** | A subtyping relationship where composite types preserve the subtyping direction of their components ($A \le B \implies F(A) \le F(B)$). Characteristic of function return types and read-only collections. | Pierce (TAPL), Cardelli |
| **Contravariance** | **Kontravariance** | A subtyping relationship where composite types reverse the subtyping direction of their components ($A \le B \implies F(B) \le F(A)$). Characteristic of function parameter types under `--strictFunctionTypes`. | Pierce (TAPL), TS Handbook |
| **Invariance** | **Invariance** | A relationship where $F(A) \le F(B)$ holds if and only if $A = B$. Characteristic of mutable read-write collections and structures. | Pierce (TAPL) |
| **Bivariance** | **Bivariance** | A relationship where $F(A) \le F(B)$ holds if either $A \le B$ or $B \le A$. Used historically for method parameters in TypeScript for compatibility with array mutation. | TypeScript FAQ |

---

## 5. Operators, Directives & Pragmas

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **`satisfies` Operator** | **Operátor `satisfies`** | An operator that validates whether an expression matches a given type contract without widening the expression's inferred literal type. | TypeScript 4.9 Release Notes |
| **`as const` Assertion** | **Konstantní tvrzení (`as const`)** | A type assertion directing the compiler to infer deeply immutable literal types and fixed-length tuples rather than mutable base primitives. | TypeScript 3.4 Release Notes |
| **Non-Null Assertion (`!`)** | **Operátor nenulovosti (non-null assertion)** | A postfix operator asserting that a preceding expression is neither `null` nor `undefined`. | TS Handbook |
| **`@ts-expect-error`** | **Direktiva `@ts-expect-error`** | A comment directive suppressing the subsequent compiler diagnostic error only if an error actually occurs on that line (emitting a compiler warning otherwise). | TypeScript 3.9 Release Notes |
| **`@ts-ignore`** | **Direktiva `@ts-ignore`** | A comment directive unconditionally suppressing any compiler error on the subsequent line. | TS Handbook |
| **Explicit Resource Management (`using`)** | **Explicitní správa prostředků (`using`)** | A TC39 syntax feature for deterministic resource cleanup upon leaving a block scope by invoking `[Symbol.dispose]()`. | TypeScript 5.2 Release Notes / TC39 |

---

## 6. Fine-Grained Reactivity & SolidJS 2.x

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Fine-Grained Reactivity** | **Jemnozrnná reaktivita** | A computational design pattern where individual data values (signals) directly update the precise DOM nodes or computations that depend on them, eliminating Virtual DOM diffing and whole-component re-renders. | SolidJS Architecture, Carniato |
| **Signal (`createSignal`)** | **Signál** | The fundamental atomic reactive primitive containing a getter accessor (`() => T`) and a setter (`(v: T) => void`), tracking subscribers when read inside reactive contexts. | `@solidjs/signals`, TC39 Signals Proposal |
| **Accessor** | **Přístupová funkce (accessor)** | A parameterless getter function (`() => T`) that establishes a reactive subscription when invoked within a tracking scope. | SolidJS Handbook |
| **Deterministic Microtask Batching** | **Deterministické dávkování v mikrotasku** | The execution model in Solid 2.0 where signal mutations are queued and deferred to the JavaScript microtask queue, ensuring consistent graph snapshots and preventing layout thrashing unless manually flushed via `flush()`. | SolidJS 2.0 Specifications |
| **First-Class Async Reactivity** | **Prvotřídní asynchronní reaktivita** | An architecture where promises and async operations flow directly through ordinary computations (`createAsync`, `createMemo`), propagating pending and rejected states out-of-band to `<Loading>` and `<Errored>` boundaries. | SolidJS 2.0 Architecture |
| **Split Effect (`createEffect(compute, effect)`)** | **Rozdělený (dvoufázový) efekt** | A two-phase effect primitive separating synchronous dependency tracking (`compute`) from asynchronous untracked side-effect execution (`effect`), with built-in cleanup return handling. | SolidJS 2.0 Architecture |
| **Settled Lifecycle (`onSettled`)** | **Životní cyklus po ustálení (`onSettled`)** | An async-aware component lifecycle hook replacing `onMount`, executing after initial DOM rendering and asynchronous dependencies have settled, and natively supporting returned cleanups. | SolidJS 2.0 Specifications |
| **Store Projection (`createProjection`)** | **Projekce úložiště (`createProjection`)** | A derived reactive store construct updated via mutable draft functions that notifies downstream subscribers with $O(1)$ property-level leaf precision. | SolidJS 2.0 Store Architecture |
| **Ref Directive Factory** | **Továrna na direktivy přes ref** | A reusable DOM attachment pattern replacing legacy `use:*` compiler transforms, structured as composable functions returning element callbacks with optional cleanups. | SolidJS 2.0 Architecture |
