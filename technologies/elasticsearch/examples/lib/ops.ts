/**
 * Teaching models for cluster operations:
 *  - cluster health colour from shard copy states
 *  - an allocation decider subset that explains why a copy cannot be assigned
 *  - disk watermarks and the flood-stage write block
 *  - JVM heap sizing and the compressed-oops threshold
 *  - incremental snapshots (file-level deduplication) and SLM retention
 *  - the supported upgrade path to 9.x
 */

export type CopyState = 'STARTED' | 'INITIALIZING' | 'RELOCATING' | 'UNASSIGNED';
export interface ShardCopy {
  index: string;
  shard: number;
  primary: boolean;
  state: CopyState;
}
export type Health = 'green' | 'yellow' | 'red';

/**
 * red: some primary is not active; yellow: all primaries active but some replica is not;
 * green: everything active. The cluster colour is the worst index colour.
 */
export function indexHealth(copies: ShardCopy[]): Health {
  const active = (c: ShardCopy) => c.state === 'STARTED' || c.state === 'RELOCATING';
  if (copies.some((c) => c.primary && !active(c))) return 'red';
  if (copies.some((c) => !c.primary && !active(c))) return 'yellow';
  return 'green';
}

export function clusterHealth(copies: ShardCopy[]): Health {
  const byIndex = new Map<string, ShardCopy[]>();
  for (const c of copies) byIndex.set(c.index, [...(byIndex.get(c.index) ?? []), c]);
  const order: Health[] = ['green', 'yellow', 'red'];
  let worst: Health = 'green';
  for (const cs of byIndex.values()) {
    const h = indexHealth(cs);
    if (order.indexOf(h) > order.indexOf(worst)) worst = h;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Allocation deciders
// ---------------------------------------------------------------------------

export interface NodeInfo {
  name: string;
  diskUsedPct: number;
  attrs: Record<string, string>;
  roles: string[];
}

export interface Watermarks {
  low: number;
  high: number;
  flood: number;
}

export const DEFAULT_WATERMARKS: Watermarks = { low: 85, high: 90, flood: 95 };

export interface Decision {
  node: string;
  decision: 'YES' | 'NO';
  reasons: string[];
}

export interface AllocationRequest {
  index: string;
  shard: number;
  primary: boolean;
  /** nodes already holding a copy of this shard */
  holders: string[];
  /** cluster.routing.allocation.awareness.attributes */
  awareness?: string;
  /** forced awareness values */
  forcedValues?: string[];
  require?: Record<string, string>;
  exclude?: Record<string, string>;
  tierPreference?: string[];
  newlyCreatedPrimary?: boolean;
}

/** A subset of Elasticsearch's deciders, producing allocation-explain style reasons. */
export function explain(
  req: AllocationRequest,
  nodes: NodeInfo[],
  wm: Watermarks = DEFAULT_WATERMARKS,
): Decision[] {
  return nodes.map((n) => {
    const reasons: string[] = [];
    if (req.holders.includes(n.name))
      reasons.push('same_shard: a copy of this shard is already allocated to this node');
    // The low watermark does not block a brand-new primary (so new indices can be created).
    if (n.diskUsedPct >= wm.low && !(req.primary && req.newlyCreatedPrimary))
      reasons.push(`disk_threshold: the node is above the low watermark [${wm.low}%]`);
    for (const [k, v] of Object.entries(req.require ?? {}))
      if (n.attrs[k] !== v)
        reasons.push(
          `filter: node does not match index setting [index.routing.allocation.require.${k}] filters [${v}]`,
        );
    for (const [k, v] of Object.entries(req.exclude ?? {}))
      if ((k === '_name' ? n.name : n.attrs[k]) === v)
        reasons.push(
          `filter: node matches index setting [index.routing.allocation.exclude.${k}] filters [${v}]`,
        );
    if (req.tierPreference) {
      const available = req.tierPreference.find((t) => nodes.some((x) => x.roles.includes(t)));
      if (available && !n.roles.includes(available))
        reasons.push(
          `data_tier: index has a preference for tiers [${req.tierPreference.join(',')}] and node does not meet the required [${available}] tier`,
        );
    }
    if (req.awareness) {
      const attr = req.awareness;
      const value = n.attrs[attr];
      const holderValues = req.holders.map((h) => nodes.find((x) => x.name === h)?.attrs[attr]);
      const values = new Set(
        [...nodes.map((x) => x.attrs[attr]), ...(req.forcedValues ?? [])].filter(Boolean),
      );
      const copies = req.holders.length + 1;
      // at most ceil(copies / #values) copies per attribute value
      const maxPerValue = Math.ceil(copies / values.size);
      if (holderValues.filter((v) => v === value).length + 1 > maxPerValue) {
        reasons.push(
          `awareness: there are [${holderValues.filter((v) => v === value).length + 1}] copies of this shard and [${values.size}] values for attribute [${attr}] which may limit the number of copies per value to [${maxPerValue}]`,
        );
      }
    }
    return { node: n.name, decision: reasons.length === 0 ? 'YES' : 'NO', reasons };
  });
}

/** What happens to an index with a shard on a node at the given disk usage. */
export function diskAction(
  usedPct: number,
  wm: Watermarks = DEFAULT_WATERMARKS,
): 'none' | 'no_new_shards' | 'relocate_away' | 'read_only_allow_delete' {
  if (usedPct >= wm.flood) return 'read_only_allow_delete';
  if (usedPct >= wm.high) return 'relocate_away';
  if (usedPct >= wm.low) return 'no_new_shards';
  return 'none';
}

/** Since 7.4 the flood-stage block is released automatically once usage drops below the high watermark. */
export function floodBlockAfter(
  usedPct: number,
  blocked: boolean,
  wm: Watermarks = DEFAULT_WATERMARKS,
): boolean {
  if (usedPct >= wm.flood) return true;
  if (blocked && usedPct >= wm.high) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Heap sizing
// ---------------------------------------------------------------------------

/**
 * The JVM can use 32-bit compressed object pointers while the heap is below ~32 GB
 * (the exact cutoff depends on the JVM; zero-based compressed oops need slightly less).
 * Recommendation: heap <= 50% of RAM (the rest is page cache for Lucene's mmapped files)
 * and below the compressed-oops threshold (~31 GB to be safe).
 */
export const COMPRESSED_OOPS_LIMIT_GB = 32;
export function recommendedHeapGb(ramGb: number): number {
  return Math.min(Math.floor(ramGb / 2), 31);
}
export function usesCompressedOops(heapGb: number): boolean {
  return heapGb < COMPRESSED_OOPS_LIMIT_GB;
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export interface Snapshot {
  name: string;
  takenAt: number;
  files: Set<string>;
}

export class Repository {
  blobs = new Set<string>();
  snapshots: Snapshot[] = [];

  /** Incremental at the file level: only segment files not already in the repository are uploaded. */
  snapshot(
    name: string,
    segmentFiles: string[],
    takenAt: number,
  ): { uploaded: number; reused: number } {
    let uploaded = 0;
    for (const f of segmentFiles)
      if (!this.blobs.has(f)) {
        this.blobs.add(f);
        uploaded++;
      }
    this.snapshots.push({ name, takenAt, files: new Set(segmentFiles) });
    return { uploaded, reused: segmentFiles.length - uploaded };
  }

  /** Deleting a snapshot only deletes blobs no other snapshot references. */
  delete(name: string): number {
    this.snapshots = this.snapshots.filter((s) => s.name !== name);
    const live = new Set(this.snapshots.flatMap((s) => [...s.files]));
    let removed = 0;
    for (const b of this.blobs)
      if (!live.has(b)) {
        this.blobs.delete(b);
        removed++;
      }
    return removed;
  }

  /** SLM retention: delete snapshots older than expireAfter, keeping at least minCount and at most maxCount. */
  applyRetention(now: number, expireAfterMs: number, minCount: number, maxCount: number): string[] {
    const sorted = [...this.snapshots].sort((a, b) => b.takenAt - a.takenAt);
    const doomed: string[] = [];
    sorted.forEach((s, i) => {
      const overMax = i >= maxCount;
      const expired = now - s.takenAt > expireAfterMs && i >= minCount;
      if (overMax || expired) doomed.push(s.name);
    });
    for (const d of doomed) this.delete(d);
    return doomed;
  }
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

const parse = (v: string) => v.split('.').map(Number) as [number, number, number];

/** Rolling upgrade to 9.x: from 8.19.x (or 8.18.x only for 9.0.x). Never across two majors. */
export function canRollingUpgrade(from: string, to: string): boolean {
  const [fM, fm] = parse(from);
  const [tM, tm] = parse(to);
  if (tM < fM || (tM === fM && tm < fm)) return false; // no downgrades
  if (tM === fM) return true;
  if (tM - fM > 1) return false;
  if (tM === 9 && fM === 8) return fm === 19 || (fm === 18 && tm === 0);
  return false;
}

/** Indices created before the previous major cannot be opened read-write by the new major. */
export function indexCompatible(
  createdMajor: number,
  clusterMajor: number,
): 'ok' | 'read_only_archive' | 'reindex_required' {
  if (createdMajor >= clusterMajor - 1) return 'ok';
  if (createdMajor === clusterMajor - 2) return 'read_only_archive';
  return 'reindex_required';
}
