import test from 'node:test';
import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// Module 06: Purely Functional Parallelism (Par) — Deadlock vs Non-Blocking
// -----------------------------------------------------------------------------

/**
 * Simulated bounded thread/worker pool demonstrating why blocking `.get()`
 * inside a submitted task deadlocks when nested forks exceed pool capacity.
 */
class DeadlockDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeadlockDetectedError';
  }
}

interface BlockingPool {
  readonly capacity: number;
  inFlight: number;
  submit<A>(task: () => A): () => A;
}

function createBlockingPool(capacity: number): BlockingPool {
  const pool: BlockingPool = {
    capacity,
    inFlight: 0,
    submit<A>(task: () => A): () => A {
      if (pool.inFlight >= pool.capacity) {
        // In a real JVM ExecutorService, pool.submit(inner).get() inside an
        // occupied worker blocks forever waiting for a free worker slot.
        // Here we fail deterministically with DeadlockDetectedError instead of hanging.
        throw new DeadlockDetectedError(
          `Worker starvation deadlock: ${pool.inFlight}/${pool.capacity} worker slots occupied`,
        );
      }
      pool.inFlight++;
      try {
        const result = task();
        return () => result;
      } finally {
        pool.inFlight--;
      }
    },
  };
  return pool;
}

type BlockingPar<A> = (pool: BlockingPool) => () => A;

const blockingUnit =
  <A>(a: A): BlockingPar<A> =>
  () =>
  () =>
    a;

const blockingFork =
  <A>(pa: () => BlockingPar<A>): BlockingPar<A> =>
  (pool) =>
    // Anti-pattern from FP in Scala Ch 7: outer task occupies a worker slot while
    // calling `.get()` (`pa()(pool)()`) synchronously on the inner submitted task.
    pool.submit(() => pa()(pool)());

// -----------------------------------------------------------------------------
// Non-blocking Continuation-Passing Par (Actor / Callback-based Future)
// -----------------------------------------------------------------------------
interface AsyncPool {
  submit(task: () => void): void;
  drain(): Promise<void>;
}

/**
 * Bounded single-worker async scheduler: tasks yield the worker slot immediately
 * after registering callbacks, so arbitrary fork nesting never starves the pool.
 */
function createAsyncPool(): AsyncPool {
  const queue: Array<() => void> = [];
  let scheduled = false;
  let idleResolvers: Array<() => void> = [];

  function flush(): void {
    scheduled = false;
    while (queue.length > 0) {
      const next = queue.shift()!;
      next();
    }
    if (queue.length === 0) {
      const resolvers = idleResolvers;
      idleResolvers = [];
      for (const r of resolvers) r();
    }
  }

  return {
    submit(task: () => void): void {
      queue.push(task);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
    drain(): Promise<void> {
      if (queue.length === 0 && !scheduled) return Promise.resolve();
      return new Promise((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}

type Future<A> = (cb: (a: A) => void) => void;
type Par<A> = (pool: AsyncPool) => Future<A>;

const unit =
  <A>(a: A): Par<A> =>
  () =>
  (cb) => {
    cb(a);
  };

const fork =
  <A>(pa: () => Par<A>): Par<A> =>
  (pool) =>
  (cb) => {
    pool.submit(() => {
      pa()(pool)(cb);
    });
  };

const lazyUnit = <A>(a: () => A): Par<A> => fork(() => unit(a()));

const map2 =
  <A, B, C>(pa: Par<A>, pb: Par<B>, f: (a: A, b: B) => C): Par<C> =>
  (pool) =>
  (cb) => {
    let ar: { readonly value: A } | undefined;
    let br: { readonly value: B } | undefined;
    let done = false;

    const tryComplete = (): void => {
      if (!done && ar !== undefined && br !== undefined) {
        done = true;
        cb(f(ar.value, br.value));
      }
    };

    pa(pool)((a) => {
      ar = { value: a };
      tryComplete();
    });
    pb(pool)((b) => {
      br = { value: b };
      tryComplete();
    });
  };

const map = <A, B>(pa: Par<A>, f: (a: A) => B): Par<B> => map2(pa, unit(undefined), (a) => f(a));

function sequence<A>(ps: readonly Par<A>[]): Par<readonly A[]> {
  if (ps.length === 0) return unit([]);
  if (ps.length === 1) return map(ps[0]!, (a) => [a]);
  const mid = Math.floor(ps.length / 2);
  const left = sequence(ps.slice(0, mid));
  const right = sequence(ps.slice(mid));
  return map2(left, right, (l, r) => [...l, ...r]);
}

function parMap<A, B>(items: readonly A[], f: (a: A) => B): Par<readonly B[]> {
  return fork(() => sequence(items.map((a) => lazyUnit(() => f(a)))));
}

const choiceN =
  <A>(n: Par<number>, choices: readonly Par<A>[]): Par<A> =>
  (pool) =>
  (cb) => {
    n(pool)((idx) => {
      const chosen = choices[idx];
      if (chosen === undefined) {
        throw new RangeError(`choiceN index out of bounds: ${idx}`);
      }
      chosen(pool)(cb);
    });
  };

async function runPar<A>(pool: AsyncPool, pa: Par<A>): Promise<A> {
  return await new Promise<A>((resolve) => {
    pa(pool)(resolve);
  });
}

// =============================================================================
// Tests
// =============================================================================

test('Module 06 negative test: blocking fork.get() deadlocks a bounded 1-worker pool', () => {
  const pool = createBlockingPool(1);
  // Single fork succeeds on 1 worker
  assert.strictEqual(blockingFork(() => blockingUnit(42))(pool)(), 42);

  // Nested fork starves because outer task holds the only worker slot while awaiting inner task
  const nested = blockingFork(() => blockingFork(() => blockingUnit(42)));
  assert.throws(() => nested(pool)(), DeadlockDetectedError);

  // Even a 2-worker pool deadlocks on depth-3 nested forks
  const pool2 = createBlockingPool(2);
  const depth3 = blockingFork(() => blockingFork(() => blockingFork(() => blockingUnit(7))));
  assert.throws(() => depth3(pool2)(), DeadlockDetectedError);
});

test('Module 06: non-blocking continuation Par survives arbitrarily deep nested forks on 1 worker', async () => {
  const pool = createAsyncPool();
  let deep: Par<number> = unit(42);
  for (let i = 0; i < 50; i++) {
    const inner = deep;
    deep = fork(() => inner);
  }
  const result = await runPar(pool, deep);
  await pool.drain();
  assert.strictEqual(result, 42);
});

test('Module 06: parMap and choiceN satisfy functor & balanced divide-and-conquer semantics', async () => {
  const pool = createAsyncPool();
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const squared = await runPar(
    pool,
    parMap(input, (x) => x * x),
  );
  assert.deepEqual(squared, [1, 4, 9, 16, 25, 36, 49, 64]);

  const picked = await runPar(
    pool,
    choiceN(
      lazyUnit(() => 1),
      [unit('zero'), lazyUnit(() => 'one'), unit('two')],
    ),
  );
  assert.strictEqual(picked, 'one');
});
