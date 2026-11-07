// Redis Cluster key distribution and client routing, after the Cluster specification:
// https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/

export const SLOTS = 16384;

/** CRC-16/XMODEM: poly 0x1021, init 0, no reflection, no final xor. CRC16("123456789") = 0x31C3. */
export function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/**
 * The part of the key that is hashed: if the key contains '{', and a '}' follows it with at
 * least one byte in between, only the bytes between the FIRST '{' and the first '}' after it.
 */
export function hashTag(key: Buffer): Buffer {
  const s = key.indexOf(0x7b); // {
  if (s < 0) return key;
  const e = key.indexOf(0x7d, s + 1); // }
  if (e < 0 || e === s + 1) return key;
  return key.subarray(s + 1, e);
}

export function keySlot(key: string | Buffer): number {
  const b = typeof key === 'string' ? Buffer.from(key) : key;
  return crc16(hashTag(b)) & (SLOTS - 1);
}

/** Multi-key commands, transactions and scripts need every key in one slot. */
export function checkSameSlot(keys: string[]): number {
  const slots = new Set(keys.map((k) => keySlot(k)));
  if (slots.size > 1) throw new Error("CROSSSLOT Keys in request don't hash to the same slot");
  return [...slots][0]!;
}

// ---------------------------------------------------------------------------------------------
// A tiny cluster: nodes own slots; a slot can be migrating from one node to another.
// ---------------------------------------------------------------------------------------------

export class FakeNode {
  readonly data = new Map<string, string>();
  readonly migrating = new Map<number, string>(); // slot -> target node id
  readonly importing = new Map<number, string>(); // slot -> source node id
  readonly id: string;
  private readonly cluster: FakeCluster;
  constructor(id: string, cluster: FakeCluster) {
    this.id = id;
    this.cluster = cluster;
  }
  /** Execute GET/SET for one key, returning a value or a redirection error string. */
  exec(cmd: 'GET' | 'SET', key: string, value?: string, asking = false): string | null {
    const slot = keySlot(key);
    const owner = this.cluster.owner(slot);
    if (owner === this.id) {
      const target = this.migrating.get(slot);
      // Migrating slot: serve keys still here, redirect ASK for keys already moved (or new ones).
      if (target && !this.data.has(key)) return `ASK ${slot} ${target}`;
      return this.apply(cmd, key, value);
    }
    if (this.importing.has(slot) && asking) return this.apply(cmd, key, value);
    return `MOVED ${slot} ${owner}`;
  }
  private apply(cmd: 'GET' | 'SET', key: string, value?: string): string | null {
    if (cmd === 'SET') {
      this.data.set(key, value!);
      return 'OK';
    }
    return this.data.get(key) ?? null;
  }
}

export class FakeCluster {
  readonly nodes = new Map<string, FakeNode>();
  private readonly slotOwner: string[] = new Array(SLOTS);
  constructor(ids: string[]) {
    ids.forEach((id) => this.nodes.set(id, new FakeNode(id, this)));
    const per = Math.ceil(SLOTS / ids.length);
    for (let s = 0; s < SLOTS; s++) this.slotOwner[s] = ids[Math.floor(s / per)]!;
  }
  owner(slot: number): string {
    return this.slotOwner[slot]!;
  }
  /** Final step of a migration: CLUSTER SETSLOT <slot> NODE <target> on both nodes. */
  assign(slot: number, id: string): void {
    this.slotOwner[slot] = id;
    for (const n of this.nodes.values()) {
      n.migrating.delete(slot);
      n.importing.delete(slot);
    }
  }
  /** MIGRATE one key from source to target (atomic per key). */
  migrateKey(key: string, from: string, to: string): void {
    const src = this.nodes.get(from)!;
    const v = src.data.get(key);
    if (v === undefined) return;
    this.nodes.get(to)!.data.set(key, v);
    src.data.delete(key);
  }
}

/** A cluster-aware client: caches slot -> node, follows MOVED (and updates), follows ASK (once). */
export class ClusterClient {
  private readonly map = new Map<number, string>();
  redirects = { moved: 0, ask: 0 };
  private readonly cluster: FakeCluster;
  private readonly seed: string;
  constructor(cluster: FakeCluster, seed: string) {
    this.cluster = cluster;
    this.seed = seed;
  }
  run(cmd: 'GET' | 'SET', key: string, value?: string): string | null {
    const slot = keySlot(key);
    let node = this.map.get(slot) ?? this.seed;
    let asking = false;
    for (let hop = 0; hop < 5; hop++) {
      const r = this.cluster.nodes.get(node)!.exec(cmd, key, value, asking);
      asking = false;
      if (typeof r === 'string' && r.startsWith('MOVED ')) {
        this.redirects.moved++;
        node = r.split(' ')[2]!;
        this.map.set(slot, node); // permanent: update the slot map
        continue;
      }
      if (typeof r === 'string' && r.startsWith('ASK ')) {
        this.redirects.ask++;
        node = r.split(' ')[2]!; // one-off: do NOT update the slot map
        asking = true;
        continue;
      }
      return r;
    }
    throw new Error('too many redirections');
  }
  cachedNode(slot: number): string | undefined {
    return this.map.get(slot);
  }
}

/** Replica election delay from the spec: 500 ms + random(0..500) + rank * 1000 ms. */
export function electionDelayMs(rank: number, rnd: number): number {
  return 500 + Math.floor(rnd * 500) + rank * 1000;
}

/** Slot binding rule: a claim with a higher configEpoch replaces the current owner ("last failover wins"). */
export function resolveSlotOwner(
  current: { node: string; epoch: number },
  claim: { node: string; epoch: number },
) {
  return claim.epoch > current.epoch ? claim : current;
}
