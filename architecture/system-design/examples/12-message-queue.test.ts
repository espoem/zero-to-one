import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  HierarchicalTimingWheel,
  IdempotentPartitionBroker,
  NotEnoughReplicasError,
  OutOfOrderSequenceError,
  ProducerFencedError,
  ReplicatedPartitionCluster,
  SegmentedCommitLog,
  estimateMessageQueueCluster,
} from './lib/message-queue-models.ts';

describe('Module 18: Distributed Message Queue Executable Proofs', () => {
  it('SegmentedCommitLog rolls segments, resolves offsets via sparse index, and drops expired segments in O(1)', () => {
    const log = new SegmentedCommitLog({
      maxSegmentBytes: 1_000,
      indexIntervalBytes: 256,
    });

    // Append 60 records (~80 B each -> ~4,800 B total across ~5 segments)
    for (let i = 0; i < 60; i++) {
      log.append(
        `k-${i % 8}`,
        `payload-record-number-${String(i).padStart(4, '0')}-abcdefghij`,
        1_000 + i * 100,
      );
    }

    assert.ok(log.segmentCount >= 4, `expected >= 4 rolled segments, got ${log.segmentCount}`);
    assert.equal(log.logEndOffset, 60);

    // Sparse-index lookup lands close to target offset with bounded linear scan
    const hit = log.readByOffset(43);
    assert.equal(hit.record?.offset, 43);
    assert.ok(hit.indexProbes <= 4, `expected logarithmic index probes, got ${hit.indexProbes}`);
    assert.ok(hit.linearScans <= 5, `expected bounded linear scan, got ${hit.linearScans}`);

    // Truncate segments whose newest record is strictly older than t=3_500 ms
    const beforeSegments = log.segmentCount;
    const removed = log.truncateExpiredSegments(3_500);
    assert.ok(removed >= 1, `expected >= 1 expired segment dropped, got ${removed}`);
    assert.equal(log.segmentCount, beforeSegments - removed);
    assert.equal(log.readByOffset(0).record, null); // Expired segment gone
    assert.equal(log.readByOffset(59).record?.offset, 59); // Active segment intact
  });

  it('ISR min.insync.replicas rejects undersized writes and KIP-101 Leader Epoch prevents lagged-HWM data loss and multi-epoch divergence', () => {
    const cluster = new ReplicatedPartitionCluster(['b1', 'b2', 'b3'], 2);

    // Healthy RF=3 cluster commits with acks=all
    cluster.produce('order-1', 'all');
    assert.equal(cluster.replicas.get('b1')!.highWatermark, 1);
    assert.equal(cluster.replicas.get('b2')!.highWatermark, 1);

    // Shrink ISR to 1 -> acks=all MUST fail with NotEnoughReplicasError
    cluster.removeFromIsr('b2');
    cluster.removeFromIsr('b3');
    assert.throws(() => cluster.produce('order-2', 'all'), NotEnoughReplicasError);

    // Authentic KIP-101 Scenario 1 (lagged-HWM data loss on follower restart):
    // b1 (epoch 0) commits offset 0 (HWM=1) and replicates offset 1 to b2, advancing b1.HWM=2,
    // while b2's local HWM still lags at 1 (waiting for the next fetch round-trip).
    // If b2 restarts before learning HWM=2, legacy hwm-only truncates b2 back to offset 1 (dropping replicated offset 1!),
    // whereas KIP-101 queries OffsetsForLeaderEpoch(0) -> 2 and preserves offset 1 without truncation.
    const hwmLossCluster = new ReplicatedPartitionCluster(['b1', 'b2'], 2);
    hwmLossCluster.produce('committed-0', 'all'); // offset 0, epoch 0, HWM=1 on both
    hwmLossCluster.produce('committed-1', 'all'); // offset 1, epoch 0, replicated to both
    hwmLossCluster.replicas.get('b2')!.highWatermark = 1; // b2 has not yet received the second fetch RTT advancing HWM

    const legacyTruncate = hwmLossCluster.reconcileReplica('b2', 'hwm-only');
    assert.equal(legacyTruncate.truncatedToOffset, 1); // Dropped replicated offset 1 before re-fetching!

    hwmLossCluster.replicas.get('b2')!.highWatermark = 1;
    const kip101Preserve = hwmLossCluster.reconcileReplica('b2', 'leader-epoch');
    assert.equal(kip101Preserve.truncatedToOffset, 2); // Preserved committed offset 1 cleanly!
    assert.equal(kip101Preserve.matchesLeader, true);

    // Authentic KIP-101 Scenario 2 (multi-epoch diverged tail truncation):
    // b1 wrote uncommitted epoch-0 tail + stale epoch-1 record while b2 became authoritative in epoch 2.
    const divergeCluster = new ReplicatedPartitionCluster(['b1', 'b2'], 1);
    divergeCluster.produce('committed-0', 'all'); // offset 0, epoch 0
    divergeCluster.produce('stale-b1-e0', '1'); // offset 1 on b1 only, epoch 0
    divergeCluster.replicas.get('b1')!.entries.push({ offset: 2, epoch: 1, value: 'stale-b1-e1' });

    divergeCluster.leaderId = 'b2';
    divergeCluster.leaderEpoch = 2;
    divergeCluster.replicas.get('b2')!.entries.push({ offset: 1, epoch: 2, value: 'winner-b2-e2' });
    divergeCluster.replicas.get('b2')!.highWatermark = 2;

    const multiEpochSync = divergeCluster.reconcileReplica('b1', 'leader-epoch');
    assert.equal(multiEpochSync.truncatedToOffset, 1); // Walks epoch 1 -> absent, epoch 0 -> ends at 1
    assert.equal(multiEpochSync.matchesLeader, true);
  });

  it('Idempotent producer deduplicates network retries within the 5-seq KIP-98 window, fences zombie epochs, and preserves exact sequence (fast-check)', () => {
    const broker = new IdempotentPartitionBroker(5);

    const first = broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 0, value: 'tx-0' });
    assert.deepEqual(first, { offset: 0, deduplicated: false });

    // Network timeout causes client to retry (p1, epoch 1, seq 0)
    const retry = broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 0, value: 'tx-0' });
    assert.deepEqual(retry, { offset: 0, deduplicated: true });
    assert.equal(broker.entries.length, 1);

    // Advance 5 more messages (seq 1..5) so seq 0 evicts from the 5-request KIP-98 dedupe window
    for (let s = 1; s <= 5; s++) {
      broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: s, value: `tx-${s}` });
    }
    // Retry inside window (seq 1) still dedupes in O(1); expired seq 0 is rejected as out-of-order
    assert.deepEqual(
      broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 1, value: 'tx-1' }),
      { offset: 1, deduplicated: true },
    );
    assert.throws(
      () => broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 0, value: 'tx-0' }),
      OutOfOrderSequenceError,
    );

    // Negative test: sequence gap (skipping seq 6) is rejected
    assert.throws(
      () => broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 7, value: 'tx-7' }),
      OutOfOrderSequenceError,
    );

    // New producer instance bumps epoch -> old zombie epoch is fenced
    broker.appendIdempotent({ producerId: 'p1', epoch: 2, seq: 0, value: 'tx-new' });
    assert.throws(
      () => broker.appendIdempotent({ producerId: 'p1', epoch: 1, seq: 6, value: 'zombie' }),
      ProducerFencedError,
    );

    // Property test: arbitrary retry multiplicities over N sequential messages yield exact N unique records
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 30 }),
        (retryCounts) => {
          const b = new IdempotentPartitionBroker(5);
          for (let seq = 0; seq < retryCounts.length; seq++) {
            const attempts = retryCounts[seq] ?? 1;
            for (let attempt = 0; attempt < attempts; attempt++) {
              b.appendIdempotent({ producerId: 'prop-p', epoch: 0, seq, value: `msg-${seq}` });
            }
          }
          assert.equal(b.entries.length, retryCounts.length);
          assert.deepEqual(
            b.entries.map((e) => e.seq),
            retryCounts.map((_, idx) => idx),
          );
        },
      ),
      { seed: 20261121, numRuns: 100 },
    );
  });

  it('HierarchicalTimingWheel cascades coarse buckets and fires delayed messages on exact due ticks including revolution boundary', () => {
    const wheel = new HierarchicalTimingWheel(16); // Level 0: 1..15 ticks ahead, Level 1: 16..255 ticks ahead
    wheel.schedule('retry-fast', 3, 'webhook-1');
    wheel.schedule('delay-boundary', 16, 'edge-boundary-16');
    wheel.schedule('delay-mid', 17, 'payment-check-1');
    wheel.schedule('delay-long', 65, 'order-timeout-1');

    const firedAt = new Map<string, number>();
    for (let t = 1; t <= 70; t++) {
      const tasks = wheel.tick();
      for (const task of tasks) {
        firedAt.set(task.id, t);
      }
    }

    assert.equal(firedAt.get('retry-fast'), 3);
    assert.equal(firedAt.get('delay-boundary'), 16);
    assert.equal(firedAt.get('delay-mid'), 17);
    assert.equal(firedAt.get('delay-long'), 65);
  });

  it('Cluster capacity model proves 1M msg/s (1 KB, RF=3, 14d) requires ~3.63 PB uncompressed and exposes >$34k/mo cross-AZ replication tax even at 3x compression', () => {
    const uncompressed = estimateMessageQueueCluster({
      messagesPerSec: 1_000_000,
      avgMessageBytes: 1_000,
      replicationFactor: 3,
      retentionDays: 14,
      compressionRatio: 1,
      consumerGroups: 3,
      crossAzCostPerGbUsd: 0.02, // $0.01 out + $0.01 in across AWS AZs
      followerFetchEnabled: false,
    });

    assert.equal(uncompressed.dailyRawTb, 86.4);
    assert.ok(uncompressed.retainedRawPb > 1.2 && uncompressed.retainedRawPb < 1.22);
    assert.ok(uncompressed.replicatedStoragePb > 3.62 && uncompressed.replicatedStoragePb < 3.64);
    // 2 GB/s cross-AZ replication * 2,592,000 s * $0.02 = $103,680/mo
    assert.ok(
      uncompressed.monthlyCrossAzReplicationUsd > 103_000 &&
        uncompressed.monthlyCrossAzReplicationUsd < 104_500,
    );

    // 3x zstd compression + KIP-392 rack-aware follower fetching zeroes consumer cross-AZ tax
    const optimized = estimateMessageQueueCluster({
      messagesPerSec: 1_000_000,
      avgMessageBytes: 1_000,
      replicationFactor: 3,
      retentionDays: 14,
      compressionRatio: 3,
      consumerGroups: 3,
      crossAzCostPerGbUsd: 0.02,
      followerFetchEnabled: true,
    });

    assert.ok(optimized.compressedStoragePb > 1.2 && optimized.compressedStoragePb < 1.22);
    assert.equal(optimized.monthlyConsumerCrossAzUsd, 0);
    // Intra-cluster follower replication alone still costs ~$34,560/mo even with 3x compression!
    assert.ok(
      optimized.monthlyCrossAzReplicationUsd > 34_000 &&
        optimized.monthlyCrossAzReplicationUsd < 35_000,
    );
  });
});
