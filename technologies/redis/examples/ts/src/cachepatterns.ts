// Three small models used by module 04: a circuit breaker for the cache client, write-behind with
// per-key coalescing, and namespace versioning for O(1) bulk invalidation.

export type BreakerState = 'closed' | 'open' | 'half-open';

/** Closed -> open after `threshold` consecutive failures; open -> half-open after `cooldownMs`;
 *  half-open lets ONE probe through: success closes, failure re-opens. */
export class CircuitBreaker {
  state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private probing = false;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  constructor(threshold: number, cooldownMs: number, now: () => number) {
    if (threshold < 1) throw new RangeError('threshold must be at least 1');
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.now = now;
  }

  /** May this call go to Redis? When false the caller must fall through to the source of truth. */
  allow(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.cooldownMs) return false;
      this.state = 'half-open';
      this.probing = false;
    }
    if (this.probing) return false; // only one probe at a time
    this.probing = true;
    return true;
  }

  success(): void {
    this.failures = 0;
    this.state = 'closed';
    this.probing = false;
  }

  failure(): void {
    this.probing = false;
    if (this.state === 'half-open' || ++this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}

/** Write-behind: acknowledge writes into a buffer, flush batches to the source of truth later. */
export class WriteBehind<V> {
  private buf = new Map<string, V>(); // coalescing: only the latest value per key survives
  readonly flushed: Array<[string, V]> = [];
  acknowledged = 0;
  private readonly maxPending: number;
  constructor(maxPending: number) {
    this.maxPending = maxPending;
  }

  write(key: string, value: V): void {
    if (!this.buf.has(key) && this.buf.size >= this.maxPending)
      throw new Error('backpressure: buffer full');
    this.buf.set(key, value);
    this.acknowledged++;
  }

  flush(): number {
    const n = this.buf.size;
    for (const entry of this.buf) this.flushed.push(entry);
    this.buf.clear();
    return n;
  }

  /** A crash loses whatever has not been flushed; returns the keys whose latest write is lost. */
  crash(): string[] {
    const lost = [...this.buf.keys()];
    this.buf.clear();
    return lost;
  }
}

/** Namespace versioning: keys embed a generation number; bumping it orphans every old key at once. */
export class NamespacedCache {
  private gen = new Map<string, number>();
  readonly store = new Map<string, string>();
  key(ns: string, id: string): string {
    return `cache:${ns}:v${this.gen.get(ns) ?? 1}:${id}`;
  }
  set(ns: string, id: string, v: string): void {
    this.store.set(this.key(ns, id), v);
  }
  get(ns: string, id: string): string | undefined {
    return this.store.get(this.key(ns, id));
  }
  /** The O(1) bulk invalidation (`INCR cache:ver:<ns>`). The old keys stay in memory until their TTL. */
  bump(ns: string): number {
    const g = (this.gen.get(ns) ?? 1) + 1;
    this.gen.set(ns, g);
    return g;
  }
  orphaned(ns: string): number {
    const live = `cache:${ns}:v${this.gen.get(ns) ?? 1}:`;
    return [...this.store.keys()].filter((k) => k.startsWith(`cache:${ns}:`) && !k.startsWith(live))
      .length;
  }
}

import { keySlot } from './cluster.ts';

/** In Cluster a multi-key read must be split per hash slot (one MGET per group), or it fails with CROSSSLOT. */
export function groupBySlot(keys: string[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const key of keys) {
    const slot = keySlot(key);
    const g = groups.get(slot);
    if (g) g.push(key);
    else groups.set(slot, [key]);
  }
  return groups;
}
