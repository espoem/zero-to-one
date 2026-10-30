// Module 06 · Agents, realms, the job queue and the event loop
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { runNode } from './helpers/run-node.js';
import { EventLoopModel } from './06-event-loop-model.js';

const macrotask = () => new Promise((r) => setTimeout(r, 0));

describe('Job ordering in Node (HostEnqueuePromiseJob → microtasks)', () => {
  test('sync → microtasks in FIFO order → tasks', async () => {
    const log = [];
    setTimeout(() => log.push('A timer'), 0);
    Promise.resolve().then(() => log.push('B then'));
    queueMicrotask(() => log.push('C queueMicrotask'));
    (async () => { await null; log.push('D await'); })();
    log.push('E sync');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(log, ['E sync', 'B then', 'C queueMicrotask', 'D await', 'A timer']);
  });

  test('then callbacks never run synchronously, even on settled promises', () => {
    const log = [];
    Promise.resolve().then(() => log.push('then'));
    log.push('after');
    assert.deepEqual(log, ['after']);
  });

  test('tick accounting: await 1, thenable 2, resolve(promise) and async return 3', async () => {
    const log = [];
    let i = 0;
    const step = () => { log.push(`tick${++i}`); if (i < 5) Promise.resolve().then(step); };
    Promise.resolve().then(step);
    (async () => { await Promise.resolve(); log.push('await'); })();
    Promise.resolve({ then(/** @type {any} */ r) { r(); } }).then(() => log.push('thenable'));
    new Promise((r) => r(Promise.resolve())).then(() => log.push('resolve(promise)'));
    (async () => Promise.resolve())().then(() => log.push('async return promise'));
    await macrotask();
    assert.deepEqual(log, ['tick1', 'await', 'tick2', 'thenable', 'tick3',
      'resolve(promise)', 'async return promise', 'tick4', 'tick5']);
  });

  test('return await is not slower than return (fewer ticks, in fact)', async () => {
    const log = [];
    const inner = () => Promise.resolve('v');
    (async () => inner())().then(() => log.push('return p'));
    (async () => await inner())().then(() => log.push('return await p'));
    await macrotask();
    assert.deepEqual(log, ['return await p', 'return p']);
  });

  test('NEGATIVE: return p (without await) bypasses the surrounding catch', async () => {
    const failing = () => Promise.reject(new Error('x'));
    async function withoutAwait() { try { return failing(); } catch { return 'caught'; } }
    async function withAwait() { try { return await failing(); } catch { return 'caught'; } }
    await assert.rejects(withoutAwait(), /x/);
    assert.equal(await withAwait(), 'caught');
  });

  test('NEGATIVE: resolving a promise with itself rejects with TypeError', async () => {
    /** @type {(v: any) => void} */
    let resolve = () => {};
    const p = new Promise((r) => { resolve = r; });
    resolve(p);
    await assert.rejects(p, TypeError);
  });

  test('only the first resolve/reject call counts', async () => {
    const p = new Promise((res, rej) => { res(1); rej(new Error('ignored')); res(2); });
    assert.equal(await p, 1);
  });
});

describe('HostPromiseRejectionTracker (§27.2.1.9) in Node', () => {
  test('NEGATIVE: an unhandled rejection exits the process with code 1 by default', () => {
    const r = runNode(['-e', 'Promise.reject(new Error("nobody listens"))']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /nobody listens/);
  });

  test('a handler attached in the same tick avoids the report; one macrotask later is too late', () => {
    const src = `
      const events = [];
      process.on('unhandledRejection', () => events.push('unhandled'));
      process.on('rejectionHandled', () => events.push('handled-late'));
      const early = Promise.reject(new Error('a'));
      early.catch(() => {});
      const late = Promise.reject(new Error('b'));
      setTimeout(() => {
        late.catch(() => {});
        setTimeout(() => console.log(JSON.stringify(events)), 10);
      }, 0);`;
    const r = runNode(['-e', src]);
    assert.deepEqual(JSON.parse(r.stdout), ['unhandled', 'handled-late']);
  });
});

describe('Realms (§9.3)', () => {
  test('each vm context has its own intrinsics', () => {
    const ctx = vm.createContext({});
    const OtherArray = vm.runInContext('Array', ctx);
    assert.notEqual(OtherArray, Array);
    const arr = vm.runInContext('[1, 2]', ctx);
    assert.equal(arr instanceof Array, false);
    assert.equal(Array.isArray(arr), true);
    assert.equal(Object.prototype.toString.call(arr), '[object Array]');
  });

  test('Error.isError (ES2026) is realm-independent and not fooled by prototypes', () => {
    const foreign = vm.runInNewContext('new TypeError("t")');
    assert.equal(foreign instanceof Error, false);
    assert.equal(Error.isError(foreign), true);
    const fake = Object.create(Error.prototype);
    assert.equal(fake instanceof Error, true);
    assert.equal(Error.isError(fake), false);
  });

  test('NEGATIVE: Symbol.toStringTag can spoof Object.prototype.toString', () => {
    const fake = { [Symbol.toStringTag]: 'Array' };
    assert.equal(Object.prototype.toString.call(fake), '[object Array]');
    assert.equal(Array.isArray(fake), false);
  });

  test('promises from another realm interoperate through the thenable protocol', async () => {
    const foreignPromise = vm.runInNewContext('Promise.resolve(42)');
    assert.equal(foreignPromise instanceof Promise, false);
    assert.equal(await foreignPromise, 42);
  });
});

describe('Agents (§9.6): a worker is a separate agent with its own event loop', () => {
  test('a blocked worker does not block the main agent (deterministic handshake)', async () => {
    // The worker blocks in Atomics.wait until the main agent, after running several of its own
    // timer tasks, flips the flag. If agents shared one thread, this could never complete.
    const sab = new SharedArrayBuffer(8);
    const a = new Int32Array(sab);
    const worker = new Worker(`
      const { parentPort, workerData: { sab } } = require('node:worker_threads');
      const a = new Int32Array(sab);
      Atomics.store(a, 1, 1); Atomics.notify(a, 1);     // "I am about to block"
      Atomics.wait(a, 0, 0);                            // blocks this agent only
      parentPort.postMessage(Atomics.load(a, 0));`, { eval: true, workerData: { sab } });
    await Atomics.waitAsync(a, 1, 0).value;            // the worker is blocked (or about to be)
    let mainTasks = 0;
    for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 0)); mainTasks++; }
    Atomics.store(a, 0, mainTasks);
    Atomics.notify(a, 0);
    const seen = await new Promise((r) => worker.once('message', r));
    await worker.terminate();
    assert.equal(seen, 5);                              // the main agent ran 5 tasks while the worker was blocked
  });

  test('structured clone recreates values in the receiving realm', async () => {
    const worker = new Worker(`
      const { parentPort } = require('node:worker_threads');
      parentPort.once('message', (v) => parentPort.postMessage([Array.isArray(v.list), v.list instanceof Array, v.when instanceof Date]));`,
    { eval: true });
    worker.postMessage({ list: [1], when: new Date() });
    const answer = await new Promise((r) => worker.once('message', r));
    await worker.terminate();
    assert.deepEqual(answer, [true, true, true]);
  });
});

describe('HTML processing model (executable model, examples/06-event-loop-model.js)', () => {
  test('the classic puzzle: sync, microtasks, then tasks', () => {
    const el = new EventLoopModel();
    el.queueTask('script', 'script', () => {
      el.log.push('1 sync');
      el.setTimeout('timer', () => el.log.push('5 timer'));
      el.queueMicrotask(() => el.log.push('3 microtask'));
      el.queueMicrotask(() => {
        el.log.push('4 microtask');
        el.queueMicrotask(() => el.log.push('4b nested microtask, same checkpoint'));
      });
      el.log.push('2 sync');
    });
    el.run();
    assert.deepEqual(el.log, ['1 sync', '2 sync', '3 microtask', '4 microtask',
      '4b nested microtask, same checkpoint', '5 timer']);
  });

  test('rAF runs inside the rendering task, before style/layout and paint; its microtasks run in between', () => {
    const el = new EventLoopModel({ frameMs: 16 });
    el.queueTask('script', 'script', () => {
      el.requestAnimationFrame(() => {
        el.log.push('rAF 1');
        el.queueMicrotask(() => el.log.push('microtask from rAF 1'));
      });
      el.requestAnimationFrame(() => el.log.push('rAF 2'));
    });
    el.run();
    assert.deepEqual(el.log, ['rAF 1', 'microtask from rAF 1', 'rAF 2', 'style+layout', 'paint']);
  });

  test('NEGATIVE: a self-re-enqueuing microtask starves timers and rendering', () => {
    const el = new EventLoopModel();
    el.queueTask('script', 'script', () => {
      el.setTimeout('timer', () => el.log.push('timer'));
      el.requestAnimationFrame(() => el.log.push('rAF'));
      const spin = () => el.queueMicrotask(spin);
      spin();
    });
    assert.throws(() => el.run({ microtaskLimit: 1000 }), /starvation/);
    assert.deepEqual(el.log, ['STARVED']);
  });

  test('a self-re-enqueuing task lets rendering interleave', () => {
    const el = new EventLoopModel({ frameMs: 16 });
    let n = 0;
    const spin = () => { if (++n < 40) el.queueTask('message', 'spin', spin); };
    el.queueTask('script', 'script', () => {
      el.requestAnimationFrame(() => el.log.push(`rAF at task ${n}`));
      spin();
    });
    el.run();
    assert.ok(el.log.includes('paint'));
    const rafEntry = el.log.find((l) => l.startsWith('rAF'));
    assert.ok(rafEntry && Number(rafEntry.split(' ').at(-1)) < 40, 'rendering happened while tasks were still queued');
  });

  test('Node agrees with the model on the sync/microtask/task order', () => {
    const r = runNode(['-e', `
      const log = [];
      setTimeout(() => { log.push('timer'); console.log(log.join(',')); });
      queueMicrotask(() => { log.push('m1'); queueMicrotask(() => log.push('m2')); });
      log.push('sync');`]);
    assert.equal(r.stdout.trim(), 'sync,m1,m2,timer');
  });
});

// ---- Depth pass: promise algorithms (§27.2.1–§27.2.5) and the verified HTML processing model

describe('Depth: CreateResolvingFunctions, reactions, PromiseIsHandled', () => {
  test('resolve reads `then` synchronously; a throwing getter rejects instead of throwing', async () => {
    const log = [];
    const p = new Promise((resolve) => {
      resolve({ get then() { log.push('getter'); throw new Error('from getter'); } });
      log.push('after resolve');
    });
    assert.deepEqual(log, ['getter', 'after resolve']);
    await assert.rejects(p, /from getter/);
  });

  test('reactions on one promise run in registration order', async () => {
    const log = [];
    const { promise, resolve } = Promise.withResolvers();
    promise.then(() => log.push(1));
    promise.then(() => log.push(2));
    promise.then(() => log.push(3));
    resolve();
    await promise; await null;
    assert.deepEqual(log, [1, 2, 3]);
  });

  test('then() without handlers passes values and rejections through', async () => {
    assert.equal(await Promise.resolve(7).then().then(), 7);
    await assert.rejects(Promise.reject(new Error('down')).then((v) => v).then(), /down/);
  });

  test('NEGATIVE: handling p does not handle the derived promise p.then(f)', () => {
    const r = runNode(['-e', `
      const p = Promise.reject(new Error('derived is unhandled'));
      p.catch(() => {});        // p is handled
      p.then(() => 'never');    // this returns a new rejected promise with no handler
    `]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /derived is unhandled/);
  });

  test('await calls PerformPromiseThen directly; resolve(promise) calls the public then', () => {
    const r = runNode(['-e', `
      const orig = Promise.prototype.then; let calls = 0;
      Promise.prototype.then = function (...a) { calls++; return orig.apply(this, a); };
      (async () => {
        await Promise.resolve(1); const viaAwait = calls; calls = 0;
        await new Promise((r) => r(Promise.resolve(2))); const viaResolve = calls;
        console.log(JSON.stringify([viaAwait, viaResolve]));
      })();`]);
    assert.deepEqual(JSON.parse(r.stdout), [0, 1]);
  });

  test('an exception thrown inside a reaction rejects the derived promise, it does not escape', async () => {
    const derived = Promise.resolve().then(() => { throw new Error('inside reaction'); });
    await assert.rejects(derived, /inside reaction/);
  });
});

describe('Depth: rendering task details in the model (HTML §8.1.7.3)', () => {
  test('verbose rendering follows the standard sub-step order', () => {
    const el = new EventLoopModel({ frameMs: 16 });
    el.verboseRendering = true;
    el.queueTask('script', 'script', () => el.requestAnimationFrame(() => el.log.push('rAF')));
    el.run();
    assert.deepEqual(el.log, ['resize', 'scroll', 'media queries', 'animations', 'fullscreen', 'context lost',
      'rAF', 'style+layout', 'focus fix-up', 'view transitions', 'intersection observers', 'paint']);
  });

  test('all rAF callbacks in a frame receive the same timestamp', () => {
    const el = new EventLoopModel({ frameMs: 16 });
    const stamps = [];
    el.queueTask('script', 'script', () => {
      el.requestAnimationFrame((t) => { stamps.push(t); el.setTimeout('busy', () => {}); });
      el.requestAnimationFrame((t) => stamps.push(t));
    });
    el.run();
    assert.equal(stamps.length, 2);
    assert.equal(stamps[0], stamps[1]);
  });

  test('NEGATIVE: hidden documents are filtered out: no rAF callbacks, no paint', () => {
    const el = new EventLoopModel({ frameMs: 16 });
    el.visible = false;
    el.queueTask('script', 'script', () => el.requestAnimationFrame(() => el.log.push('rAF')));
    el.run({ maxSteps: 100 });
    assert.deepEqual(el.log, []);
  });

  test('idle deadline is capped at 50 ms and by the next timer', () => {
    const el = new EventLoopModel();
    assert.equal(el.idleDeadline(), 50);
    el.setTimeout('t', () => {}, 20);
    assert.equal(el.idleDeadline(), 20);
  });

  test('user dispatch checkpoints between listeners; el.click() from script does not', () => {
    const run = (fromUser) => {
      const el = new EventLoopModel();
      el.queueTask('user-interaction', 'click', () => {
        el.dispatch([
          () => { el.queueMicrotask(() => el.log.push('microtask from listener 1')); el.log.push('listener 1'); },
          () => el.log.push('listener 2'),
        ], { fromUser });
      });
      el.run();
      return el.log;
    };
    assert.deepEqual(run(true), ['listener 1', 'microtask from listener 1', 'listener 2']);
    assert.deepEqual(run(false), ['listener 1', 'listener 2', 'microtask from listener 1']);
  });

  test('Node EventTarget dispatch from script behaves like el.click(): microtasks after all listeners', () => {
    const log = [];
    const target = new EventTarget();
    target.addEventListener('x', () => { queueMicrotask(() => log.push('microtask')); log.push('l1'); });
    target.addEventListener('x', () => log.push('l2'));
    target.dispatchEvent(new Event('x'));
    assert.deepEqual(log, ['l1', 'l2']);
  });
});
