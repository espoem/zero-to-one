# Scala 3.10.1 & Effect Systems Cheat Sheet

Fast desk reference for Scala 3.10.1 (Scala CLI 1.18.0), Cats 2.13.0, Cats Effect 3.7.1, and FS2 3.16.0. Every section links to its full curriculum module.

---

## 1. Scala CLI (`scala`) & Toolchain — [Module 01](./modules/01-scala3-toolchain-tasty-and-jvm-lowering.md)

| Task | Command / Directive |
| --- | --- |
| Run project or script | `scala run examples` / `scala run Main.scala` |
| Compile main + test sources | `scala compile --test examples` |
| Run MUnit / ScalaCheck tests | `scala test examples` |
| Format & check formatting | `scala fmt examples` / `scala fmt --check examples` |
| Strict lint compile | `scala compile --test -Werror -Wunused:all examples` |
| Inspect TASTy / bytecode | `scalac -Xprint:typer File.scala` / `javap -c -p ClassName` |
| Pin Scala version & deps | `//> using scala 3.10.1` and `//> using dep org.typelevel::cats-effect:3.7.1` |
| Run via pinned `mise` tasks | `mise run fmt && mise run typecheck && mise run test && mise run lint` |

### Key Compiler Flags

| Flag | Purpose |
| --- | --- |
| `-Werror` | Fail compilation on any warning (including non-exhaustive `match`) |
| `-Wunused:all` | Report unused imports, locals, parameters, and private members |
| `-Yexplicit-nulls` | Exclude `null` from `AnyRef` subtypes (forces `T \| Null` for Java nulls) |
| `-language:strictEquality` | Enable multiversal equality (`CanEqual[L, R]`) across the compilation unit |
| `-source:3.0-migration` | Accept Scala 2 syntax during gradual migration and emit `-rewrite` fixes |
| `-Xmax-inlines 64` | Raise recursive `inline` / match-type expansion limit (default `32`) |

---

## 2. Scala 2 → Scala 3 ("Then vs now") — [Module 02](./modules/02-adts-enums-pattern-matching-and-collections.md) · [Module 10](./modules/10-production-scala-testing-interoperability-and-evolution.md)

| Concept | Scala 2 ("Then") | Scala 3 ("Now") |
| --- | --- | --- |
| Entry point | `object Main extends App` (delayed-init hazards) | `@main def run(args: String*): Unit = ...` |
| Sum-type ADT | `sealed trait Color; case object Red extends Color` | `enum Color: case Red, Green, Blue` |
| Lazy list | `Stream` (eager head, head-retention leaks) | `LazyList` (lazy head & tail; avoid `val` head retention) |
| Early return | `return` inside closure (stack-trace `NonLocalReturnControl`) | `scala.util.boundary { ... break(x) }` |
| Implicit value | `implicit val ord: Ordering[User] = ...` | `given Ordering[User] = ...` |
| Implicit param | `def sort[A](xs: List[A])(implicit o: Ordering[A])` | `def sort[A](xs: List[A])(using Ordering[A])` |
| Summon instance | `implicitly[Ordering[User]]` | `summon[Ordering[User]]` (or `summonInline[T]` in macros) |
| Extension method | `implicit class RichInt(val n: Int) extends AnyVal` | `extension (n: Int) def squared: Int = n * n` |
| Wildcard import | `import cats.implicits._` | `import cats.implicits.*` (givens need `import Mod.given`) |
| Type lambda | `Either[String, *]` (needs `kind-projector` plugin) | `[A] =>> Either[String, A]` (native syntax) |
| Zero-cost newtype | `case class Id(v: String) extends AnyVal` (boxes in generics) | `opaque type Id = String` (zero runtime boxing) |
| Intersection | `A with B` (order-sensitive compound type) | `A & B` (commutative intersection type) |
| Type projection | `Outer#Inner` (unsound for abstract `Outer`) | Restricted to concrete paths `outer.Inner` / type members |
| Structural enum | `Enumeration` (no exhaustivity, erased runtime values) | `enum` ADTs (exhaustivity checked, `values`, `ordinal`) |

---

## 3. Contextual Abstractions (`given` / `using`) — [Module 04](./modules/04-contextual-abstractions-given-using-and-typeclasses.md)

| Construct | Syntax | Semantics & Trap |
| --- | --- | --- |
| Anonymous `given` | `given Show[Int] = _.toString` | Compiler synthesizes canonical name; no orphan risk inside companion |
| Named `given` | `given intShow: Show[Int] = _.toString` | Useful for explicit overrides or disambiguation |
| Conditional `given` | `given [A: Show]: Show[List[A]] = ...` | Derives instances recursively; beware overlapping instances |
| Context parameter | `def log[A](a: A)(using s: Show[A])` | Caller passes explicitly with `(using myShow)` |
| Importing givens | `import Codecs.given` or `import Codecs.{given Show[?]}` | Wildcard `import Codecs.*` does **not** import `given`s! |
| Context function | `type Tx[A] = Session ?=> A` | Argument `Session` supplied automatically from enclosing `using` scope |
| Type-class derivation | `case class User(id: Int) derives Show` | Invokes `Show.derived` using compiler `Mirror.Of[User]` |
| `Conversion[A, B]` | `given Conversion[Int, Long] = _.toLong` | Replaces `implicit def`; requires `scala.language.implicitConversions` |

---

## 4. Type-Level Scala 3 — [Module 03](./modules/03-type-system-variance-and-type-inference.md) · [Module 05](./modules/05-type-level-scala-opaque-match-and-lambdas.md) · [Module 06](./modules/06-metaprogramming-inline-mirrors-and-macros.md)

| Construct | Example | Key Rule |
| --- | --- | --- |
| Covariant container | `enum Box[+A] { case Full(a: A); case Empty }` | Methods taking `A` must widen: `def put[B >: A](b: B): Box[B]` |
| Contravariant sink | `trait Sink[-A] { def emit(a: A): Unit }` | Parameter position is contravariant; return position is covariant |
| Union type | `type Result = Int \| String` | Unboxed, commutative (`A \| B =:= B \| A`); erased on JVM to LUB |
| Intersection type | `type NamedLogged = Named & Logged` | Value satisfies both `Named` and `Logged` simultaneously |
| Opaque type | `object Ids { opaque type UserId = String }` | Equal to `String` **only** inside `Ids`; nominal outside |
| Type lambda | `type ErrOr = [X] =>> Either[Error, X]` | Essential for higher-kinded instances (`Monad[ErrOr]`) |
| Match type | `type Elem[X] = X match { case String => Char; case Iterable[t] => t }` | Cases must be provably disjoint to reduce on abstract `X` |
| Polymorphic function | `val head: [A] => List[A] => Option[A] = [A] => xs => xs.headOption` | First-class universally quantified function value |
| `inline` / `transparent` | `transparent inline def pick(b: Boolean) = if b then 1 else "x"` | `transparent` narrows call-site return type to `1` or `"x"` |
| `Mirror` inspection | `inline erasedValue[m.MirroredElemTypes]` | Enables compile-time field traversal via `summonInline` |

---

## 5. Cats 2.13.0, Cats Effect 3.7.1 & FS2 3.16.0 — [Module 08](./modules/08-typelevel-ecosystem-cats-and-cats-effect.md) · [Module 09](./modules/09-functional-streaming-fs2-and-zio-ecosystem.md)

### Cats Type Classes & Validation

| Type Class / Data Type | Primary Combinators | Purpose |
| --- | --- | --- |
| `Semigroup[A]` / `Monoid[A]` | `a \|+\| b`, `Monoid[A].empty` | Associative binary combination + identity element |
| `Functor[F]` | `fa.map(f)`, `fa.as(b)`, `fa.void` | Structure-preserving pure transformation |
| `Applicative[F]` | `a.pure[F]`, `(fa, fb).mapN(f)`, `fa *> fb` | Independent effect/context combination (supports error accumulation) |
| `Monad[F]` | `fa.flatMap(f)`, `for ... yield`, `tailRecM` | Sequential dependent computation (short-circuits on error) |
| `Traverse[F]` | `xs.traverse(f)`, `xs.sequence` | Invert `F[G[A]]` to `G[F[A]]` while preserving shape |
| `ValidatedNel[E, A]` | `"err".invalidNel`, `v1.combine(v2)`, `(v1, v2).mapN(...)` | Accumulates all errors in `NonEmptyList[E]` (not a `Monad`) |
| `Parallel[M]` | `(ea, eb).parMapN(...)`, `xs.parTraverse(f)` | Temporarily switches `Monad` `M` (`Either`, `IO`) to parallel `Applicative` |

### Cats Effect 3 `IO` & Concurrency Primitives

| Primitive | Usage | Runtime Guarantee |
| --- | --- | --- |
| `IO(thunk)` / `IO.blocking(thunk)` | Suspend CPU vs blocking I/O | `IO.blocking` shifts work off the compute pool onto a cached blocking pool |
| `Resource.make(acq)(rel)` | `res.use(a => ...)` | `rel` runs uncancelably on normal exit, error, and fiber cancelation |
| `IO.uncancelable { poll => ... }` | Mask cancelation in critical regions | Only `poll(io)` regions remain interruptible |
| `Ref[IO].of(init)` | `ref.update(f)`, `ref.modify(f => (s2, out))` | Lock-free atomic CAS state cell |
| `Deferred[IO, A]` | `d.get`, `d.complete(a)` | Semantic single-assignment barrier (suspends fiber, never blocks OS thread) |
| `fa.start` / `fa.both(fb)` | Spawn `FiberIO[A]` / structured race-free pair | `both` cancels the sibling automatically if either fails or is canceled |

### FS2 3.16.0 Streaming Combinators

| Combinator | Behavior |
| --- | --- |
| `Stream.emits(seq)` / `Stream.eval(io)` | Create chunked pure stream or single-effect stream |
| `Stream.bracket(acq)(rel)` | Acquire scoped resource on first pull; release deterministically on completion, error, or `.take(n)` |
| `s.chunkN(n)` / `s.chunks` | Batch or inspect underlying `Chunk[O]` arrays to amortize effect-interpreter overhead |
| `s.mapAsync(maxConcurrent)(f)` | Bounded concurrent effect evaluation preserving upstream order (backpressured) |
| `s.parEvalMapUnordered(n)(f)` | Bounded concurrent evaluation emitting outputs as soon as each fiber completes |
| `s.pull.uncons` | Low-level pull state machine decomposing `Stream` into `Option[(Chunk[O], Stream[F, O])]` |
| `s.compile.toVector` / `.drain` | Lower `Stream[F, O]` into a single `F[Vector[O]]` or `F[Unit]` |
