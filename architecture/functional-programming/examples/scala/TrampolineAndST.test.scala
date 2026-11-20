import munit.ScalaCheckSuite
import org.scalacheck.Prop.forAll
import scala.annotation.tailrec
import scala.compiletime.testing.typeChecks

// -----------------------------------------------------------------------------
// Module 12: Stack-Safe TailRec Trampoline & Free Monad
// -----------------------------------------------------------------------------
enum TailRec[A]:
  case Return(value: A)
  case Suspend(resume: () => TailRec[A])
  case FlatMap[A, B](sub: TailRec[A], k: A => TailRec[B]) extends TailRec[B]

  def flatMap[B](f: A => TailRec[B]): TailRec[B] =
    TailRec.FlatMap(this, f)

  def map[B](f: A => B): TailRec[B] =
    flatMap(a => TailRec.Return(f(a)))

object TailRec:
  @tailrec
  def run[A](tr: TailRec[A]): A = tr match
    case Return(v)  => v
    case Suspend(r) => run(r())
    case FlatMap(sub, k) =>
      sub match
        case Return(a)     => run(k(a))
        case Suspend(r)    => run(FlatMap(r(), k))
        case FlatMap(y, g) => run(FlatMap(y, a => FlatMap(g(a), k)))

// -----------------------------------------------------------------------------
// Module 12: Scoped Local Mutable State (ST) via Rank-2 Polymorphism
// -----------------------------------------------------------------------------
sealed trait ST[S, A]:
  self =>
  protected def run(s: S): (A, S)

  def map[B](f: A => B): ST[S, B] = new ST[S, B]:
    def run(s: S): (B, S) =
      val (a, s2) = self.run(s)
      (f(a), s2)

  def flatMap[B](f: A => ST[S, B]): ST[S, B] = new ST[S, B]:
    def run(s: S): (B, S) =
      val (a, s2) = self.run(s)
      f(a).run(s2)

object ST:
  // Evaluate `a` freshly on each `run(s)` so reusable actions like `val r = ref.read`
  // observe subsequent mutations rather than returning a stale memoized snapshot.
  def apply[S, A](a: => A): ST[S, A] = new ST[S, A]:
    def run(s: S): (A, S) = (a, s)

  // Scala 3 polymorphic function type `[S] => () => ST[S, A]` enforces rank-2
  // universal quantification: S cannot escape into return type A!
  def runST[A](st: [S] => () => ST[S, A]): A =
    st[Unit]().run(())._1

final class STRef[S, A] private (private var cell: A):
  def read: ST[S, A] = ST(cell)
  def write(a: A): ST[S, Unit] = new ST[S, Unit]:
    def run(s: S): (Unit, S) =
      cell = a
      ((), s)

object STRef:
  def apply[S, A](a: A): ST[S, STRef[S, A]] = ST(new STRef[S, A](a))

final class STArray[S, A] private (private val arr: Array[A]):
  def size: ST[S, Int] = ST(arr.length)
  def read(i: Int): ST[S, A] = ST(arr(i))
  def write(i: Int, a: A): ST[S, Unit] = new ST[S, Unit]:
    def run(s: S): (Unit, S) =
      arr(i) = a
      ((), s)
  def swap(i: Int, j: Int): ST[S, Unit] =
    for
      vi <- read(i)
      vj <- read(j)
      _ <- write(i, vj)
      _ <- write(j, vi)
    yield ()
  def freeze: ST[S, List[A]] = ST(arr.toList)

object STArray:
  def fromList[S, A: reflect.ClassTag](xs: List[A]): ST[S, STArray[S, A]] =
    ST(new STArray[S, A](xs.toArray))

object PureQuicksort:
  private def partition[S](arr: STArray[S, Int], l: Int, r: Int, pivotIdx: Int): ST[S, Int] =
    for
      pivotVal <- arr.read(pivotIdx)
      _ <- arr.swap(pivotIdx, r)
      jRef <- STRef[S, Int](l)
      _ <- (l until r).foldLeft(ST[S, Unit](())) { (acc, i) =>
        for
          _ <- acc
          vi <- arr.read(i)
          _ <-
            if vi < pivotVal then
              for
                j <- jRef.read
                _ <- arr.swap(i, j)
                _ <- jRef.write(j + 1)
              yield ()
            else ST[S, Unit](())
        yield ()
      }
      j <- jRef.read
      _ <- arr.swap(j, r)
    yield j

  private def qs[S](arr: STArray[S, Int], l: Int, r: Int): ST[S, Unit] =
    if l < r then
      for
        pi <- partition(arr, l, r, l + (r - l) / 2)
        _ <- qs(arr, l, pi - 1)
        _ <- qs(arr, pi + 1, r)
      yield ()
    else ST[S, Unit](())

  def sort(xs: List[Int]): List[Int] =
    if xs.isEmpty then Nil
    else
      ST.runST(
        [S] =>
          () =>
            for
              arr <- STArray.fromList[S, Int](xs)
              len <- arr.size
              _ <- qs(arr, 0, len - 1)
              sorted <- arr.freeze
            yield sorted
      )

class TrampolineAndSTSuite extends ScalaCheckSuite:

  test("TailRec trampoline survives 100,000 chained flatMaps without StackOverflowError"):
    val n = 100_000
    val prog = (0 until n).foldLeft(TailRec.Return(0): TailRec[Int]) { (acc, _) =>
      acc.flatMap(x => TailRec.Suspend(() => TailRec.Return(x + 1)))
    }
    assertEquals(TailRec.run(prog), n)

  property("Pure ST in-place Quicksort is referentially transparent and matches List.sorted"):
    forAll: (xs: List[Int]) =>
      assertEquals(PureQuicksort.sort(xs), xs.sorted)

  test("STRef.read observes subsequent writes when the same ST action is reused"):
    val pair = ST.runST(
      [S] =>
        () =>
          for
            ref <- STRef[S, Int](10)
            readRef = ref.read
            before <- readRef
            _ <- ref.write(99)
            after <- readRef
          yield (before, after)
    )
    assertEquals(pair, (10, 99))

  test("Negative compile-time proof: STRef[S, Int] cannot escape rank-2 ST.runST"):
    val escapesRef = typeChecks(
      """
      val leaked = ST.runST([S] => () => STRef[S, Int](0))
      """
    )
    assert(!escapesRef, "STRef[S, Int] must not escape rank-2 quantified S")

    val escapesArray = typeChecks(
      """
      val leaked = ST.runST([S] => () => STArray.fromList[S, Int](List(1, 2, 3)))
      """
    )
    assert(!escapesArray, "STArray[S, Int] must not escape rank-2 quantified S")
