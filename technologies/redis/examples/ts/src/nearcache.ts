// Model of server-assisted client-side caching (CLIENT TRACKING, default mode) and the client rule
// that makes it correct: mark a key "pending" before sending the read, and drop the reply if an
// invalidation for that key arrived in between.

export type Msg =
  | { kind: 'reply'; key: string; value: string | null; seq: number }
  | { kind: 'invalidate'; keys: string[] | null }; // null = flush everything

export class TrackingServer {
  data = new Map<string, string>();
  /** key -> set of client ids that may have cached it (the invalidation table). */
  table = new Map<string, Set<number>>();
  maxKeys: number;
  constructor(maxKeys = 1_000_000) {
    this.maxKeys = maxKeys;
  }

  read(client: number, key: string): string | null {
    let set = this.table.get(key);
    if (!set) {
      set = new Set();
      this.table.delete(key);
      this.table.set(key, set);
    }
    set.add(client);
    this.limit();
    return this.data.get(key) ?? null;
  }

  /** Write by `writer`; returns invalidations per tracking client. NOLOOP suppresses the writer's own. */
  write(key: string, value: string, writer: number, noloop = false): Map<number, Msg> {
    this.data.set(key, value);
    const out = new Map<number, Msg>();
    for (const c of this.table.get(key) ?? []) {
      if (noloop && c === writer) continue;
      out.set(c, { kind: 'invalidate', keys: [key] });
    }
    // An invalidation forgets the key: the client must read again to be tracked again.
    this.table.delete(key);
    return out;
  }

  /** `tracking-table-max-keys`: when exceeded, the oldest keys are dropped and their clients told. */
  private limit(): void {
    while (this.table.size > this.maxKeys) {
      const oldest = this.table.keys().next().value as string;
      this.dropped.push({ key: oldest, clients: [...this.table.get(oldest)!] });
      this.table.delete(oldest);
    }
  }
  dropped: Array<{ key: string; clients: number[] }> = [];
}

export class NearCache {
  cache = new Map<string, string | null>();
  /** One entry per in-flight read, so several reads of the same key are tracked independently. */
  private pending = new Map<number, { key: string; invalidated: boolean }>();
  private seq = 0;
  readonly safe: boolean;
  constructor(safe = true) {
    this.safe = safe;
  }

  /** Call before sending GET. Returns a sequence number to pair with the reply. */
  beginRead(key: string): number {
    const seq = ++this.seq;
    if (this.safe) this.pending.set(seq, { key, invalidated: false });
    return seq;
  }

  onMessage(m: Msg): void {
    if (m.kind === 'invalidate') {
      if (m.keys === null) {
        this.cache.clear();
        for (const p of this.pending.values()) p.invalidated = true;
        return;
      }
      for (const key of m.keys) {
        this.cache.delete(key);
        for (const p of this.pending.values()) if (p.key === key) p.invalidated = true;
      }
      return;
    }
    const p = this.pending.get(m.seq);
    if (this.safe && p) {
      this.pending.delete(m.seq);
      if (p.invalidated) return; // the value in this reply is already stale: do not cache it
    }
    this.cache.set(m.key, m.value);
  }

  /** Connection loss: invalidations may have been missed, so nothing can be trusted. */
  onDisconnect(): void {
    this.cache.clear();
    for (const p of this.pending.values()) p.invalidated = true;
  }
}
