/**
 * Executable models for Module 18: Distributed Message Queue (ByteByteGo Ch. 19).
 * Covers:
 *  1. Segmented append-only commit log with sparse offset index and O(1) segment truncation
 *  2. ISR replication, min.insync.replicas enforcement, and KIP-101 Leader Epoch truncation
 *  3. Producer idempotence (PID + epoch + sequence) and fencing
 *  4. Hierarchical Timing Wheel (Varghese & Lauck, SOSP 1987) for delayed messages
 *  5. Cluster storage, replication bandwidth, and cross-AZ egress cost estimation
 */

export interface LogRecord {
  readonly offset: number;
  readonly timestampMs: number;
  readonly key: string | null;
  readonly payload: string;
  readonly byteSize: number;
  readonly leaderEpoch: number;
}

interface SparseIndexEntry {
  readonly offset: number;
  readonly recordIndex: number;
}

interface LogSegment {
  readonly baseOffset: number;
  readonly createdAtMs: number;
  readonly records: LogRecord[];
  readonly sparseIndex: SparseIndexEntry[];
  bytes: number;
  bytesSinceLastIndex: number;
  closed: boolean;
}

export interface LookupResult {
  readonly record: LogRecord | null;
  readonly indexProbes: number;
  readonly linearScans: number;
}

/**
 * Append-only segmented commit log modeled on Kafka's `.log` + sparse `.index` files.
 * Rolls over to a fresh segment when `maxSegmentBytes` is exceeded and drops expired
 * segments in O(1) per segment without random per-record deletes.
 */
export class SegmentedCommitLog {
  private readonly maxSegmentBytes: number;
  private readonly indexIntervalBytes: number;
  private readonly segments: LogSegment[] = [];
  private nextOffset = 0;

  constructor(options: { maxSegmentBytes: number; indexIntervalBytes: number }) {
    if (options.maxSegmentBytes <= 0 || options.indexIntervalBytes <= 0) {
      throw new RangeError('Segment and index interval sizes must be positive');
    }
    this.maxSegmentBytes = options.maxSegmentBytes;
    this.indexIntervalBytes = options.indexIntervalBytes;
  }

  append(key: string | null, payload: string, timestampMs: number, leaderEpoch = 0): LogRecord {
    const byteSize =
      Buffer.byteLength(payload, 'utf8') + (key ? Buffer.byteLength(key, 'utf8') : 0) + 32;
    let active = this.segments.at(-1);

    if (!active || active.bytes + byteSize > this.maxSegmentBytes) {
      if (active) active.closed = true;
      active = {
        baseOffset: this.nextOffset,
        createdAtMs: timestampMs,
        records: [],
        sparseIndex: [],
        bytes: 0,
        bytesSinceLastIndex: this.indexIntervalBytes,
        closed: false,
      };
      this.segments.push(active);
    }

    const record: LogRecord = {
      offset: this.nextOffset++,
      timestampMs,
      key,
      payload,
      byteSize,
      leaderEpoch,
    };

    const recordIndex = active.records.length;
    if (active.bytesSinceLastIndex >= this.indexIntervalBytes || recordIndex === 0) {
      active.sparseIndex.push({ offset: record.offset, recordIndex });
      active.bytesSinceLastIndex = 0;
    }

    active.records.push(record);
    active.bytes += byteSize;
    active.bytesSinceLastIndex += byteSize;
    return record;
  }

  /**
   * Binary-searches segments by baseOffset, then binary-searches the segment's sparse
   * offset index, and finally scans forward only within one index interval.
   */
  readByOffset(targetOffset: number): LookupResult {
    const firstSegment = this.segments[0];
    if (!firstSegment || targetOffset < firstSegment.baseOffset) {
      return { record: null, indexProbes: 0, linearScans: 0 };
    }

    // Binary search for the segment whose baseOffset <= targetOffset
    let segLo = 0;
    let segHi = this.segments.length - 1;
    let segIdx = 0;
    while (segLo <= segHi) {
      const mid = (segLo + segHi) >>> 1;
      const midSeg = this.segments[mid];
      if (midSeg && midSeg.baseOffset <= targetOffset) {
        segIdx = mid;
        segLo = mid + 1;
      } else {
        segHi = mid - 1;
      }
    }

    const segment = this.segments[segIdx];
    if (!segment) {
      return { record: null, indexProbes: 0, linearScans: 0 };
    }

    let lo = 0;
    let hi = segment.sparseIndex.length - 1;
    let startRecordIdx = 0;
    let indexProbes = 0;

    while (lo <= hi) {
      indexProbes++;
      const mid = (lo + hi) >>> 1;
      const idxEntry = segment.sparseIndex[mid];
      if (idxEntry && idxEntry.offset <= targetOffset) {
        startRecordIdx = idxEntry.recordIndex;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    let linearScans = 0;
    for (let i = startRecordIdx; i < segment.records.length; i++) {
      linearScans++;
      const rec = segment.records[i];
      if (!rec) break;
      if (rec.offset === targetOffset) {
        return { record: rec, indexProbes, linearScans };
      }
      if (rec.offset > targetOffset) break;
    }
    return { record: null, indexProbes, linearScans };
  }

  /**
   * Drops closed segments whose newest record is older than `cutoffMs` in O(expiredSegments).
   * Never drops the active writable segment.
   */
  truncateExpiredSegments(cutoffMs: number): number {
    let removed = 0;
    while (this.segments.length > 1) {
      const oldest = this.segments[0];
      if (!oldest || !oldest.closed) break;
      const newestInSeg = oldest.records.at(-1)?.timestampMs ?? oldest.createdAtMs;
      if (newestInSeg < cutoffMs) {
        this.segments.shift();
        removed++;
      } else {
        break;
      }
    }
    return removed;
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  get logEndOffset(): number {
    return this.nextOffset;
  }
}

export class NotEnoughReplicasError extends Error {
  constructor(isrSize: number, minIsr: number) {
    super(`NotEnoughReplicasError: ISR size ${isrSize} < min.insync.replicas ${minIsr}`);
    this.name = 'NotEnoughReplicasError';
  }
}

export interface EpochEntry {
  readonly offset: number;
  readonly epoch: number;
  readonly value: string;
}

export interface ReplicaState {
  readonly brokerId: string;
  entries: EpochEntry[];
  highWatermark: number;
}

/**
 * Replicated partition model proving `acks=all` + `min.insync.replicas` enforcement
 * and contrasting naive HWM-only truncation with KIP-101 Leader Epoch truncation.
 */
export class ReplicatedPartitionCluster {
  readonly minInSyncReplicas: number;
  readonly replicas = new Map<string, ReplicaState>();
  readonly isr = new Set<string>();
  leaderId: string;
  leaderEpoch = 0;

  constructor(brokerIds: readonly string[], minInSyncReplicas: number) {
    const initialLeader = brokerIds[0];
    if (!initialLeader) throw new RangeError('At least one broker is required');
    this.minInSyncReplicas = minInSyncReplicas;
    this.leaderId = initialLeader;
    for (const id of brokerIds) {
      this.replicas.set(id, { brokerId: id, entries: [], highWatermark: 0 });
      this.isr.add(id);
    }
  }

  removeFromIsr(brokerId: string): void {
    if (brokerId === this.leaderId) {
      throw new Error('Cannot remove current leader without electing a new leader first');
    }
    this.isr.delete(brokerId);
  }

  /**
   * Appends to the leader. Under `acks = 'all'`, enforces `isr.size >= minInSyncReplicas`,
   * replicates synchronously to all ISR followers, and advances HWM to the replicated offset.
   * Under `acks = '1'`, appends to leader only without advancing HWM until followers fetch.
   */
  produce(value: string, acks: '1' | 'all'): EpochEntry {
    if (acks === 'all' && this.isr.size < this.minInSyncReplicas) {
      throw new NotEnoughReplicasError(this.isr.size, this.minInSyncReplicas);
    }
    const leader = this.replicas.get(this.leaderId)!;
    const entry: EpochEntry = {
      offset: leader.entries.length,
      epoch: this.leaderEpoch,
      value,
    };
    leader.entries.push(entry);

    if (acks === 'all') {
      for (const id of this.isr) {
        if (id === this.leaderId) continue;
        this.replicas.get(id)!.entries.push(entry);
      }
      const newHwm = leader.entries.length;
      for (const id of this.isr) {
        this.replicas.get(id)!.highWatermark = newHwm;
      }
    }
    return entry;
  }

  /**
   * Reconciles a restarted replica against the current leader using either:
   *  - `hwm-only`: legacy Kafka truncation to the restarted node's lagged local HWM
   *  - `leader-epoch` (KIP-101): walks the follower's epoch history backward via
   *    `OffsetsForLeaderEpoch` until it finds the highest epoch shared with the leader,
   *    preserving committed records while truncating only uncommitted diverged tails.
   */
  reconcileReplica(
    restartedBrokerId: string,
    mode: 'hwm-only' | 'leader-epoch',
  ): { truncatedToOffset: number; matchesLeader: boolean } {
    const follower = this.replicas.get(restartedBrokerId)!;
    const leader = this.replicas.get(this.leaderId)!;

    let truncateTo: number;
    if (mode === 'hwm-only') {
      truncateTo = follower.highWatermark;
    } else {
      truncateTo = 0;
      const followerEpochs = [...new Set(follower.entries.map((e) => e.epoch))].sort(
        (a, b) => b - a,
      );
      for (const epoch of followerEpochs) {
        if (!leader.entries.some((e) => e.epoch === epoch)) continue;
        const firstHigherEpochIdx = leader.entries.findIndex((e) => e.epoch > epoch);
        const leaderEndForEpoch =
          firstHigherEpochIdx === -1 ? leader.entries.length : firstHigherEpochIdx;
        const followerEndForEpoch = follower.entries.findLastIndex((e) => e.epoch === epoch) + 1;
        truncateTo = Math.min(followerEndForEpoch, leaderEndForEpoch);
        break;
      }
    }

    follower.entries = follower.entries.slice(0, truncateTo);
    // Catch up missing suffix from leader
    for (let i = follower.entries.length; i < leader.entries.length; i++) {
      const leaderEntry = leader.entries[i];
      if (leaderEntry) follower.entries.push(leaderEntry);
    }
    follower.highWatermark = leader.highWatermark;

    const matchesLeader =
      follower.entries.length === leader.entries.length &&
      follower.entries.every((e, idx) => {
        const expected = leader.entries[idx];
        return (
          expected !== undefined &&
          e.offset === expected.offset &&
          e.epoch === expected.epoch &&
          e.value === expected.value
        );
      });

    return { truncatedToOffset: truncateTo, matchesLeader };
  }
}

export class ProducerFencedError extends Error {
  constructor(producerId: string, gotEpoch: number, currentEpoch: number) {
    super(`ProducerFencedError(${producerId}): epoch ${gotEpoch} < active epoch ${currentEpoch}`);
    this.name = 'ProducerFencedError';
  }
}

export class OutOfOrderSequenceError extends Error {
  constructor(producerId: string, gotSeq: number, expectedSeq: number) {
    super(`OutOfOrderSequenceError(${producerId}): got seq ${gotSeq}, expected ${expectedSeq}`);
    this.name = 'OutOfOrderSequenceError';
  }
}

interface ProducerWindowState {
  epoch: number;
  lastSeq: number;
  recentOffsets: Map<number, number>;
}

/**
 * Partition-level idempotent producer verifier (Kafka KIP-98 `PID + epoch + seq`).
 * Deduplicates retries within a bounded 5-sequence O(1) window while fencing zombie epochs
 * and rejecting sequence gaps or stale retries evicted from the window.
 */
export class IdempotentPartitionBroker {
  private readonly maxWindowSize: number;
  private readonly log: Array<{ offset: number; producerId: string; seq: number; value: string }> =
    [];
  private readonly producers = new Map<string, ProducerWindowState>();

  constructor(maxWindowSize = 5) {
    this.maxWindowSize = maxWindowSize;
  }

  appendIdempotent(req: { producerId: string; epoch: number; seq: number; value: string }): {
    offset: number;
    deduplicated: boolean;
  } {
    const state = this.producers.get(req.producerId);

    if (!state || req.epoch > state.epoch) {
      if (req.seq !== 0) {
        throw new OutOfOrderSequenceError(req.producerId, req.seq, 0);
      }
      const offset = this.log.length;
      this.log.push({ offset, producerId: req.producerId, seq: req.seq, value: req.value });
      this.producers.set(req.producerId, {
        epoch: req.epoch,
        lastSeq: 0,
        recentOffsets: new Map([[0, offset]]),
      });
      return { offset, deduplicated: false };
    }

    if (req.epoch < state.epoch) {
      throw new ProducerFencedError(req.producerId, req.epoch, state.epoch);
    }

    // O(1) duplicate network retry check inside the bounded 5-sequence KIP-98 window
    const existingOffset = state.recentOffsets.get(req.seq);
    if (existingOffset !== undefined) {
      return { offset: existingOffset, deduplicated: true };
    }

    const expectedSeq = state.lastSeq + 1;
    if (req.seq !== expectedSeq) {
      throw new OutOfOrderSequenceError(req.producerId, req.seq, expectedSeq);
    }

    const offset = this.log.length;
    this.log.push({ offset, producerId: req.producerId, seq: req.seq, value: req.value });
    state.lastSeq = req.seq;
    state.recentOffsets.set(req.seq, offset);
    if (state.recentOffsets.size > this.maxWindowSize) {
      const oldestKey = state.recentOffsets.keys().next().value;
      if (oldestKey !== undefined) state.recentOffsets.delete(oldestKey);
    }
    return { offset, deduplicated: false };
  }

  get entries(): ReadonlyArray<{ offset: number; producerId: string; seq: number; value: string }> {
    return this.log;
  }
}

export interface ScheduledTask {
  readonly id: string;
  readonly dueTick: number;
  readonly payload: string;
}

/**
 * Two-level Hierarchical Timing Wheel (Varghese & Lauck, SOSP 1987).
 * Level 0 holds timers 1..(wheelSize - 1) ticks ahead; Level 1 holds wheelSize..(wheelSize^2 - 1).
 * Scheduling and per-tick firing run in O(1) amortized time without scanning all timers.
 */
export class HierarchicalTimingWheel {
  private readonly wheelSize: number;
  private readonly level0: ScheduledTask[][];
  private readonly level1: ScheduledTask[][];
  private currentTick = 0;

  constructor(wheelSize = 16) {
    if (wheelSize < 2) throw new RangeError('wheelSize must be >= 2');
    this.wheelSize = wheelSize;
    this.level0 = Array.from({ length: wheelSize }, () => []);
    this.level1 = Array.from({ length: wheelSize }, () => []);
  }

  schedule(id: string, delayTicks: number, payload: string): void {
    if (!Number.isInteger(delayTicks) || delayTicks < 1) {
      throw new RangeError('delayTicks must be a positive integer');
    }
    const maxSpan = this.wheelSize * this.wheelSize - 1;
    if (delayTicks > maxSpan) {
      throw new RangeError(`delayTicks ${delayTicks} exceeds two-level wheel capacity ${maxSpan}`);
    }
    const task: ScheduledTask = { id, dueTick: this.currentTick + delayTicks, payload };
    this.insert(task);
  }

  private insert(task: ScheduledTask): void {
    const remaining = task.dueTick - this.currentTick;
    if (remaining < this.wheelSize) {
      const slot = task.dueTick % this.wheelSize;
      this.level0[slot]?.push(task);
    } else {
      const coarseSlot = Math.floor(task.dueTick / this.wheelSize) % this.wheelSize;
      this.level1[coarseSlot]?.push(task);
    }
  }

  /** Advances the wheel by 1 tick, cascading coarse buckets when Level 0 wraps around. */
  tick(): ScheduledTask[] {
    this.currentTick++;
    const fineSlot = this.currentTick % this.wheelSize;

    // Cascade Level 1 bucket into Level 0 whenever Level 0 completes a full revolution
    if (fineSlot === 0) {
      const coarseSlot = Math.floor(this.currentTick / this.wheelSize) % this.wheelSize;
      const cascadeTasks = this.level1[coarseSlot] ?? [];
      this.level1[coarseSlot] = [];
      for (const task of cascadeTasks) {
        const slot = task.dueTick % this.wheelSize;
        this.level0[slot]?.push(task);
      }
    }

    const due = this.level0[fineSlot] ?? [];
    this.level0[fineSlot] = [];
    return due;
  }
}

export interface QueueClusterEstimate {
  readonly rawIngestBytesPerSec: number;
  readonly dailyRawTb: number;
  readonly retainedRawPb: number;
  readonly replicatedStoragePb: number;
  readonly compressedStoragePb: number;
  readonly crossAzReplicationGbPerSec: number;
  readonly monthlyCrossAzReplicationUsd: number;
  readonly monthlyConsumerCrossAzUsd: number;
}

/**
 * Quantitative capacity and cloud cross-AZ network cost model for a distributed
 * message queue cluster (default: 1M msg/s, 1 KB payload, RF=3, 14-day retention).
 */
export function estimateMessageQueueCluster(options: {
  messagesPerSec: number;
  avgMessageBytes: number;
  replicationFactor: number;
  retentionDays: number;
  compressionRatio: number;
  consumerGroups: number;
  crossAzCostPerGbUsd: number;
  followerFetchEnabled: boolean;
}): QueueClusterEstimate {
  const {
    messagesPerSec,
    avgMessageBytes,
    replicationFactor,
    retentionDays,
    compressionRatio,
    consumerGroups,
    crossAzCostPerGbUsd,
    followerFetchEnabled,
  } = options;

  const rawIngestBytesPerSec = messagesPerSec * avgMessageBytes;
  const rawIngestGbPerSec = rawIngestBytesPerSec / 1e9;
  const dailyRawTb = (rawIngestBytesPerSec * 86_400) / 1e12;
  const retainedRawPb = (dailyRawTb * retentionDays) / 1000;
  const replicatedStoragePb = retainedRawPb * replicationFactor;
  const compressedStoragePb = replicatedStoragePb / compressionRatio;

  // (RF - 1) followers replicate across AZs; compressed wire bytes flow over the network
  const crossAzReplicationGbPerSec =
    (rawIngestGbPerSec * (replicationFactor - 1)) / compressionRatio;
  const secondsPerMonth = 30 * 86_400; // 2,592,000 s
  const monthlyCrossAzReplicationUsd =
    crossAzReplicationGbPerSec * secondsPerMonth * crossAzCostPerGbUsd;

  // Without KIP-392 rack-aware follower fetching, ~(RF - 1)/RF of consumer reads cross AZ boundaries
  const crossAzConsumerFraction = followerFetchEnabled
    ? 0
    : (replicationFactor - 1) / replicationFactor;
  const consumerCrossAzGbPerSec =
    ((rawIngestGbPerSec * consumerGroups) / compressionRatio) * crossAzConsumerFraction;
  const monthlyConsumerCrossAzUsd = consumerCrossAzGbPerSec * secondsPerMonth * crossAzCostPerGbUsd;

  return {
    rawIngestBytesPerSec,
    dailyRawTb,
    retainedRawPb,
    replicatedStoragePb,
    compressedStoragePb,
    crossAzReplicationGbPerSec,
    monthlyCrossAzReplicationUsd,
    monthlyConsumerCrossAzUsd,
  };
}
