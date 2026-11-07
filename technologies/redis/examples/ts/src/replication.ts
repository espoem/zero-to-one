// Replication and Sentinel decision rules as pure functions.

// ---------------------------------------------------------------------------------------------
// PSYNC: partial vs full resynchronisation (replication.c: masterTryPartialResynchronization)
// ---------------------------------------------------------------------------------------------

export interface PrimaryReplState {
  replid: string;
  /** Previous replication ID (inherited when this node was promoted) and the offset up to which it is valid. */
  replid2: string;
  secondReplidOffset: number;
  /** The backlog holds the stream bytes in [backlogStart, masterOffset]. */
  backlogStart: number;
  masterOffset: number;
  backlogAllocated: boolean;
}

/** `PSYNC <replid> <offset>`: offset is the first byte the replica still needs (its offset + 1). */
export function psync(
  p: PrimaryReplState,
  replid: string,
  offset: number,
): 'CONTINUE' | 'FULLRESYNC' {
  const idOk = replid === p.replid || (replid === p.replid2 && offset <= p.secondReplidOffset);
  if (!idOk) return 'FULLRESYNC';
  if (!p.backlogAllocated) return 'FULLRESYNC';
  if (offset < p.backlogStart || offset > p.masterOffset + 1) return 'FULLRESYNC';
  return 'CONTINUE';
}

/** On promotion the old ID becomes replid2, valid up to the current offset, and a new ID is minted. */
export function promote(p: PrimaryReplState, newId: string): PrimaryReplState {
  return { ...p, replid2: p.replid, secondReplidOffset: p.masterOffset + 1, replid: newId };
}

/** Minimum backlog for a replica to survive a disconnect of `seconds` with partial resync. */
export function backlogBytesNeeded(writeBytesPerSec: number, seconds: number): number {
  return Math.ceil(writeBytesPerSec * seconds);
}

// ---------------------------------------------------------------------------------------------
// min-replicas-to-write / min-replicas-max-lag
// ---------------------------------------------------------------------------------------------

/** A primary accepts writes only if at least `minReplicas` replicas acked within `maxLagSec`. */
export function acceptsWrites(
  replicaLagsSec: number[],
  minReplicas: number,
  maxLagSec: number,
): boolean {
  if (minReplicas === 0 || maxLagSec === 0) return true;
  return replicaLagsSec.filter((l) => l <= maxLagSec).length >= minReplicas;
}

/**
 * Split brain: the old primary is partitioned away with its clients at t=0. Replicas report
 * (via REPLCONF ACK) every second; after the partition no acks arrive. Returns how many seconds
 * the isolated primary keeps accepting writes that will be discarded when it rejoins.
 */
export function isolatedPrimaryWriteWindow(minReplicas: number, maxLagSec: number): number {
  if (minReplicas === 0 || maxLagSec === 0) return Infinity;
  // Lag grows by 1 per second since the last ack; writes stop when lag > maxLag.
  return maxLagSec + 1;
}

// ---------------------------------------------------------------------------------------------
// Sentinel
// ---------------------------------------------------------------------------------------------

export interface SentinelView {
  total: number; // sentinels configured to monitor the master
  quorum: number; // sentinel monitor <name> <ip> <port> <quorum>
}

/** ODOWN: at least `quorum` sentinels consider the master subjectively down. */
export function objectivelyDown(v: SentinelView, sdownVotes: number): boolean {
  return sdownVotes >= v.quorum;
}

/**
 * Failover needs ODOWN *and* a leader elected by a majority of all sentinels (not just quorum),
 * for the current epoch. A minority partition can detect ODOWN but never fail over.
 */
export function canFailover(
  v: SentinelView,
  reachableSentinels: number,
  sdownVotes: number,
): boolean {
  const majority = Math.floor(v.total / 2) + 1;
  return objectivelyDown(v, sdownVotes) && reachableSentinels >= Math.max(majority, v.quorum);
}

/** Replica selection order used by Sentinel: priority (lower wins, 0 = never), offset (higher), run id. */
export interface ReplicaCandidate {
  runId: string;
  priority: number;
  offset: number;
  disconnectedSec: number;
}
export function pickReplica(
  cands: ReplicaCandidate[],
  downAfterSec: number,
): ReplicaCandidate | undefined {
  return cands
    .filter((c) => c.priority > 0 && c.disconnectedSec <= downAfterSec * 10)
    .sort(
      (a, b) => a.priority - b.priority || b.offset - a.offset || (a.runId < b.runId ? -1 : 1),
    )[0];
}
