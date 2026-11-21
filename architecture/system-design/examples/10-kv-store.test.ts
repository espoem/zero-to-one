import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  DynamoReplicaCluster,
  PhiAccrualDetector,
  applyLwwWrite,
  buildMerkleTree,
  compareVectorClocks,
  diffMerkleTrees,
  incrementClock,
  mergeVectorClocks,
} from './lib/kv-store-models.ts';

describe('Module 16: Distributed Key-Value Store Executable Proofs', () => {
  it('Strict quorum (N=3, W=2, R=2) reads latest write; negative tests expose partial-write phantom persistence and sloppy-quorum invisibility', () => {
    const cluster = new DynamoReplicaCluster(['N1', 'N2', 'N3'], ['N4']);

    // 1. Healthy strict quorum write (W=2) and read (R=2)
    const w1 = cluster.write({ key: 'cart:42', value: 'v1', version: 1, w: 2, sloppy: false });
    assert.equal(w1.ok, true);
    assert.equal(cluster.read({ key: 'cart:42', r: 2, syncReadRepair: false }).entry?.value, 'v1');

    // 2. Negative test (failed partial write phantom persistence):
    // N2 & N3 are unreachable, so W=2 FAILS, yet N1 still durably accepted v2!
    cluster.setNodeOnline('N2', false);
    cluster.setNodeOnline('N3', false);
    const failedWrite = cluster.write({
      key: 'cart:42',
      value: 'v2-phantom',
      version: 2,
      w: 2,
      sloppy: false,
    });
    assert.equal(failedWrite.ok, false);
    assert.deepEqual(failedWrite.ackedNodes, ['N1']);

    // N2 recovers (still holding v1); strict R=2 read across {N1, N2} observes the "failed" v2!
    cluster.setNodeOnline('N2', true);
    const rAfterFail = cluster.read({
      key: 'cart:42',
      r: 2,
      syncReadRepair: false,
      targetNodes: ['N1', 'N2'],
    });
    assert.equal(rAfterFail.ok, true);
    assert.equal(rAfterFail.entry?.value, 'v2-phantom');

    // Meanwhile without synchronous read repair, another reader hitting {N2, N3} once N3 recovers sees stale v1!
    cluster.setNodeOnline('N3', true);
    const rStale = cluster.read({
      key: 'cart:42',
      r: 2,
      syncReadRepair: false,
      targetNodes: ['N2', 'N3'],
    });
    assert.equal(rStale.entry?.value, 'v1');

    // Synchronous read repair on {N1, N2} repairs N2 so {N2, N3} now converges to v2-phantom
    const rRepaired = cluster.read({
      key: 'cart:42',
      r: 2,
      syncReadRepair: true,
      targetNodes: ['N1', 'N2'],
    });
    assert.deepEqual(rRepaired.repairedNodes, ['N2']);
    assert.equal(
      cluster.read({ key: 'cart:42', r: 2, syncReadRepair: false, targetNodes: ['N2', 'N3'] }).entry
        ?.value,
      'v2-phantom',
    );

    // 3. Negative test (Sloppy quorum & hinted handoff):
    // N2 & N3 go down; sloppy write succeeds via {N1, standby N4 (hint for N2)}!
    cluster.setNodeOnline('N2', false);
    cluster.setNodeOnline('N3', false);
    const sloppyWrite = cluster.write({
      key: 'cart:99',
      value: 'v3-sloppy',
      version: 3,
      w: 2,
      sloppy: true,
    });
    assert.equal(sloppyWrite.ok, true);
    assert.deepEqual(sloppyWrite.ackedNodes, ['N1', 'N4']);
    assert.deepEqual(sloppyWrite.hintedFor, ['N2']);

    // Before hinted handoff replays, N2 & N3 come back while N1 pauses -> strict R=2 on {N2, N3} misses v3-sloppy!
    cluster.setNodeOnline('N1', false);
    cluster.setNodeOnline('N2', true);
    cluster.setNodeOnline('N3', true);
    assert.equal(
      cluster.read({ key: 'cart:99', r: 2, syncReadRepair: false, targetNodes: ['N2', 'N3'] })
        .entry,
      undefined,
    );

    // Replaying hints from N4 to recovered N2 restores visibility on {N2, N3}
    assert.equal(cluster.replayHints(), 1);
    assert.equal(
      cluster.read({ key: 'cart:99', r: 2, syncReadRepair: false, targetNodes: ['N2', 'N3'] }).entry
        ?.value,
      'v3-sloppy',
    );
  });

  it('Vector clocks detect causal dominance vs concurrent siblings and satisfy partial-order axioms (fast-check)', () => {
    const v0 = incrementClock({}, 'S1'); // {S1:1}
    const v1 = incrementClock(v0, 'S1'); // {S1:2}
    const branchA = incrementClock(v1, 'S2'); // {S1:2, S2:1}
    const branchB = incrementClock(v1, 'S3'); // {S1:2, S3:1}

    assert.equal(compareVectorClocks(v0, v1), 'BEFORE');
    assert.equal(compareVectorClocks(v1, v0), 'AFTER');
    assert.equal(compareVectorClocks(branchA, branchB), 'CONCURRENT');

    const merged = incrementClock(mergeVectorClocks(branchA, branchB), 'S1');
    assert.equal(compareVectorClocks(branchA, merged), 'BEFORE');
    assert.equal(compareVectorClocks(branchB, merged), 'BEFORE');

    const clockArb = fc.record({
      S1: fc.integer({ min: 0, max: 5 }),
      S2: fc.integer({ min: 0, max: 5 }),
      S3: fc.integer({ min: 0, max: 5 }),
    });

    fc.assert(
      fc.property(clockArb, clockArb, (a, b) => {
        // Reflexivity
        assert.equal(compareVectorClocks(a, a), 'EQUAL');
        // Antisymmetry / duality
        const ab = compareVectorClocks(a, b);
        const ba = compareVectorClocks(b, a);
        if (ab === 'BEFORE') assert.equal(ba, 'AFTER');
        if (ab === 'AFTER') assert.equal(ba, 'BEFORE');
        if (ab === 'EQUAL') assert.equal(ba, 'EQUAL');
        if (ab === 'CONCURRENT') assert.equal(ba, 'CONCURRENT');
        // Merge upper bound dominates both inputs
        const m = mergeVectorClocks(a, b);
        assert.ok(['BEFORE', 'EQUAL'].includes(compareVectorClocks(a, m)));
        assert.ok(['BEFORE', 'EQUAL'].includes(compareVectorClocks(b, m)));
      }),
      { seed: 20261121, numRuns: 200 },
    );
  });

  it('Negative test: Last-Write-Wins (LWW) silently drops a causally newer update under 250 ms NTP clock skew', () => {
    // Node A writes first at true time T=1000 ms, but its wall clock runs +250 ms fast (1250 ms)
    const write1 = applyLwwWrite(undefined, {
      value: 'old-address',
      wallClockMs: 1250,
      nodeId: 'node-a',
    });
    // Node B writes causally AFTER reading write1 at true time T=1100 ms (accurate clock: 1100 ms)
    const result = applyLwwWrite(write1, {
      value: 'new-address',
      wallClockMs: 1100,
      nodeId: 'node-b',
    });

    // Silent data loss: LWW keeps 'old-address' and discards the causally newer 'new-address'!
    assert.equal(result.value, 'old-address');

    // Exact wall-clock tie breaks deterministically by lexicographically larger nodeId
    const tied = applyLwwWrite(write1, {
      value: 'tie-winner',
      wallClockMs: 1250,
      nodeId: 'node-z',
    });
    assert.equal(tied.value, 'tie-winner');
  });

  it('Merkle tree anti-entropy pinpoints 1 mutated key out of 1,024 in O(log B) node comparisons', () => {
    const replicaA = new Map<string, string>();
    const replicaB = new Map<string, string>();
    for (let i = 0; i < 1024; i++) {
      const k = `item:${i}`;
      const v = `payload:${i}`;
      replicaA.set(k, v);
      replicaB.set(k, v);
    }

    const treeA = buildMerkleTree(replicaA, 64);
    const treeBIdentical = buildMerkleTree(replicaB, 64);
    const cleanDiff = diffMerkleTrees(treeA, treeBIdentical);
    assert.deepEqual(cleanDiff.divergentBuckets, []);
    assert.equal(cleanDiff.nodesCompared, 1); // root hashes match immediately

    // Mutate exactly 1 key on replicaB
    replicaB.set('item:777', 'payload:777-corrupted');
    const treeBMutated = buildMerkleTree(replicaB, 64);
    const diff = diffMerkleTrees(treeA, treeBMutated);

    assert.equal(diff.divergentBuckets.length, 1);
    // 64 buckets => height 6 => 1 root + 2 children * 6 levels = 13 comparisons (vs 1,024 full scan)
    assert.equal(diff.nodesCompared, 13);
  });

  it('Phi Accrual Failure Detector keeps phi < 2 under jittered healthy heartbeats and exceeds phi > 8 on node crash', () => {
    const detector = new PhiAccrualDetector({ maxWindow: 100, minStdDevMs: 40 });
    // Feed 50 healthy heartbeats every ~1000 ms with deterministic +/- 60 ms network jitter
    let t = 0;
    const jitterPattern = [0, 30, -25, 55, -40, 20, -15, 60, -50, 10];
    for (let i = 0; i < 50; i++) {
      detector.heartbeat(t);
      t += 1000 + (jitterPattern[i % jitterPattern.length] ?? 0);
    }
    const lastSeen = t - (1000 + (jitterPattern[49 % jitterPattern.length] ?? 0));

    // Normal arrival window (1050 ms later): low suspicion (healthy)
    const phiHealthy = detector.phi(lastSeen + 1050);
    assert.ok(phiHealthy < 2.0, `expected healthy phi < 2.0, got ${phiHealthy}`);

    // Minor transient jitter (1200 ms later): elevated but well below Cassandra conviction threshold (8.0)
    const phiJitter = detector.phi(lastSeen + 1200);
    assert.ok(phiJitter < 8.0, `expected jitter phi < 8.0, got ${phiJitter}`);

    // Node crashed / 2500 ms silent: crosses Cassandra's phi = 8.0 conviction threshold cleanly
    const phiDead = detector.phi(lastSeen + 2500);
    assert.ok(phiDead > 8.0, `expected dead-node phi > 8.0, got ${phiDead}`);
  });
});
