// Module 10: PSYNC decisions, promotion and replid2, backlog sizing, min-replicas-to-write,
// Sentinel quorum vs majority, replica selection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  psync,
  promote,
  backlogBytesNeeded,
  acceptsWrites,
  isolatedPrimaryWriteWindow,
  objectivelyDown,
  canFailover,
  pickReplica,
  type PrimaryReplState,
} from './src/replication.ts';

const base: PrimaryReplState = {
  replid: 'A'.repeat(40),
  replid2: '0'.repeat(40),
  secondReplidOffset: -1,
  backlogStart: 1_000_001,
  masterOffset: 2_000_000,
  backlogAllocated: true,
};

test("PSYNC continues when the replica's offset is still in the backlog", () => {
  assert.equal(psync(base, base.replid, 1_500_000), 'CONTINUE');
  assert.equal(psync(base, base.replid, 2_000_001), 'CONTINUE'); // fully caught up
});

test('negative: an offset that fell out of the backlog forces a full resync', () => {
  assert.equal(psync(base, base.replid, 999_999), 'FULLRESYNC');
});

test('negative: an unknown replication ID forces a full resync', () => {
  assert.equal(psync(base, 'B'.repeat(40), 1_500_000), 'FULLRESYNC');
  assert.equal(psync(base, '?', -1), 'FULLRESYNC'); // PSYNC ? -1: a fresh replica
});

test('after failover, other replicas can continue from the promoted replica via replid2', () => {
  const promoted = promote(base, 'C'.repeat(40));
  // A sibling replica that followed the old primary up to offset 1 999 000:
  assert.equal(psync(promoted, base.replid, 1_999_001), 'CONTINUE');
  // But not past the point where the history diverged:
  assert.equal(psync(promoted, base.replid, 2_000_002), 'FULLRESYNC');
});

test('backlog sizing: write rate x tolerated disconnect', () => {
  // 5 MB/s of writes, survive a 60 s network blip: 300 MB, vs the 1 MB default.
  assert.equal(backlogBytesNeeded(5 * 2 ** 20, 60), 300 * 2 ** 20);
});

test('min-replicas-to-write: writes are refused without enough fresh replicas', () => {
  assert.equal(acceptsWrites([1, 3], 1, 10), true);
  assert.equal(acceptsWrites([11, 30], 1, 10), false);
  assert.equal(acceptsWrites([], 0, 10), true); // feature disabled
});

test("split brain: min-replicas bounds the isolated primary's lost-write window", () => {
  assert.equal(isolatedPrimaryWriteWindow(0, 10), Infinity); // default: accepts writes until it learns it was demoted
  assert.equal(isolatedPrimaryWriteWindow(1, 10), 11);
});

test('Sentinel: quorum decides ODOWN, but failover needs a majority of all sentinels', () => {
  const v = { total: 5, quorum: 2 };
  assert.equal(objectivelyDown(v, 2), true);
  assert.equal(canFailover(v, 2, 2), false); // minority partition: detects, cannot act
  assert.equal(canFailover(v, 3, 2), true);
});

test('negative: a quorum larger than the reachable sentinels blocks failover even with a majority', () => {
  const v = { total: 5, quorum: 4 };
  assert.equal(canFailover(v, 3, 3), false);
});

test('replica selection: priority, then most data (offset), then run id; priority 0 never promoted', () => {
  const r = pickReplica(
    [
      { runId: 'b', priority: 100, offset: 900, disconnectedSec: 0 },
      { runId: 'a', priority: 100, offset: 1000, disconnectedSec: 0 },
      { runId: 'c', priority: 0, offset: 5000, disconnectedSec: 0 },
      { runId: 'd', priority: 100, offset: 9999, disconnectedSec: 1000 }, // disconnected too long
    ],
    30,
  );
  assert.equal(r?.runId, 'a');
});
