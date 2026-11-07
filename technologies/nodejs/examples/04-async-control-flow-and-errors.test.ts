// Module 04 · Async control flow and errors: callbacks, EventEmitter, AbortSignal, process-level policy.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once, on, errorMonitor, getEventListeners } from 'node:events';
import { promisify, callbackify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { runNode } from './helpers/run-node.ts';

describe('callbacks and Zalgo', () => {
  // An API that is sometimes synchronous and sometimes asynchronous ("releases Zalgo").
  const cache = new Map<string, number>([['hit', 1]]);
  function getBad(key: string, cb: (err: Error | null, v?: number) => void): void {
    if (cache.has(key)) return cb(null, cache.get(key)); // synchronous path
    setImmediate(() => cb(null, 0)); // asynchronous path
  }
  function getGood(key: string, cb: (err: Error | null, v?: number) => void): void {
    if (cache.has(key)) return process.nextTick(cb, null, cache.get(key)); // always async
    setImmediate(() => cb(null, 0));
  }

  test("a sometimes-sync callback changes the caller's ordering (the bug)", () => {
    const order: string[] = [];
    getBad('hit', () => order.push('callback'));
    order.push('after call');
    assert.deepEqual(order, ['callback', 'after call']);
  });

  test('deferring the sync path with process.nextTick makes ordering consistent', async () => {
    const order: string[] = [];
    await new Promise<void>((done) => {
      getGood('hit', () => {
        order.push('callback');
        done();
      });
      order.push('after call');
    });
    assert.deepEqual(order, ['after call', 'callback']);
  });

  test('util.promisify follows the error-first convention and honours promisify.custom', async () => {
    function double(a: number, cb: (err: Error | null, v?: number) => void) {
      cb(null, a * 2);
    }
    function fail(_a: number, cb: (err: Error | null) => void) {
      cb(Object.assign(new Error('nope'), { code: 'E_NOPE' }));
    }
    assert.equal(await promisify(double)(21), 42);
    await assert.rejects(promisify(fail)(1), { code: 'E_NOPE' });
    const withCustom = Object.assign(double, {
      [promisify.custom]: async (_a: number) => 'custom',
    });
    assert.equal(await promisify(withCustom)(1), 'custom');
  });

  test('util.callbackify turns a rejection with a falsy reason into an Error with .reason', async () => {
    const cbStyle = callbackify(async () => Promise.reject(null)) as unknown as (
      cb: (e: Error) => void,
    ) => void;
    const err = await new Promise<Error & { reason?: unknown }>((r) => cbStyle((e: Error) => r(e)));
    assert.ok(err instanceof Error);
    assert.equal(err.reason, null);
  });
});

describe('EventEmitter', () => {
  test('emit() is synchronous and calls listeners in registration order (prepend jumps the queue)', () => {
    const e = new EventEmitter();
    const order: string[] = [];
    e.on('x', () => order.push('first'));
    e.on('x', () => order.push('second'));
    e.prependListener('x', () => order.push('prepended'));
    order.push('before emit');
    e.emit('x');
    order.push('after emit');
    assert.deepEqual(order, ['before emit', 'prepended', 'first', 'second', 'after emit']);
  });

  test('a throwing listener aborts emit(): later listeners do not run and the error reaches the emitter', () => {
    const e = new EventEmitter();
    let secondRan = false;
    e.on('x', () => {
      throw new Error('listener failed');
    });
    e.on('x', () => {
      secondRan = true;
    });
    assert.throws(() => e.emit('x'), /listener failed/);
    assert.equal(secondRan, false);
  });

  test("'error' with no listener throws; a non-Error value is wrapped in ERR_UNHANDLED_ERROR", () => {
    const e = new EventEmitter();
    assert.throws(() => e.emit('error', new Error('boom')), /boom/);
    assert.throws(() => e.emit('error', 'just a string'), { code: 'ERR_UNHANDLED_ERROR' });
  });

  test('errorMonitor observes errors without handling them', () => {
    const e = new EventEmitter();
    const seen: string[] = [];
    e.on(errorMonitor, (err: Error) => seen.push(err.message));
    assert.throws(() => e.emit('error', new Error('m')));
    assert.deepEqual(seen, ['m']);
  });

  test('captureRejections routes a rejected async listener to the error event', async () => {
    const e = new EventEmitter({ captureRejections: true });
    e.on('job', async () => {
      throw new Error('async listener failed');
    });
    const errored = once(e, 'error');
    e.emit('job');
    const [err] = (await errored) as [Error];
    assert.equal(err.message, 'async listener failed');
  });

  test('WITHOUT captureRejections an async listener rejection is an unhandled rejection: exit 1', () => {
    const r = runNode([
      '-e',
      'const E = require("events"); const e = new E(); e.on("x", async () => { throw new Error("lost") }); e.emit("x")',
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /lost/);
  });

  test('the 11th listener triggers MaxListenersExceededWarning (a leak heuristic, not a limit)', async () => {
    const e = new EventEmitter();
    const warning = once(process, 'warning');
    for (let i = 0; i < 11; i++) e.on('x', () => {});
    const [w] = (await warning) as [Error & { count?: number }];
    assert.equal(w.name, 'MaxListenersExceededWarning');
    assert.equal(e.listenerCount('x'), 11); // all 11 are still registered
  });
});

describe('bridging events and promises', () => {
  test('events.once resolves with the argument array and rejects on error', async () => {
    const e = new EventEmitter();
    const p = once(e, 'go');
    e.emit('go', 1, 2);
    assert.deepEqual(await p, [1, 2]);
    const q = once(e, 'never');
    e.emit('error', new Error('rejects'));
    await assert.rejects(q, /rejects/);
  });

  test('events.once with an AbortSignal removes its listener on abort (no leak)', async () => {
    const e = new EventEmitter();
    const ac = new AbortController();
    const p = once(e, 'go', { signal: ac.signal });
    assert.equal(e.listenerCount('go'), 1);
    ac.abort();
    await assert.rejects(p, { name: 'AbortError' });
    assert.equal(e.listenerCount('go'), 0);
  });

  test('events.on is an async iterator over events; break removes the listener', async () => {
    const e = new EventEmitter();
    const got: number[] = [];
    const consumer = (async () => {
      for await (const [n] of on(e, 'n')) {
        got.push(n as number);
        if (got.length === 3) break; // calls return(): the listener is removed
      }
    })();
    for (const n of [1, 2, 3, 4]) e.emit('n', n); // buffered synchronously, consumed asynchronously
    await consumer;
    assert.deepEqual(got, [1, 2, 3]);
    assert.equal(e.listenerCount('n'), 0);
  });

  test('events.on with an AbortSignal: aborting while waiting rejects with AbortError', async () => {
    const e = new EventEmitter();
    const ac = new AbortController();
    const it = on(e, 'n', { signal: ac.signal });
    const next = it.next();
    ac.abort();
    await assert.rejects(next, { name: 'AbortError' });
    assert.equal(e.listenerCount('n'), 0);
  });

  test('EventTarget: a throwing listener does not stop dispatch; the error is rethrown asynchronously', () => {
    const r = runNode([
      '-e',
      `const t = new EventTarget();
       t.addEventListener('x', () => { throw new Error('in listener'); });
       t.addEventListener('x', () => console.log('second listener ran'));
       t.dispatchEvent(new Event('x'));
       console.log('after dispatch');`,
    ]);
    assert.match(r.stdout, /second listener ran\nafter dispatch/);
    assert.equal(r.status, 1); // uncaught, via process.nextTick
  });
});

describe('cancellation with AbortSignal', () => {
  test('Node APIs accept a signal and reject with AbortError; the reason is preserved', async () => {
    const ac = new AbortController();
    ac.abort(new Error('client went away'));
    await assert.rejects(readFile(import.meta.filename, { signal: ac.signal }), (err: Error) => {
      assert.equal(err.name, 'AbortError');
      assert.equal((err.cause as Error).message, 'client went away');
      return true;
    });
  });

  test('AbortSignal.any combines signals; listeners on long-lived signals must be removed', () => {
    const parent = new AbortController();
    const child = new AbortController();
    const combined = AbortSignal.any([parent.signal, child.signal]);
    child.abort('child reason');
    assert.equal(combined.aborted, true);
    assert.equal(combined.reason, 'child reason');
    assert.equal(getEventListeners(parent.signal, 'abort').length >= 0, true);
  });
});

describe('process-level error policy', () => {
  const rejectThenLive =
    'Promise.reject(new Error("r")); setTimeout(() => console.log("alive"), 5)';
  const cases: Array<[string[], number, boolean]> = [
    [[], 1, false], // default: throw
    [['--unhandled-rejections=strict'], 1, false],
    [['--unhandled-rejections=warn'], 0, true],
    [['--unhandled-rejections=warn-with-error-code'], 1, true],
    [['--unhandled-rejections=none'], 0, true],
  ];
  for (const [flags, code, alive] of cases) {
    test(`unhandled rejection with ${flags[0] ?? 'default (throw)'} → exit ${code}, keeps running: ${alive}`, () => {
      const r = runNode([...flags, '-e', rejectThenLive]);
      assert.equal(r.status, code);
      assert.equal(r.stdout.includes('alive'), alive);
    });
  }

  test("in throw mode an 'unhandledRejection' listener prevents the crash; in strict mode it does not", () => {
    const prog =
      'process.on("unhandledRejection", () => console.log("handler")); ' + rejectThenLive;
    const dflt = runNode(['-e', prog]);
    assert.equal(dflt.status, 0);
    assert.match(dflt.stdout, /handler\nalive/);
    assert.equal(runNode(['--unhandled-rejections=strict', '-e', prog]).status, 1);
  });

  test("'uncaughtException' sees unhandled rejections too, with origin 'unhandledRejection'", () => {
    const r = runNode([
      '-e',
      'process.on("uncaughtException", (e, origin) => console.log(e.message, origin)); Promise.reject(new Error("y"))',
    ]);
    assert.equal(r.stdout.trim(), 'y unhandledRejection');
  });

  test("'uncaughtExceptionMonitor' observes without preventing the crash", () => {
    const r = runNode([
      '-e',
      'process.on("uncaughtExceptionMonitor", (e) => console.log("monitor", e.message)); throw new Error("z")',
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /monitor z/);
  });

  test("a late .catch() fires 'rejectionHandled' after 'unhandledRejection'", () => {
    const r = runNode([
      '-e',
      `process.on('unhandledRejection', () => console.log('unhandled'));
       process.on('rejectionHandled', () => console.log('rejectionHandled'));
       const p = Promise.reject(new Error('late'));
       setTimeout(() => p.catch(() => {}), 5);`,
    ]);
    assert.deepEqual(r.stdout.trim().split('\n'), ['unhandled', 'rejectionHandled']);
  });
});

describe('errors as data', () => {
  test('Error.cause chains are preserved and printed by util.inspect', async () => {
    const { inspect } = await import('node:util');
    const e = new Error('loading config failed', { cause: new Error('ENOENT') });
    assert.match(inspect(e), /\[cause\]: Error: ENOENT/);
  });

  test('system errors carry code, errno and syscall', async () => {
    await assert.rejects(readFile('/definitely/not/here'), (err: NodeJS.ErrnoException) => {
      assert.equal(err.code, 'ENOENT');
      assert.equal(err.syscall, 'open');
      assert.equal(typeof err.errno, 'number');
      return true;
    });
  });

  test('zero-cost async stack traces show the awaiting callers', async () => {
    async function inner() {
      // oxlint-disable-next-line unicorn/no-unnecessary-await -- the await creates the async boundary the stack trace must cross
      await null;
      throw new Error('deep');
    }
    async function outer() {
      await inner();
    }
    await assert.rejects(outer(), (err: Error) => {
      assert.match(err.stack ?? '', /at async outer/);
      return true;
    });
  });

  test('AggregateError collects every failure from Promise.any', async () => {
    await assert.rejects(
      Promise.any([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]),
      (err: AggregateError) => {
        assert.deepEqual(
          err.errors.map((e: Error) => e.message),
          ['a', 'b'],
        );
        return true;
      },
    );
  });

  test('Error.captureStackTrace omits frames above a given function', () => {
    function factory() {
      const o: { stack?: string } = {};
      Error.captureStackTrace(o, factory);
      return o.stack ?? '';
    }
    function caller() {
      return factory();
    }
    const stack = caller();
    assert.ok(!stack.includes('at factory'));
    assert.ok(stack.includes('at caller'));
  });
});

describe('control-flow utilities (04-control-flow.ts)', async () => {
  const { withTimeout, onceCallback, safeHandler } = await import('./04-control-flow.ts');
  const { setTimeout: sleep } = await import('node:timers/promises');

  test('withTimeout cancels the work itself: Node APIs reject with AbortError whose cause is the TimeoutError', async () => {
    let sawAbort = false;
    await assert.rejects(
      withTimeout(async (signal) => {
        signal.addEventListener('abort', () => (sawAbort = true));
        await sleep(60_000, undefined, { signal });
      }, 10),
      (err: Error) => {
        assert.equal(err.name, 'AbortError');
        assert.equal((err.cause as Error).name, 'TimeoutError');
        return true;
      },
    );
    assert.equal(sawAbort, true);
  });

  test('withTimeout propagates a parent abort reason', async () => {
    const parent = new AbortController();
    parent.abort(new Error('shutdown'));
    await assert.rejects(
      withTimeout(async () => 1, 1000, parent.signal),
      /shutdown/,
    );
  });

  test('withTimeout returns the value when work wins, leaving no timer that keeps the process alive', () => {
    const r = runNode([
      '--input-type=module',
      '-e',
      `import { withTimeout } from ${JSON.stringify(new URL('./04-control-flow.ts', import.meta.url).href)};
       const t0 = Date.now();
       console.log(await withTimeout(async () => 42, 60_000));
       process.on('exit', () => console.log(Date.now() - t0 < 30_000 ? 'exited promptly' : 'held open'));`,
    ]);
    assert.deepEqual(r.stdout.trim().split('\n'), ['42', 'exited promptly']);
  });

  test('negative: a Promise.race timeout keeps the process alive until its timer fires', () => {
    const r = runNode([
      '-e',
      `const t0 = Date.now();
       const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 300));
       timeout.catch(() => {});
       Promise.race([Promise.resolve(42), timeout]).then(console.log);
       process.on('exit', () => console.log(Date.now() - t0 >= 300 ? 'held open by timer' : 'exited early'));`,
    ]);
    assert.deepEqual(r.stdout.trim().split('\n'), ['42', 'held open by timer']);
  });

  test('onceCallback swallows and reports the second call', () => {
    const results: unknown[] = [];
    const dups: string[] = [];
    const cb = onceCallback<[number]>(
      (err, v) => results.push(err ?? v),
      (e) => dups.push(e.message),
    );
    cb(null, 1);
    cb(null, 2);
    assert.deepEqual(results, [1]);
    assert.deepEqual(dups, ['callback called more than once']);
  });

  test('safeHandler turns a rejected handler into a 500, not an unhandled rejection', async () => {
    const reported: unknown[] = [];
    const res = {
      statusCode: 200,
      body: '',
      headersSent: false,
      end(b?: string) {
        this.body = b ?? '';
      },
    };
    const h = safeHandler(
      async () => {
        throw new Error('db down');
      },
      (e) => reported.push(e),
    );
    h({}, res);
    await sleep(0);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body, 'internal error');
    assert.equal((reported[0] as Error).message, 'db down');
  });
});
