import test from 'node:test';
import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// Module 04: Non-strict Lazy Stream with Memoized Thunks & Corecursion
// -----------------------------------------------------------------------------
type LazyStream<A> =
  | { readonly tag: 'Empty' }
  | { readonly tag: 'Cons'; readonly head: () => A; readonly tail: () => LazyStream<A> };

const Empty: LazyStream<never> = { tag: 'Empty' };

// Smart constructor memoizes both head and tail thunks (by-need semantics)
function lazyCons<A>(hd: () => A, tl: () => LazyStream<A>): LazyStream<A> {
  let cachedHead: { readonly value: A } | undefined;
  let cachedTail: LazyStream<A> | undefined;

  return {
    tag: 'Cons',
    head: () => {
      if (cachedHead === undefined) {
        cachedHead = { value: hd() };
      }
      return cachedHead.value;
    },
    tail: () => {
      if (cachedTail === undefined) {
        cachedTail = tl();
      }
      return cachedTail;
    },
  };
}

function unfold<A, S>(
  z: S,
  f: (s: S) => { readonly value: A; readonly next: S } | undefined,
): LazyStream<A> {
  const step = f(z);
  if (step === undefined) return Empty;
  return lazyCons(
    () => step.value,
    () => unfold(step.next, f),
  );
}

function foldRightLazy<A, B>(s: LazyStream<A>, z: () => B, f: (a: A, b: () => B) => B): B {
  if (s.tag === 'Empty') return z();
  return f(s.head(), () => foldRightLazy(s.tail(), z, f));
}

function mapStream<A, B>(s: LazyStream<A>, f: (a: A) => B): LazyStream<B> {
  return foldRightLazy<A, LazyStream<B>>(
    s,
    () => Empty,
    (a, b) => lazyCons(() => f(a), b),
  );
}

function filterStream<A>(s: LazyStream<A>, p: (a: A) => boolean): LazyStream<A> {
  return foldRightLazy<A, LazyStream<A>>(
    s,
    () => Empty,
    (a, b) => (p(a) ? lazyCons(() => a, b) : b()),
  );
}

function takeStream<A>(s: LazyStream<A>, n: number): LazyStream<A> {
  if (n <= 0 || s.tag === 'Empty') return Empty;
  return lazyCons(s.head, () => takeStream(s.tail(), n - 1));
}

function toArrayStream<A>(s: LazyStream<A>): A[] {
  const out: A[] = [];
  let cur = s;
  while (cur.tag === 'Cons') {
    out.push(cur.head());
    cur = cur.tail();
  }
  return out;
}

function findStream<A>(s: LazyStream<A>, p: (a: A) => boolean): A | undefined {
  let cur = s;
  while (cur.tag === 'Cons') {
    const h = cur.head();
    if (p(h)) return h;
    cur = cur.tail();
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Module 05: Purely Functional State (RNG & Candy Dispenser FSM)
// -----------------------------------------------------------------------------
type State<S, A> = (s: S) => readonly [A, S];

const unitState =
  <S, A>(a: A): State<S, A> =>
  (s) => [a, s];

const mapState =
  <S, A, B>(sa: State<S, A>, f: (a: A) => B): State<S, B> =>
  (s) => {
    const [a, s2] = sa(s);
    return [f(a), s2];
  };

const flatMapState =
  <S, A, B>(sa: State<S, A>, f: (a: A) => State<S, B>): State<S, B> =>
  (s) => {
    const [a, s2] = sa(s);
    return f(a)(s2);
  };

const modifyState =
  <S>(f: (s: S) => S): State<S, void> =>
  (s) => [undefined, f(s)];

const getState =
  <S>(): State<S, S> =>
  (s) => [s, s];

function sequenceState<S, A>(fs: readonly State<S, A>[]): State<S, readonly A[]> {
  return (s0) => {
    const out: A[] = [];
    let s = s0;
    for (const f of fs) {
      const [a, next] = f(s);
      out.push(a);
      s = next;
    }
    return [out, s];
  };
}

// Pure 64-bit-masked LCG RNG using BigInt so shifts match Scala SimpleRNG exactly
interface RNG {
  nextInt(): readonly [number, RNG];
}

function simpleRng(seed: bigint): RNG {
  return {
    nextInt() {
      const mask48 = (1n << 48n) - 1n;
      const newSeed = (seed * 0x5deece66dn + 0xbn) & mask48;
      const nextRNG = simpleRng(newSeed);
      const raw = Number(BigInt.asIntN(32, newSeed >> 16n));
      return [raw, nextRNG];
    },
  };
}

type Input = 'Coin' | 'Turn';
interface Machine {
  readonly locked: boolean;
  readonly candies: number;
  readonly coins: number;
}

function stepMachine(input: Input): (m: Machine) => Machine {
  return (m) => {
    if (m.candies <= 0) return m;
    if (input === 'Coin' && m.locked) {
      return { locked: false, candies: m.candies, coins: m.coins + 1 };
    }
    if (input === 'Turn' && !m.locked) {
      return { locked: true, candies: m.candies - 1, coins: m.coins };
    }
    return m;
  };
}

function simulateMachine(inputs: readonly Input[]): State<Machine, readonly [number, number]> {
  const transitions = inputs.map((i) => modifyState(stepMachine(i)));
  return flatMapState(sequenceState(transitions), () =>
    mapState(getState<Machine>(), (m) => [m.coins, m.candies] as const),
  );
}

// =============================================================================
// Tests
// =============================================================================

test('Module 04: smart constructor memoizes head and tail thunks (call-by-need proof)', () => {
  let headEvalCount = 0;
  let tailEvalCount = 0;

  const stream = lazyCons(
    () => {
      headEvalCount++;
      return 42;
    },
    () => {
      tailEvalCount++;
      return lazyCons(
        () => 99,
        () => Empty,
      );
    },
  );

  // Construction itself is completely non-strict
  assert.strictEqual(headEvalCount, 0);
  assert.strictEqual(tailEvalCount, 0);

  if (stream.tag !== 'Cons') assert.fail('Expected Cons');
  assert.strictEqual(stream.head(), 42);
  assert.strictEqual(stream.head(), 42);
  assert.strictEqual(stream.head(), 42);
  assert.strictEqual(headEvalCount, 1);

  const tl1 = stream.tail();
  const tl2 = stream.tail();
  assert.strictEqual(tl1, tl2);
  assert.strictEqual(tailEvalCount, 1);
});

test('Module 04: infinite Fibonacci via unfold and single-pass stream fusion', () => {
  const fibs = unfold<number, readonly [number, number]>([0, 1], ([a, b]) => ({
    value: a,
    next: [b, a + b],
  }));

  assert.deepEqual(toArrayStream(takeStream(fibs, 8)), [0, 1, 1, 2, 3, 5, 8, 13]);

  // Prove deforestation/fusion: map followed by filter followed by find evaluates
  // elements interleaved and short-circuits immediately when target is found
  const trace: string[] = [];
  const nats = unfold(1, (n) => ({ value: n, next: n + 1 }));
  const fused = filterStream(
    mapStream(nats, (x) => {
      trace.push(`map(${x})`);
      return x * x;
    }),
    (sq) => {
      trace.push(`filter(${sq})`);
      return sq > 10;
    },
  );

  const firstOver10 = findStream(fused, (sq) => sq % 2 === 0);
  assert.strictEqual(firstOver10, 16);
  // Only evaluated n=1,2,3,4 — never touched n=5 or built intermediate arrays
  assert.deepEqual(trace, [
    'map(1)',
    'filter(1)',
    'map(2)',
    'filter(4)',
    'map(3)',
    'filter(9)',
    'map(4)',
    'filter(16)',
  ]);
});

test('Module 05: RNG is referentially transparent across repeated calls with same seed', () => {
  const rng0 = simpleRng(42n);
  const [a1, rng1] = rng0.nextInt();
  const [a2] = rng0.nextInt();
  const [b1] = rng1.nextInt();

  assert.strictEqual(a1, a2);
  assert.notStrictEqual(a1, b1);

  const genPair = flatMapState(unitState<RNG, number>(0), () => (r) => {
    const [x, r2] = r.nextInt();
    const [y, r3] = r2.nextInt();
    return [[x, y] as const, r3];
  });
  const [[p1, p2]] = genPair(rng0);
  assert.strictEqual(p1, a1);
  assert.strictEqual(p2, b1);
});

test('Module 05: candy dispenser FSM handles valid, duplicate, and empty transitions purely', () => {
  const initial: Machine = { locked: true, candies: 5, coins: 10 };
  const inputs: readonly Input[] = [
    'Coin',
    'Turn', // 11 coins, 4 candies
    'Coin',
    'Coin', // duplicate coin ignored when unlocked
    'Turn', // 12 coins, 3 candies
    'Turn', // turn on locked machine ignored
    'Coin',
    'Turn', // 13 coins, 2 candies
    'Coin',
    'Turn', // 14 coins, 1 candy
  ];

  const [[coins, candies], nextMachine] = simulateMachine(inputs)(initial);
  assert.strictEqual(coins, 14);
  assert.strictEqual(candies, 1);
  assert.strictEqual(nextMachine.locked, true);
  // Original state remains untouched
  assert.strictEqual(initial.coins, 10);
  assert.strictEqual(initial.candies, 5);
});
