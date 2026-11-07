// Module 06: stream IDs, consumer groups, PEL recovery, trimming, idempotent production,
// reliable list queues, and pub/sub output-buffer disconnects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  Stream,
  nextAutoId,
  cmpId,
  fmt,
  IdempotentProducerTable,
  ListQueue,
  disconnectTime,
} from './src/streams.ts';

test('auto IDs are <ms>-<seq> and strictly increasing even when the clock goes backwards', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 1_000 }), { minLength: 1, maxLength: 200 }),
      (clock) => {
        let last = { ms: 0, seq: 0 };
        for (const now of clock) {
          const id = nextAutoId(last, now);
          assert.ok(
            cmpId(id, last) > 0 || (last.ms === 0 && last.seq === 0 && cmpId(id, last) >= 0),
          );
          last = id;
        }
      },
    ),
  );
  assert.equal(fmt(nextAutoId({ ms: 1000, seq: 4 }, 900)), '1000-5');
});

test('negative: explicit IDs must be greater than the last ID', () => {
  const s = new Stream();
  s.xadd({ a: '1' }, { id: '5-0' });
  assert.throws(() => s.xadd({ a: '2' }, { id: '5-0' }), /equal or smaller/);
  assert.throws(() => s.xadd({ a: '2' }, { id: '4-9' }), /equal or smaller/);
});

test('consumer group: each entry goes to one consumer; un-acked entries stay in the PEL', () => {
  const s = new Stream();
  for (let i = 0; i < 6; i++) {
    s.now = i;
    s.xadd({ n: String(i) });
  }
  s.xgroupCreate('workers', '0');
  const a = s.readNew('workers', 'alice', 3);
  const b = s.readNew('workers', 'bob', 3);
  assert.deepEqual(
    [...a, ...b].map((e) => e.fields.n),
    ['0', '1', '2', '3', '4', '5'],
  );
  assert.equal(s.xack('workers', fmt(a[0]!.id), fmt(a[1]!.id)), 2);
  assert.equal(s.readOwnPending('workers', 'alice').length, 1); // one not acked
  assert.equal(s.readNew('workers', 'carol', 10).length, 0); // nothing new
});

test('crash recovery: a restarted consumer re-reads its own pending entries with ID 0', () => {
  const s = new Stream();
  s.xadd({ job: 'x' });
  s.xgroupCreate('g', '0');
  s.readNew('g', 'worker-1', 1); // crashes before XACK
  const again = s.readOwnPending('g', 'worker-1');
  assert.equal(again.length, 1);
});

test('XAUTOCLAIM moves idle entries to a live consumer and counts deliveries (poison detection)', () => {
  const s = new Stream();
  const id = s.xadd({ job: 'poison' });
  s.xgroupCreate('g', '0');
  s.readNew('g', 'dead', 1);
  s.now = 10_000;
  assert.equal(s.xautoclaim('g', 'rescuer', 60_000).claimed.length, 0); // not idle long enough
  s.now = 70_000;
  for (let round = 0; round < 3; round++) {
    s.now += 61_000;
    s.xautoclaim('g', `rescuer-${round}`, 60_000);
  }
  const p = s.pending('g', id)!;
  assert.equal(p.deliveries, 4);
  // A dead-letter policy: deliveries above a threshold -> XADD to a DLQ stream and XACK.
  assert.ok(p.deliveries > 3);
});

test('trimming removes entries still in a PEL; XAUTOCLAIM reports and drops them', () => {
  const s = new Stream();
  for (let i = 0; i < 5; i++) s.xadd({ i: String(i) });
  s.xgroupCreate('g', '0');
  s.readNew('g', 'c1', 5);
  s.xadd({ i: '5' }, { maxlen: 2 }); // MAXLEN 2 trims entries 0..3 although they are unacked
  s.now = 1_000_000;
  const r = s.xautoclaim('g', 'c2', 1);
  assert.equal(r.deleted.length, 4);
  assert.equal(r.claimed.length, 1);
});

test('lag: entries added after the group last delivered ID', () => {
  const s = new Stream();
  s.xadd({});
  s.xgroupCreate('g', '$'); // only new entries
  assert.equal(s.lag('g'), 0);
  s.xadd({});
  s.xadd({});
  assert.equal(s.lag('g'), 2);
});

test('negative: creating a group twice is BUSYGROUP; reading a missing group is NOGROUP', () => {
  const s = new Stream();
  s.xgroupCreate('g', '0');
  assert.throws(() => s.xgroupCreate('g', '0'), /BUSYGROUP/);
  assert.throws(() => s.readNew('nope', 'c', 1), /NOGROUP/);
});

test('idempotent production: a retried XADD with the same producer/message id is not duplicated', () => {
  const s = new Stream();
  const t = new IdempotentProducerTable(100_000, 100);
  const first = t.add(s, 'orders-api', 'order-42', { total: '10' });
  const retry = t.add(s, 'orders-api', 'order-42', { total: '10' });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.id, first.id);
  assert.equal(s.entries.length, 1);
  s.now += 100_001; // outside the dedup window: a late retry *is* duplicated
  assert.equal(t.add(s, 'orders-api', 'order-42', {}).duplicate, false);
  assert.equal(s.entries.length, 2);
});

test('reliable queue: RPOP loses the job if the worker crashes; LMOVE keeps it recoverable', () => {
  const q = new ListQueue();
  q.lpush('jobs', 'j1');
  q.lpush('jobs', 'j2');
  q.rpop('jobs'); // worker takes j1 and crashes: j1 exists nowhere
  assert.equal(q.len('jobs') + q.len('processing:w1'), 1);

  const r = new ListQueue();
  r.lpush('jobs', 'j1');
  const job = r.lmove('jobs', 'processing:w1'); // worker takes j1 and crashes
  assert.equal(job, 'j1');
  // Reaper: move everything from a dead worker's processing list back to the queue.
  while (r.lmove('processing:w1', 'jobs')) {
    /* drain */
  }
  assert.equal(r.len('jobs'), 1);
  // A worker that succeeds removes the job from its processing list.
  const j = r.lmove('jobs', 'processing:w2')!;
  assert.equal(r.lrem('processing:w2', j), 1);
  assert.equal(r.len('jobs') + r.len('processing:w2'), 0);
});

test('pub/sub output buffer: hard limit disconnects at once, soft limit after soft-seconds', () => {
  const lim = { hard: 32 * 2 ** 20, soft: 8 * 2 ** 20, softSeconds: 60 };
  assert.equal(
    disconnectTime(
      [
        [0, 1e6],
        [1, 40 * 2 ** 20],
      ],
      lim,
    ),
    1,
  );
  const slow: Array<[number, number]> = Array.from({ length: 100 }, (_, t) => [t, 10 * 2 ** 20]);
  assert.equal(disconnectTime(slow, lim), 60);
  // Dipping below the soft limit resets the soft timer.
  const bursty: Array<[number, number]> = Array.from({ length: 200 }, (_, t) => [
    t,
    t % 50 === 0 ? 0 : 10 * 2 ** 20,
  ]);
  assert.equal(disconnectTime(bursty, lim), null);
});
