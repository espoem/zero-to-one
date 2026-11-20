# Functional Streaming with FS2 3.16 and the ZIO 2.1 Ecosystem

The foundational theory of pull-based stream transducers (`Process`, `Await`, `Emit`, `Kill`), resource-safe brackets, and trampolined effects is established in [Functional Programming M12](../../../architecture/functional-programming/modules/12-effects-io-trampolining-st-and-streaming.md). This module examines how production Scala 3 systems execute bounded-memory streaming and typed-effect architectures across two major ecosystems: **FS2 3.16.0** on Cats Effect, and **ZIO 2.1.26** with `ZLayer`, `Scope`, and Software Transactional Memory (`STM`).

---

## 1. FS2 3.16.0: Pull-Based Chunked Streaming

**FS2** (_Functional Streams for Scala_, `co.fs2::fs2-core:3.16.0`) implements effectful, pull-based, constant-memory streams parameterized over any Cats Effect `F[_]` (`Stream[F, O]`). Unlike reactive-streams push engines where fast producers overwhelm slow consumers unless explicit `request(n)` signals are wired manually at every stage, an FS2 stream is a **demand-driven coroutine** compiled over `Pull[F, O, R]`.

### Why `Chunk[O]` Batching Matters

Evaluating one element at a time through `IO` and `Pull` state transitions incurs multiple heap allocations and virtual dispatches per item. FS2 solves this by making **`Chunk[O]`**—an immutable, array-backed or `ByteVector`-backed contiguous slice—its fundamental unit of transmission:

```mermaid
flowchart LR
    SRC["Source (Files.readAll, 64 KiB Chunks)"] -->|"Pull requests next Chunk[Byte]"| DEC["Pipe: utf8.decode & lines (Chunk-fused)"]
    DEC -->|"Chunk[String] (N lines)"| CON["parEvalMap(8)(processRecord)"]
    CON -->|"Bounded 8-fiber window + backpressure"| SINK["Sink / Take(100) Early Halt"]
    SINK -->|"Close Lexical Scope on Halt / Error / Cancel"| CLEAN["Deterministic Resource Finalizers"]
```

Inside a single `Chunk`, `.map`, `.filter`, and `.fold` execute over contiguous `Array` memory without re-entering the `Pull` interpreter, delivering orders-of-magnitude higher throughput and minimal GC churn compared to single-element streams while preserving $O(1)$ peak memory per chunk.

### `Pull[F, O, R]` and `Pipe[F, I, O]`

Whereas `Stream[F, O]` exposes declarative collection-like combinators (`map`, `filter`, `flatMap`, `through`), **`Pull[F, O, R]`** exposes explicit **step-by-step stateful recursion** emitting zero or more `Chunk[O]`s before terminating with a final result `R`:

```scala
import cats.effect.IO
import fs2.{Chunk, Pipe, Pull, Stream}

// Stateful Pipe taking elements only while a running sum stays below `limit`,
// implemented cleanly via Pull without mutable vars!
def takeWhileSumBelow(limit: Int): Pipe[IO, Int, Int] =
  def go(stream: Stream[IO, Int], acc: Int): Pull[IO, Int, Unit] =
    stream.pull.uncons.flatMap:
      case None => Pull.done
      case Some((chunk, rest)) =>
        var running = acc
        var idx     = 0
        while idx < chunk.size && running + chunk(idx) <= limit do
          running += chunk(idx)
          idx += 1
        val emitted = chunk.take(idx)
        if idx < chunk.size then
          Pull.output(emitted) >> Pull.done // Short-circuit upstream immediately!
        else
          Pull.output(emitted) >> go(rest, running)

  in => go(in, 0).stream
```

Notice two crucial properties of `takeWhileSumBelow`:

1. **Chunk-level fast loop**: Scanning `chunk` uses a local `var idx` confined inside a pure step (contextually pure, see [FP M12](../../../architecture/functional-programming/modules/12-effects-io-trampolining-st-and-streaming.md#4-local-effects-sts-a-and-rank-2-polymorphism)), emitting a single zero-copy slice `chunk.take(idx)` via `Pull.output`.
2. **Immediate upstream termination**: As soon as `idx < chunk.size`, `go` returns `Pull.done` without ever stepping `rest`, closing all upstream `Scope` resources cleanly.

### Constant-Memory I/O and Lexical `Scope` Resource Safety

`Stream.bracket(acquire)(release)` and `Stream.resource(res)` attach finalizers to FS2's internal **`Scope` tree**. Unlike `Resource.use`—which closes as soon as its callback returns—`Stream.resource` binds the resource's lifetime to the **active pull scope of the stream** and releases it deterministically the instant any of four events occurs:

1. Upstream reaches end-of-stream (`None`).
2. Downstream terminates early (e.g., `.take(5)` or `Pull.done`).
3. Either upstream or downstream raises an error.
4. The fiber running `.compile.drain` is canceled.

```scala
import cats.effect.{IO, Resource}
import fs2.Stream
import java.io.{BufferedReader, FileReader}

def linesFromFile(path: String): Stream[IO, String] =
  Stream
    .resource(Resource.fromAutoCloseable(IO.blocking(BufferedReader(FileReader(path)))))
    .flatMap: reader =>
      Stream.repeatEval(IO.blocking(Option(reader.readLine()))).unNoneTerminate
```

Calling `linesFromFile("huge-10gb.log").take(3).compile.toList` reads **at most three lines**, executes `reader.close()` on the blocking pool immediately after line 3, and holds $O(1)$ memory regardless of file size.

### Handling Errors and Resource Cleanup Inside `Stream.bracket`

When wrapping lower-level C/JVM handles directly without `Resource`, `Stream.bracketCase` exposes `ExitCase` (`Succeeded`, `Errored(e)`, `Canceled`) to the release hook for metrics and rollback differentiation:

```scala
import cats.effect.kernel.Resource.ExitCase
import cats.effect.Ref

def trackedBracket(events: Ref[IO, List[String]]): Stream[IO, Int] =
  Stream
    .bracketCase(events.update(_ :+ "acquire").as("conn")): (_, exitCase) =>
      exitCase match
        case ExitCase.Succeeded  => events.update(_ :+ "release:ok")
        case ExitCase.Errored(e) => events.update(_ :+ s"release:err:${e.getMessage}")
        case ExitCase.Canceled   => events.update(_ :+ "release:canceled")
    .flatMap(_ => Stream(1, 2, 3, 4, 5))
    .take(2)
```

Running `trackedBracket(ref).compile.toList` emits `List(1, 2)` and records `List("acquire", "release:ok")`—proving that `.take(2)` normal early truncation cleanly closes the bracket rather than treating downstream termination as an error!

### Bounded Concurrency and Backpressure

FS2 provides explicit concurrency bounds so downstream bottlenecks automatically propagate backpressure upstream without unbounded queues:

- **`parEvalMap(maxConcurrent)(f)`**: Pulls chunks upstream and evaluates `f: A => F[B]` across up to `maxConcurrent` concurrent fibers, **preserving upstream element order** in the output stream. If fiber #1 is slow while fibers #2–#8 finish, #2–#8 wait in a bounded buffer until #1 emits—providing natural head-of-line backpressure.
- **`parEvalMapUnordered(maxConcurrent)(f)`**: Emits results as soon as each fiber completes, eliminating head-of-line blocking when downstream ordering is irrelevant.
- **`parJoin(maxOpen)`**: Flattens a `Stream[F, Stream[F, O]]` by concurrently pulling from at most `maxOpen` inner streams simultaneously. Setting `maxOpen` (rather than `parJoinUnbounded`) is mandatory in network servers to cap open sockets and memory buffers.

### Time-and-Size Batching (`groupWithin`), `SignallingRef`, and `Topic`

Real ingestion pipelines batch records either when a chunk reaches `N` items or when a latency window elapses (`groupWithin`), and coordinate graceful shutdown across stages via `fs2.concurrent.{SignallingRef, Topic}`:

```scala
import cats.effect.IO
import fs2.{Chunk, Stream}
import fs2.concurrent.{SignallingRef, Topic}
import scala.concurrent.duration.*

case class Event(id: Long, payload: String)

def ingestPipeline(
    source: Stream[IO, Event],
    writeBatch: Chunk[Event] => IO[Unit],
    shutdown: SignallingRef[IO, Boolean]
): IO[Unit] =
  Topic[IO, Event].flatMap: auditTopic =>
    val ingest =
      source
        .interruptWhen(shutdown)               // Stops pulling cleanly when shutdown flips to true
        .evalTap(auditTopic.publish1)          // Broadcast each event to subscribed consumers
        .groupWithin(100, 250.millis)          // Flush every 100 items OR 250 ms, whichever comes first
        .parEvalMap(4)(writeBatch)             // Up to 4 concurrent DB batch inserts, backpressured
        .compile
        .drain

    val auditConsumer =
      auditTopic.subscribe(maxQueued = 128).evalMap(e => IO.println(s"audit:${e.id}")).compile.drain

    ingest.both(auditConsumer).void
```

Look closely at `.interruptWhen(shutdown)` vs `.take(n)`: `.interruptWhen` polls the `SignallingRef[IO, Boolean]` cooperatively at chunk boundaries and terminates the stream cleanly, flushing any in-flight `groupWithin` partial chunk if configured via `terminateAfter` or shutting down `Scope` finalizers deterministically. Similarly, `Topic.subscribe(maxQueued = 128)` enforces bounded per-subscriber queues so a slow consumer backpressures `publish1` instead of exhausting heap.

---

## 2. Then vs. Now: 2015 `Process` / `Tee` / `Wye` vs. FS2 3.16.0

In Ch 15 of _Functional Programming in Scala_ (2015), incremental I/O was taught via `Process[F, O]` (`Emit`, `Await`, `Halt`, `Kill`), deterministic dual-input `Tee[I, I2, O]`, and non-deterministic `Wye[I, I2, O]`. Modern FS2 evolved from `scalaz-stream` to fix two architectural bottlenecks in that 2015 design:

| Dimension | 2015 _FP in Scala_ `Process` | FS2 `3.16.0` | Why It Changed |
| --- | --- | --- | --- |
| Granularity | Single element `Emit(head, tail)` | `Chunk[O]` contiguous slices | Eliminates per-element `Pull` allocation and monadic dispatch |
| State machine | `Process[F, O]` with `Append` / `Await` | `Pull[F, O, R]` compiled to free scope algebra | Type-safe return value `R` simplifies stateful pipes like `uncons` |
| Dual-stream merge | `Tee` (`L` / `R`) and `Wye` (`ReceiveL` / `ReceiveR` / `Both`) | `zip` / `interleave` (pure pull) & `merge` / `parJoin` (fiber-backed) | Cats Effect `Concurrent[F]` queues/signals replace ad-hoc `Wye` state machines |
| Resource cleanup | Manual `Kill` propagation in `Process.resource` | Lexical `Scope` tree integrated with `IO.uncancelable` | Guarantees LIFO cleanup even under concurrent `parJoin` cancelation |

---

## 3. ZIO 2.1.26 Effect System

While Cats Effect models effects as a **monofunctor** `IO[+A]` (fixed error type `Throwable` and no explicit environment channel), **ZIO 2.1.26** (`dev.zio::zio:2.1.26`) models an effect as a **trifunctor/bifunctor value `ZIO[-R, +E, +A]`**:

- **`-R` (Environment)**: Contravariant input dependencies required to run the effect (`Any` when all dependencies are satisfied).
- **`+E` (Typed Error)**: Covariant **expected domain failure** channel (`Nothing` when infallible).
- **`+A` (Success)**: Covariant result type.

Conceptually, `ZIO[R, E, A]` represents a fiber-scheduled lazy computation isomorphic to `R => FiberIO[Either[E, A]]`, executed by ZIO's own work-stealing fiber runtime (`ZIOAppDefault`).

### Typed Errors (`Fail`) vs. Defects (`Die`) and `Cause[E]`

A defining design principle of ZIO 2 is separating **recoverable typed business errors (`E`)** from **unexpected runtime defects (`Throwable` / bugs)**:

1. **Typed errors (`ZIO.fail(e: E)`)**: Tracked statically in `+E`, handled by `.catchAll(e => ...)` or `.either: ZIO[R, Nothing, Either[E, A]]`.
2. **Defects (`ZIO.die(t: Throwable)` or uncaught `RuntimeException` inside `ZIO.attempt` converted via `.orDie`)**: Removed from `+E` so domain signatures stay clean (e.g., `UserService` fails with `UserError`, not `Throwable`), yet still captured safely by ZIO's fiber supervisor inside **`Cause[E]`**!

`Cause[E]` is a lossless algebraic tree recording every possible failure mode: `Fail(e)`, `Die(throwable)`, `Interrupt(fiberId)`, `Then(left, right)` (sequential error + finalizer error!), and `Both(left, right)` (parallel fiber failures in `zipPar`).

> [!IMPORTANT]
> Calling `.catchAll` on a `ZIO[R, E, A]` catches **only `Fail(e)`**, never `Die(t)` defects or fiber interruptions. To inspect or recover from defects at a top-level HTTP error boundary without catching interrupts, use `.catchAllDefect` or `.sandbox` (which surfaces `Cause[E]` in the error channel).

### `ZEnvironment` and `ZLayer` Compile-Time Dependency Graph

ZIO 2 replaces Scala 2's `Has[A]` boilerplate with **`ZEnvironment[R]`** (a type-indexed heterogeneous map using intersection types `ServiceA & ServiceB`) and **`ZLayer[-RIn, +E, +ROut]`** (resourceful recipe constructors):

```scala
import zio.*

trait Metrics:
  def inc(name: String): UIO[Unit]

case class MetricsLive(ref: Ref[Map[String, Long]]) extends Metrics:
  def inc(name: String): UIO[Unit] =
    ref.update(m => m.updatedWith(name)(v => Some(v.getOrElse(0L) + 1L)))

object MetricsLive:
  val layer: ULayer[Metrics] =
    ZLayer.fromZIO(Ref.make(Map.empty[String, Long]).map(MetricsLive(_)))

case class OrderService(metrics: Metrics):
  def placeOrder(id: String): ZIO[Any, String, Unit] =
    if id.isEmpty then ZIO.fail("empty order id")
    else metrics.inc("orders.placed")

object OrderService:
  val layer: URLayer[Metrics, OrderService] = ZLayer.fromFunction(OrderService(_))

object App extends ZIOAppDefault:
  val program: ZIO[OrderService, String, Unit] =
    ZIO.serviceWithZIO[OrderService](_.placeOrder("ord-42"))

  def run: ZIO[Any, Any, Unit] =
    program.provide(OrderService.layer, MetricsLive.layer).ignore
```

Notice `.provide(OrderService.layer, MetricsLive.layer)`: a Scala 3 macro analyzes the `ZLayer` inputs and outputs **at compile time**, constructs the minimal topological DAG (sharing diamond dependencies once per graph), fails compilation with a human-readable missing-dependency message if `MetricsLive.layer` is omitted, and wraps any `ZLayer.scoped` resources inside a `Scope` closed automatically on shutdown!

### `Scope` and Software Transactional Memory (`STM`)

ZIO 2 encodes scoped resources directly via the environment type `Scope`: `ZIO.acquireRelease(acquire)(release)` produces `ZIO[Scope, E, A]`, which composes inside `for`-comprehensions and automatically runs all release finalizers in LIFO order when wrapped in `ZIO.scoped(...)`.

For complex multi-entity atomic state—such as transferring funds between two accounts without deadlocking on lock ordering—ZIO ships **Software Transactional Memory (`zio.stm`)**:

```scala
import zio.*
import zio.stm.*

def transfer(from: TRef[Long], to: TRef[Long], amount: Long): STM[String, Unit] =
  for
    bal <- from.get
    _   <- if bal < amount then STM.fail("insufficient funds") else STM.unit
    _   <- from.update(_ - amount)
    _   <- to.update(_ + amount)
  yield ()

// Wait semantically until `from` has enough funds, without polling!
def awaitAndTransfer(from: TRef[Long], to: TRef[Long], amount: Long): UIO[Unit] =
  (for
    bal <- from.get
    _   <- STM.check(bal >= amount) // Calls STM.retry if false; wakes ONLY when `from` changes!
    _   <- from.update(_ - amount)
    _   <- to.update(_ + amount)
  yield ()).commit
```

Under `.commit` (`STM.atomically`), ZIO executes the transaction against a thread-local transaction log, validates read/write version stamps atomically on commit, retries transparently on write-skew conflicts, and suspends fibers via `STM.retry` (`STM.check`) until a participating `TRef`/`TMap` is modified by another fiber. Alongside `STM`, ZIO provides `Queue` and `Hub` (a backpressured publish-subscribe broadcast channel where slow subscribers either throttle publishers or drop selectively).

### Composable `Schedule` Retries, `ZStream`, and `TestClock`

ZIO turns retry, repetition, and exponential backoff policies into composable algebraic values via `Schedule[-Env, -In, +Out]`:

```scala
import zio.*
import zio.stream.*

val retryPolicy: Schedule[Any, Throwable, (Long, Long)] =
  (Schedule.exponential(50.millis).jittered && Schedule.recurs(5))
    .whileInput[Throwable](!_.isInstanceOf[IllegalArgumentException])

def resilientCall(op: Task[String]): Task[String] =
  op.retry(retryPolicy)

// ZStream (zio-streams) mirrors pull-based chunking via ZChannel + Chunk
def batchedStream(queue: Dequeue[Int]): ZStream[Any, Nothing, Chunk[Int]] =
  ZStream.fromQueue(queue).groupedWithin(64, 100.millis)

// Scoped resource acquisition directly inside ZStream
def managedLines(acquire: Task[java.io.BufferedReader]): ZStream[Any, Throwable, String] =
  ZStream.acquireReleaseWith(acquire)(r => ZIO.attemptBlocking(r.close()).ignore)
    .flatMap(r => ZStream.repeatZIOOption(ZIO.attemptBlocking(Option(r.readLine())).mapError(Some(_)).some))
```

For deterministic unit testing of timed pipelines and retry schedules, `zio-test`'s `ZIOSpecDefault` injects a simulated `TestClock` automatically—allowing tests to verify a 10-minute exponential backoff schedule in microseconds via `TestClock.adjust(10.minutes)` without wall-clock `sleep` flakiness:

```scala
import zio.test.*

object RetrySpec extends ZIOSpecDefault:
  def spec = test("retries exponential backoff deterministically"):
    for
      attempts <- Ref.make(0)
      fiber    <- resilientCall(attempts.updateAndGet(_ + 1).flatMap(_ => ZIO.fail(RuntimeException("transient")))).either.fork
      _        <- TestClock.adjust(5.minutes)
      result   <- fiber.join
      count    <- attempts.get
    yield assertTrue(result.isLeft && count == 6)
```

For multi-subscriber broadcast with backpressure, `Hub.bounded[Event](128)` replaces manual `Queue` fan-out loops; every subscriber obtains a scoped `Dequeue[Event]` via `hub.subscribe`, and `Hub` applies backpressure automatically when the slowest subscriber fills its 128-slot ring buffer:

```scala
def broadcastOrders(orders: List[String]): ZIO[Any, Nothing, List[String]] =
  ZIO.scoped:
    for
      hub <- Hub.bounded[String](32)
      s1  <- hub.subscribe
      s2  <- hub.subscribe
      _   <- ZIO.foreachDiscard(orders)(hub.publish).fork
      r1  <- ZIO.foreach(orders)(_ => s1.take)
      r2  <- ZIO.foreach(orders)(_ => s2.take)
    yield r1 ++ r2
```

Notice `ZIO.scoped`: once the `scoped` block completes (or if an upstream fiber is interrupted), `s1` and `s2` subscriptions are automatically unsubscribed from `hub` so a terminated subscriber never stalls other subscribers or leaks queue slots!

---

## 4. Architectural Comparison: Cats Effect 3 + FS2 vs. ZIO 2 vs. Ox + Capture Checking

| Dimension | Cats Effect 3.7 + FS2 3.16 | ZIO 2.1.26 (`zio-streams`) | Direct-Style Ox 1.0.9 + Capture Checking |
| --- | --- | --- | --- |
| Effect representation | `IO[+A]` (or Tagless Final `F[_]`) | `ZIO[-R, +E, +A]` (typed env & error) | Plain `T` on JDK 25 Virtual Threads (`throws` \| `Either`) |
| Referential transparency | Strict (reified lazy AST) | Strict (reified lazy AST) | Imperative direct calls (purity enforced by discipline / `caps`) |
| Error model | `Throwable` (or `EitherT[IO, E, A]` \| `MonadError`) | Bifunctor typed `E` + lossless `Cause[E]` defects | `Either` \| `boundary`/`break` \| experimental `CanThrow[E]` |
| Dependency injection | Manual constructor wiring / `Resource` / `Kleisli` | Built-in `ZEnvironment` & compile-time `ZLayer` DAG | Plain constructor parameters / `using` context params |
| Streaming engine | FS2 `Stream[F, O]` (`Chunk` + `Pull` + `Scope`) | `ZStream[-R, +E, +O]` (`ZChannel` + `Chunk`) | `ox.flow.Flow` over Virtual Threads & CSP `Channel` |
| Shared atomic state | `Ref` + `Deferred` + `Semaphore` | `Ref` + `Promise` + `Hub` + composable `STM` | `Atomic*` \| CSP `Channel` (`select`) \| `Actor` |
| Stack traces & debugging | Async fiber traces (CE3 tracing) | Built-in zero-cost fiber dumps & `ZTrace` | Standard JVM stack traces on Virtual Threads! |
| Ecosystem & maturity | Broadest pure-FP library ecosystem (`http4s`, `doobie`, `skunk`) | Unified all-in-one batteries-included stack (`zio-http`, `zio-json`) | Lightweight direct-style libraries on JDK 21+/25 |

---

## 5. Production Failure Modes and Negative Examples

1. **Single-element FS2 streams (`chunkSize = 1`)**: Writing `Stream.unfoldEval(0)(...)` emits one-element chunks, forcing every downstream `.map` and `.filter` to traverse the `Pull` interpreter on every integer. Prefer `Stream.unfoldChunkEval` or `.chunkN(1024)` / `Files[IO].readAll` so downstream operators fuse over multi-kilobyte chunks.
2. **Unbounded `parJoinUnbounded` / `parEvalMap(Int.MaxValue)`**: Replacing bounded `parEvalMap(32)` with `parJoinUnbounded` spawns an arbitrary number of concurrent fibers when input spikes, exhausting file descriptors, database connection pools, and heap memory. Always pass an explicit concurrency cap derived from downstream pool limits.
3. **Side effects inside ZIO `STM`**: Calling `println` or external HTTP requests inside an `STM` transaction (via `Unsafe`) executes multiple times whenever optimistic validation detects a conflict and retries. Perform only `TRef`/`TMap`/`TQueue` mutations inside `STM` and trigger external effects _after_ `.commit` succeeds.
4. **Silent defect swallowing vs. missing defects in ZIO `catchAll`**: Using `.catchAll(_ => fallback)` catches only typed `E` failures while letting `NullPointerException` (`Die`) crash the fiber; conversely, wrapping everything in `ZIO.attempt` + `.orDie` suppresses typed error handling. Match domain errors in `E` and handle unexpected defects at service supervision boundaries via `.sandbox` or `.catchAllDefect`.

```scala
// Negative FS2 chunking anti-pattern vs fixed chunked stream:
val slowByteByByte: Stream[IO, Byte] =
  Stream.eval(IO.pure(0.toByte)).repeat.take(100_000) // 100,000 separate size-1 chunks!

val fastChunked: Stream[IO, Byte] =
  Stream.chunk(Chunk.array(Array.fill[Byte](4096)(0))).repeat.take(100_000) // ~25 pulls total!
```

Notice the orders-of-magnitude allocation gap: `slowByteByByte` enters the `Pull` interpreter 100,000 times, whereas `fastChunked` performs only 25 `Pull` transitions for the exact same byte volume.

Similarly, wrapping side effects inside ZIO `STM` breaks atomicity guarantees on conflict retries:

```scala
import zio.stm.*

// Negative STM anti-pattern: side effects execute multiple times under optimistic contention!
def unsafeTransferLog(a: TRef[Int], b: TRef[Int]): UIO[Unit] =
  STM.atomically:
    for
      x <- a.get
      _ <- a.set(x - 1)
      _ <- b.update(_ + 1)
      _ = println("WARNING: may print N times on retry!") // ❌ Never perform I/O inside STM!
    yield ()
```

Keep `STM` blocks strictly limited to `TRef`, `TMap`, and `TQueue` operations, and run logging or network I/O **after** `.commit` returns.

---

## Interview Drill

1. **Why does FS2 represent streams around `Chunk[O]` rather than single elements, and what happens if a producer emits size-1 chunks?**

<details><summary>Answer</summary>

`Pull` state transitions and Cats Effect `IO` bindings carry per-step heap and dispatch overhead. Grouping elements into contiguous array-backed `Chunk[O]`s allows `map`, `filter`, and codecs like `utf8.decode` to run tight JVM loops over arrays inside one chunk, amortizing `Pull` overhead across thousands of items. Emitting size-1 chunks (`unfoldEval` instead of `unfoldChunkEval`) forfeits that amortization and degrades throughput by an order of magnitude or more.

</details>

2. **How does `Stream.resource` ensure deterministic cleanup on `.take(5)` without loading the entire resource into memory?**

<details><summary>Answer</summary>

`Stream.resource` registers the `Resource`'s acquisition and release inside FS2's lexical `Scope` tree rather than running `Resource.use` up front. Downstream pulls chunks lazily; the moment `.take(5)` emits its fifth element, `.take` returns `Pull.done` without pulling further, triggering `Scope.close` to execute the release finalizer immediately on the active fiber.

</details>

3. **Contrast `parEvalMap` and `parEvalMapUnordered` in FS2 with respect to latency, throughput, and backpressure.**

<details><summary>Answer</summary>

Both bound concurrency to `maxConcurrent` fibers and backpressure upstream when all slots are occupied. `parEvalMap` preserves strict input order: if item #1 takes 500 ms while items #2–#16 take 5 ms, items #2–#16 wait in a bounded queue behind #1 (head-of-line blocking), increasing tail latency and stalling slot reuse. `parEvalMapUnordered` emits each result immediately upon completion, maximizing throughput when ordering is not required.

</details>

4. **In ZIO 2, what is the difference between a typed error (`Fail(e)`), a defect (`Die(t)`), and `Cause[E]`?**

<details><summary>Answer</summary>

Typed errors (`E` in `ZIO[R, E, A]`) represent expected, recoverable domain failures handled by `catchAll` or `foldZIO`. Defects (`Die(t)`) represent unexpected bugs or unchecked exceptions removed from `E` (e.g., via `orDie`). Both—along with fiber `Interrupt` and sequential/parallel error composition (`Then`, `Both`)—are preserved losslessly inside `Cause[E]`, which can be inspected via `.sandbox` or `.catchAllCause`.

</details>

5. **How does `ZIO.provide(layerA, layerB)` resolve dependencies differently from runtime DI containers like Spring or Guice?**

<details><summary>Answer</summary>

Runtime DI containers scan annotations and wire graphs via reflection at startup, discovering missing bindings or cycles only when the JVM boots. `ZIO.provide` runs a compile-time Scala 3 macro that inspects the `ZEnvironment` input/output types of each `ZLayer`, rejects missing or circular dependencies as compiler errors, deduplicates shared diamond layers, and attaches `Scope` lifecycles automatically.

</details>

6. **How does ZIO `STM.check` (or `STM.retry`) avoid busy-waiting without holding OS locks?**

<details><summary>Answer</summary>

During an `STM` transaction, ZIO records every `TRef` read in a transaction log. When `STM.retry` runs (because a condition in `STM.check` is false), ZIO aborts the current attempt, attaches the fiber as a waiter onto every `TRef` in its read set, and semantically suspends the fiber. The fiber wakes up only when another committed transaction modifies at least one of those `TRef`s.

</details>

7. **How would you decide between Cats Effect 3 + FS2, ZIO 2, and Ox + Virtual Threads for a new Scala 3 microservice?**

<details><summary>Answer</summary>

Choose **Cats Effect 3 + FS2** when you value maximum pure-FP ecosystem interoperability (`http4s`, `doobie`, `skunk`), strict separation of typed algebras, and rock-solid pull streaming. Choose **ZIO 2** when you want an integrated all-in-one stack with compile-time `ZLayer` DI, typed error channel `E` + `Cause`, and built-in `STM` / `Schedule`. Choose **Ox + JDK 25 Virtual Threads** when the team prefers direct-style imperative/functional Scala with native JVM stack traces, minimal effect-type ceremony, and structured concurrency without monadic `flatMap` wrappers.

</details>

8. **How does `groupWithin(N, d)` behave under upstream stalls vs. bursts, and how does `interruptWhen` coordinate clean shutdown?**

<details><summary>Answer</summary>

`groupWithin(N, d)` races upstream chunk arrival against a `d` timer: under high throughput it emits full `Chunk`s of size `N` immediately without waiting for `d`; under sparse traffic it flushes whatever partial items arrived as soon as `d` expires, bounding tail latency. Pairing it with `.interruptWhen(shutdownSignal)` triggers clean stream termination at the next pull point when `shutdownSignal` turns `true`, allowing finalizers and `Scope` resources to close cleanly instead of killing the fiber mid-batch.

</details>
