import { createHash } from 'node:crypto';

export type CausalRelation = 'BEFORE' | 'AFTER' | 'EQUAL' | 'CONCURRENT';
export type VectorClock = Readonly<Record<string, number>>;

export function incrementClock(clock: VectorClock, nodeId: string): Record<string, number> {
  return {
    ...clock,
    [nodeId]: (clock[nodeId] ?? 0) + 1,
  };
}

export function compareVectorClocks(a: VectorClock, b: VectorClock): CausalRelation {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aLessThanB = false;
  let bLessThanA = false;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    if (va < vb) aLessThanB = true;
    if (vb < va) bLessThanA = true;
  }
  if (!aLessThanB && !bLessThanA) return 'EQUAL';
  if (aLessThanB && !bLessThanA) return 'BEFORE';
  if (bLessThanA && !aLessThanB) return 'AFTER';
  return 'CONCURRENT';
}

export function mergeVectorClocks(a: VectorClock, b: VectorClock): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const merged: Record<string, number> = {};
  for (const k of keys) {
    merged[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return merged;
}

export interface LwwRecord {
  value: string;
  wallClockMs: number;
  nodeId: string;
}

/**
 * Last-Write-Wins merge by wall-clock timestamp (tie-broken by nodeId).
 * Demonstrates silent data loss when a causally newer writer's NTP clock lags behind.
 */
export function applyLwwWrite(existing: LwwRecord | undefined, incoming: LwwRecord): LwwRecord {
  if (!existing) return incoming;
  if (incoming.wallClockMs > existing.wallClockMs) return incoming;
  if (incoming.wallClockMs === existing.wallClockMs && incoming.nodeId > existing.nodeId) {
    return incoming;
  }
  return existing;
}

export interface VersionedEntry {
  value: string;
  version: number;
}

interface HintedWrite {
  targetNode: string;
  key: string;
  entry: VersionedEntry;
}

/**
 * Deterministic Dynamo-style ring cluster with N=3 home preference list plus standby node,
 * supporting strict quorum writes/reads, partial-write failure modeling, sloppy quorum
 * with hinted handoff, and optional synchronous read repair.
 */
export class DynamoReplicaCluster {
  private readonly homeReplicas: readonly string[];
  private readonly standbyNodes: readonly string[];
  private readonly online = new Set<string>();
  private readonly store = new Map<string, Map<string, VersionedEntry>>();
  private readonly hints = new Map<string, HintedWrite[]>();

  constructor(homeReplicas: readonly string[], standbyNodes: readonly string[]) {
    this.homeReplicas = homeReplicas;
    this.standbyNodes = standbyNodes;
    for (const node of [...homeReplicas, ...standbyNodes]) {
      this.online.add(node);
      this.store.set(node, new Map());
      this.hints.set(node, []);
    }
  }

  setNodeOnline(nodeId: string, isOnline: boolean): void {
    if (isOnline) {
      this.online.add(nodeId);
    } else {
      this.online.delete(nodeId);
    }
  }

  write(options: { key: string; value: string; version: number; w: number; sloppy: boolean }): {
    ok: boolean;
    ackedNodes: string[];
    hintedFor: string[];
  } {
    const { key, value, version, w, sloppy } = options;
    const entry: VersionedEntry = { value, version };
    const ackedNodes: string[] = [];
    const hintedFor: string[] = [];
    const downHomeNodes: string[] = [];

    for (const node of this.homeReplicas) {
      if (this.online.has(node)) {
        this.applyToNode(node, key, entry);
        ackedNodes.push(node);
      } else {
        downHomeNodes.push(node);
      }
    }

    if (sloppy && ackedNodes.length < w) {
      for (const standby of this.standbyNodes) {
        if (ackedNodes.length >= w || downHomeNodes.length === 0) break;
        if (!this.online.has(standby)) continue;
        const targetNode = downHomeNodes.shift();
        if (!targetNode) break;
        // Hints live in standby's separate hint queue (not served to home-preference reads until replayHints)
        this.hints.get(standby)?.push({ targetNode, key, entry });
        ackedNodes.push(standby);
        hintedFor.push(targetNode);
      }
    }

    return { ok: ackedNodes.length >= w, ackedNodes, hintedFor };
  }

  read(options: {
    key: string;
    r: number;
    syncReadRepair: boolean;
    targetNodes?: readonly string[];
  }): {
    ok: boolean;
    entry: VersionedEntry | undefined;
    respondedNodes: string[];
    repairedNodes: string[];
  } {
    const { key, r, syncReadRepair, targetNodes } = options;
    const candidates = targetNodes ?? this.homeReplicas;
    const responded: Array<{ node: string; entry: VersionedEntry | undefined }> = [];

    for (const node of candidates) {
      if (responded.length >= r) break;
      if (!this.online.has(node)) continue;
      responded.push({ node, entry: this.store.get(node)?.get(key) });
    }

    if (responded.length < r) {
      return {
        ok: false,
        entry: undefined,
        respondedNodes: responded.map((x) => x.node),
        repairedNodes: [],
      };
    }

    let latest: VersionedEntry | undefined;
    for (const item of responded) {
      if (item.entry && (!latest || item.entry.version > latest.version)) {
        latest = item.entry;
      }
    }

    const repairedNodes: string[] = [];
    if (syncReadRepair && latest) {
      for (const item of responded) {
        if (!item.entry || item.entry.version < latest.version) {
          this.applyToNode(item.node, key, latest);
          repairedNodes.push(item.node);
        }
      }
    }

    return {
      ok: true,
      entry: latest,
      respondedNodes: responded.map((x) => x.node),
      repairedNodes,
    };
  }

  replayHints(): number {
    let replayed = 0;
    for (const [standby, queue] of this.hints.entries()) {
      if (!this.online.has(standby)) continue;
      const remaining: HintedWrite[] = [];
      for (const hint of queue) {
        if (this.online.has(hint.targetNode)) {
          this.applyToNode(hint.targetNode, hint.key, hint.entry);
          replayed++;
        } else {
          remaining.push(hint);
        }
      }
      this.hints.set(standby, remaining);
    }
    return replayed;
  }

  private applyToNode(nodeId: string, key: string, incoming: VersionedEntry): void {
    const map = this.store.get(nodeId);
    if (!map) return;
    const prev = map.get(key);
    if (!prev || incoming.version >= prev.version) {
      map.set(key, incoming);
    }
  }
}

export interface MerkleNode {
  hash: string;
  bucketStart: number;
  bucketEnd: number;
  left?: MerkleNode;
  right?: MerkleNode;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Builds a binary Merkle tree over `bucketCount` power-of-two key-range buckets.
 */
export function buildMerkleTree(
  records: ReadonlyMap<string, string>,
  bucketCount: number,
): MerkleNode {
  if (bucketCount < 1 || (bucketCount & (bucketCount - 1)) !== 0) {
    throw new RangeError('bucketCount must be a positive power of two');
  }
  const buckets: Array<Array<[string, string]>> = Array.from({ length: bucketCount }, () => []);
  for (const [k, v] of records.entries()) {
    const h = createHash('sha256').update(k).digest().readUInt32BE(0);
    const idx = h % bucketCount;
    buckets[idx]?.push([k, v]);
  }

  let level: MerkleNode[] = buckets.map((items, idx) => {
    items.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const serialized = items.map(([k, v]) => `${k}=${v}`).join('\n');
    return { hash: sha256Hex(serialized), bucketStart: idx, bucketEnd: idx };
  });

  while (level.length > 1) {
    const next: MerkleNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1]!;
      next.push({
        hash: sha256Hex(`${left.hash}:${right.hash}`),
        bucketStart: left.bucketStart,
        bucketEnd: right.bucketEnd,
        left,
        right,
      });
    }
    level = next;
  }
  return level[0]!;
}

/**
 * Compares two Merkle trees top-down, returning the exact divergent leaf bucket indices
 * and total node hash comparisons performed.
 */
export function diffMerkleTrees(
  a: MerkleNode,
  b: MerkleNode,
): { divergentBuckets: number[]; nodesCompared: number } {
  const divergentBuckets: number[] = [];
  let nodesCompared = 0;

  function walk(na: MerkleNode, nb: MerkleNode): void {
    nodesCompared++;
    if (na.hash === nb.hash) return;
    if (!na.left || !na.right || !nb.left || !nb.right) {
      divergentBuckets.push(na.bucketStart);
      return;
    }
    walk(na.left, nb.left);
    walk(na.right, nb.right);
  }

  walk(a, b);
  return { divergentBuckets, nodesCompared };
}

/**
 * Complementary error function approximation (Abramowitz & Stegun 7.1.26, max error < 1.5e-7)
 * used to compute normal tail probability P_later(t) in Hayashibara's Phi Accrual Failure Detector.
 */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * Hayashibara et al. (SRDS 2004) Phi Accrual Failure Detector:
 *   phi(t_now) = -log10(P_later(t_now - t_last))
 */
export class PhiAccrualDetector {
  private readonly intervals: number[] = [];
  private readonly maxWindow: number;
  private readonly minStdDevMs: number;
  private lastHeartbeatMs: number | undefined;

  constructor(options?: { maxWindow?: number; minStdDevMs?: number }) {
    this.maxWindow = options?.maxWindow ?? 200;
    this.minStdDevMs = options?.minStdDevMs ?? 50;
  }

  heartbeat(timestampMs: number): void {
    if (this.lastHeartbeatMs !== undefined) {
      const delta = timestampMs - this.lastHeartbeatMs;
      if (delta >= 0) {
        this.intervals.push(delta);
        if (this.intervals.length > this.maxWindow) {
          this.intervals.shift();
        }
      }
    }
    this.lastHeartbeatMs = timestampMs;
  }

  phi(nowMs: number): number {
    if (this.lastHeartbeatMs === undefined || this.intervals.length < 2) {
      return 0;
    }
    const elapsed = Math.max(0, nowMs - this.lastHeartbeatMs);
    const mean = this.intervals.reduce((sum, x) => sum + x, 0) / this.intervals.length;
    const variance =
      this.intervals.reduce((sum, x) => sum + (x - mean) ** 2, 0) / this.intervals.length;
    const stdDev = Math.max(this.minStdDevMs, Math.sqrt(variance));
    // Normal survival function P(X > elapsed) = 0.5 * erfc((elapsed - mean) / (stdDev * sqrt(2)))
    const pLater = 0.5 * erfc((elapsed - mean) / (stdDev * Math.SQRT2));
    if (pLater <= Number.MIN_VALUE) {
      return 300;
    }
    return -Math.log10(pLater);
  }
}
