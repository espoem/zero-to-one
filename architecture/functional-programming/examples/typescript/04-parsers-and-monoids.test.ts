import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

// -----------------------------------------------------------------------------
// Module 08: Algebraic Parser Combinators with Committed vs Backtracking Errors
// -----------------------------------------------------------------------------
interface ParseLocation {
  readonly input: string;
  readonly offset: number;
}

interface ParseError {
  readonly stack: readonly { readonly loc: ParseLocation; readonly msg: string }[];
}

type ParseResult<A> =
  | { readonly tag: 'Success'; readonly value: A; readonly consumed: number }
  | { readonly tag: 'Failure'; readonly error: ParseError; readonly isCommitted: boolean };

type Parser<A> = (loc: ParseLocation) => ParseResult<A>;

const advanceBy = (loc: ParseLocation, n: number): ParseLocation => ({
  input: loc.input,
  offset: loc.offset + n,
});

const sliceRemaining = (loc: ParseLocation): string => loc.input.slice(loc.offset);

const addCommit = <A>(res: ParseResult<A>, isCommitted: boolean): ParseResult<A> =>
  res.tag === 'Failure'
    ? { tag: 'Failure', error: res.error, isCommitted: res.isCommitted || isCommitted }
    : res;

const mapError = <A>(res: ParseResult<A>, f: (e: ParseError) => ParseError): ParseResult<A> =>
  res.tag === 'Failure' ? { ...res, error: f(res.error) } : res;

const succeed =
  <A>(a: A): Parser<A> =>
  () => ({ tag: 'Success', value: a, consumed: 0 });

const literal =
  (s: string): Parser<string> =>
  (loc) => {
    if (sliceRemaining(loc).startsWith(s)) {
      return { tag: 'Success', value: s, consumed: s.length };
    }
    return {
      tag: 'Failure',
      error: { stack: [{ loc, msg: `Expected "${s}"` }] },
      isCommitted: false,
    };
  };

const regex =
  (re: RegExp, labelMsg: string): Parser<string> =>
  (loc) => {
    const anchored = new RegExp(`^(?:${re.source})`, re.flags.replace('g', ''));
    const m = anchored.exec(sliceRemaining(loc));
    if (m !== null) {
      return { tag: 'Success', value: m[0], consumed: m[0].length };
    }
    return {
      tag: 'Failure',
      error: { stack: [{ loc, msg: `Expected ${labelMsg}` }] },
      isCommitted: false,
    };
  };

const scope =
  <A>(msg: string, p: Parser<A>): Parser<A> =>
  (loc) =>
    mapError(p(loc), (e) => ({
      stack: [{ loc, msg }, ...e.stack],
    }));

const attempt =
  <A>(p: Parser<A>): Parser<A> =>
  (loc) => {
    const res = p(loc);
    return res.tag === 'Failure' ? { ...res, isCommitted: false } : res;
  };

const or =
  <A>(p1: Parser<A>, p2: () => Parser<A>): Parser<A> =>
  (loc) => {
    const r1 = p1(loc);
    if (r1.tag === 'Failure' && !r1.isCommitted) {
      return p2()(loc);
    }
    return r1;
  };

const flatMap =
  <A, B>(p: Parser<A>, f: (a: A) => Parser<B>): Parser<B> =>
  (loc) => {
    const r1 = p(loc);
    if (r1.tag === 'Failure') return r1;
    const r2 = f(r1.value)(advanceBy(loc, r1.consumed));
    if (r2.tag === 'Success') {
      return { tag: 'Success', value: r2.value, consumed: r1.consumed + r2.consumed };
    }
    // Once p consumed >= 1 character, failure in the continuation commits the branch
    return addCommit(r2, r1.consumed > 0);
  };

const map = <A, B>(p: Parser<A>, f: (a: A) => B): Parser<B> => flatMap(p, (a) => succeed(f(a)));

const product = <A, B>(pa: Parser<A>, pb: () => Parser<B>): Parser<readonly [A, B]> =>
  flatMap(pa, (a) => map(pb(), (b) => [a, b] as const));

const skipLeft = <A, B>(pa: Parser<A>, pb: () => Parser<B>): Parser<B> =>
  map(product(pa, pb), ([, b]) => b);

const skipRight = <A, B>(pa: Parser<A>, pb: () => Parser<B>): Parser<A> =>
  map(product(pa, pb), ([a]) => a);

function many<A>(p: Parser<A>): Parser<readonly A[]> {
  return (loc) => {
    const acc: A[] = [];
    let totalConsumed = 0;
    while (true) {
      const res = p(advanceBy(loc, totalConsumed));
      if (res.tag === 'Success') {
        if (res.consumed === 0) break; // prevent infinite loop on zero-width parsers
        acc.push(res.value);
        totalConsumed += res.consumed;
      } else if (res.isCommitted) {
        return res;
      } else {
        break;
      }
    }
    return { tag: 'Success', value: acc, consumed: totalConsumed };
  };
}

function sepBy<A, S>(p: Parser<A>, sep: Parser<S>): Parser<readonly A[]> {
  return or(
    flatMap(p, (first) => map(many(skipLeft(sep, () => p)), (rest) => [first, ...rest])),
    () => succeed([]),
  );
}

// Minimal Algebraic JSON AST & Parser
type Json = null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json };

const ws = regex(/\s*/, 'whitespace');
const token = <A>(p: Parser<A>): Parser<A> =>
  skipRight(
    skipLeft(ws, () => p),
    () => ws,
  );
const jsonString = scope(
  'string',
  map(regex(/"([^"\\]|\\.)*"/, 'JSON string literal'), (raw) => JSON.parse(raw) as string),
);
const jsonNumber = scope(
  'number',
  map(regex(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'JSON number'), Number),
);
const jsonNull = map(literal('null'), () => null);
const jsonBool = or(
  map(literal('true'), () => true),
  () => map(literal('false'), () => false),
);

function jsonValue(): Parser<Json> {
  return (loc) => {
    const arrayParser: Parser<Json> = scope(
      'array',
      skipLeft(token(literal('[')), () =>
        skipRight(sepBy(token(jsonValue()), token(literal(','))), () => token(literal(']'))),
      ),
    );
    const kvParser: Parser<readonly [string, Json]> = product(
      skipRight(token(jsonString), () => token(literal(':'))),
      () => token(jsonValue()),
    );
    const objectParser: Parser<Json> = scope(
      'object',
      map(
        skipLeft(token(literal('{')), () =>
          skipRight(sepBy(kvParser, token(literal(','))), () => token(literal('}'))),
        ),
        (entries) => Object.fromEntries(entries),
      ),
    );

    const anyJson = token(
      or<Json>(objectParser, () =>
        or<Json>(arrayParser, () =>
          or<Json>(jsonString, () =>
            or<Json>(jsonNumber, () => or<Json>(jsonBool, () => jsonNull)),
          ),
        ),
      ),
    );
    return anyJson(loc);
  };
}

function parseFull<A>(p: Parser<A>, input: string): ParseResult<A> {
  const full = skipRight(p, () => (loc) => {
    if (loc.offset === loc.input.length) {
      return { tag: 'Success', value: undefined, consumed: 0 };
    }
    return {
      tag: 'Failure',
      error: { stack: [{ loc, msg: 'Expected EOF' }] },
      isCommitted: true,
    };
  });
  return full({ input, offset: 0 });
}

// -----------------------------------------------------------------------------
// Module 09: Monoids, Product Fusion, and Balanced Parallel Word Count (WC)
// -----------------------------------------------------------------------------
interface Monoid<A> {
  readonly empty: A;
  combine(a: A, b: A): A;
}

const intAddition: Monoid<number> = { empty: 0, combine: (a, b) => a + b };
const intMultiplication: Monoid<number> = { empty: 1, combine: (a, b) => a * b };

function productMonoid<A, B>(ma: Monoid<A>, mb: Monoid<B>): Monoid<readonly [A, B]> {
  return {
    empty: [ma.empty, mb.empty],
    combine: ([a1, b1], [a2, b2]) => [ma.combine(a1, a2), mb.combine(b1, b2)],
  };
}

function foldMapV<A, B>(xs: readonly A[], m: Monoid<B>, f: (a: A) => B): B {
  if (xs.length === 0) return m.empty;
  if (xs.length === 1) return f(xs[0]!);
  const mid = Math.floor(xs.length / 2);
  return m.combine(foldMapV(xs.slice(0, mid), m, f), foldMapV(xs.slice(mid), m, f));
}

// WC algebra for associative parallel word counting
type WC =
  | { readonly tag: 'Stub'; readonly chars: string }
  | {
      readonly tag: 'Part';
      readonly lStub: string;
      readonly words: number;
      readonly rStub: string;
    };

const Stub = (chars: string): WC => ({ tag: 'Stub', chars });
const Part = (lStub: string, words: number, rStub: string): WC => ({
  tag: 'Part',
  lStub,
  words,
  rStub,
});

const wcMonoid: Monoid<WC> = {
  empty: Stub(''),
  combine(a, b) {
    if (a.tag === 'Stub' && b.tag === 'Stub') return Stub(a.chars + b.chars);
    if (a.tag === 'Stub' && b.tag === 'Part') return Part(a.chars + b.lStub, b.words, b.rStub);
    if (a.tag === 'Part' && b.tag === 'Stub') return Part(a.lStub, a.words, a.rStub + b.chars);
    if (a.tag === 'Part' && b.tag === 'Part') {
      const middleWord = a.rStub.length + b.lStub.length > 0 ? 1 : 0;
      return Part(a.lStub, a.words + middleWord + b.words, b.rStub);
    }
    return a;
  },
};

function countWordsParallel(text: string): number {
  const toWC = (ch: string): WC => (/\s/.test(ch) ? Part('', 0, '') : Stub(ch));
  const res = foldMapV([...text], wcMonoid, toWC);
  const nonEmpty = (s: string): number => (s.length > 0 ? 1 : 0);
  if (res.tag === 'Stub') return nonEmpty(res.chars);
  return nonEmpty(res.lStub) + res.words + nonEmpty(res.rStub);
}

// =============================================================================
// Tests
// =============================================================================

test('Module 08: JSON parser parses nested objects, arrays, numbers, and booleans', () => {
  const input = ' { "id": 42, "ok": true, "tags": ["fp", "scala3"], "meta": null } ';
  const res = parseFull(jsonValue(), input);
  assert.strictEqual(res.tag, 'Success');
  if (res.tag === 'Success') {
    assert.deepEqual(res.value, {
      id: 42,
      ok: true,
      tags: ['fp', 'scala3'],
      meta: null,
    });
  }
});

test('Module 08 negative test: committed failure blocks backtracking unless wrapped in attempt', () => {
  const pLeft = flatMap(literal('ab'), () => literal('c'));
  const pRight = literal('abd');

  // 'ab' consumes 2 chars, so failing on 'c' commits the left branch and blocks pRight
  const committedChoice = or(pLeft, () => pRight);
  const r1 = committedChoice({ input: 'abd', offset: 0 });
  assert.strictEqual(r1.tag, 'Failure');
  if (r1.tag === 'Failure') {
    assert.strictEqual(r1.isCommitted, true);
  }

  // Wrapping pLeft in attempt resets isCommitted on failure, allowing fallback to pRight
  const backtrackingChoice = or(attempt(pLeft), () => pRight);
  const r2 = backtrackingChoice({ input: 'abd', offset: 0 });
  assert.deepEqual(r2, { tag: 'Success', value: 'abd', consumed: 3 });
});

test('Module 09: WC monoid counts words identically across arbitrary chunk splits and fuses sum+product', () => {
  const sample = '  lorem ipsum   dolor sit amet  ';
  assert.strictEqual(countWordsParallel(sample), 5);

  // Single-pass fusion via productMonoid: compute sum and product in one balanced fold
  const sumAndProduct = foldMapV(
    [10, 20, 30, 40],
    productMonoid(intAddition, intMultiplication),
    (n) => [n, n] as const,
  );
  assert.deepEqual(sumAndProduct, [100, 240_000]);
});

test('Module 09 negative property test: subtraction and IEEE 754 float addition violate Monoid associativity', () => {
  const subViolates = fc.check(
    fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => a - b - c === a - (b - c)),
    { seed: 7 },
  );
  assert.strictEqual(subViolates.failed, true);

  const floatViolates = fc.check(
    fc.property(
      fc.double({ min: -1e16, max: 1e16, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1e16, max: 1e16, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1e16, max: 1e16, noNaN: true, noDefaultInfinity: true }),
      (a, b, c) => a + b + c === a + (b + c),
    ),
    { seed: 7, numRuns: 500 },
  );
  assert.strictEqual(floatViolates.failed, true);
});
