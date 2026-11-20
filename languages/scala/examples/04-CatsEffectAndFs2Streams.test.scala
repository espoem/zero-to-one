package scalafp.examples

import cats.effect.{Deferred, IO, Ref, Resource}
import cats.effect.unsafe.implicits.global
import cats.implicits.*
import fs2.{Pull, Stream}

class CatsEffectAndFs2StreamsSuite extends munit.FunSuite:

  test("Cats Effect IO is stack-safe across 100,000 chained flatMap operations") {
    def countDown(n: Int): IO[Int] =
      if n <= 0 then IO.pure(0)
      else IO.pure(n - 1).flatMap(countDown)

    val result = countDown(100_000).unsafeRunSync()
    assertEquals(result, 0)
  }

  test(
    "Resource.make executes finalizers deterministically on normal exit, error, and cancelation"
  ) {
    val program = for
      log <- Ref[IO].of(Vector.empty[String])
      acquiredGate <- Deferred[IO, Unit]

      mkRes = Resource.make(log.update(_ :+ "acquire"))(_ => log.update(_ :+ "release"))

      // 1. Normal completion
      _ <- mkRes.use(_ => log.update(_ :+ "use-ok"))

      // 2. Error inside use
      _ <- mkRes
        .use(_ => log.update(_ :+ "use-err") *> IO.raiseError[Unit](new RuntimeException("boom")))
        .attempt

      // 3. Fiber cancelation while suspended inside use
      fiber <- mkRes
        .use(_ => acquiredGate.complete(()) *> IO.never[Unit])
        .start
      _ <- acquiredGate.get
      _ <- fiber.cancel
      outcome <- fiber.join

      events <- log.get
    yield (outcome.isCanceled, events)

    val (wasCanceled, events) = program.unsafeRunSync()
    assert(wasCanceled, "Expected fiber outcome to be Canceled")
    assertEquals(
      events,
      Vector(
        "acquire",
        "use-ok",
        "release",
        "acquire",
        "use-err",
        "release",
        "acquire",
        "release"
      )
    )
  }

  test("Ref + parTraverse provides lock-free atomic updates across 1,000 concurrent fibers") {
    val program = for
      counter <- Ref[IO].of(0)
      _ <- (1 to 1_000).toList.parTraverse_(_ => counter.update(_ + 1))
      total <- counter.get
    yield total

    assertEquals(program.unsafeRunSync(), 1_000)
  }

  test("Deferred coordinates producer and consumer fibers without busy-waiting") {
    val program = for
      gate <- Deferred[IO, String]
      consumer <- gate.get.map(msg => s"received:$msg").start
      _ <- IO.cede
      _ <- gate.complete("hello-fiber")
      result <- consumer.joinWithNever
    yield result

    assertEquals(program.unsafeRunSync(), "received:hello-fiber")
  }

  test("FS2 Pull-based chunked Stream runs bracket finalizers on early take(3) termination") {
    def takeFirst3ViaPull[F[_], O](s: Stream[F, O]): Stream[F, O] =
      def go(rem: Int, stream: Stream[F, O]): Pull[F, O, Unit] =
        if rem <= 0 then Pull.done
        else
          stream.pull.uncons.flatMap {
            case Some((chunk, tail)) =>
              if chunk.size <= rem then Pull.output(chunk) >> go(rem - chunk.size, tail)
              else Pull.output(chunk.take(rem)) >> Pull.done
            case None => Pull.done
          }
      go(3, s).stream

    val program = for
      events <- Ref[IO].of(Vector.empty[String])
      stream = Stream
        .bracket(events.update(_ :+ "open"))(_ => events.update(_ :+ "close"))
        .flatMap { _ =>
          Stream.emits(1 to 100).chunkLimit(2).unchunks.evalTap(n => events.update(_ :+ s"emit:$n"))
        }
      collected <- takeFirst3ViaPull(stream).compile.toVector
      recorded <- events.get
    yield (collected, recorded)

    val (collected, recorded) = program.unsafeRunSync()
    assertEquals(collected, Vector(1, 2, 3))
    assertEquals(recorded.head, "open")
    assertEquals(recorded.last, "close")
    assert(recorded.count(_.startsWith("emit:")) <= 4, s"Unexpected over-evaluation: $recorded")
  }

  test("FS2 Stream.bracket runs cleanup even when downstream fails mid-stream") {
    val program = for
      closed <- Ref[IO].of(false)
      failingStream = Stream
        .bracket(IO.unit)(_ => closed.set(true))
        .flatMap(_ =>
          Stream(1, 2, 3).evalMap(n =>
            if n == 2 then IO.raiseError[Int](new IllegalStateException("bad")) else IO.pure(n)
          )
        )
      res <- failingStream.compile.toList.attempt
      wasClosed <- closed.get
    yield (res.isLeft, wasClosed)

    val (failed, wasClosed) = program.unsafeRunSync()
    assert(failed)
    assert(wasClosed)
  }
