import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

// -----------------------------------------------------------------------------
// Persistent Singly-Linked List (Module 02: Structural Sharing & Stack Safety)
// -----------------------------------------------------------------------------
type List<A> =
  | { readonly tag: 'Nil' }
  | { readonly tag: 'Cons'; readonly head: A; readonly tail: List<A> };

const Nil: List<never> = { tag: 'Nil' };

function Cons<A>(head: A, tail: List<A>): List<A> {
  return { tag: 'Cons', head, tail };
}

function listOf<A>(...items: readonly A[]): List<A> {
  let acc: List<A> = Nil;
  for (let i = items.length - 1; i >= 0; i--) {
    acc = Cons(items[i]!, acc);
  }
  return acc;
}

function toArray<A>(xs: List<A>): A[] {
  const out: A[] = [];
  let cur: List<A> = xs;
  while (cur.tag === 'Cons') {
    out.push(cur.head);
    cur = cur.tail;
  }
  return out;
}

function tail<A>(xs: List<A>): List<A> {
  return xs.tag === 'Cons' ? xs.tail : Nil;
}

function setHead<A>(xs: List<A>, h: A): List<A> {
  return xs.tag === 'Cons' ? Cons(h, xs.tail) : Cons(h, Nil);
}

// Naive recursive foldRight: O(n) call-stack frames -> overflows on large lists
function foldRightUnsafe<A, B>(xs: List<A>, z: B, f: (a: A, b: B) => B): B {
  if (xs.tag === 'Nil') return z;
  return f(xs.head, foldRightUnsafe(xs.tail, z, f));
}

// Stack-safe iterative foldLeft: O(1) stack space
function foldLeft<A, B>(xs: List<A>, z: B, f: (b: B, a: A) => B): B {
  let acc = z;
  let cur = xs;
  while (cur.tag === 'Cons') {
    acc = f(acc, cur.head);
    cur = cur.tail;
  }
  return acc;
}

function reverse<A>(xs: List<A>): List<A> {
  return foldLeft(xs, Nil as List<A>, (acc, a) => Cons(a, acc));
}

// Stack-safe foldRight expressed via foldLeft on reversed list (or continuation/trampoline)
function foldRightSafe<A, B>(xs: List<A>, z: B, f: (a: A, b: B) => B): B {
  return foldLeft(reverse(xs), z, (b, a) => f(a, b));
}

function append<A>(xs: List<A>, ys: List<A>): List<A> {
  return foldRightSafe(xs, ys, (a, acc) => Cons(a, acc));
}

// -----------------------------------------------------------------------------
// Persistent Binary Tree (Catamorphism)
// -----------------------------------------------------------------------------
type Tree<A> =
  | { readonly tag: 'Leaf'; readonly value: A }
  | { readonly tag: 'Branch'; readonly left: Tree<A>; readonly right: Tree<A> };

const Leaf = <A>(value: A): Tree<A> => ({ tag: 'Leaf', value });
const Branch = <A>(left: Tree<A>, right: Tree<A>): Tree<A> => ({ tag: 'Branch', left, right });

function foldTree<A, B>(t: Tree<A>, f: (a: A) => B, g: (l: B, r: B) => B): B {
  if (t.tag === 'Leaf') return f(t.value);
  return g(foldTree(t.left, f, g), foldTree(t.right, f, g));
}

// -----------------------------------------------------------------------------
// Algebraic Error Handling: Option, Either, Validated (Module 03)
// -----------------------------------------------------------------------------
type Option<A> = { readonly tag: 'None' } | { readonly tag: 'Some'; readonly value: A };

const None: Option<never> = { tag: 'None' };
const Some = <A>(value: A): Option<A> => ({ tag: 'Some', value });

function mapOption<A, B>(oa: Option<A>, f: (a: A) => B): Option<B> {
  return oa.tag === 'Some' ? Some(f(oa.value)) : None;
}

function flatMapOption<A, B>(oa: Option<A>, f: (a: A) => Option<B>): Option<B> {
  return oa.tag === 'Some' ? f(oa.value) : None;
}

function getOrElse<A>(oa: Option<A>, fallback: () => A): A {
  return oa.tag === 'Some' ? oa.value : fallback();
}

function sequenceOption<A>(xs: readonly Option<A>[]): Option<readonly A[]> {
  const out: A[] = [];
  for (const x of xs) {
    if (x.tag === 'None') return None;
    out.push(x.value);
  }
  return Some(out);
}

type Either<E, A> =
  | { readonly tag: 'Left'; readonly error: E }
  | { readonly tag: 'Right'; readonly value: A };

const Left = <E>(error: E): Either<E, never> => ({ tag: 'Left', error });
const Right = <A>(value: A): Either<never, A> => ({ tag: 'Right', value });

function flatMapEither<E, A, B>(ea: Either<E, A>, f: (a: A) => Either<E, B>): Either<E, B> {
  return ea.tag === 'Right' ? f(ea.value) : ea;
}

function map2Either<E, A, B, C>(
  ea: Either<E, A>,
  eb: Either<E, B>,
  f: (a: A, b: B) => C,
): Either<E, C> {
  return flatMapEither(ea, (a) => (eb.tag === 'Right' ? Right(f(a, eb.value)) : eb));
}

type Validated<E, A> =
  | { readonly tag: 'Invalid'; readonly errors: readonly E[] }
  | { readonly tag: 'Valid'; readonly value: A };

const Invalid = <E>(...errors: readonly E[]): Validated<E, never> => ({
  tag: 'Invalid',
  errors,
});
const Valid = <A>(value: A): Validated<never, A> => ({ tag: 'Valid', value });

function map2Validated<E, A, B, C>(
  va: Validated<E, A>,
  vb: Validated<E, B>,
  f: (a: A, b: B) => C,
): Validated<E, C> {
  if (va.tag === 'Valid' && vb.tag === 'Valid') {
    return Valid(f(va.value, vb.value));
  }
  if (va.tag === 'Invalid' && vb.tag === 'Invalid') {
    return { tag: 'Invalid', errors: [...va.errors, ...vb.errors] };
  }
  return va.tag === 'Invalid' ? va : (vb as Validated<E, never>);
}

// =============================================================================
// Tests
// =============================================================================

test('Module 02: structural sharing reuses tail node references in O(1)', () => {
  const xs = listOf(1, 2, 3, 4);
  const ys = Cons(0, xs);
  const zs = setHead(xs, 99);
  const dropped = tail(xs);

  assert.strictEqual(ys.tag, 'Cons');
  if (ys.tag === 'Cons') {
    // Exact object identity preserved — no defensive copy of tail
    assert.strictEqual(ys.tail, xs);
  }
  if (zs.tag === 'Cons' && xs.tag === 'Cons') {
    assert.strictEqual(zs.tail, xs.tail);
    assert.strictEqual(dropped, xs.tail);
  }
  assert.deepEqual(toArray(xs), [1, 2, 3, 4]);
  assert.deepEqual(toArray(zs), [99, 2, 3, 4]);
});

test('Module 02: append shares the second list tail without copying it', () => {
  const xs = listOf(1, 2);
  const ys = listOf(3, 4);
  const joined = append(xs, ys);
  assert.deepEqual(toArray(joined), [1, 2, 3, 4]);
  // Stepping 2 nodes into joined must reach exact reference ys
  if (joined.tag === 'Cons' && joined.tail.tag === 'Cons') {
    assert.strictEqual(joined.tail.tail, ys);
  } else {
    assert.fail('Expected at least two Cons cells');
  }
});

test('Module 02 negative test: naive recursive foldRight overflows call stack while foldLeft/foldRightSafe succeed', () => {
  const n = 25_000;
  let big: List<number> = Nil;
  for (let i = n; i >= 1; i--) {
    big = Cons(i, big);
  }

  assert.throws(
    () => foldRightUnsafe(big, 0, (a, b) => a + b),
    (err: unknown) => err instanceof RangeError,
  );

  const expectedSum = (n * (n + 1)) / 2;
  assert.strictEqual(
    foldLeft(big, 0, (acc, a) => acc + a),
    expectedSum,
  );
  assert.strictEqual(
    foldRightSafe(big, 0, (a, acc) => a + acc),
    expectedSum,
  );
});

test('Module 02: Tree catamorphism computes size, depth, and map algebraically', () => {
  const tree = Branch(Branch(Leaf(1), Leaf(4)), Leaf(2));
  const size = foldTree(
    tree,
    () => 1,
    (l, r) => 1 + l + r,
  );
  const depth = foldTree(
    tree,
    () => 0,
    (l, r) => 1 + Math.max(l, r),
  );
  const maxVal = foldTree(
    tree,
    (x) => x,
    (l, r) => Math.max(l, r),
  );

  assert.strictEqual(size, 5);
  assert.strictEqual(depth, 2);
  assert.strictEqual(maxVal, 4);
});

test('Module 03: Option totality & sequence short-circuits on None', () => {
  const safeDiv = (n: number, d: number): Option<number> => (d === 0 ? None : Some(n / d));
  const res = flatMapOption(safeDiv(10, 2), (q) => mapOption(Some(q), (x) => x + 1));
  assert.strictEqual(
    getOrElse(res, () => -1),
    6,
  );

  assert.deepEqual(sequenceOption([Some(1), Some(2), Some(3)]), Some([1, 2, 3]));
  assert.deepEqual(sequenceOption([Some(1), None, Some(3)]), None);
});

test('Module 03: Either fails fast while Validated accumulates all errors', () => {
  const validateName = (s: string): Either<string, string> =>
    s.trim().length > 0 ? Right(s.trim()) : Left('name must not be empty');
  const validateAge = (n: number): Either<string, number> =>
    n >= 0 ? Right(n) : Left('age must be non-negative');

  const eitherResult = map2Either(validateName(''), validateAge(-5), (name, age) => ({
    name,
    age,
  }));
  assert.deepEqual(eitherResult, Left('name must not be empty'));

  const vName = (s: string): Validated<string, string> =>
    s.trim().length > 0 ? Valid(s.trim()) : Invalid('name must not be empty');
  const vAge = (n: number): Validated<string, number> =>
    n >= 0 ? Valid(n) : Invalid('age must be non-negative');

  const validatedResult = map2Validated(vName(''), vAge(-5), (name, age) => ({
    name,
    age,
  }));
  assert.deepEqual(validatedResult, Invalid('name must not be empty', 'age must be non-negative'));
});

test('Module 02 property: reverse is an involution on persistent List', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const xs = listOf(...arr);
      assert.deepEqual(toArray(reverse(reverse(xs))), arr);
    }),
    { seed: 42 },
  );
});
