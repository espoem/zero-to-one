# Bilingual Glossary: Functional Programming (English ↔ Czech)

This glossary establishes canonical terminology for purely functional programming, lambda calculus, algebraic data types, type classes, effect systems, and stream transducers. Shared foundational terms match the root repository [`GLOSSARY.md`](../../GLOSSARY.md) verbatim; domain-specific terms are grounded in primary literature (Church, Strachey, Wadler, Reynolds, Okasaki, Pierce, Chiusano & Bjarnason, Moggi, Mac Lane).

---

## 1. Foundations, Purity & Lambda Calculus

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Pure Function** | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. | Church (Lambda Calculus), Functional Programming Standards |
| **Side Effect** | **Vedlejší účinek** | Any state mutation outside the local execution scope of a function (e.g., modifying global state, performing I/O, writing to disk or network). | IEEE Standard Glossary of Software Engineering Technology |
| **Referential Transparency** | **Referenční transparentnost** | An expression property where any call can be substituted with its resulting value without altering the behavior of the program. | Strachey (Fundamental Concepts in Programming Languages) |
| **Substitution Model** | **Substituční model vyhodnocování** | An equational evaluation model where function applications and pure expressions are reduced step by step by substituting formal parameters with their argument expressions or values. | Abelson & Sussman (SICP), Church ($\beta$-reduction) |
| **Lambda Calculus ($\lambda$-calculus)** | **Lambda kalkul** | A formal mathematical system for expressing computation based on function abstraction ($\lambda x. e$) and function application ($e_1\;e_2$), governed by $\alpha$-equivalence, $\beta$-reduction, and $\eta$-conversion. | Church (1936), Barendregt |
| **$\beta$-Reduction** | **$\beta$-redukce** | The operational rewrite rule replacing every free occurrence of the bound parameter $x$ in body $e$ with argument $v$: $(\lambda x. e)\;v \to_\beta e[x := v]$. | Church (1936), Pierce (TAPL) |
| **Higher-Order Function** | **Funkce vyššího řádu** | A function that accepts one or more functions as arguments, returns a function, or both. | Abelson & Sussman (SICP) |
| **Closure** | **Uzávěr (lexikální uzávěr)** | The combination of a function bundled together with references to its surrounding lexical environment, allowing access to outer scope variables. | Landin (The Mechanical Evaluation of Expressions) |
| **Currying** | **Currying (částečná aplikace přes unární funkce)** | Transforming a function of multiple arguments $(A \times B) \to C$ into a chain of unary functions $A \to (B \to C)$, named after Haskell Curry and Moses Schönfinkel. | Schönfinkel (1924), Curry (1958) |
| **Parametricity (Free Theorems)** | **Parametricita (věty zdarma)** | A property of parametrically polymorphic functions guaranteeing uniform behavior across all type instantiations, allowing algebraic theorems to be derived directly from the type signature alone. | Reynolds (1983), Wadler (1989) |
| **Contextual Purity (Local Effects)** | **Kontextová čistota (lokální efekty)** | The principle that an expression may allocate and mutate strictly local state internally as long as no mutation is observable outside its scope, preserving referential transparency for callers. | Sabry (1998), Launchbury & Peyton Jones (1994) |
| **Rank-2 Polymorphism** | **Polymorfismus 2. řádu** | A type system feature permitting universal quantification ($\forall S$) inside a function parameter rather than only at the outermost level, used by `ST[S, A]` to prevent mutable references from escaping their scope. | Peyton Jones & Shields (2007), Launchbury & Peyton Jones (1994) |
| **Covariance** | **Kovariance** | A subtyping relationship where composite types preserve the subtyping direction of their components (`A ≤ B ⟹ F(A) ≤ F(B)`). Characteristic of function return types and read-only collections. | Pierce (TAPL), Cardelli |
| **Contravariance** | **Kontravariance** | A subtyping relationship where composite types reverse the subtyping direction of their components (`A ≤ B ⟹ F(B) ≤ F(A)`). Characteristic of function parameter types. | Pierce (TAPL), TS Handbook |
| **Invariance** | **Invariance** | A relationship where `F(A) ≤ F(B)` holds if and only if `A = B`. Characteristic of mutable read-write collections and structures. | Pierce (TAPL) |

---

## 2. Data Structures, Errors & Laziness

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Immutability** | **Neměnnost (imutabilita)** | The property of a data structure or object whose state cannot be modified after instantiation. Modifications create a new instance. | Okasaki (Purely Functional Data Structures) |
| **Persistent Data Structure** | **Perzistentní datová struktura** | An immutable data structure that preserves previous versions when updated, sharing unchanged sub-structures across versions in time and space. | Driscoll et al. (1989), Okasaki (1998) |
| **Structural Sharing** | **Strukturální sdílení** | Reusing unmodified immutable nodes or subtrees across multiple versions of a persistent data structure (e.g., prepending to a singly-linked list in $O(1)$ without copying its tail). | Okasaki (Purely Functional Data Structures) |
| **Algebraic Data Type (ADT)** | **Algebraický datový typ (ADT)** | A composite type formed by combining **sum types** (disjoint tagged unions, representing choice `A \| B`) and **product types** (records/tuples, representing pairing `A × B`). | Hope (Burstall et al. 1980), Pierce (TAPL) |
| **Totality (Total Function)** | **Totální funkce** | A function defined for every valid value of its input domain that terminates and returns a value in its declared codomain without throwing exceptions or diverging. | Turner (Total Functional Programming 2004) |
| **Catamorphism** | **Katamorfismus** | A generalized structural fold (`foldRight`, `foldTree`) that recursively collapses an inductive data structure into a single value using an algebra over its constructors. | Meijer, Fokkinga, Paterson (Bananas, Lenses, Envelopes 1991) |
| **Anamorphism** | **Anamorfismus** | The categorical dual of a catamorphism: a generalized `unfold` that coinductively generates a potentially infinite data stream or structure from a seed state. | Meijer, Fokkinga, Paterson (1991) |
| **Tail Recursion** | **Koncová rekurze** | A recursive call whose result is returned directly without further computation in the caller's stack frame, enabling compilers or loops to reuse a single stack frame in $O(1)$ stack space. | Steele (Debunking the Expensive Procedure Call 1977) |
| **Strict vs. Non-Strict Evaluation** | **Striktní vs. nestriktní vyhodnocování** | Strict evaluation (call-by-value) reduces function arguments before entering the function body; non-strict evaluation defers argument evaluation until (and unless) the value is demanded. | Peyton Jones (The Implementation of Functional Programming Languages) |
| **Thunk** | **Odložený výpočet (_thunk_)** | A zero-argument closure encapsulating an unevaluated expression together with its lexical environment for deferred evaluation. | Ingerman (1961), Peyton Jones (1987) |
| **Call-by-Need (Lazy Memoization)** | **Volání podle potřeby (líné vyhodnocování s memoizací)** | A non-strict evaluation strategy where each thunk is evaluated at most once upon first demand and its result is cached for subsequent accesses. | Wadsworth (1971), Launchbury (1993) |
| **Corecursion** | **Korekurze** | A productive generative pattern that constructs coinductive data (such as infinite streams) incrementally from a seed state, producing each output element in finite steps without requiring a terminating base case. | Turner (2004), Chiusano & Bjarnason (2015) |
| **Deforestation (Stream Fusion)** | **Odlesnění (fúze proudů)** | Compiler or library optimization that eliminates intermediate heap allocations between chained traversals (`map`, `filter`, `fold`) by fusing transformations into a single pass over elements. | Wadler (Deforestation 1990), Coutts et al. (2007) |
| **Head Retention (Space Leak)** | **Udržování hlavy proudu (únik paměti)** | A lazy-list memory leak occurring when a live reference to the head cell of a memoized stream prevents garbage collection of all consumed prefix nodes, causing $O(n)$ heap retention. | Chiusano & Bjarnason (FP in Scala Ch. 5), Marlow |

---

## 3. Algebraic Design, Type Classes & Effects

| English Term | Czech Term | Definition & Context | Primary Reference |
| :-- | :-- | :-- | :-- |
| **Type Class** | **Typová třída** | An ad-hoc polymorphism mechanism defining an interface of operations and algebraic laws over a type or type constructor, instantiated separately from data definitions (`given` / `using` in Scala 3). | Wadler & Blott (POPL 1989) |
| **Higher-Kinded Type (HKT)** | **Typ vyššího druhu** | A type constructor abstracted over another type constructor (kind `* -> *`, written `F[_]` in Scala), enabling polymorphic abstractions such as `Functor[F[_]]` and `Monad[F[_]]`. | Moors, Piessens, Odersky (OOPSLA 2008) |
| **Type Lambda** | **Typová lambda** | An anonymous type-level function that partially applies a multi-parameter type constructor to match a unary higher-kinded shape (e.g., `[X] =>> State[S, X]` in Scala 3). | Scala 3 Reference (Type Lambdas) |
| **Property-Based Testing** | **Testování založené na vlastnostech** | A verification methodology that generates arbitrary inputs via composable generators (`Gen`) and asserts universal invariants (`Prop`) across hundreds of cases, shrinking counterexamples to minimal failing inputs. | Claessen & Hughes (QuickCheck, ICFP 2000) |
| **Shrinking** | **Zmenšování protipříkladu (_shrinking_)** | The automated minimization of a failing property-based test input into the smallest, simplest counterexample that still falsifies the property. | Claessen & Hughes (2000), MacIver (Hypothesis) |
| **Parser Combinator** | **Kombinační analyzátor (kombinátor parserů)** | A higher-order function that builds complex grammars by composing smaller parsers algebraically (`or`, `flatMap`, `many`), separating grammar specification from input cursor mechanics. | Hutton & Meijer (JFP 1998) |
| **Semigroup** | **Pologrupa** | An algebraic structure $(A, \oplus)$ equipped with a closed binary associative operation: $(a \oplus b) \oplus c = a \oplus (b \oplus c)$. | Abstract Algebra, Cats Kernel |
| **Monoid** | **Monoid** | A semigroup $(A, \oplus, e)$ augmented with an identity element $e \in A$ satisfying left and right identity: $e \oplus a = a = a \oplus e$. | Abstract Algebra, Chiusano & Bjarnason (Ch. 10) |
| **Homomorphism** | **Homomorfismus** | A structure-preserving map $h: A \to B$ between two algebraic structures satisfying $h(x \oplus_A y) = h(x) \oplus_B h(y)$ (and $h(e_A) = e_B$ for monoids). | Mac Lane (Categories for the Working Mathematician) |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
| **Functor** | **Funktor** | A type constructor $F[\_]$ supporting `map: (F[A], A => B) => F[B]` that preserves identity (`map(fa)(id) == fa`) and composition (`map(map(fa)(f))(g) == map(fa)(g compose f)`). | Mac Lane (1971), Moggi (1991) |
| **Applicative Functor** | **Aplikativní funktor** | A functor strictly between `Functor` and `Monad` providing `unit`/`pure` and independent effect combination (`map2`/`apply`), enabling static structure analysis and parallel or error-accumulating composition. | McBride & Paterson (JFP 2008) |
| **Monad** | **Monáda** | An applicative functor equipped with sequential context-dependent composition (`flatMap` / `join`) and `unit`, satisfying left identity, right identity, and associativity laws. | Moggi (1991), Wadler (1992) |
| **Kleisli Arrow / Composition** | **Kleisliho šipka / kompozice** | A function returning an effectful value `A => F[B]` and its associative composition operator `>=>` (`compose`), making Kleisli arrows the morphisms of a category where `unit` is identity. | Kleisli (1965), Moggi (1991) |
| **Natural Transformation** | **Přirozená transformace** | A polymorphic function `F ~> G` (`[A] => F[A] => G[A]`) converting container/effect contexts uniformly for all element types $A$ without inspecting values inside $F$. | Mac Lane (1971) |
| **Traversable Functor (`Traverse`)** | **Procházitelný funktor (`Traverse`)** | A type class generalizing structure-preserving effectful traversal (`traverse: F[A] => (A => G[B]) => G[F[B]]`) and context inversion (`sequence: F[G[A]] => G[F[A]]`) for any `Applicative` $G$. | Gibbons & Oliveira (JFP 2009) |
| **Trampolining** | **Trampolínování** | Reifying mutually or deeply recursive calls as heap-allocated thunk/continuation AST nodes (`Return`, `Suspend`, `FlatMap`) interpreted by a constant-stack tail-recursive driver loop. | Ganz, Friedman, Wand (ICFP 1999), Bjarnason (2012) |
| **Free Monad (`Free[F, A]`)** | **Volná monáda** | A recursive data structure constructing a lawful `Monad` from any functorial instruction set `F[_]` without commiting to an execution semantics, decoupling program AST from natural-transformation interpreters (`F ~> G`). | Swierstra (Data Types à la Carte 2008), Bjarnason |
| **IO Monad** | **Monáda IO** | A referentially transparent description of effectful computation suspended as an immutable value until explicitly interpreted at the "end of the world" (`unsafeRunSync`), enabling equational reasoning over programs with I/O. | Peyton Jones & Wadler (POPL 1993) |
| **Fiber** | **Vlákno na úrovni runtime (_fiber_)** | A lightweight, cooperatively scheduled green thread managed by an effect runtime (such as Cats Effect or ZIO) that parks asynchronously without blocking OS carrier threads and supports structured cancelation. | Cats Effect 3 Architecture, ZIO Runtime |
| **Stream Transducer (`Process` / Pull Stream)** | **Proudový převodník (_stream transducer_)** | A demand-driven (pull-based) state machine representing incremental transformations over effectful streams with built-in backpressure and bracketed resource finalizers. | Chiusano & Bjarnason (Ch. 15), FS2 Architecture |
| **Bracket / Resource Safety** | **Bezpečná správa zdrojů (_bracket_)** | A structured effect combinator `(acquire, use, release)` guaranteeing that the `release` finalizer executes deterministically upon normal completion, error, or asynchronous fiber cancelation. | Cats Effect `Resource`, Haskell `Control.Exception.bracket` |
