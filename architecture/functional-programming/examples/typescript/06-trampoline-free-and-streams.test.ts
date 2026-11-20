import test from 'node:test';
import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// Module 12: Naive Recursive IO (Negative Test) vs Trampolined TailRec & Free
// -----------------------------------------------------------------------------
type NaiveIO<A> = () => A;

const naiveReturn =
  <A>(a: A): NaiveIO<A> =>
  () =>
    a;

const naiveFlatMap =
  <A, B>(io: NaiveIO<A>, f: (a: A) => NaiveIO<B>): NaiveIO<B> =>
  () =>
    f(io())();

// Stack-safe Trampoline (TailRec) — control flow reified on heap
type TailRec<A> =
  | { readonly tag: 'Return'; readonly value: A }
  | { readonly tag: 'Suspend'; readonly resume: () => TailRec<A> }
  | {
      readonly tag: 'FlatMap';
      readonly sub: TailRec<unknown>;
      readonly k: (x: unknown) => TailRec<A>;
    };

const Return = <A>(value: A): TailRec<A> => ({ tag: 'Return', value });
const Suspend = <A>(resume: () => TailRec<A>): TailRec<A> => ({ tag: 'Suspend', resume });
const flatMapTR = <A, B>(sub: TailRec<A>, k: (a: A) => TailRec<B>): TailRec<B> => ({
  tag: 'FlatMap',
  sub,
  k: k as (x: unknown) => TailRec<B>,
});

function runTailRec<A>(tr: TailRec<A>): A {
  let current: TailRec<unknown> = tr;
  while (true) {
    if (current.tag === 'Return') {
      return current.value as A;
    }
    if (current.tag === 'Suspend') {
      current = current.resume();
      continue;
    }
    // FlatMap(sub, k)
    const { sub, k } = current;
    if (sub.tag === 'Return') {
      current = k(sub.value);
    } else if (sub.tag === 'Suspend') {
      current = flatMapTR(sub.resume(), k);
    } else {
      // Right-associate nested FlatMap(FlatMap(y, g), k) -> FlatMap(y, a => FlatMap(g(a), k))
      const innerSub = sub.sub;
      const innerK = sub.k;
      current = flatMapTR(innerSub, (a) => flatMapTR(innerK(a), k));
    }
  }
}

// -----------------------------------------------------------------------------
// Free Monad over a Pure Console Algebra (Interpreted without real I/O)
// -----------------------------------------------------------------------------
type ConsoleOp<A> =
  | { readonly tag: 'ReadLine'; readonly next: (line: string) => A }
  | { readonly tag: 'PrintLine'; readonly line: string; readonly next: A };

type FreeConsole<A> =
  | { readonly tag: 'Pure'; readonly value: A }
  | { readonly tag: 'Impure'; readonly op: ConsoleOp<FreeConsole<A>> };

const pureConsole = <A>(value: A): FreeConsole<A> => ({ tag: 'Pure', value });
const readLine: FreeConsole<string> = {
  tag: 'Impure',
  op: { tag: 'ReadLine', next: (line) => pureConsole(line) },
};
const printLine = (line: string): FreeConsole<void> => ({
  tag: 'Impure',
  op: { tag: 'PrintLine', line, next: pureConsole(undefined) },
});

function flatMapFree<A, B>(fa: FreeConsole<A>, f: (a: A) => FreeConsole<B>): FreeConsole<B> {
  if (fa.tag === 'Pure') return f(fa.value);
  if (fa.op.tag === 'ReadLine') {
    const nextFn = fa.op.next;
    return {
      tag: 'Impure',
      op: { tag: 'ReadLine', next: (line) => flatMapFree(nextFn(line), f) },
    };
  }
  const nextCont = fa.op.next;
  return {
    tag: 'Impure',
    op: { tag: 'PrintLine', line: fa.op.line, next: flatMapFree(nextCont, f) },
  };
}

function interpretConsolePure<A>(
  prog: FreeConsole<A>,
  inputs: readonly string[],
): {
  readonly result: A;
  readonly outputs: readonly string[];
  readonly remaining: readonly string[];
} {
  let cur: FreeConsole<A> = prog;
  let idx = 0;
  const outputs: string[] = [];

  while (cur.tag === 'Impure') {
    if (cur.op.tag === 'ReadLine') {
      const line = inputs[idx] ?? '';
      idx++;
      cur = cur.op.next(line);
    } else {
      outputs.push(cur.op.line);
      cur = cur.op.next;
    }
  }
  return { result: cur.value, outputs, remaining: inputs.slice(idx) };
}

// -----------------------------------------------------------------------------
// Pull-Based Stream Transducer (Process) with Guaranteed Resource Cleanup
// -----------------------------------------------------------------------------
type Process<O> =
  | { readonly tag: 'Halt'; readonly err?: Error }
  | { readonly tag: 'Emit'; readonly head: O; readonly tail: (kill?: boolean) => Process<O> }
  | {
      readonly tag: 'Await';
      readonly acquireOrStep: (kill?: boolean) => Process<O>;
    };

const Halt = (err?: Error): Process<never> => (err ? { tag: 'Halt', err } : { tag: 'Halt' });
const Emit = <O>(head: O, tail: (kill?: boolean) => Process<O>): Process<O> => ({
  tag: 'Emit',
  head,
  tail,
});

function killProcess<O>(p: Process<O>): Process<never> {
  let cur: Process<O> = p;
  while (cur.tag !== 'Halt') {
    if (cur.tag === 'Emit') {
      cur = cur.tail(true);
    } else {
      cur = cur.acquireOrStep(true);
    }
  }
  return cur;
}

function bracketResource<R, O>(
  acquire: () => R,
  use: (r: R) => Process<O>,
  release: (r: R) => void,
): Process<O> {
  return {
    tag: 'Await',
    acquireOrStep: (kill) => {
      if (kill) return Halt(); // Resource not yet acquired
      const res = acquire();
      let released = false;
      const releaseOnce = (): void => {
        if (!released) {
          released = true;
          release(res);
        }
      };

      const wrap = (p: Process<O>): Process<O> => {
        if (p.tag === 'Halt') {
          releaseOnce();
          return p;
        }
        if (p.tag === 'Emit') {
          return Emit(p.head, (killed) => {
            if (killed) {
              try {
                killProcess(p.tail(true));
              } finally {
                releaseOnce();
              }
              return Halt();
            }
            return wrap(p.tail(false));
          });
        }
        return {
          tag: 'Await',
          acquireOrStep: (killed) => {
            if (killed) {
              try {
                killProcess(p.acquireOrStep(true));
              } finally {
                releaseOnce();
              }
              return Halt();
            }
            return wrap(p.acquireOrStep(false));
          },
        };
      };

      try {
        return wrap(use(res));
      } catch (err) {
        releaseOnce();
        throw err;
      }
    },
  };
}

function takeProcess<O>(p: Process<O>, n: number): Process<O> {
  if (n <= 0) {
    return killProcess(p);
  }
  if (p.tag === 'Halt') return p;
  if (p.tag === 'Emit') {
    if (n === 1) {
      return Emit(p.head, () => killProcess(p.tail(true)));
    }
    return Emit(p.head, (killed) =>
      killed ? killProcess(p.tail(true)) : takeProcess(p.tail(false), n - 1),
    );
  }
  return {
    tag: 'Await',
    acquireOrStep: (killed) =>
      killed ? killProcess(p.acquireOrStep(true)) : takeProcess(p.acquireOrStep(false), n),
  };
}

function runLog<O>(p: Process<O>): readonly O[] {
  const out: O[] = [];
  let cur: Process<O> = p;

  while (cur.tag !== 'Halt') {
    if (cur.tag === 'Emit') {
      out.push(cur.head);
      cur = cur.tail(false);
    } else {
      cur = cur.acquireOrStep(false);
    }
  }
  if (cur.err) throw cur.err;
  return out;
}

// =============================================================================
// Tests
// =============================================================================

test('Module 12 negative test: naive recursive IO blows call stack at 25,000 flatMaps', () => {
  let io: NaiveIO<number> = naiveReturn(0);
  for (let i = 0; i < 25_000; i++) {
    const prev = io;
    io = naiveFlatMap(prev, (x) => naiveReturn(x + 1));
  }
  assert.throws(
    () => io(),
    (err: unknown) => err instanceof RangeError,
  );
});

test('Module 12: TailRec trampoline executes 100,000 chained flatMaps in O(1) stack', () => {
  let tr: TailRec<number> = Return(0);
  for (let i = 0; i < 100_000; i++) {
    tr = flatMapTR(tr, (x) => Suspend(() => Return(x + 1)));
  }
  assert.strictEqual(runTailRec(tr), 100_000);
});

test('Module 12: Free monad separates pure program description from pure test interpreter', () => {
  const greeter: FreeConsole<string> = flatMapFree(printLine('What is your name?'), () =>
    flatMapFree(readLine, (name) =>
      flatMapFree(printLine(`Hello, ${name}!`), () => pureConsole(name)),
    ),
  );

  const run1 = interpretConsolePure(greeter, ['Ada', 'unused']);
  assert.strictEqual(run1.result, 'Ada');
  assert.deepEqual(run1.outputs, ['What is your name?', 'Hello, Ada!']);
  assert.deepEqual(run1.remaining, ['unused']);
});

test('Module 12: pull-based Process guarantees resource finalizer runs on early take() and on downstream error', () => {
  let openHandles = 0;
  let closeCalls = 0;

  const linesFromFakeFile = (rows: readonly string[]): Process<string> =>
    bracketResource(
      () => {
        openHandles++;
        return { rows, idx: 0 };
      },
      (handle) => {
        const loop = (): Process<string> => {
          if (handle.idx >= handle.rows.length) return Halt();
          const row = handle.rows[handle.idx]!;
          handle.idx++;
          return Emit(row, loop);
        };
        return loop();
      },
      () => {
        openHandles--;
        closeCalls++;
      },
    );

  // Case 1: early termination via take(2) still closes resource
  const early = runLog(takeProcess(linesFromFakeFile(['a', 'b', 'c', 'd']), 2));
  assert.deepEqual(early, ['a', 'b']);
  assert.strictEqual(openHandles, 0);
  assert.strictEqual(closeCalls, 1);

  // Case 2: failure mid-stream triggers finalizer cleanup via killProcess
  const failAfterN = (p: Process<string>, limit: number): Process<string> => {
    if (p.tag === 'Halt') return p;
    if (p.tag === 'Emit') {
      if (limit === 0) {
        killProcess(p.tail(true));
        return Halt(new Error('downstream parse error'));
      }
      return Emit(p.head, (killed) =>
        killed ? killProcess(p.tail(true)) : failAfterN(p.tail(false), limit - 1),
      );
    }
    return {
      tag: 'Await',
      acquireOrStep: (killed) =>
        killed ? killProcess(p.acquireOrStep(true)) : failAfterN(p.acquireOrStep(false), limit),
    };
  };

  assert.throws(
    () => runLog(failAfterN(linesFromFakeFile(['x', 'y', 'z']), 1)),
    /downstream parse error/,
  );
  assert.strictEqual(openHandles, 0);
  assert.strictEqual(closeCalls, 2);
});
