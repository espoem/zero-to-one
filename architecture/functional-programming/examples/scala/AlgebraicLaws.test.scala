import munit.ScalaCheckSuite
import org.scalacheck.{Arbitrary, Gen, Prop}
import org.scalacheck.Prop.forAll
import scala.compiletime.testing.typeChecks

// -----------------------------------------------------------------------------
// Higher-Kinded Type Classes in Scala 3 (Monoid, Functor, Applicative, Monad, Traverse)
// -----------------------------------------------------------------------------
trait Monoid[A]:
  def empty: A
  def combine(x: A, y: A): A

object Monoid:
  given Monoid[Int] with
    def empty: Int = 0
    def combine(x: Int, y: Int): Int = x + y

  given Monoid[String] with
    def empty: String = ""
    def combine(x: String, y: String): String = x + y

  given [A](using ma: Monoid[A]): Monoid[Option[A]] with
    def empty: Option[A] = None
    def combine(x: Option[A], y: Option[A]): Option[A] = (x, y) match
      case (Some(a), Some(b)) => Some(ma.combine(a, b))
      case (Some(_), None)    => x
      case (None, Some(_))    => y
      case (None, None)       => None

  given [A]: Monoid[List[A]] with
    def empty: List[A] = Nil
    def combine(x: List[A], y: List[A]): List[A] = x ++ y

trait Functor[F[_]]:
  def map[A, B](fa: F[A])(f: A => B): F[B]

trait Applicative[F[_]] extends Functor[F]:
  def unit[A](a: => A): F[A]
  def map2[A, B, C](fa: F[A], fb: F[B])(f: (A, B) => C): F[C]

  override def map[A, B](fa: F[A])(f: A => B): F[B] =
    map2(fa, unit(()))((a, _) => f(a))

  def apply[A, B](fab: F[A => B])(fa: F[A]): F[B] =
    map2(fab, fa)((f, a) => f(a))

  def product[A, B](fa: F[A], fb: F[B]): F[(A, B)] =
    map2(fa, fb)((_, _))

trait Monad[F[_]] extends Applicative[F]:
  def flatMap[A, B](fa: F[A])(f: A => F[B]): F[B]

  override def map[A, B](fa: F[A])(f: A => B): F[B] =
    flatMap(fa)(a => unit(f(a)))

  override def map2[A, B, C](fa: F[A], fb: F[B])(f: (A, B) => C): F[C] =
    flatMap(fa)(a => map(fb)(b => f(a, b)))

  def compose[A, B, C](f: A => F[B], g: B => F[C]): A => F[C] =
    a => flatMap(f(a))(g)

trait Traverse[F[_]] extends Functor[F]:
  def traverse[G[_]: Applicative, A, B](fa: F[A])(f: A => G[B]): G[F[B]]
  def sequence[G[_]: Applicative, A](fga: F[G[A]]): G[F[A]] =
    traverse(fga)(identity)

// Pure State[S, A]
final case class State[S, A](run: S => (A, S))

object State:
  def get[S]: State[S, S] = State(s => (s, s))
  def set[S](s: S): State[S, Unit] = State(_ => ((), s))

  given stateMonad[S]: Monad[[X] =>> State[S, X]] with
    def unit[A](a: => A): State[S, A] = State(s => (a, s))
    def flatMap[A, B](fa: State[S, A])(f: A => State[S, B]): State[S, B] =
      State { s =>
        val (a, s2) = fa.run(s)
        f(a).run(s2)
      }

// Validated[E, A] for error-accumulating Applicative (cannot have a lawful Monad)
enum Validated[+E, +A]:
  case Valid(value: A)
  case Invalid(error: E)

object Validated:
  given validatedApplicative[E](using me: Monoid[E]): Applicative[[X] =>> Validated[E, X]] with
    def unit[A](a: => A): Validated[E, A] = Valid(a)
    def map2[A, B, C](fa: Validated[E, A], fb: Validated[E, B])(f: (A, B) => C): Validated[E, C] =
      (fa, fb) match
        case (Valid(a), Valid(b))       => Valid(f(a, b))
        case (Invalid(e1), Invalid(e2)) => Invalid(me.combine(e1, e2))
        case (Invalid(e), _)            => Invalid(e)
        case (_, Invalid(e))            => Invalid(e)

given optionMonad: Monad[Option] with
  def unit[A](a: => A): Option[A] = Some(a)
  def flatMap[A, B](fa: Option[A])(f: A => Option[B]): Option[B] = fa.flatMap(f)

given listTraverse: Traverse[List] with
  def map[A, B](fa: List[A])(f: A => B): List[B] = fa.map(f)
  def traverse[G[_], A, B](fa: List[A])(f: A => G[B])(using G: Applicative[G]): G[List[B]] =
    fa.foldRight(G.unit(List.empty[B]))((a, acc) => G.map2(f(a), acc)(_ :: _))

class AlgebraicLawsSuite extends ScalaCheckSuite:

  given [E: Arbitrary, A: Arbitrary]: Arbitrary[Validated[E, A]] =
    Arbitrary(
      Gen.oneOf(
        Arbitrary.arbitrary[E].map(Validated.Invalid.apply),
        Arbitrary.arbitrary[A].map(Validated.Valid.apply)
      )
    )

  private def checkMonoidLaws[A: Arbitrary: Monoid](name: String): Unit =
    val m = summon[Monoid[A]]
    property(s"Monoid[$name]: associativity and identity"):
      forAll: (x: A, y: A, z: A) =>
        assertEquals(m.combine(m.combine(x, y), z), m.combine(x, m.combine(y, z)))
        assertEquals(m.combine(m.empty, x), x)
        assertEquals(m.combine(x, m.empty), x)

  checkMonoidLaws[Int]("Int")
  checkMonoidLaws[String]("String")
  checkMonoidLaws[Option[Int]]("Option[Int]")

  property("Monad[[X] =>> State[Int, X]] laws via Scala 3 type lambda"):
    val M = summon[Monad[[X] =>> State[Int, X]]]
    val f: Int => State[Int, Int] = x => State(s => (x + s, s + 1))
    val g: Int => State[Int, Int] = x => State(s => (x * 2, s + 3))

    forAll: (x: Int, init: Int) =>
      // Left identity: unit(x).flatMap(f) == f(x)
      assertEquals(M.flatMap(M.unit(x))(f).run(init), f(x).run(init))
      // Right identity: m.flatMap(unit) == m
      val m = f(x)
      assertEquals(M.flatMap(m)(M.unit(_)).run(init), m.run(init))
      // Associativity: m.flatMap(f).flatMap(g) == m.flatMap(a => f(a).flatMap(g))
      assertEquals(
        M.flatMap(M.flatMap(m)(f))(g).run(init),
        M.flatMap(m)(a => M.flatMap(f(a))(g)).run(init)
      )

  property("Applicative[[X] =>> Validated[List[String], X]] satisfies all 4 laws"):
    val A = summon[Applicative[[X] =>> Validated[List[String], X]]]
    val fn1: Int => Int = _ + 10
    def assoc[X, Y, Z](p: (X, (Y, Z))): ((X, Y), Z) = ((p._1, p._2._1), p._2._2)

    forAll:
      (
          va: Validated[List[String], Int],
          vb: Validated[List[String], Int],
          vc: Validated[List[String], Int],
          x: Int
      ) =>
        // 1. Identity
        assertEquals(A.apply(A.unit(identity[Int]))(va), va)
        // 2. Homomorphism
        assertEquals(A.apply(A.unit(fn1))(A.unit(x)), A.unit(fn1(x)))
        // 3. Interchange
        val vf: Validated[List[String], Int => Int] = A.map(va)(_ => fn1)
        assertEquals(A.apply(vf)(A.unit(x)), A.apply(A.unit((f: Int => Int) => f(x)))(vf))
        // 4. Associativity
        assertEquals(
          A.product(A.product(va, vb), vc),
          A.map(A.product(va, A.product(vb, vc)))(assoc)
        )

  property("Traverse[List] identity law and zipWithIndex via State"):
    val T = summon[Traverse[List]]
    forAll: (xs: List[Int]) =>
      // Identity: traverse(xs)(Some(_)) == Some(xs)
      assertEquals(T.traverse(xs)(x => Option(x)), Some(xs))

      // State-based zipWithIndex
      val (indexed, finalCount) =
        T.traverse[[X] =>> State[Int, X], Int, (Int, Int)](xs)(a => State(i => ((a, i), i + 1)))
          .run(0)
      assertEquals(indexed, xs.zipWithIndex)
      assertEquals(finalCount, xs.length)

  test("Negative compile-time proof: covariant +A rejected in contravariant parameter position"):
    val compiles = typeChecks(
      """
      trait Box[+A]:
        def put(a: A): Unit
      """
    )
    assert(!compiles, "Covariant +A in parameter position must be rejected by Scala 3 compiler")

  test("Negative property proof: subtraction fails Monoid associativity"):
    val prop = Prop.forAll { (a: Int, b: Int, c: Int) =>
      (a - b) - c == a - (b - c)
    }
    val res = org.scalacheck.Test.check(org.scalacheck.Test.Parameters.default, prop)
    assert(!res.passed, "Subtraction must falsify associativity")
