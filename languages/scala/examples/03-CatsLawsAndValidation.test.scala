package scalafp.examples

import cats.*
import cats.data.{Validated, ValidatedNel}
import cats.implicits.*
import org.scalacheck.{Arbitrary, Gen, Prop, Test}
import org.scalacheck.Prop.forAll

class CatsLawsAndValidationSuite extends munit.ScalaCheckSuite:

  // Helper for checking Monad laws cleanly on F[_]
  private def checkMonoidLaws[A: Monoid: Arbitrary: Eq](name: String): Unit =
    property(s"Monoid[$name] satisfies associativity and left/right identity") {
      val M = Monoid[A]
      forAll { (x: A, y: A, z: A) =>
        val assoc = Eq[A].eqv(M.combine(M.combine(x, y), z), M.combine(x, M.combine(y, z)))
        val leftId = Eq[A].eqv(M.combine(M.empty, x), x)
        val rightId = Eq[A].eqv(M.combine(x, M.empty), x)
        assoc && leftId && rightId
      }
    }

  checkMonoidLaws[Int]("Int")
  checkMonoidLaws[String]("String")

  property("Functor[Option] and Functor[List] satisfy identity and composition laws") {
    forAll { (opt: Option[Int], xs: List[Int]) =>
      val f: Int => Int = _ + 3
      val g: Int => String = _.toString

      val optId = opt.map(identity) == opt
      val optComp = opt.map(f).map(g) == opt.map(f.andThen(g))

      val listId = xs.map(identity) == xs
      val listComp = xs.map(f).map(g) == xs.map(f.andThen(g))

      optId && optComp && listId && listComp
    }
  }

  property("Applicative[ValidatedNel[String, *]] satisfies identity and homomorphism laws") {
    type Val[A] = ValidatedNel[String, A]
    val A = Applicative[Val]
    given arbValInt: Arbitrary[Val[Int]] = Arbitrary(
      Gen.oneOf(
        Arbitrary.arbitrary[Int].map(Validated.validNel),
        Arbitrary.arbitrary[String].map(Validated.invalidNel)
      )
    )

    forAll { (fa: Val[Int], x: Int) =>
      val f: Int => Int = _ * 2 + 1
      val idLaw = A.ap(A.pure(identity[Int]))(fa) == fa
      val homoLaw = A.ap(A.pure(f))(A.pure(x)) == A.pure(f(x))
      idLaw && homoLaw
    }
  }

  property("Monad[Either[String, *]] satisfies left identity, right identity, and associativity") {
    type ErrOr[A] = Either[String, A]
    val M = Monad[ErrOr]
    given arbEither: Arbitrary[ErrOr[Int]] = Arbitrary(
      Gen.oneOf(
        Arbitrary.arbitrary[Int].map(Right(_)),
        Gen.alphaNumStr.map(s => Left(s"err:$s"))
      )
    )

    forAll { (x: Int, m: ErrOr[Int]) =>
      val f: Int => ErrOr[Int] = n => if n % 2 == 0 then Right(n / 2) else Left("odd")
      val g: Int => ErrOr[Int] = n => if n >= 0 then Right(n + 10) else Left("neg")

      val leftId = M.flatMap(M.pure(x))(f) == f(x)
      val rightId = M.flatMap(m)(M.pure) == m
      val assoc = M.flatMap(M.flatMap(m)(f))(g) == M.flatMap(m)(a => M.flatMap(f(a))(g))

      leftId && rightId && assoc
    }
  }

  property("Traverse[List] satisfies identity and sequential composition consistency") {
    val T = Traverse[List]
    forAll { (xs: List[Int]) =>
      val limited = xs.take(20)
      val idLaw = T.traverse[Id, Int, Int](limited)(identity) == limited
      val optTrav = T.traverse(limited)(x => if x >= 0 then Some(x) else None)
      val expected = if limited.forall(_ >= 0) then Some(limited) else None
      idLaw && (optTrav == expected)
    }
  }

  test("ValidatedNel accumulates all errors whereas Either short-circuits on the first error") {
    final case class Config(host: String, port: Int)

    def parseHost(s: String): ValidatedNel[String, String] =
      if s.nonEmpty then s.validNel else "empty host".invalidNel

    def parsePort(p: Int): ValidatedNel[String, Int] =
      if p > 0 && p <= 65535 then p.validNel else "invalid port".invalidNel

    val accumulated = (parseHost(""), parsePort(-1)).mapN(Config.apply)
    assertEquals(
      accumulated,
      Validated.invalid(cats.data.NonEmptyList.of("empty host", "invalid port"))
    )

    val failFast: Either[String, Config] = for
      h <- parseHost("").toEither.leftMap(_.head)
      p <- parsePort(-1).toEither.leftMap(_.head)
    yield Config(h, p)
    assertEquals(failFast, Left("empty host"))

    val parAccumulated = (
      parseHost("").toEither,
      parsePort(-1).toEither
    ).parMapN(Config.apply)
    assertEquals(parAccumulated, Left(cats.data.NonEmptyList.of("empty host", "invalid port")))
  }

  test("Negative property test: subtraction fails Monoid associativity under ScalaCheck") {
    val brokenIntMonoid: Monoid[Int] = new Monoid[Int]:
      def empty: Int = 0
      def combine(x: Int, y: Int): Int = x - y

    val assocProp: Prop = forAll { (a: Int, b: Int, c: Int) =>
      brokenIntMonoid.combine(brokenIntMonoid.combine(a, b), c) ==
        brokenIntMonoid.combine(a, brokenIntMonoid.combine(b, c))
    }

    val result = Test.check(Test.Parameters.default, assocProp)
    assert(
      !result.passed,
      "Expected subtraction Monoid associativity to be falsified by ScalaCheck"
    )
  }
