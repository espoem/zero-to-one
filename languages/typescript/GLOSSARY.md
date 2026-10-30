# TypeScript Glossary (EN ↔ CZ)

This glossary defines standard technical terms used throughout the `languages/typescript/` learning track. All definitions and context descriptions are written in English; terms provide their canonical English name and established Czech equivalent. Terminology is based on the official TypeScript specification and handbook, the ECMA-262 (ECMAScript) standard, and fundamental type systems literature (Benjamin C. Pierce: *Types and Programming Languages*).

---

## 1. Type System Foundations

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Type World vs. Value World** | **Typový prostor vs. prostor hodnot** | The fundamental separation in TypeScript: the *Type World* exists solely during compilation and is erased during emit (*type erasure*); the *Value World* represents executable JavaScript runtime memory and state. | TypeScript Handbook |
| **Structural vs. Nominal Typing** | **Strukturální vs. nominální typování** | In structural typing, type compatibility is determined by shape and members; in nominal typing, compatibility requires explicit declarations and type names. (Root glossary wording; TypeScript is structural, with brands and `#private` fields as nominal escape hatches.) | Pierce (TAPL) |
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
| **Covariance** | **Kovariance** | A subtyping relationship where composite types preserve the subtyping direction of their components (`A ≤ B ⟹ F(A) ≤ F(B)`). Characteristic of function return types and read-only collections. | Pierce (TAPL), Cardelli |
| **Contravariance** | **Kontravariance** | A subtyping relationship where composite types reverse the subtyping direction of their components (`A ≤ B ⟹ F(B) ≤ F(A)`). Characteristic of function parameter types under `--strictFunctionTypes`. | Pierce (TAPL), TS Handbook |
| **Invariance** | **Invariance** | A relationship where `F(A) ≤ F(B)` holds if and only if `A = B`. Characteristic of mutable read-write collections and structures. | Pierce (TAPL) |
| **Bivariance** | **Bivariance** | A relationship where `F(A) ≤ F(B)` holds if either `A ≤ B` or `B ≤ A`. Used historically for method parameters in TypeScript for compatibility with array mutation. | TypeScript FAQ |

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

## 6. Assignability, Inference & Variance Mechanics

Where Czech practice has no established translation, the English term is used in Czech texts as well; this is marked "(EN term used)".

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Assignability** | **Přiřaditelnost** | The relation $S \preceq T$ deciding whether a value of type `S` may be used where `T` is expected; structural subtyping plus special cases (`any`, optional properties, enums). | TS Handbook (Type Compatibility) |
| **Freshness (Fresh Object Literal)** | **Čerstvý objektový literál** (EN term used) | The status of an object literal expression before it is assigned or widened; fresh types are subject to excess-property checks. | TS Handbook (Object Types) |
| **Inference Site** | **Místo inference** (EN term used) | An occurrence of a type parameter in a parameter type that an argument type is matched against to collect inference candidates; `NoInfer<T>` removes it. | TS Handbook (Generics), [Module 07](./modules/07-generics-and-inference.md) |
| **Variance Annotation (`in` / `out`)** | **Anotace variance** | Explicit marking of a type parameter as contravariant (`in`), covariant (`out`) or invariant (`in out`); checked against usage (TS2636). | TS 4.7 release notes |
| **Homomorphic Mapped Type** | **Homomorfní mapovaný typ** | A mapped type over `keyof T` that preserves `readonly`/optional modifiers and maps arrays and tuples to arrays and tuples. | TS Handbook (Mapped Types) |
| **Deferred Conditional Type** | **Odložený podmíněný typ** | A conditional type whose check depends on unresolved type parameters and is kept unevaluated until instantiation. | TS Handbook (Conditional Types) |
| **Tail-Recursive Conditional Type** | **Koncově rekurzivní podmíněný typ** | A recursive conditional type whose recursive reference is an entire branch, evaluated iteratively (limit 1000 iterations) instead of by nested instantiation. | TS 4.5 release notes |
| **Inferred Type Predicate** | **Odvozený typový predikát** | A `x is T` return type that the compiler infers from a function body consisting of a precise narrowing expression (TS 5.5+). | TS 5.5 release notes |

---

## 7. Modules, Declarations & Toolchain

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Declaration File (`.d.ts`)** | **Deklarační soubor** | A file containing only type declarations describing JavaScript; emits no code. | TS Handbook (Declaration Files) |
| **Ambient Declaration** | **Ambientní deklarace** | A `declare` statement describing a value, module or global that exists at runtime but is implemented elsewhere. | TS Handbook (Modules) |
| **Declaration Merging** | **Slučování deklarací** | Combining same-named interfaces, namespaces and value declarations into one symbol; type aliases never merge. | TS Handbook (Declaration Merging) |
| **Module Augmentation** | **Rozšíření modulu** (augmentace) | Adding declarations to an existing module from another module with `declare module "x" { … }`; `declare global` does the same for the global scope. | TS Handbook (Declaration Merging) |
| **Module Resolution** | **Rozlišení modulů** (resolve) | The algorithm mapping an import specifier to a file and its declarations; `nodenext` models Node, `bundler` models bundlers. | TS Handbook (Modules Reference) |
| **Package Exports / Conditions** | **Exporty balíčku / podmínky** | The `exports` map in `package.json` and the condition names (`types`, `import`, `require`, `default`) selecting an entry point. | Node.js documentation (Packages) |
| **Project References** | **Odkazy na projekty** (project references) | Splitting a code base into `composite` projects linked by `references` and built with `tsc -b`, downstream projects checking against upstream `.d.ts` output. | TS Handbook (Project References) |
| **Type Stripping** | **Odstranění typů** (type stripping) | Executing TypeScript by deleting type syntax without type checking or transforming, as Node.js does by default. | Node.js documentation (TypeScript) |
| **Erasable Syntax** | **Vymazatelná syntaxe** | TypeScript syntax whose removal yields correct JavaScript; `erasableSyntaxOnly` forbids the rest (enums, value namespaces, parameter properties). | TS 5.8 release notes |
| **Verbatim Module Syntax** | (EN term used) | The rule that imports/exports are kept or removed purely by the presence of the `type` modifier. | TS tsconfig reference |
| **Isolated Declarations** | **Izolované deklarace** (EN term used) | A mode requiring explicit types on exports so that declaration files can be emitted per file without type checking. | TS 5.5 release notes |
| **Native Compiler (TypeScript 7)** | **Nativní kompilátor** | The Go port of the TypeScript compiler released as 7.0, with parallel parsing and type checking. | TS 7.0 announcement |
| **Language Server (LSP)** | **Jazykový server** | The editor back end implementing the Language Server Protocol; TS 7's server speaks LSP natively. | LSP specification |
| **Standard Schema** | (EN term used) | A library-neutral interface (`~standard.validate`, phantom `types`) implemented by schema libraries such as Zod, Valibot and ArkType. | standardschema.dev |

---

## 8. JSX & UI Framework Typing

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **JSX Namespace** | **Jmenný prostor JSX** | The set of types (`Element`, `IntrinsicElements`, `ElementChildrenAttribute`, …) a framework exports to tell the checker how to type JSX. | TS Handbook (JSX) |
| **Intrinsic Element** | **Vnitřní (intrinsic) element** | A lowercase JSX tag whose props come from `JSX.IntrinsicElements[tag]`. | TS Handbook (JSX) |
| **JSX Import Source** | (EN term used) | The package whose `jsx-runtime` module provides the JSX namespace and runtime (`react`, `@solidjs/web`). | TS tsconfig reference |
| **Polymorphic Component** | **Polymorfní komponenta** | A component whose rendered element and accepted props are chosen by an `as`-style prop. | [Module 12](./modules/12-typing-ui-frameworks.md) |
| **Accessor (Solid)** | **Accessor** (EN term used) | The function type `() => T` returned by Solid signals and memos; read by calling it. Runtime semantics: technologies/solidjs. | Solid documentation |
