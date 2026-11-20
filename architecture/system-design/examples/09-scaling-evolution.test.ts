import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  PrimaryReplicaCluster,
  assignFixedShard,
  assignShuffleShard,
  binomial,
  isTenantCompletelyOut,
  simulateAutoscaler,
  simulateSessionTierFailure,
  uslPeakNodes,
  uslRelativeCapacity,
} from './lib/scaling-models.ts';

describe('Module 15: Scale From Zero to Millions Executable Proofs', () => {
  it("Negative test: Gunther's USL exhibits retrograde scaling past N_max when coherency beta > 0", () => {
    const alpha = 0.05; // 5% serialization contention
    const beta = 0.005; // 0.5% cross-node coherency overhead (e.g., distributed lock / cache invalidation chatter)
    const nMax = uslPeakNodes(alpha, beta); // sqrt(0.95 / 0.005) ~= 13.78 nodes

    assert.ok(nMax > 13 && nMax < 14.5, `expected N_max around 13.78, got ${nMax}`);

    const capAt1 = uslRelativeCapacity(1, alpha, beta);
    const capAtPeak = uslRelativeCapacity(Math.round(nMax), alpha, beta);
    const capAt64 = uslRelativeCapacity(64, alpha, beta);

    assert.equal(capAt1, 1);
    assert.ok(capAtPeak > 5.0, `expected meaningful scale-up near peak, got ${capAtPeak}`);
    // Adding 4.5x more nodes beyond peak actually REDUCES total throughput (retrograde zone)
    assert.ok(
      capAt64 < capAtPeak * 0.55,
      `expected retrograde throughput collapse at N=64 (${capAt64}) vs peak (${capAtPeak})`,
    );

    // Zero coherency (beta=0) degrades gracefully to Amdahl's Law ceiling 1/alpha = 20 without ever regressing
    assert.equal(uslPeakNodes(alpha, 0), Number.POSITIVE_INFINITY);
    assert.ok(uslRelativeCapacity(64, alpha, 0) > uslRelativeCapacity(14, alpha, 0));
  });

  it('Negative test: Sticky local sessions drop 1/3 of active users on single-AZ outage vs 0% loss with multi-AZ Valkey (and 100% loss if un-replicated store fails)', () => {
    const sticky = simulateSessionTierFailure({
      totalUsers: 90_000,
      webNodes: 9,
      failedNodes: 3, // 1 of 3 Availability Zones lost
      mode: 'sticky-local',
    });
    const statelessHa = simulateSessionTierFailure({
      totalUsers: 90_000,
      webNodes: 9,
      failedNodes: 3,
      mode: 'external-valkey',
      sessionStoreFailed: false,
    });
    const statelessSpof = simulateSessionTierFailure({
      totalUsers: 90_000,
      webNodes: 9,
      failedNodes: 3,
      mode: 'external-valkey',
      sessionStoreFailed: true,
    });

    assert.equal(sticky.droppedSessions, 30_000);
    assert.ok(Math.abs(sticky.droppedRatio - 1 / 3) < 1e-9);

    assert.equal(statelessHa.droppedSessions, 0);
    assert.equal(statelessHa.survivedSessions, 90_000);

    // Negative check: externalizing sessions without multi-AZ replication turns the store into a 100% SPOF
    assert.equal(statelessSpof.droppedSessions, 90_000);
    assert.equal(statelessSpof.droppedRatio, 1);
  });

  it('Negative test: Async read replica returns stale value inside WAL lag window vs LSN-pinned read-your-writes', () => {
    const cluster = new PrimaryReplicaCluster(120); // 120 ms async replication lag

    // Initial committed profile
    cluster.write('user:42:bio', 'old-bio');
    cluster.advanceClock(150);
    assert.equal(cluster.readNaiveReplica('user:42:bio').value, 'old-bio');

    // User updates bio and immediately refreshes page 10 ms later
    const { lsn } = cluster.write('user:42:bio', 'new-bio');
    cluster.advanceClock(10);

    // Negative proof: naive read hits lagging replica and returns stale data
    const stale = cluster.readNaiveReplica('user:42:bio');
    assert.equal(stale.servedBy, 'replica');
    assert.equal(stale.value, 'old-bio');

    // LSN-pinned read sees replica_lsn < minLsn and routes safely to primary
    const pinnedEarly = cluster.readWithLsnPin('user:42:bio', lsn);
    assert.equal(pinnedEarly.servedBy, 'primary');
    assert.equal(pinnedEarly.value, 'new-bio');

    // Once WAL catches up past 120 ms, LSN-pinned read offloads back to replica with fresh data
    cluster.advanceClock(120);
    const pinnedCaughtUp = cluster.readWithLsnPin('user:42:bio', lsn);
    assert.equal(pinnedCaughtUp.servedBy, 'replica');
    assert.equal(pinnedCaughtUp.value, 'new-bio');
  });

  it('Shuffle sharding cuts multi-tenant poison-pill blast radius from 1/4 (25%) to ~1/28 (3.57%) at identical worker count', () => {
    const totalWorkers = 8;
    const shardSize = 2;
    assert.equal(binomial(totalWorkers, shardSize), 28);

    const tenantCount = 2_800;
    const poisonTenant = 'tenant-poison-0';
    const poisonFixed = assignFixedShard(poisonTenant, totalWorkers, shardSize);
    const poisonShuffle = assignShuffleShard(poisonTenant, totalWorkers, shardSize);

    let fixedOutages = 0;
    let shuffleOutages = 0;

    for (let i = 1; i <= tenantCount; i++) {
      const tid = `tenant-${i}`;
      if (isTenantCompletelyOut(poisonFixed, assignFixedShard(tid, totalWorkers, shardSize))) {
        fixedOutages++;
      }
      if (isTenantCompletelyOut(poisonShuffle, assignShuffleShard(tid, totalWorkers, shardSize))) {
        shuffleOutages++;
      }
    }

    const fixedRatio = fixedOutages / tenantCount;
    const shuffleRatio = shuffleOutages / tenantCount;

    // Fixed 4 disjoint pairs: ~25% of all tenants share the exact same 2 workers as the poison tenant
    assert.ok(
      fixedRatio > 0.21 && fixedRatio < 0.29,
      `expected ~0.25 fixed outage ratio, got ${fixedRatio}`,
    );
    // Shuffle sharding C(8,2)=28: ~3.57% exact overlap -> ~7x smaller blast radius
    assert.ok(
      shuffleRatio > 0.02 && shuffleRatio < 0.055,
      `expected ~0.0357 shuffle outage ratio, got ${shuffleRatio}`,
    );
    assert.ok(
      fixedRatio / shuffleRatio > 5.0,
      `expected >5x blast-radius reduction, got ${fixedRatio / shuffleRatio}`,
    );
  });

  it('Property test: Shuffle shard allocator always returns k distinct in-range sorted workers deterministically', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 32 }),
        fc.integer({ min: 4, max: 32 }),
        fc.integer({ min: 1, max: 4 }),
        (tenantId, totalWorkers, shardSize) => {
          const a = assignShuffleShard(tenantId, totalWorkers, shardSize);
          const b = assignShuffleShard(tenantId, totalWorkers, shardSize);
          assert.deepEqual(a, b);
          assert.equal(a.length, shardSize);
          assert.equal(new Set(a).size, shardSize);
          for (let i = 0; i < a.length; i++) {
            const val = a[i]!;
            assert.ok(val >= 0 && val < totalWorkers);
            if (i > 0) {
              assert.ok(a[i - 1]! < val);
            }
          }
        },
      ),
      { seed: 20261120, numRuns: 200 },
    );
  });

  it('Negative test: Naive autoscaler without in-flight boot tracking or cooldown hysteresis thrashes vs stabilized HPA', () => {
    // Alternating bursty demand pattern (spike -> dip -> spike -> dip)
    const demandSeries = [
      300, 300, 1200, 1200, 1200, 1200, 400, 400, 1200, 1200, 1200, 400, 400, 1200, 1200, 400, 400,
    ];

    const naive = simulateAutoscaler({
      demandSeries,
      qpsPerNode: 200,
      initialNodes: 2,
      minNodes: 2,
      maxNodes: 20,
      scaleOutThreshold: 0.7,
      scaleInThreshold: 0.65,
      bootDelayTicks: 3,
      scaleDownCooldownTicks: 0,
      trackInflightBoots: false,
    });

    const inflightOnly = simulateAutoscaler({
      demandSeries,
      qpsPerNode: 200,
      initialNodes: 2,
      minNodes: 2,
      maxNodes: 20,
      scaleOutThreshold: 0.7,
      scaleInThreshold: 0.65,
      bootDelayTicks: 3,
      scaleDownCooldownTicks: 0, // tracks in-flight boots, still lacks cooldown hysteresis
      trackInflightBoots: true,
    });

    const stabilized = simulateAutoscaler({
      demandSeries,
      qpsPerNode: 200,
      initialNodes: 2,
      minNodes: 2,
      maxNodes: 20,
      scaleOutThreshold: 0.7,
      scaleInThreshold: 0.35, // wide hysteresis band
      bootDelayTicks: 3,
      scaleDownCooldownTicks: 6, // holds capacity across brief dips
      trackInflightBoots: true,
    });

    assert.ok(
      naive.totalScaleEvents >= stabilized.totalScaleEvents * 2,
      `expected naive thrashing (${naive.totalScaleEvents}) >= 2x stabilized (${stabilized.totalScaleEvents})`,
    );
    assert.ok(
      inflightOnly.totalScaleEvents > stabilized.totalScaleEvents,
      `expected zero-cooldown flapping (${inflightOnly.totalScaleEvents}) > stabilized (${stabilized.totalScaleEvents})`,
    );
    assert.ok(
      stabilized.overloadTicks <= naive.overloadTicks,
      `expected stabilized overload ticks (${stabilized.overloadTicks}) <= naive (${naive.overloadTicks})`,
    );
  });
});
