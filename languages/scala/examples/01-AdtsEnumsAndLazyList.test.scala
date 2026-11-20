package scalafp.examples

import scala.annotation.tailrec
import scala.util.boundary
import scala.util.boundary.break

class AdtsEnumsAndLazyListSuite extends munit.FunSuite:

  // Algebraic Data Type (ADT) using Scala 3 covariant enum
  enum MyList[+A]:
    case Nil
    case Cons(head: A, tail: MyList[A])

    def headOption: Option[A] = this match
      case Nil        => None
      case Cons(h, _) => Some(h)

  object MyList:
    def apply[A](xs: A*): MyList[A] =
      xs.foldRight(Nil: MyList[A])((h, acc) => Cons(h, acc))

    @tailrec
    def foldLeft[A, B](xs: MyList[A], acc: B)(f: (B, A) => B): B = xs match
      case Nil        => acc
      case Cons(h, t) => foldLeft(t, f(acc, h))(f)

    def reverse[A](xs: MyList[A]): MyList[A] =
      foldLeft(xs, Nil: MyList[A])((acc, h) => Cons(h, acc))

    def map[A, B](xs: MyList[A])(f: A => B): MyList[B] =
      val reversed = foldLeft(xs, Nil: MyList[B])((acc, h) => Cons(f(h), acc))
      reverse(reversed)

    def toList[A](xs: MyList[A]): List[A] =
      foldLeft(reverse(xs), List.empty[A])((acc, h) => h :: acc)

  // Generalized Algebraic Data Type (GADT) with type refinement in pattern matching
  enum Expr[A]:
    case IntLit(value: Int) extends Expr[Int]
    case BoolLit(value: Boolean) extends Expr[Boolean]
    case Add(lhs: Expr[Int], rhs: Expr[Int]) extends Expr[Int]
    case Eq[B](lhs: Expr[B], rhs: Expr[B]) extends Expr[Boolean]
    case If[B](cond: Expr[Boolean], onTrue: Expr[B], onFalse: Expr[B]) extends Expr[B]

  def eval[A](expr: Expr[A]): A = expr match
    case Expr.IntLit(v)  => v
    case Expr.BoolLit(b) => b
    case Expr.Add(l, r)  => eval(l) + eval(r)
    case Expr.Eq(l, r)   => eval(l) == eval(r)
    case Expr.If(c, tBranch, fBranch) =>
      if eval(c) then eval(tBranch) else eval(fBranch)

  test("Scala 3 enum ADT supports @tailrec stack-safe transformations on 50,000 elements") {
    val n = 50_000
    var list: MyList[Int] = MyList.Nil
    var i = n
    while i > 0 do
      list = MyList.Cons(i, list)
      i -= 1

    val doubled = MyList.map(list)(_ * 2)
    assertEquals(doubled.headOption, Some(2))
    val sum = MyList.foldLeft(doubled, 0L)(_ + _)
    val expected = n.toLong * (n + 1).toLong
    assertEquals(sum, expected)
  }

  test("GADT pattern matching refines existential and branch return types statically") {
    val program: Expr[Int] =
      Expr.If(
        Expr.Eq(Expr.Add(Expr.IntLit(2), Expr.IntLit(3)), Expr.IntLit(5)),
        Expr.Add(Expr.IntLit(10), Expr.IntLit(32)),
        Expr.IntLit(0)
      )
    assertEquals(eval(program), 42)
  }

  test("LazyList is lazy in BOTH head and tail on construction (unlike Scala 2 Stream)") {
    var evaluatedHeads = 0
    var evaluatedTails = 0

    val ll: LazyList[Int] = LazyList.cons(
      { evaluatedHeads += 1; 10 }, {
        evaluatedTails += 1
        LazyList.cons(
          { evaluatedHeads += 1; 20 },
          LazyList.empty
        )
      }
    )

    // Constructing LazyList evaluates neither head nor tail
    assertEquals(evaluatedHeads, 0)
    assertEquals(evaluatedTails, 0)

    // Accessing head evaluates only the first head thunk, not the tail
    assertEquals(ll.head, 10)
    assertEquals(evaluatedHeads, 1)
    assertEquals(evaluatedTails, 0)

    // Accessing second element evaluates tail and second head, memoizing first head
    assertEquals(ll.tail.head, 20)
    assertEquals(evaluatedHeads, 2)
    assertEquals(evaluatedTails, 1)
    assertEquals(ll.head, 10)
    assertEquals(evaluatedHeads, 2)
  }

  test("LazyList generated via def avoids head retention across 1,000,000 elements") {
    def naturalsFrom(n: Int): LazyList[Int] =
      n #:: naturalsFrom(n + 1)

    val millionth = naturalsFrom(1).drop(999_999).head
    assertEquals(millionth, 1_000_000)
  }

  test(
    "Scala 3 boundary/break provides typed structured early exit without stackless exceptions escaping"
  ) {
    def findFirstDuplicate(xs: List[Int]): Either[String, Int] =
      boundary:
        val seen = scala.collection.mutable.HashSet.empty[Int]
        for x <- xs do if !seen.add(x) then break(Right(x))
        Left("no duplicate found")

    assertEquals(findFirstDuplicate(List(1, 2, 3, 2, 4)), Right(2))
    assertEquals(findFirstDuplicate(List(1, 2, 3)), Left("no duplicate found"))
  }
