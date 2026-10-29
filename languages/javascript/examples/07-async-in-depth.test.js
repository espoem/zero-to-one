// Module 07 · Async programming in depth
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { setTimeout as delay } from 'node:timers/promises';
import { promiseAll, mapWithConcurrency, retry, debounce, throttle } from './07-async-utils.ts';

describe('Promise basics', () => {
  test('the executor runs synchronously; a throw inside it rejects', async () => {
    const log = [];
    const p = new Promise(() => { log.push('executor'); throw new Error('in executor'); });
    log.push('after');
    assert.deepEqual(log, ['executor', 'after']);
    await assert.rejects(p, /in executor/);
  });

  test('finally passes the outcome through unless it throws', async () => {
    assert.equal(await Promise.resolve(1).finally(() => 2), 1);
    await assert.rejects(Promise.resolve(1).finally(() => { throw new Error('f'); }), /f/);
  });

  test('withResolvers (ES2024) exposes resolve/reject', async () => {
    const { promise, resolve } = Promise.withResolvers();
    setTimeout(resolve, 1, 'later');
    assert.equal(await promise, 'later');
  });

  test('Promise.try (ES2025) runs synchronously and captures sync throws', async () => {
    const log = [];
    const p = Promise.try(() => { log.push('ran'); throw new Error('sync'); });
    assert.deepEqual(log, ['ran']);
    await assert.rejects(p, /sync/);
  });

  test('NEGATIVE: an async function turns a synchronous throw into a rejection', async () => {
    async function f() { throw new Error('early'); }
    let threw = false;
    let p;
    try { p = f(); } catch { threw = true; }
    assert.equal(threw, false);
    await assert.rejects(/** @type {Promise<never>} */ (p), /early/);
  });
});

describe('Combinators (§27.2.4)', () => {
  test('all keeps input order; allSettled reports all; any / AggregateError; race', async () => {
    assert.deepEqual(await Promise.all([delay(20, 'slow'), delay(1, 'fast')]), ['slow', 'fast']);
    const settled = await Promise.allSettled([Promise.resolve(1), Promise.reject(new Error('x'))]);
    assert.deepEqual(settled.map((s) => s.status), ['fulfilled', 'rejected']);
    assert.equal(await Promise.any([Promise.reject(new Error('a')), delay(5, 'b')]), 'b');
    await assert.rejects(Promise.any([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]),
      (e) => e instanceof AggregateError && e.errors.length === 2);
    assert.equal(await Promise.race([delay(20, 'slow'), delay(1, 'fast')]), 'fast');
  });

  test('empty inputs: all → [], any → AggregateError, race never settles', async () => {
    assert.deepEqual(await Promise.all([]), []);
    await assert.rejects(Promise.any([]), AggregateError);
    const raced = await Promise.race([Promise.race([]), delay(20, 'timeout')]);
    assert.equal(raced, 'timeout');
  });

  test('NEGATIVE: Promise.all rejecting does not stop the other operations', async () => {
    let finished = 0;
    const work = (ms) => delay(ms).then(() => { finished++; });
    await assert.rejects(Promise.all([Promise.reject(new Error('fast fail')), work(10), work(15)]), /fast fail/);
    assert.equal(finished, 0);
    await delay(30);
    assert.equal(finished, 2);   // the "cancelled" work completed anyway
  });

  test('promiseAll matches Promise.all (property test)', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({ ms: fc.nat(3), ok: fc.boolean(), v: fc.integer() }), { maxLength: 6 }),
      async (specs) => {
        const make = () => specs.map(({ ms, ok, v }) =>
          delay(ms).then(() => (ok ? v : Promise.reject(new Error(`e${v}`)))));
        const outcome = (p) => p.then((v) => ({ v }), (e) => ({ e: true, msg: e.message }));
        const [a, b] = await Promise.all([outcome(promiseAll(make())), outcome(Promise.all(make()))]);
        // with racing rejections either error may win, so compare only the kind of outcome and fulfilled values
        return a.e === b.e && (a.e || JSON.stringify(a.v) === JSON.stringify(b.v));
      }), { numRuns: 50 });
  });
});

describe('async/await semantics', () => {
  test('code before the first await runs synchronously in the caller', () => {
    const log = [];
    async function f() { log.push('sync part'); await null; log.push('after await'); }
    f();
    log.push('caller continues');
    assert.deepEqual(log, ['sync part', 'caller continues']);
  });

  test('sequential awaits sum latencies; concurrent awaits take the max', async () => {
    const t0 = performance.now();
    for (const ms of [30, 30, 30]) await delay(ms);
    const sequential = performance.now() - t0;
    const t1 = performance.now();
    await Promise.all([30, 30, 30].map((ms) => delay(ms)));
    const concurrent = performance.now() - t1;
    assert.ok(sequential >= 85, `sequential ${sequential}`);
    assert.ok(concurrent < 70, `concurrent ${concurrent}`);
  });

  test('NEGATIVE: forEach(async ...) does not wait', async () => {
    const saved = [];
    [1, 2, 3].forEach(async (x) => { await delay(1); saved.push(x); });
    assert.deepEqual(saved, []);
    await delay(10);
    assert.equal(saved.length, 3);
  });
});

describe('Bounded concurrency', () => {
  test('never exceeds the limit and preserves order', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([5, 1, 4, 2, 3, 1, 2], 3, async (ms, i) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await delay(ms);
      inFlight--;
      return i;
    });
    assert.equal(peak, 3);
    assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6]);
  });

  test('NEGATIVE: after a failure, no new items are started', async () => {
    const started = [];
    await assert.rejects(mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (x) => {
      started.push(x);
      await delay(2);
      if (x === 1) throw new Error('boom');
      return x;
    }), /boom/);
    await delay(10);
    assert.ok(started.length <= 3, `started ${started}`);
  });

  test('property: peak concurrency is min(limit, n)', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 12 }), async (limit, n) => {
      let inFlight = 0; let peak = 0;
      await mapWithConcurrency(Array.from({ length: n }, (_, i) => i), limit, async () => {
        inFlight++; peak = Math.max(peak, inFlight);
        await delay(1);
        inFlight--;
      });
      return peak === Math.min(limit, n);
    }), { numRuns: 25 });
  });
});

describe('Cancellation with AbortSignal', () => {
  test('AbortSignal.timeout aborts with a TimeoutError', async () => {
    const signal = AbortSignal.timeout(5);
    await assert.rejects(delay(1000, undefined, { signal }), (e) => e.name === 'AbortError' || e.name === 'TimeoutError');
    assert.equal(signal.reason.name, 'TimeoutError');
  });

  test('AbortSignal.any aborts with the first reason', () => {
    const a = new AbortController();
    const b = new AbortController();
    const any = AbortSignal.any([a.signal, b.signal]);
    b.abort(new Error('b first'));
    a.abort(new Error('a second'));
    assert.equal(any.reason.message, 'b first');
  });

  test('throwIfAborted throws the reason', () => {
    const c = new AbortController();
    c.abort(new Error('stop'));
    assert.throws(() => c.signal.throwIfAborted(), /stop/);
  });

  test('listeners registered with { signal } are removed on abort', () => {
    const target = new EventTarget();
    const c = new AbortController();
    let calls = 0;
    target.addEventListener('ping', () => calls++, { signal: c.signal });
    target.dispatchEvent(new Event('ping'));
    c.abort();
    target.dispatchEvent(new Event('ping'));
    assert.equal(calls, 1);
  });
});

describe('Retry with backoff and jitter', () => {
  test('retries with exponentially growing caps and succeeds', async () => {
    const sleeps = [];
    let calls = 0;
    const result = await retry(async () => {
      if (++calls < 4) throw new Error('flaky');
      return 'ok';
    }, { retries: 5, baseMs: 100, random: () => 1, sleep: async (ms) => { sleeps.push(ms); } });
    assert.equal(result, 'ok');
    assert.deepEqual(sleeps, [100, 200, 400]);
  });

  test('NEGATIVE: gives up after the retry budget and rethrows the last error', async () => {
    let calls = 0;
    await assert.rejects(retry(async () => { calls++; throw new Error(`fail ${calls}`); },
      { retries: 2, sleep: async () => {} }), /fail 3/);
  });

  test('NEGATIVE: does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(retry(async () => { calls++; throw new TypeError('bad input'); },
      { retries: 5, isRetryable: (e) => !(e instanceof TypeError), sleep: async () => {} }), TypeError);
    assert.equal(calls, 1);
  });

  test('an abort during backoff stops retrying', async () => {
    const c = new AbortController();
    const p = retry(async () => { throw new Error('down'); }, { retries: 10, baseMs: 1000, random: () => 1, signal: c.signal });
    setTimeout(() => c.abort(new Error('caller gave up')), 5);
    await assert.rejects(p, /caller gave up/);
  });
});

describe('Debounce and throttle (fake clock)', () => {
  function fakeClock() {
    let now = 0;
    /** @type {{ at: number, fn: () => void, id: number }[]} */
    let timers = [];
    let nextId = 1;
    return {
      setTimeout(fn, ms) { const id = nextId++; timers.push({ at: now + ms, fn, id }); return id; },
      clearTimeout(id) { timers = timers.filter((t) => t.id !== id); },
      now: () => now,
      advance(ms) {
        now += ms;
        const due = timers.filter((t) => t.at <= now);
        timers = timers.filter((t) => t.at > now);
        due.forEach((t) => t.fn());
      },
    };
  }

  test('debounce fires once, with the last arguments, after quiet time', () => {
    const clock = fakeClock();
    const calls = [];
    const d = debounce((q) => calls.push(q), 100, clock);
    d('a'); clock.advance(50); d('ab'); clock.advance(50); d('abc');
    clock.advance(99);
    assert.deepEqual(calls, []);
    clock.advance(1);
    assert.deepEqual(calls, ['abc']);
  });

  test('throttle allows at most one call per window', () => {
    const clock = fakeClock();
    const calls = [];
    const t = throttle((x) => calls.push(x), 100, clock);
    t(1); clock.advance(10); t(2); clock.advance(95); t(3);
    assert.deepEqual(calls, [1, 3]);
  });
});
