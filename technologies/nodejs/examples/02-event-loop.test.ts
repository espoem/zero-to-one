// Module 02 · The event loop: phases, nextTick vs microtasks, setImmediate vs timers, thread pool.
// Every ordering assertion here is one the event loop *guarantees*. Orderings that depend on
// wall-clock time (main-module setTimeout(0) vs setImmediate) are demonstrated, never asserted.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { runNode, runModule } from './helpers/run-node.ts';
import { MiniLoop } from './02-mini-loop.ts';

const lines = (s: string) => s.trim().split(/\s+/);

describe('nextTick queue vs microtask queue', () => {
  const program = `
    const log = []; const L = (s) => log.push(s);
    process.nextTick(() => L('tick1'));
    Promise.resolve().then(() => { L('p1'); process.nextTick(() => L('tick-from-p1')); Promise.resolve().then(() => L('p1b')); });
    queueMicrotask(() => L('qm'));
    process.nextTick(() => { L('tick2'); Promise.resolve().then(() => L('p-from-tick2')); });
    process.on('exit', () => console.log(log.join(' ')));
    L('sync');`;

  test('CommonJS entry: all ticks, then all microtasks; a tick queued by a microtask waits for the drain', () => {
    const r = runNode(['-e', program]);
    assert.deepEqual(lines(r.stdout), [
      'sync',
      'tick1',
      'tick2',
      'p1',
      'qm',
      'p-from-tick2',
      'p1b',
      'tick-from-p1',
    ]);
  });

  test('ES module entry: microtasks run BEFORE nextTick (evaluation is itself inside a promise job)', () => {
    const r = runModule(program);
    assert.deepEqual(lines(r.stdout), [
      'sync',
      'p1',
      'qm',
      'p1b',
      'tick1',
      'tick2',
      'tick-from-p1',
      'p-from-tick2',
    ]);
  });
});

describe('phases', () => {
  test('inside an I/O callback, setImmediate always beats setTimeout(0)', async () => {
    for (let i = 0; i < 20; i++) {
      const order: string[] = [];
      await new Promise<void>((done) => {
        stat(import.meta.filename, () => {
          setTimeout(() => {
            order.push('timeout');
            if (order.length === 2) done();
          }, 0);
          setImmediate(() => {
            order.push('immediate');
            if (order.length === 2) done();
          });
        });
      });
      assert.deepEqual(order, ['immediate', 'timeout']);
    }
  });

  test('main module setTimeout(0) vs setImmediate is NOT guaranteed (demonstration only)', () => {
    const r = runNode([
      '-e',
      'setTimeout(() => process.stdout.write("T"), 0); setImmediate(() => process.stdout.write("I"))',
    ]);
    assert.ok(r.stdout === 'TI' || r.stdout === 'IT', r.stdout);
  });

  test('microtasks and ticks are drained between individual timer callbacks (since Node 11)', () => {
    const r = runNode([
      '-e',
      `const log = [];
       setTimeout(() => { log.push('t1'); process.nextTick(() => log.push('t1-tick')); Promise.resolve().then(() => log.push('t1-p')); }, 0);
       setTimeout(() => log.push('t2'), 0);
       process.on('exit', () => console.log(log.join(' ')));`,
    ]);
    assert.deepEqual(lines(r.stdout), ['t1', 't1-tick', 't1-p', 't2']);
  });

  test('immediates queued during the check phase run on the NEXT iteration, after the current batch', async () => {
    const order: string[] = [];
    await new Promise<void>((done) => {
      setImmediate(() => {
        order.push('A');
        Promise.resolve().then(() => order.push('A-microtask'));
        setImmediate(() => {
          order.push('C');
          done();
        });
      });
      setImmediate(() => order.push('B'));
    });
    assert.deepEqual(order, ['A', 'A-microtask', 'B', 'C']);
  });

  test('a timer cannot fire while JavaScript is running: lateness >= blocking time', async () => {
    const t0 = performance.now();
    const fired = new Promise<number>((r) => setTimeout(() => r(performance.now()), 0));
    const blockUntil = t0 + 60;
    while (performance.now() < blockUntil) {
      /* busy: simulates JSON.parse of a huge body */
    }
    assert.ok((await fired) - t0 >= 60);
  });
});

describe('starvation', () => {
  test('recursive process.nextTick starves I/O: the stat callback never runs during the recursion', () => {
    const r = runNode([
      '-e',
      `let n = 0, ioAt = -1;
       require('fs').stat('.', () => { ioAt = n; });
       (function f() { if (++n < 200000) process.nextTick(f); else console.log('io seen during ticks:', ioAt !== -1); })();`,
    ]);
    assert.match(r.stdout, /io seen during ticks: false/);
  });

  test('recursive promise chains starve I/O the same way', () => {
    const r = runNode([
      '-e',
      `let n = 0, ioAt = -1;
       require('fs').stat('.', () => { ioAt = n; });
       (function f() { if (++n < 200000) Promise.resolve().then(f); else console.log('io seen during microtasks:', ioAt !== -1); })();`,
    ]);
    assert.match(r.stdout, /io seen during microtasks: false/);
  });

  test('recursive setImmediate does NOT starve I/O: poll runs every iteration', () => {
    const r = runNode([
      '-e',
      `let n = 0, io = false;
       require('fs').stat('.', () => { io = true; });
       (function f() { n++; if (!io && n < 1e7) setImmediate(f); else console.log('io after', n, 'immediates:', io); })();`,
    ]);
    assert.match(r.stdout, /immediates: true/);
  });
});

describe('the libuv thread pool', () => {
  const program = `
    const log = [];
    require('crypto').pbkdf2('pw', 'salt', 200000, 32, 'sha256', () => log.push('pbkdf2'));
    require('fs').stat(__filename, () => log.push('fs'));
    process.on('exit', () => console.log(log.join(' ')));`;

  test('UV_THREADPOOL_SIZE=1: a queued pbkdf2 delays an unrelated fs call (FIFO, one worker)', () => {
    const r = runNode(['-e', program.replace('__filename', '"."')], {
      env: { UV_THREADPOOL_SIZE: '1' },
    });
    assert.equal(r.stdout.trim(), 'pbkdf2 fs');
  });

  test('crypto.pbkdf2Sync blocks the main thread instead (the callback-free version)', () => {
    const r = runNode([
      '-e',
      `let fired = false; setTimeout(() => (fired = true), 0);
       require('crypto').pbkdf2Sync('pw', 'salt', 50000, 32, 'sha256');
       console.log('timer fired during pbkdf2Sync:', fired);`,
    ]);
    assert.match(r.stdout, /during pbkdf2Sync: false/);
  });
});

describe('timers', () => {
  test('delays above 2^31-1 ms overflow to 1 ms with a TimeoutOverflowWarning', () => {
    const r = runNode(['-e', 'setTimeout(() => console.log("fired early"), 2 ** 31)']);
    assert.match(r.stdout, /fired early/);
    assert.match(r.stderr, /TimeoutOverflowWarning/);
  });

  test('an unref()ed timer does not keep the process alive', () => {
    const r = runNode(['-e', 'setTimeout(() => console.log("never"), 60_000).unref()']);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('timers/promises honours AbortSignal', async () => {
    const ac = new AbortController();
    const p = sleep(60_000, 'value', { signal: ac.signal });
    ac.abort();
    await assert.rejects(p, { name: 'AbortError' });
  });

  test('timer.refresh() restarts a timer without allocating a new one', async () => {
    const order: string[] = [];
    await new Promise<void>((done) => {
      const t = setTimeout(() => {
        order.push('fired');
        done();
      }, 20);
      setTimeout(() => {
        order.push('refresh');
        t.refresh();
      }, 10);
    });
    assert.deepEqual(order, ['refresh', 'fired']);
  });

  test('a timer handle exposes ref state and a numeric id', () => {
    const t = setTimeout(() => {}, 1000);
    assert.equal(t.hasRef(), true);
    t.unref();
    assert.equal(t.hasRef(), false);
    assert.equal(typeof +t, 'number'); // Symbol.toPrimitive gives an id usable with clearTimeout
    clearTimeout(+t);
  });
});

describe('the executable model (02-mini-loop.ts) agrees with real Node on guaranteed orderings', () => {
  test('ticks vs microtasks (CommonJS entry)', () => {
    const l = new MiniLoop();
    const L = (x: string) => l.log.push(x);
    l.runMain(() => {
      l.nextTick(() => L('tick1'));
      l.queueMicrotask(() => {
        L('p1');
        l.nextTick(() => L('tick-from-p1'));
        l.queueMicrotask(() => L('p1b'));
      });
      l.queueMicrotask(() => L('qm'));
      l.nextTick(() => {
        L('tick2');
        l.queueMicrotask(() => L('p-from-tick2'));
      });
      L('sync');
    });
    assert.deepEqual(l.log, [
      'sync',
      'tick1',
      'tick2',
      'p1',
      'qm',
      'p-from-tick2',
      'p1b',
      'tick-from-p1',
    ]);
  });

  test('inside an I/O callback: tick, immediate, then timer', () => {
    const l = new MiniLoop();
    const L = (x: string) => l.log.push(x);
    l.runMain(() => {
      l.completeIo(() => {
        L('io');
        l.setTimeout(() => L('io-timer'), 0);
        l.setImmediate(() => L('io-immediate'));
        l.nextTick(() => L('io-tick'));
      });
    });
    assert.deepEqual(l.log, ['io', 'io-tick', 'io-immediate', 'io-timer']);
  });

  test('drain after every timer, and the immediate snapshot rule', () => {
    const l = new MiniLoop();
    const L = (x: string) => l.log.push(x);
    l.runMain(() => {
      l.setTimeout(() => {
        L('t1');
        l.queueMicrotask(() => L('t1-p'));
      }, 0);
      l.setTimeout(() => L('t2'), 0);
      l.setImmediate(() => {
        L('A');
        l.setImmediate(() => L('C'));
      });
      l.setImmediate(() => L('B'));
    });
    assert.deepEqual(
      l.log.filter((x) => x.startsWith('t')),
      ['t1', 't1-p', 't2'],
    );
    assert.deepEqual(
      l.log.filter((x) => /^[ABC]$/.test(x)),
      ['A', 'B', 'C'],
    );
  });

  test('timer clamping: 0, NaN and > 2^31-1 all become 1 ms', () => {
    const l = new MiniLoop();
    l.runMain(() => {
      l.setTimeout(() => l.log.push(`a@${l.now}`), 0);
      l.setTimeout(() => l.log.push(`b@${l.now}`), Number.NaN);
      l.setTimeout(() => l.log.push(`c@${l.now}`), 2 ** 31);
      l.setTimeout(() => l.log.push(`d@${l.now}`), 5);
    });
    assert.deepEqual(l.log, ['a@1', 'b@1', 'c@1', 'd@5']);
  });
});
