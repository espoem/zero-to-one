import { createHash } from 'node:crypto';

/**
 * Gunther's Universal Scalability Law (USL):
 *   C(N) = N / (1 + alpha * (N - 1) + beta * N * (N - 1))
 *
 * - alpha in [0, 1): contention / serialization fraction (Amdahl term)
 * - beta >= 0: coherency / crosstalk penalty across nodes (causes retrograde scaling)
 */
export function uslRelativeCapacity(nodes: number, alpha: number, beta: number): number {
  if (!Number.isFinite(nodes) || nodes < 1) {
    throw new RangeError('nodes must be >= 1');
  }
  if (alpha < 0 || alpha >= 1) {
    throw new RangeError('alpha must be in [0, 1)');
  }
  if (beta < 0) {
    throw new RangeError('beta must be >= 0');
  }
  return nodes / (1 + alpha * (nodes - 1) + beta * nodes * (nodes - 1));
}

/**
 * Analytical peak concurrency before retrograde scaling begins:
 *   N_max = sqrt((1 - alpha) / beta)
 */
export function uslPeakNodes(alpha: number, beta: number): number {
  if (alpha < 0 || alpha >= 1) {
    throw new RangeError('alpha must be in [0, 1)');
  }
  if (beta <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.sqrt((1 - alpha) / beta);
}

export interface SessionTierOutcome {
  totalUsers: number;
  survivedSessions: number;
  droppedSessions: number;
  droppedRatio: number;
}

/**
 * Compares sticky in-memory web-tier sessions versus an externalized stateless session store
 * when a subset of web nodes (e.g., one Availability Zone) fails abruptly.
 *
 * When `mode === 'external-valkey'`, sessions survive web-node / AZ loss provided the session
 * store itself remains available (`sessionStoreFailed === false`, e.g., multi-AZ replicated Valkey);
 * if an un-replicated single-AZ session store fails (`sessionStoreFailed === true`), all sessions drop.
 */
export function simulateSessionTierFailure(options: {
  totalUsers: number;
  webNodes: number;
  failedNodes: number;
  mode: 'sticky-local' | 'external-valkey';
  sessionStoreFailed?: boolean;
}): SessionTierOutcome {
  const { totalUsers, webNodes, failedNodes, mode, sessionStoreFailed = false } = options;
  if (webNodes < 1 || failedNodes < 0 || failedNodes > webNodes) {
    throw new RangeError('invalid webNodes or failedNodes');
  }
  if (mode === 'external-valkey') {
    const survivingNodes = webNodes - failedNodes;
    const survivedSessions = survivingNodes > 0 && !sessionStoreFailed ? totalUsers : 0;
    const droppedSessions = totalUsers - survivedSessions;
    return {
      totalUsers,
      survivedSessions,
      droppedSessions,
      droppedRatio: totalUsers === 0 ? 0 : droppedSessions / totalUsers,
    };
  }

  let dropped = 0;
  for (let user = 0; user < totalUsers; user++) {
    const pinnedNode = user % webNodes;
    if (pinnedNode < failedNodes) {
      dropped++;
    }
  }
  return {
    totalUsers,
    survivedSessions: totalUsers - dropped,
    droppedSessions: dropped,
    droppedRatio: totalUsers === 0 ? 0 : dropped / totalUsers,
  };
}

export interface ReplicaWriteEvent {
  lsn: number;
  key: string;
  value: string;
  appliedAtMs: number;
}

/**
 * Minimal deterministic Primary + Async Read Replica model proving:
 * 1. Naive immediate read from an async replica after a write returns stale data when elapsed < lagMs.
 * 2. LSN-pinned routing (read-your-writes) routes to primary or waits until replica_lsn >= minLsn.
 */
export class PrimaryReplicaCluster {
  private primaryState = new Map<string, string>();
  private replicaState = new Map<string, string>();
  private primaryLsn = 0;
  private replicaLsn = 0;
  private walQueue: ReplicaWriteEvent[] = [];
  private nowMs = 0;
  private readonly replicationLagMs: number;

  constructor(replicationLagMs: number) {
    if (replicationLagMs < 0) {
      throw new RangeError('replicationLagMs must be >= 0');
    }
    this.replicationLagMs = replicationLagMs;
  }

  advanceClock(deltaMs: number): void {
    if (deltaMs < 0) {
      throw new RangeError('clock cannot move backwards');
    }
    this.nowMs += deltaMs;
    this.flushEligibleWal();
  }

  write(key: string, value: string): { lsn: number } {
    this.primaryLsn++;
    this.primaryState.set(key, value);
    this.walQueue.push({
      lsn: this.primaryLsn,
      key,
      value,
      appliedAtMs: this.nowMs + this.replicationLagMs,
    });
    return { lsn: this.primaryLsn };
  }

  readNaiveReplica(key: string): {
    value: string | undefined;
    servedBy: 'replica';
    replicaLsn: number;
  } {
    this.flushEligibleWal();
    return {
      value: this.replicaState.get(key),
      servedBy: 'replica',
      replicaLsn: this.replicaLsn,
    };
  }

  readWithLsnPin(
    key: string,
    minLsn: number,
  ): { value: string | undefined; servedBy: 'primary' | 'replica'; observedLsn: number } {
    this.flushEligibleWal();
    if (this.replicaLsn >= minLsn) {
      return {
        value: this.replicaState.get(key),
        servedBy: 'replica',
        observedLsn: this.replicaLsn,
      };
    }
    return {
      value: this.primaryState.get(key),
      servedBy: 'primary',
      observedLsn: this.primaryLsn,
    };
  }

  private flushEligibleWal(): void {
    while (this.walQueue.length > 0) {
      const next = this.walQueue[0];
      if (!next || next.appliedAtMs > this.nowMs) {
        break;
      }
      this.walQueue.shift();
      this.replicaState.set(next.key, next.value);
      this.replicaLsn = next.lsn;
    }
  }
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  const r = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= r; i++) {
    result = (result * (n - r + i)) / i;
  }
  return Math.round(result);
}

/**
 * Deterministic Shuffle Sharding allocator:
 * Maps each tenant to a unique sorted subset of k distinct workers out of N total workers
 * using SHA-256 Fisher-Yates selection without replacement.
 */
export function assignShuffleShard(
  tenantId: string,
  totalWorkers: number,
  shardSize: number,
): number[] {
  if (shardSize < 1 || shardSize > totalWorkers) {
    throw new RangeError('shardSize must be in [1, totalWorkers]');
  }
  const pool = Array.from({ length: totalWorkers }, (_, idx) => idx);
  const chosen: number[] = [];
  for (let i = 0; i < shardSize; i++) {
    const digest = createHash('sha256').update(`${tenantId}#${i}`).digest();
    const rand = digest.readUInt32BE(0);
    const pickIdx = rand % pool.length;
    const worker = pool.splice(pickIdx, 1)[0];
    if (worker === undefined) {
      throw new Error('unreachable empty pool');
    }
    chosen.push(worker);
  }
  chosen.sort((a, b) => a - b);
  return chosen;
}

/**
 * Deterministic standard (non-overlapping) shard allocator for baseline comparison:
 * Partitions N workers into floor(N / k) disjoint fixed shards of size k.
 */
export function assignFixedShard(
  tenantId: string,
  totalWorkers: number,
  shardSize: number,
): number[] {
  const numShards = Math.floor(totalWorkers / shardSize);
  if (numShards < 1) {
    throw new RangeError('totalWorkers must be >= shardSize');
  }
  const digest = createHash('sha256').update(tenantId).digest();
  const shardIdx = digest.readUInt32BE(0) % numShards;
  const start = shardIdx * shardSize;
  return Array.from({ length: shardSize }, (_, idx) => start + idx);
}

/**
 * Returns true if a poison-pill tenant taking down ALL of its assigned workers
 * completely takes down another victim tenant (i.e., victim's worker set is a subset of poison's).
 */
export function isTenantCompletelyOut(
  poisonWorkers: readonly number[],
  victimWorkers: readonly number[],
): boolean {
  const poisoned = new Set(poisonWorkers);
  return victimWorkers.every((w) => poisoned.has(w));
}

export interface AutoscalerStepResult {
  tick: number;
  demandQps: number;
  activeNodes: number;
  utilization: number;
  scaleEvents: number;
}

/**
 * Discrete-time autoscaler simulator showing oscillation/thrashing when cold-start boot delay
 * is paired with zero hysteresis and zero scale-down cooldown, versus stabilized scaling.
 */
export function simulateAutoscaler(options: {
  demandSeries: readonly number[];
  qpsPerNode: number;
  initialNodes: number;
  minNodes: number;
  maxNodes: number;
  scaleOutThreshold: number;
  scaleInThreshold: number;
  bootDelayTicks: number;
  scaleDownCooldownTicks: number;
  trackInflightBoots: boolean;
}): {
  steps: AutoscalerStepResult[];
  totalScaleEvents: number;
  overloadTicks: number;
} {
  const {
    demandSeries,
    qpsPerNode,
    initialNodes,
    minNodes,
    maxNodes,
    scaleOutThreshold,
    scaleInThreshold,
    bootDelayTicks,
    scaleDownCooldownTicks,
    trackInflightBoots,
  } = options;

  let activeNodes = initialNodes;
  const bootingQueue: number[] = []; // tick at which each booting node becomes ready
  let lastScaleOutTick = -10_000;
  let totalScaleEvents = 0;
  let overloadTicks = 0;
  const steps: AutoscalerStepResult[] = [];

  for (let tick = 0; tick < demandSeries.length; tick++) {
    const demandQps = demandSeries[tick] ?? 0;

    // Activate any nodes whose boot delay has elapsed
    while (bootingQueue.length > 0 && (bootingQueue[0] ?? Number.POSITIVE_INFINITY) <= tick) {
      bootingQueue.shift();
      activeNodes = Math.min(maxNodes, activeNodes + 1);
    }

    const capacity = activeNodes * qpsPerNode;
    const utilization = capacity > 0 ? demandQps / capacity : Number.POSITIVE_INFINITY;
    if (utilization > 1.0) {
      overloadTicks++;
    }

    let scaleEvents = 0;
    if (utilization > scaleOutThreshold && activeNodes < maxNodes) {
      const pendingCount = trackInflightBoots ? bootingQueue.length : 0;
      const desiredTotal = Math.min(
        maxNodes,
        Math.ceil(demandQps / (qpsPerNode * scaleOutThreshold)),
      );
      const toLaunch = Math.max(0, desiredTotal - (activeNodes + pendingCount));
      for (let i = 0; i < toLaunch; i++) {
        bootingQueue.push(tick + bootDelayTicks);
        scaleEvents++;
        totalScaleEvents++;
        lastScaleOutTick = tick;
      }
    } else if (
      utilization < scaleInThreshold &&
      activeNodes > minNodes &&
      tick - lastScaleOutTick >= scaleDownCooldownTicks
    ) {
      activeNodes = Math.max(minNodes, activeNodes - 1);
      scaleEvents++;
      totalScaleEvents++;
    }

    steps.push({ tick, demandQps, activeNodes, utilization, scaleEvents });
  }

  return { steps, totalScaleEvents, overloadTicks };
}
