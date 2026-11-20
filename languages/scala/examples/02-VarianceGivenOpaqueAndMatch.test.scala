package scalafp.examples

import scala.compiletime.{constValue, erasedValue, summonInline}
import scala.compiletime.testing.{typeCheckErrors, typeChecks}
import scala.deriving.Mirror

class VarianceGivenOpaqueAndMatchSuite extends munit.FunSuite:

  // 1. Declaration-site variance (+A / -A) and lower-bound widening
  sealed trait Animal:
    def name: String
  final case class Dog(name: String) extends Animal
  final case class Cat(name: String) extends Animal

  final case class CovariantBox[+A](value: A):
    def map[B](f: A => B): CovariantBox[B] = CovariantBox(f(value))
    def replaceWith[B >: A](other: B): CovariantBox[B] = CovariantBox(other)

  trait Sink[-A]:
    def consume(a: A): String

  test("CovariantBox preserves subtyping and widens via lower bound B >: A") {
    val dogBox: CovariantBox[Dog] = CovariantBox(Dog("Rex"))
    val animalBox: CovariantBox[Animal] = dogBox
    val widened: CovariantBox[Animal] = dogBox.replaceWith(Cat("Mittens"))
    assertEquals(animalBox.value.name, "Rex")
    assertEquals(widened.value.name, "Mittens")

    val animalSink: Sink[Animal] = (a: Animal) => s"logged:${a.name}"
    val dogSink: Sink[Dog] = animalSink // contravariance: Sink[Animal] <: Sink[Dog]
    assertEquals(dogSink.consume(Dog("Rex")), "logged:Rex")
  }

  // 2. Opaque types: zero-overhead newtypes with strict representation encapsulation
  object DomainIds:
    opaque type UserId = String
    object UserId:
      def fromString(raw: String): Either[String, UserId] =
        if raw.nonEmpty && raw.forall(_.isLetterOrDigit) then Right(raw)
        else Left(s"Invalid UserId: $raw")
      extension (id: UserId) def value: String = id

    opaque type PositiveInt = Int
    object PositiveInt:
      def fromInt(n: Int): Either[String, PositiveInt] =
        if n > 0 then Right(n) else Left(s"Expected positive int, got $n")
      extension (p: PositiveInt) def toInt: Int = p

  test(
    "Opaque types enforce nominal abstraction at compile time with zero runtime boxing overhead"
  ) {
    import DomainIds.*

    val uid = UserId.fromString("user42").toOption.get
    val pos = PositiveInt.fromInt(7).toOption.get

    assertEquals(uid.value, "user42")
    assertEquals(pos.toInt, 7)

    // At runtime on JVM, PositiveInt is an unboxed primitive / java.lang.Integer when boxed
    val asAny: Any = pos
    assertEquals(asAny.getClass, classOf[java.lang.Integer])
    assertEquals(
      typeChecks(
        """
        import DomainIds.*
        val p: PositiveInt = 7
        """
      ),
      false
    )
    assertEquals(
      typeChecks(
        """
        import DomainIds.*
        val u: UserId = "abc"
        val s: String = u
        """
      ),
      false
    )
  }

  // 3. Native type lambdas and polymorphic function types
  type EitherError = [A] =>> Either[String, A]

  test("Native type lambdas and polymorphic function types compile without compiler plugins") {
    val ok: EitherError[Int] = Right(10)
    assertEquals(ok.map(_ + 5), Right(15))

    val headPoly: [A] => List[A] => Option[A] = [A] => (xs: List[A]) => xs.headOption
    assertEquals(headPoly[Int](List(1, 2, 3)), Some(1))
    assertEquals(headPoly[String](Nil), None)
  }

  // 4. Match types
  type Elem[X] = X match
    case String      => Char
    case Iterable[t] => t
    case Any         => X

  transparent inline def firstElemOrSelf[X](inline x: X) = inline x match
    case s: String       => s.charAt(0)
    case it: Iterable[t] => it.head
    case other           => other

  test("Match types compute return types recursively from scrutinized types") {
    summon[Elem[String] =:= Char]
    summon[Elem[List[Int]] =:= Int]
    summon[Elem[Boolean] =:= Boolean]

    val c: Elem[String] = firstElemOrSelf("scala")
    val i: Elem[List[Int]] = firstElemOrSelf(List(99, 100))
    val b: Elem[Boolean] = firstElemOrSelf(true)
    assertEquals(c, 's')
    assertEquals(i, 99)
    assertEquals(b, true)
  }

  // 5. Given/using & Mirror type-class derivation
  trait Show[A]:
    def show(a: A): String

  object Show:
    given Show[Int] = (a: Int) => a.toString
    given Show[String] = (a: String) => s"\"$a\""
    given Show[Boolean] = (a: Boolean) => a.toString

    inline def showElems[T <: Tuple](p: Product, idx: Int): List[String] =
      inline erasedValue[T] match
        case _: EmptyTuple => Nil
        case _: (h *: t) =>
          summonInline[Show[h]].show(p.productElement(idx).asInstanceOf[h]) ::
            showElems[t](p, idx + 1)

    inline def derived[A](using m: Mirror.ProductOf[A]): Show[A] =
      (a: A) =>
        val prod = a.asInstanceOf[Product]
        val labels = constValueList[m.MirroredElemLabels]
        val values = showElems[m.MirroredElemTypes](prod, 0)
        val fields = labels.zip(values).map((k, v) => s"$k=$v").mkString(", ")
        s"${prod.productPrefix}($fields)"

    private inline def constValueList[T <: Tuple]: List[String] =
      inline erasedValue[T] match
        case _: EmptyTuple => Nil
        case _: (h *: t)   => constValue[h].toString :: constValueList[t]

  final case class User(name: String, age: Int, active: Boolean) derives Show

  test("given/using and Mirror.ProductOf derive Show cleanly for product types") {
    val rendered = summon[Show[User]].show(User("Ada", 36, true))
    assertEquals(rendered, "User(name=\"Ada\", age=36, active=true)")
  }

  // 6. Compile-time negative tests proving type-system rejections
  test("Negative compile-time checks: variance, ambiguous givens, opaque leaks, strictEquality") {
    // (1) Covariant +A in contravariant method parameter position is rejected
    val varianceErrors = typeCheckErrors("""
      class BadBox[+A](value: A):
        def accepts(a: A): Unit = ()
    """)
    assert(
      varianceErrors.exists(
        _.message.contains("covariant type A occurs in contravariant position")
      ),
      varianceErrors.map(_.message).mkString("\n")
    )

    // (2) Ambiguous competing given instances are rejected by implicit search
    val ambiguousErrors = typeCheckErrors("""
      trait Codec[A]:
        def encode(a: A): String
      given c1: Codec[Int] = _.toString
      given c2: Codec[Int] = i => s"#$i"
      val found = summon[Codec[Int]]
    """)
    assert(
      ambiguousErrors.exists(_.message.contains("Ambiguous given instances")),
      ambiguousErrors.map(_.message).mkString("\n")
    )

    // (3) Opaque type underlying representation does not leak outside defining scope
    val opaqueErrors = typeCheckErrors("""
      object Tokens:
        opaque type Secret = String
        object Secret:
          def apply(s: String): Secret = s
      val s: Tokens.Secret = Tokens.Secret("top-secret")
      val len: Int = s.length
    """)
    assert(
      opaqueErrors.exists(_.message.contains("value length is not a member of Tokens.Secret")),
      opaqueErrors.map(_.message).mkString("\n")
    )

    // (4) strictEquality (CanEqual) rejects comparing unrelated types Int == String
    val eqErrors = typeCheckErrors("""
      import scala.language.strictEquality
      val bad = (1 == "1")
    """)
    assert(
      eqErrors.exists(_.message.contains("Values of types Int and String cannot be compared")),
      eqErrors.map(_.message).mkString("\n")
    )
  }
