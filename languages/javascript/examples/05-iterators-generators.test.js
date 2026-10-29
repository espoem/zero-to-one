// Module 05 · Iterators, generators and async iteration
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { runNode } from './helpers/run-node.js';

/** A closable counting iterator that records protocol calls. */
function tracked(n, log) {
  let i = 0;
  return {
    [Symbol.iterator]() { return this; },
    next() { log.push('next'); return i < n ? { value: i++, done: false } : { value: undefined, done: true }; },
    return() { log.push('return'); return { value: undefined, done: true }; },
  };
}

/** co-style driver: runs a generator that yields promises. */
export function run(genFn, ...args) {
  return new Promise((resolve, reject) => {
    const it = genFn(...args);
    const step = (method, arg) => {
      let r;
      try { r = it[method](arg); } catch (e) { reject(e); return; }
      if (r.done) { resolve(r.value); return; }
      Promise.resolve(r.value).then((v) => step('next', v), (e) => step('throw', e));
    };
    step('next');
  });
}

/** Lazy take without helpers. */
export function* take(iterable, n) {
  if (n <= 0) return;
  for (const x of iterable) {
    yield x;
    if (--n === 0) return;
  }
}

describe('Iteration protocols (§27.1.1)', () => {
  test('a hand-written iterable works with every consumer', () => {
    const range = {
      from: 1, to: 3,
      [Symbol.iterator]() {
        let cur = this.from; const last = this.to;
        return { next: () => (cur <= last ? { value: cur++, done: false } : { value: undefined, done: true }) };
      },
    };
    assert.deepEqual([...range], [1, 2, 3]);
    assert.deepEqual(Array.from(range), [1, 2, 3]);
    const [a, b] = range;
    assert.deepEqual([a, b], [1, 2]);
    assert.equal(new Set(range).size, 3);
    assert.deepEqual([...range], [1, 2, 3]);   // fresh iterator each time: reusable
  });

  test('NEGATIVE: generators are one-shot', () => {
    function* g() { yield 1; yield 2; }
    const it = g();
    assert.deepEqual([...it], [1, 2]);
    assert.deepEqual([...it], []);
  });

  test('next is cached at loop start (Iterator Record)', () => {
    const it = tracked(3, []);
    const seen = [];
    for (const x of it) {
      seen.push(x);
      it.next = () => ({ value: 'hijacked', done: false }); // no effect on the running loop
    }
    assert.deepEqual(seen, [0, 1, 2]);
  });

  test('NEGATIVE: an IteratorResult that is not an object throws TypeError', () => {
    const bad = { [Symbol.iterator]: () => ({ next: () => 42 }) };
    assert.throws(() => [.../** @type {any} */ (bad)], TypeError);
  });
});

describe('IteratorClose (§7.4.11)', () => {
  test('break, destructuring and throw call return(); exhaustion does not', () => {
    let log = [];
    for (const x of tracked(5, log)) if (x === 1) break;
    assert.deepEqual(log, ['next', 'next', 'return']);

    log = [];
    const [first] = tracked(5, log);
    assert.equal(first, 0);
    assert.deepEqual(log, ['next', 'return']);

    log = [];
    assert.throws(() => { for (const _ of tracked(5, log)) throw new Error('body'); }, /body/);
    assert.deepEqual(log, ['next', 'return']);

    log = [];
    for (const _ of tracked(2, log));
    assert.deepEqual(log, ['next', 'next', 'next']);
  });

  test('the body exception wins over an exception thrown by return()', () => {
    const it = {
      [Symbol.iterator]() { return this; },
      next: () => ({ value: 1, done: false }),
      return() { throw new Error('from return'); },
    };
    assert.throws(() => { for (const _ of it) throw new Error('from body'); }, /from body/);
    assert.throws(() => { for (const _ of it) break; }, /from return/);
  });

  test('a generator finally block runs when the consumer stops early', () => {
    const log = [];
    function* g() { try { yield 1; yield 2; } finally { log.push('cleanup'); } }
    for (const _ of g()) break;
    assert.deepEqual(log, ['cleanup']);
  });
});

describe('Generators (§27.5)', () => {
  test('two-way communication; the first next() argument is ignored', () => {
    function* dialogue() {
      const name = yield 'name?';
      const age = yield `hello ${name}, age?`;
      return `${name} is ${age}`;
    }
    const g = dialogue();
    assert.deepEqual(g.next('ignored'), { value: 'name?', done: false });
    assert.deepEqual(g.next('Ada'), { value: 'hello Ada, age?', done: false });
    assert.deepEqual(g.next(36), { value: 'Ada is 36', done: true });
    assert.deepEqual(g.next(), { value: undefined, done: true });
  });

  test('throw() raises at the paused yield and can be caught', () => {
    function* g() { try { yield 1; } catch (e) { yield `caught ${e}`; } }
    const it = g();
    it.next();
    assert.deepEqual(it.throw('boom'), { value: 'caught boom', done: false });
  });

  test('return() runs finally; a yield inside finally suspends again', () => {
    function* g() { try { yield 1; } finally { yield 'from finally'; } }
    const it = g();
    it.next();
    assert.deepEqual(it.return(5), { value: 'from finally', done: false });
    assert.deepEqual(it.next(), { value: 5, done: true });
  });

  test('return() before start completes without running the body', () => {
    let ran = false;
    function* g() { ran = true; yield 1; }
    const it = g();
    assert.deepEqual(it.return(9), { value: 9, done: true });
    assert.equal(ran, false);
  });

  test('NEGATIVE: re-entrant next() throws TypeError', () => {
    /** @type {Generator} */
    let it;
    function* g() { yield it.next(); }
    it = g();
    assert.throws(() => it.next(), TypeError);
  });

  test('yield* forwards and evaluates to the inner return value', () => {
    function* inner() { yield 'a'; return 'inner-result'; }
    function* outer() { const r = yield* inner(); yield r; }
    assert.deepEqual([...outer()], ['a', 'inner-result']);
  });

  test('co-style driver turns a generator into an async function', async () => {
    const result = await run(function* (x) {
      const a = yield Promise.resolve(x + 1);
      try { yield Promise.reject(new Error('fail')); } catch (e) { return `${a} ${/** @type {Error} */ (e).message}`; }
    }, 1);
    assert.equal(result, '2 fail');
  });

  test('infinite generators are safe with lazy consumers', () => {
    function* naturals() { for (let n = 0; ; n++) yield n; }
    assert.deepEqual([...take(naturals(), 3)], [0, 1, 2]);
    assert.deepEqual(naturals().filter((n) => n % 2).map((n) => n * n).take(3).toArray(), [1, 9, 25]);
  });
});

describe('Iterator helpers (ES2025) and Iterator.concat (ES2026)', () => {
  test('helpers are lazy: work happens per pulled element', () => {
    const log = [];
    const it = [1, 2, 3, 4].values().map((x) => { log.push(x); return x * 2; });
    assert.deepEqual(log, []);
    assert.deepEqual(it.take(2).toArray(), [2, 4]);
    assert.deepEqual(log, [1, 2]);
  });

  test('callbacks receive (value, counter) only', () => {
    const args = [];
    ['a', 'b'].values().forEach((...a) => args.push(a));
    assert.deepEqual(args, [['a', 0], ['b', 1]]);
  });

  test('early-stopping helpers close the source', () => {
    const log = [];
    const found = Iterator.from(tracked(10, log)).find((x) => x === 2);
    assert.equal(found, 2);
    assert.equal(log.at(-1), 'return');
  });

  test('Iterator.from wraps a next()-only object', () => {
    let i = 0;
    const nextOnly = { next: () => (i < 2 ? { value: i++, done: false } : { value: undefined, done: true }) };
    assert.deepEqual(Iterator.from(nextOnly).map((x) => x + 10).toArray(), [10, 11]);
  });

  test('NEGATIVE: iterator flatMap rejects strings returned by the mapper', () => {
    assert.throws(() => ['ab'].values().flatMap((s) => /** @type {any} */ (s)).toArray(), TypeError);
    assert.deepEqual(['ab'].flatMap((s) => s), ['ab']); // arrays flatten only arrays
  });

  test('Iterator.concat is lazy and validates arguments up front', () => {
    const log = [];
    const it = Iterator.concat([1], tracked(2, log), new Set([9]));
    assert.deepEqual(log, []);
    assert.deepEqual([...it], [1, 0, 1, 9]);
    assert.throws(() => Iterator.concat(/** @type {any} */ (5)), TypeError);
  });

  test('property: take(n) of an iterator equals slice(0, n) of the array', () => {
    fc.assert(fc.property(fc.array(fc.integer()), fc.nat(20), (xs, n) =>
      JSON.stringify(xs.values().take(n).toArray()) === JSON.stringify(xs.slice(0, n)) &&
      JSON.stringify([...take(xs, n)]) === JSON.stringify(xs.slice(0, n))));
  });
});

describe('Async iteration (§27.1.1.3, §27.6)', () => {
  test('async generators interleave await and yield; break closes them', async () => {
    const log = [];
    async function* paginate() {
      try {
        for (let page = 0; ; page++) {
          await null;
          yield* [page * 10, page * 10 + 1];
        }
      } finally { log.push('closed'); }
    }
    const out = [];
    for await (const x of paginate()) { out.push(x); if (out.length === 3) break; }
    assert.deepEqual(out, [0, 1, 10]);
    assert.deepEqual(log, ['closed']);
  });

  test('concurrent next() calls on an async generator are queued in order', async () => {
    async function* g() { yield 'a'; yield 'b'; }
    const it = g();
    const results = await Promise.all([it.next(), it.next(), it.next()]);
    assert.deepEqual(results.map((r) => r.value), ['a', 'b', undefined]);
  });

  test('for await falls back to sync iterators and awaits each value', async () => {
    const out = [];
    for await (const x of [Promise.resolve(1), 2]) out.push(x);
    assert.deepEqual(out, [1, 2]);
  });

  test('Array.fromAsync collects sequentially and awaits the mapper', async () => {
    const order = [];
    const res = await Array.fromAsync([3, 1, 2], async (x) => {
      order.push(`start ${x}`);
      await new Promise((r) => setTimeout(r, x));
      order.push(`end ${x}`);
      return x * 10;
    });
    assert.deepEqual(res, [30, 10, 20]);
    assert.deepEqual(order, ['start 3', 'end 3', 'start 1', 'end 1', 'start 2', 'end 2']);
  });

  test('NEGATIVE: for await over pre-created promises crashes on an early rejection', () => {
    const src = `
      const slow = new Promise((r) => setTimeout(r, 50, 'slow'));
      const fails = Promise.reject(new Error('early'));   // no handler yet
      for await (const x of [slow, fails]) console.log(x);`;
    const r = runNode(['--input-type=module', '-e', src]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /early/);
    assert.doesNotMatch(r.stdout, /slow/);   // the process died before the loop reached the first value
  });
});
