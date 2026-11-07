// Models of Redis messaging primitives: stream IDs, consumer groups with a PEL, XAUTOCLAIM,
// trimming, the reliable-list-queue pattern, and pub/sub output-buffer limits.

export interface StreamId {
  ms: number;
  seq: number;
}

export const fmt = (id: StreamId): string => `${id.ms}-${id.seq}`;
export function parseId(s: string): StreamId {
  const [ms, seq] = s.split('-');
  return { ms: Number(ms), seq: Number(seq ?? 0) };
}
export function cmpId(a: StreamId, b: StreamId): number {
  return a.ms !== b.ms ? a.ms - b.ms : a.seq - b.seq;
}

/**
 * XADD * ID generation: <unix-ms>-<seq>. IDs are strictly increasing even if the wall clock
 * goes backwards: the server reuses the last ms and increments the sequence.
 */
export function nextAutoId(last: StreamId, nowMs: number): StreamId {
  if (nowMs > last.ms) return { ms: nowMs, seq: 0 };
  return { ms: last.ms, seq: last.seq + 1 };
}

export interface Entry {
  id: StreamId;
  fields: Record<string, string>;
}

interface Pending {
  consumer: string;
  deliveredAt: number;
  deliveries: number;
}

export interface Group {
  lastDelivered: StreamId;
  pel: Map<string, Pending>; // id -> pending info, ordered by insertion = id order
}

export class Stream {
  entries: Entry[] = [];
  last: StreamId = { ms: 0, seq: 0 };
  groups = new Map<string, Group>();
  now = 0;

  xadd(fields: Record<string, string>, opts: { id?: string; maxlen?: number } = {}): string {
    let id: StreamId;
    if (opts.id) {
      id = parseId(opts.id);
      if (cmpId(id, this.last) <= 0) {
        throw new Error(
          'ERR The ID specified in XADD is equal or smaller than the target stream top item',
        );
      }
    } else id = nextAutoId(this.last, this.now);
    this.entries.push({ id, fields });
    this.last = id;
    if (opts.maxlen !== undefined && this.entries.length > opts.maxlen) {
      this.entries.splice(0, this.entries.length - opts.maxlen);
    }
    return fmt(id);
  }

  xgroupCreate(name: string, start: '$' | '0'): void {
    if (this.groups.has(name)) throw new Error('BUSYGROUP Consumer Group name already exists');
    this.groups.set(name, {
      lastDelivered: start === '$' ? { ...this.last } : { ms: 0, seq: 0 },
      pel: new Map(),
    });
  }

  private group(name: string): Group {
    const g = this.groups.get(name);
    if (!g) throw new Error('NOGROUP No such key or consumer group');
    return g;
  }

  /** XREADGROUP GROUP g c COUNT n STREAMS s > : new entries, recorded in the PEL. */
  readNew(group: string, consumer: string, count: number): Entry[] {
    const g = this.group(group);
    const out = this.entries.filter((e) => cmpId(e.id, g.lastDelivered) > 0).slice(0, count);
    for (const e of out) {
      g.lastDelivered = e.id;
      g.pel.set(fmt(e.id), { consumer, deliveredAt: this.now, deliveries: 1 });
    }
    return out;
  }

  /** XREADGROUP … STREAMS s 0 : this consumer's own pending entries (crash recovery). */
  readOwnPending(group: string, consumer: string): Array<Entry | { id: StreamId; deleted: true }> {
    const g = this.group(group);
    return [...g.pel]
      .filter(([, p]) => p.consumer === consumer)
      .map(
        ([id]) =>
          this.entries.find((e) => fmt(e.id) === id) ?? { id: parseId(id), deleted: true as const },
      );
  }

  xack(group: string, ...ids: string[]): number {
    const g = this.group(group);
    return ids.filter((id) => g.pel.delete(id)).length;
  }

  /**
   * XAUTOCLAIM key group consumer min-idle-time start COUNT n : transfers ownership of entries
   * idle for at least min-idle and bumps their delivery counter. Entries trimmed from the
   * stream are removed from the PEL and reported as deleted.
   */
  xautoclaim(
    group: string,
    consumer: string,
    minIdle: number,
    count = 100,
  ): { claimed: Entry[]; deleted: string[] } {
    const g = this.group(group);
    const claimed: Entry[] = [];
    const deleted: string[] = [];
    for (const [id, p] of g.pel) {
      if (claimed.length >= count) break;
      if (this.now - p.deliveredAt < minIdle) continue;
      const e = this.entries.find((x) => fmt(x.id) === id);
      if (!e) {
        g.pel.delete(id);
        deleted.push(id);
        continue;
      }
      p.consumer = consumer;
      p.deliveredAt = this.now;
      p.deliveries++;
      claimed.push(e);
    }
    return { claimed, deleted };
  }

  pending(group: string, id: string): Pending | undefined {
    return this.group(group).pel.get(id);
  }

  /** Consumer-group lag: entries added after the group's last delivered ID. */
  lag(group: string): number {
    const g = this.group(group);
    return this.entries.filter((e) => cmpId(e.id, g.lastDelivered) > 0).length;
  }
}

/**
 * Idempotent production (Redis 8.6 XADD IDMP/IDMPAUTO, modelled abstractly): the server
 * remembers recent (producer, message-id) pairs for a bounded time and count, and a retried
 * XADD with the same pair returns the original entry instead of appending a duplicate.
 */
export class IdempotentProducerTable {
  private readonly seen = new Map<string, { entryId: string; at: number }>();
  private readonly durationMs: number;
  private readonly maxSize: number;
  constructor(durationMs: number, maxSize: number) {
    this.durationMs = durationMs;
    this.maxSize = maxSize;
  }
  add(
    stream: Stream,
    producer: string,
    msgId: string,
    fields: Record<string, string>,
  ): { id: string; duplicate: boolean } {
    const key = `${producer}\u0000${msgId}`;
    for (const [k, v] of this.seen) if (stream.now - v.at > this.durationMs) this.seen.delete(k);
    const hit = this.seen.get(key);
    if (hit) return { id: hit.entryId, duplicate: true };
    const id = stream.xadd(fields);
    this.seen.set(key, { entryId: id, at: stream.now });
    while (this.seen.size > this.maxSize) this.seen.delete(this.seen.keys().next().value!);
    return { id, duplicate: false };
  }
}

// ---------------------------------------------------------------------------------------------
// Reliable queue with lists: BLMOVE queue processing:<worker> RIGHT LEFT, then LREM on success
// ---------------------------------------------------------------------------------------------

export class ListQueue {
  lists = new Map<string, string[]>();
  private l(name: string): string[] {
    if (!this.lists.has(name)) this.lists.set(name, []);
    return this.lists.get(name)!;
  }
  lpush(name: string, v: string): void {
    this.l(name).unshift(v);
  }
  /** Atomic move of the tail of `src` to the head of `dst` (LMOVE src dst RIGHT LEFT). */
  lmove(src: string, dst: string): string | null {
    const v = this.l(src).pop();
    if (v === undefined) return null;
    this.l(dst).unshift(v);
    return v;
  }
  /** Plain RPOP: the item exists only in the worker's memory afterwards. */
  rpop(src: string): string | null {
    return this.l(src).pop() ?? null;
  }
  lrem(name: string, v: string): number {
    const list = this.l(name);
    const i = list.indexOf(v);
    if (i < 0) return 0;
    list.splice(i, 1);
    return 1;
  }
  len(name: string): number {
    return this.l(name).length;
  }
}

// ---------------------------------------------------------------------------------------------
// Pub/Sub output buffer limit: client-output-buffer-limit pubsub <hard> <soft> <soft-seconds>
// ---------------------------------------------------------------------------------------------

export interface OutputBufferLimit {
  hard: number;
  soft: number;
  softSeconds: number;
}

/**
 * Feed (time, bufferedBytes) samples for one slow subscriber; returns the time at which the
 * server disconnects it, or null. Hard limit: immediately. Soft limit: when continuously above
 * it for softSeconds.
 */
export function disconnectTime(
  samples: Array<[number, number]>,
  lim: OutputBufferLimit,
): number | null {
  let softSince: number | null = null;
  for (const [t, bytes] of samples) {
    if (lim.hard > 0 && bytes >= lim.hard) return t;
    if (lim.soft > 0 && bytes >= lim.soft) {
      softSince ??= t;
      if (t - softSince >= lim.softSeconds) return t;
    } else softSince = null;
  }
  return null;
}
