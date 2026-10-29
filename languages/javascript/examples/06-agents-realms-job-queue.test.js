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
  test('blocking the worker does not block the main agent', async () => {
    const worker = new Worker(`
      const { parentPort } = require('node:worker_threads');
      const end = Date.now() + 200;
      while (Date.now() < end) {}        // busy loop: blocks only this agent
      parentPort.postMessage('done');`, { eval: true });
    let mainTicks = 0;
    const interval = setInterval(() => mainTicks++, 10);
    await new Promise((r) => worker.once('message', r));
    clearInterval(interval);
    await worker.terminate();
    assert.ok(mainTicks >= 5, `main agent kept running (${mainTicks} ticks)`);
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
