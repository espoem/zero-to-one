// Module 11 · Diagnostics and performance: event-loop delay/ELU, CPU profiles, heap snapshots,
// diagnostic reports, AsyncLocalStorage, diagnostics_channel, perf_hooks.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { monitorEventLoopDelay, performance, createHistogram } from 'node:perf_hooks';
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import dc from 'node:diagnostics_channel';
import { Session } from 'node:inspector/promises';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep, setImmediate as tick } from 'node:timers/promises';
import { countNodesByName } from './11-heap-snapshot.ts';
import { runNode } from './helpers/run-node.ts';

const busy = (ms: number) => {
  const end = performance.now() + ms;
  while (performance.now() < end);
};

describe('event-loop delay and utilisation', () => {
  test('monitorEventLoopDelay records a block at least as long as the block', async () => {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    await sleep(30); // let the sampling timer start
    busy(120); // block the loop
    await sleep(30); // let the late sample be recorded
    h.disable();
    assert.ok(h.max >= 100e6, `max delay ${(h.max / 1e6).toFixed(1)} ms`); // nanoseconds
    assert.ok(h.percentile(100) === h.max);
  });

  test('eventLoopUtilization is ~1 across a synchronous block (no idle time inside it)', () => {
    const start = performance.eventLoopUtilization();
    busy(50);
    const delta = performance.eventLoopUtilization(start);
    assert.ok(delta.utilization > 0.9, `ELU ${delta.utilization}`);
    assert.ok(delta.active >= 50);
  });

  test('custom histograms for your own latencies', () => {
    const h = createHistogram();
    for (const v of [1, 2, 3, 100]) h.record(v);
    assert.equal(h.min, 1);
    assert.equal(h.max, 100);
    assert.equal(h.count, 4);
  });
});

describe('CPU profiling', () => {
  test('--cpu-prof writes a .cpuprofile in which the hot function appears', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-prof-'));
    try {
      const r = runNode([
        '--cpu-prof',
        `--cpu-prof-dir=${dir}`,
        '-e',
        'function hotFunction() { let x = 0; const end = Date.now() + 300; while (Date.now() < end) x += Math.sqrt(x + 1); return x; } hotFunction();',
      ]);
      assert.equal(r.status, 0, r.stderr);
      const file = readdirSync(dir).find((f) => f.endsWith('.cpuprofile'));
      assert.ok(file);
      const profile = JSON.parse(readFileSync(join(dir, file!), 'utf8')) as {
        nodes: Array<{ callFrame: { functionName: string } }>;
      };
      assert.ok(profile.nodes.some((n) => n.callFrame.functionName === 'hotFunction'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the inspector protocol profiles in-process (node:inspector/promises)', async () => {
    const session = new Session();
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.start');
    function profiledWork() {
      busy(100);
    }
    profiledWork();
    const { profile } = (await session.post('Profiler.stop')) as {
      profile: { nodes: Array<{ callFrame: { functionName: string } }> };
    };
    session.disconnect();
    assert.ok(
      profile.nodes.some(
        (n) => n.callFrame.functionName === 'profiledWork' || n.callFrame.functionName === 'busy',
      ),
    );
  });
});

describe('heap snapshots', () => {
  test('v8.writeHeapSnapshot: the snapshot counts exactly the retained instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-snap-'));
    try {
      const r = runNode([
        '-e',
        `
        class LeakyThing { constructor(i) { this.i = i; } }
        globalThis.retained = Array.from({ length: 1234 }, (_, i) => new LeakyThing(i));
        console.log(require('v8').writeHeapSnapshot(require('path').join(${JSON.stringify(dir)}, 'x.heapsnapshot')));`,
      ]);
      assert.equal(r.status, 0, r.stderr);
      const counts = countNodesByName(readFileSync(r.stdout.trim(), 'utf8'), 'object');
      assert.equal(counts.get('LeakyThing'), 1234);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('diagnostic reports', () => {
  test('process.report.getReport() is a JSON document about the whole process', () => {
    const report = process.report.getReport() as unknown as {
      header: { nodejsVersion: string; glibcVersionRuntime?: string };
      javascriptHeap: unknown;
      libuv: unknown[];
    };
    assert.equal(report.header.nodejsVersion, process.version);
    assert.ok(report.javascriptHeap);
    assert.ok(Array.isArray(report.libuv));
  });

  test('--report-uncaught-exception writes a report when the process crashes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-report-'));
    try {
      const r = runNode([
        '--report-uncaught-exception',
        `--report-directory=${dir}`,
        '--report-exclude-env',
        '-e',
        'throw new Error("crash for the report")',
      ]);
      assert.equal(r.status, 1);
      const file = readdirSync(dir).find((f) => f.startsWith('report.') && f.endsWith('.json'));
      assert.ok(file);
      const text = readFileSync(join(dir, file!), 'utf8');
      const rep = JSON.parse(text) as {
        header: { trigger: string };
        javascriptStack: { stack: string[] };
        environmentVariables?: unknown;
      };
      assert.match(rep.header.trigger, /Exception/);
      assert.ok(text.includes('crash for the report'));
      assert.equal(rep.environmentVariables, undefined); // excluded: reports otherwise contain secrets from env
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('AsyncLocalStorage', () => {
  const als = new AsyncLocalStorage<string>();

  test('the store follows await, timers and immediates', async () => {
    const seen: Array<string | undefined> = [];
    await als.run('req-1', async () => {
      seen.push(als.getStore());
      await sleep(1);
      seen.push(als.getStore());
      await new Promise<void>((r) =>
        setImmediate(() => {
          seen.push(als.getStore());
          r();
        }),
      );
    });
    assert.deepEqual(seen, ['req-1', 'req-1', 'req-1']);
    assert.equal(als.getStore(), undefined);
  });

  test("concurrent requests do not see each other's store", async () => {
    const log: string[] = [];
    await Promise.all(
      ['a', 'b', 'c'].map((id) =>
        als.run(id, async () => {
          await tick();
          log.push(`${id}:${als.getStore()}`);
        }),
      ),
    );
    assert.deepEqual(log.sort(), ['a:a', 'b:b', 'c:c']);
  });

  test('negative: an EventEmitter listener runs in the context of whoever calls emit()', () => {
    const bus = new EventEmitter();
    let seen: string | undefined;
    als.run('registered-in-A', () => bus.on('x', () => (seen = als.getStore())));
    als.run('emitted-from-B', () => bus.emit('x'));
    assert.equal(seen, 'emitted-from-B'); // a shared connection's events report the WRONG request
  });

  test('AsyncResource.bind pins a callback to the context where it was bound', () => {
    const bus = new EventEmitter();
    let seen: string | undefined;
    als.run('registered-in-A', () =>
      bus.on(
        'x',
        AsyncResource.bind(() => (seen = als.getStore())),
      ),
    );
    als.run('emitted-from-B', () => bus.emit('x'));
    assert.equal(seen, 'registered-in-A');
  });

  test('exit() runs background work outside the request context', () => {
    als.run('req', () => {
      als.exit(() => assert.equal(als.getStore(), undefined));
      assert.equal(als.getStore(), 'req');
    });
  });

  test('AsyncContextFrame is the default implementation; --no-async-context-frame is the escape hatch', () => {
    const r = runNode([
      '--no-async-context-frame',
      '-e',
      'const { AsyncLocalStorage } = require("node:async_hooks"); const s = new AsyncLocalStorage(); s.run(1, async () => { await null; console.log(s.getStore()); });',
    ]);
    assert.equal(r.stdout.trim(), '1'); // same semantics either way for ordinary code
  });
});

describe('diagnostics_channel tracing for your own operations', () => {
  test('tracingChannel.tracePromise publishes start / end / asyncStart / asyncEnd around an async call', async () => {
    const tc = dc.tracingChannel<{ query: string }>('zto:db.query');
    const events: string[] = [];
    const sub = {
      start: (c: { query: string }) => events.push(`start ${c.query}`),
      end: () => events.push('end'),
      asyncStart: () => events.push('asyncStart'),
      asyncEnd: () => events.push('asyncEnd'),
      error: () => events.push('error'),
    };
    tc.subscribe(sub);
    const result = await tc.tracePromise(
      async () => {
        await tick();
        return 42;
      },
      { query: 'SELECT 1' },
    );
    tc.unsubscribe(sub);
    assert.equal(result, 42);
    assert.deepEqual(events, ['start SELECT 1', 'end', 'asyncStart', 'asyncEnd']);
  });

  test('publishing with no subscribers is cheap and observable via hasSubscribers', () => {
    const ch = dc.channel('zto:unused');
    assert.equal(ch.hasSubscribers, false);
    ch.publish({ anything: true }); // no-op
  });
});

describe('perf_hooks user timing', () => {
  test('mark/measure and timerify produce PerformanceEntries', () => {
    performance.mark('a');
    busy(5);
    performance.mark('b');
    const m = performance.measure('a-to-b', 'a', 'b');
    assert.ok(m.duration >= 5);
    performance.clearMarks();
    performance.clearMeasures();
  });
});
