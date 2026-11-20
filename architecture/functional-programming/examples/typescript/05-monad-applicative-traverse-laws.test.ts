import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

// -----------------------------------------------------------------------------
// Modules 10 & 11: Functor, Monad (Kleisli), Applicative (4 laws), Traverse
// -----------------------------------------------------------------------------
type Option<A> = { readonly tag: 'None' } | { readonly tag: 'Some'; readonly value: A };
const None: Option<never> = { tag: 'None' };
const Some = <A>(value: A): Option<A> => ({ tag: 'Some', value });

const optionMonad = {
  unit: <A>(a: A): Option<A> => Some(a),
  map: <A, B>(oa: Option<A>, f: (a: A) => B): Option<B> =>
    oa.tag === 'Some' ? Some(f(oa.value)) : None,
  flatMap: <A, B>(oa: Option<A>, f: (a: A) => Option<B>): Option<B> =>
    oa.tag === 'Some' ? f(oa.value) : None,
  compose:
    <A, B, C>(f: (a: A) => Option<B>, g: (b: B) => Option<C>) =>
    (a: A): Option<C> =>
      optionMonad.flatMap(f(a), g),
  apply: <A, B>(ofn: Option<(a: A) => B>, oa: Option<A>): Option<B> =>
    ofn.tag === 'Some' && oa.tag === 'Some' ? Some(ofn.value(oa.value)) : None,
  product: <A, B>(oa: Option<A>, ob: Option<B>): Option<readonly [A, B]> =>
    oa.tag === 'Some' && ob.tag === 'Some' ? Some([oa.value, ob.value] as const) : None,
};

type Validation<E, A> =
  | { readonly tag: 'Failure'; readonly head: E; readonly tail: readonly E[] }
  | { readonly tag: 'Success'; readonly value: A };

const vSuccess = <A>(value: A): Validation<never, A> => ({ tag: 'Success', value });
const vFailure = <E>(head: E, ...tail: readonly E[]): Validation<E, never> => ({
  tag: 'Failure',
  head,
  tail,
});

function validationMap2<E, A, B, C>(
  va: Validation<E, A>,
  vb: Validation<E, B>,
  f: (a: A, b: B) => C,
): Validation<E, C> {
  if (va.tag === 'Success' && vb.tag === 'Success') {
    return vSuccess(f(va.value, vb.value));
  }
  if (va.tag === 'Failure' && vb.tag === 'Failure') {
    return vFailure(va.head, ...va.tail, vb.head, ...vb.tail);
  }
  return va.tag === 'Failure' ? va : (vb as Validation<E, never>);
}

function validationApply<E, A, B>(
  vf: Validation<E, (a: A) => B>,
  va: Validation<E, A>,
): Validation<E, B> {
  return validationMap2(vf, va, (f, a) => f(a));
}

function validationMap<E, A, B>(va: Validation<E, A>, f: (a: A) => B): Validation<E, B> {
  return va.tag === 'Success' ? vSuccess(f(va.value)) : va;
}

function validationProduct<E, A, B>(
  va: Validation<E, A>,
  vb: Validation<E, B>,
): Validation<E, readonly [A, B]> {
  return validationMap2(va, vb, (a, b) => [a, b] as const);
}

// Traverse for Array into Option or Validation
function traverseArrayOption<A, B>(xs: readonly A[], f: (a: A) => Option<B>): Option<readonly B[]> {
  const out: B[] = [];
  for (const x of xs) {
    const r = f(x);
    if (r.tag === 'None') return None;
    out.push(r.value);
  }
  return Some(out);
}

function traverseArrayValidation<E, A, B>(
  xs: readonly A[],
  f: (a: A) => Validation<E, B>,
): Validation<E, readonly B[]> {
  let acc: Validation<E, readonly B[]> = vSuccess([]);
  for (const x of xs) {
    acc = validationMap2(acc, f(x), (list, b) => [...list, b]);
  }
  return acc;
}

// Stateful traversal: zipWithIndex implemented solely via State + Traverse
type State<S, A> = (s: S) => readonly [A, S];

function traverseArrayState<S, A, B>(
  xs: readonly A[],
  f: (a: A) => State<S, B>,
): State<S, readonly B[]> {
  return (s0) => {
    const out: B[] = [];
    let s = s0;
    for (const x of xs) {
      const [b, next] = f(x)(s);
      out.push(b);
      s = next;
    }
    return [out, s];
  };
}

function zipWithIndex<A>(xs: readonly A[]): readonly (readonly [A, number])[] {
  const [res] = traverseArrayState<number, A, readonly [A, number]>(xs, (a) => (idx) => [
    [a, idx] as const,
    idx + 1,
  ])(0);
  return res;
}

const arbOption = <A>(arb: fc.Arbitrary<A>): fc.Arbitrary<Option<A>> =>
  fc.oneof(
    fc.constant(None),
    arb.map((v) => Some(v)),
  );

const arbValidation = <A>(arb: fc.Arbitrary<A>): fc.Arbitrary<Validation<string, A>> =>
  fc.oneof(
    fc
      .tuple(fc.string(), fc.array(fc.string(), { maxLength: 2 }))
      .map(([h, t]) => vFailure(h, ...t)),
    arb.map((v) => vSuccess(v)),
  );

// =============================================================================
// Tests
// =============================================================================

test('Module 10: Functor identity and composition laws hold for Option', () => {
  const f = (n: number): number => n + 1;
  const g = (n: number): number => n * 2;

  fc.assert(
    fc.property(arbOption(fc.integer()), (oa) => {
      assert.deepEqual(
        optionMonad.map(oa, (x) => x),
        oa,
      );
      assert.deepEqual(
        optionMonad.map(optionMonad.map(oa, f), g),
        optionMonad.map(oa, (x) => g(f(x))),
      );
    }),
    { seed: 101 },
  );
});

test('Module 10: Monad laws (left identity, right identity, associativity) via flatMap and Kleisli', () => {
  const f = (n: number): Option<number> => (n % 2 === 0 ? Some(n / 2) : None);
  const g = (n: number): Option<number> => (n > 0 ? Some(n * 3) : None);
  const h = (n: number): Option<string> => Some(`v:${n}`);

  fc.assert(
    fc.property(fc.integer(), arbOption(fc.integer()), (x, mx) => {
      // Left identity: unit(x).flatMap(f) == f(x)
      assert.deepEqual(optionMonad.flatMap(optionMonad.unit(x), f), f(x));

      // Right identity: mx.flatMap(unit) == mx
      assert.deepEqual(optionMonad.flatMap(mx, optionMonad.unit), mx);

      // Associativity (flatMap): mx.flatMap(f).flatMap(g) == mx.flatMap(a => f(a).flatMap(g))
      assert.deepEqual(
        optionMonad.flatMap(optionMonad.flatMap(mx, f), g),
        optionMonad.flatMap(mx, (a) => optionMonad.flatMap(f(a), g)),
      );

      // Kleisli associativity: compose(compose(f, g), h)(x) == compose(f, compose(g, h))(x)
      assert.deepEqual(
        optionMonad.compose(optionMonad.compose(f, g), h)(x),
        optionMonad.compose(f, optionMonad.compose(g, h))(x),
      );
    }),
    { seed: 102 },
  );
});

test('Module 11: all 4 Applicative laws hold for Validation (accumulating errors)', () => {
  const fnAdd1 = (x: number): number => x + 1;
  const fnMul3 = (x: number): number => x * 3;
  const assoc = <A, B, C>([a, [b, c]]: readonly [A, readonly [B, C]]) =>
    [[a, b] as const, c] as const;

  fc.assert(
    fc.property(
      arbValidation(fc.integer()),
      arbValidation(fc.integer()),
      arbValidation(fc.integer()),
      fc.integer(),
      fc.boolean(),
      (va, vb, vc, x, useAdd) => {
        const fn = useAdd ? fnAdd1 : fnMul3;

        // 1. Identity: apply(unit(id), v) == v
        assert.deepEqual(
          validationApply(
            vSuccess((a: number) => a),
            va,
          ),
          va,
        );

        // 2. Homomorphism: apply(unit(fn), unit(x)) == unit(fn(x))
        assert.deepEqual(validationApply(vSuccess(fn), vSuccess(x)), vSuccess(fn(x)));

        // 3. Interchange: apply(vf, unit(x)) == apply(unit(f => f(x)), vf)
        const vf: Validation<string, (n: number) => number> =
          va.tag === 'Success' ? vSuccess(fn) : vFailure(va.head, ...va.tail);
        assert.deepEqual(
          validationApply(vf, vSuccess(x)),
          validationApply(
            vSuccess((f: (n: number) => number) => f(x)),
            vf,
          ),
        );

        // 4. Associativity: product(product(va, vb), vc) == map(product(va, product(vb, vc)), assoc)
        assert.deepEqual(
          validationProduct(validationProduct(va, vb), vc),
          validationMap(validationProduct(va, validationProduct(vb, vc)), assoc),
        );
      },
    ),
    { seed: 111 },
  );
});

test('Module 11: Traverse identity law and State-based zipWithIndex', () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 20 }), (arr) => {
      // Identity law: traverse(xs, Some) == Some(xs)
      assert.deepEqual(traverseArrayOption(arr, Some), Some(arr));

      // Validation accumulation across all elements
      const parsed = traverseArrayValidation(arr, (n) =>
        n >= 0 ? vSuccess(n) : vFailure(`neg:${n}`),
      );
      const negatives = arr.filter((n) => n < 0).map((n) => `neg:${n}`);
      if (negatives.length === 0) {
        assert.deepEqual(parsed, vSuccess(arr));
      } else {
        assert.strictEqual(parsed.tag, 'Failure');
        if (parsed.tag === 'Failure') {
          assert.deepEqual([parsed.head, ...parsed.tail], negatives);
        }
      }
    }),
    { seed: 112 },
  );

  assert.deepEqual(zipWithIndex(['a', 'b', 'c']), [
    ['a', 0],
    ['b', 1],
    ['c', 2],
  ]);
});
