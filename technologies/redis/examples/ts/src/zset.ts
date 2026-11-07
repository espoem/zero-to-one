// A sorted set the way Redis builds it (t_zset.c): a skiplist whose forward links carry a
// *span* (how many nodes the link skips), plus a hash map member -> score.
// The span is what makes ZRANK and ZRANGE by index O(log N) instead of O(N).
// Skip lists in general are owned by algorithms/dsa; this file is the Redis-specific realisation.

export const ZSKIPLIST_MAXLEVEL = 32;
export const ZSKIPLIST_P = 0.25;

interface Level {
  forward: Node | null;
  span: number;
}
interface Node {
  member: string;
  score: number;
  backward: Node | null;
  level: Level[];
}

/** Redis orders by score, then by member bytes (memcmp). */
export function zcmp(aScore: number, aMember: string, bScore: number, bMember: string): number {
  if (aScore !== bScore) return aScore < bScore ? -1 : 1;
  const a = Buffer.from(aMember);
  const b = Buffer.from(bMember);
  return Buffer.compare(a, b);
}

export class SortedSet {
  private readonly header: Node;
  private tail: Node | null = null;
  private level = 1;
  private readonly dict = new Map<string, number>();
  private readonly rnd: () => number;
  /** Number of forward hops taken by the last rank() call (instrumentation for tests). */
  lastRankHops = 0;

  constructor(rnd: () => number = Math.random) {
    this.rnd = rnd;
    this.header = {
      member: '',
      score: -Infinity,
      backward: null,
      level: Array.from({ length: ZSKIPLIST_MAXLEVEL }, () => ({ forward: null, span: 0 })),
    };
  }

  get size(): number {
    return this.dict.size;
  }

  private randomLevel(): number {
    let lvl = 1;
    while (this.rnd() < ZSKIPLIST_P && lvl < ZSKIPLIST_MAXLEVEL) lvl++;
    return lvl;
  }

  /** ZADD semantics: returns true if the member is new. Updating a score re-positions it. */
  add(member: string, score: number): boolean {
    if (Number.isNaN(score)) throw new Error('ERR resulting score is not a number (NaN)');
    const old = this.dict.get(member);
    if (old !== undefined) {
      if (old === score) return false;
      this.deleteNode(member, old);
      this.insert(member, score);
      this.dict.set(member, score);
      return false;
    }
    this.insert(member, score);
    this.dict.set(member, score);
    return true;
  }

  remove(member: string): boolean {
    const s = this.dict.get(member);
    if (s === undefined) return false;
    this.deleteNode(member, s);
    this.dict.delete(member);
    return true;
  }

  score(member: string): number | undefined {
    return this.dict.get(member);
  }

  private insert(member: string, score: number): void {
    const update: Node[] = new Array(ZSKIPLIST_MAXLEVEL);
    const rank: number[] = new Array(ZSKIPLIST_MAXLEVEL).fill(0);
    let x = this.header;
    for (let i = this.level - 1; i >= 0; i--) {
      rank[i] = i === this.level - 1 ? 0 : rank[i + 1]!;
      while (
        x.level[i]!.forward &&
        zcmp(x.level[i]!.forward!.score, x.level[i]!.forward!.member, score, member) < 0
      ) {
        rank[i]! += x.level[i]!.span;
        x = x.level[i]!.forward!;
      }
      update[i] = x;
    }
    const lvl = this.randomLevel();
    if (lvl > this.level) {
      for (let i = this.level; i < lvl; i++) {
        rank[i] = 0;
        update[i] = this.header;
        this.header.level[i]!.span = this.dict.size; // size before insert
      }
      this.level = lvl;
    }
    const node: Node = {
      member,
      score,
      backward: null,
      level: Array.from({ length: lvl }, () => ({ forward: null, span: 0 })),
    };
    for (let i = 0; i < lvl; i++) {
      const u = update[i]!;
      node.level[i]!.forward = u.level[i]!.forward;
      u.level[i]!.forward = node;
      // Invariant: span(u -> node) + span(node -> old forward) == old span(u -> old forward) + 1
      node.level[i]!.span = u.level[i]!.span - (rank[0]! - rank[i]!);
      u.level[i]!.span = rank[0]! - rank[i]! + 1;
    }
    for (let i = lvl; i < this.level; i++) update[i]!.level[i]!.span++;
    node.backward = update[0] === this.header ? null : update[0]!;
    if (node.level[0]!.forward) node.level[0]!.forward.backward = node;
    else this.tail = node;
  }

  private deleteNode(member: string, score: number): void {
    const update: Node[] = new Array(ZSKIPLIST_MAXLEVEL);
    let x = this.header;
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.level[i]!.forward &&
        zcmp(x.level[i]!.forward!.score, x.level[i]!.forward!.member, score, member) < 0
      ) {
        x = x.level[i]!.forward!;
      }
      update[i] = x;
    }
    const target = x.level[0]!.forward;
    if (!target || target.member !== member) throw new Error('corrupt skiplist');
    for (let i = 0; i < this.level; i++) {
      const u = update[i]!;
      if (u.level[i]!.forward === target) {
        u.level[i]!.span += target.level[i]!.span - 1;
        u.level[i]!.forward = target.level[i]!.forward;
      } else {
        u.level[i]!.span -= 1;
      }
    }
    if (target.level[0]!.forward) target.level[0]!.forward.backward = target.backward;
    else this.tail = target.backward;
    while (this.level > 1 && this.header.level[this.level - 1]!.forward === null) this.level--;
  }

  /** ZRANK: 0-based rank, found by summing spans on the search path. O(log N) expected. */
  rank(member: string): number | undefined {
    const score = this.dict.get(member);
    if (score === undefined) return undefined;
    let r = 0;
    let x = this.header;
    this.lastRankHops = 0;
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.level[i]!.forward &&
        zcmp(x.level[i]!.forward!.score, x.level[i]!.forward!.member, score, member) <= 0
      ) {
        this.lastRankHops++;
        r += x.level[i]!.span;
        x = x.level[i]!.forward!;
      }
      if (x.member === member && x !== this.header) return r - 1;
    }
    return undefined;
  }

  /** Element at a 0-based rank (ZRANGE key i i). O(log N) expected. */
  byRank(rank: number): { member: string; score: number } | undefined {
    if (rank < 0 || rank >= this.size) return undefined;
    let traversed = 0;
    let x = this.header;
    const target = rank + 1;
    for (let i = this.level - 1; i >= 0; i--) {
      while (x.level[i]!.forward && traversed + x.level[i]!.span <= target) {
        traversed += x.level[i]!.span;
        x = x.level[i]!.forward!;
      }
      if (traversed === target) return { member: x.member, score: x.score };
    }
    return undefined;
  }

  /** ZRANGE start stop (inclusive, negative indexes count from the end, like Redis). */
  range(start: number, stop: number): string[] {
    const n = this.size;
    if (start < 0) start = Math.max(0, n + start);
    if (stop < 0) stop = n + stop;
    if (stop >= n) stop = n - 1;
    if (start > stop || start >= n) return [];
    const out: string[] = [];
    let node = this.byRankNode(start);
    for (let i = start; i <= stop && node; i++) {
      out.push(node.member);
      node = node.level[0]!.forward;
    }
    return out;
  }

  private byRankNode(rank: number): Node | null {
    let traversed = 0;
    let x = this.header;
    for (let i = this.level - 1; i >= 0; i--) {
      while (x.level[i]!.forward && traversed + x.level[i]!.span <= rank + 1) {
        traversed += x.level[i]!.span;
        x = x.level[i]!.forward!;
      }
      if (traversed === rank + 1) return x;
    }
    return null;
  }

  /** ZRANGEBYSCORE min max (inclusive). O(log N + M). */
  rangeByScore(min: number, max: number): string[] {
    let x = this.header;
    for (let i = this.level - 1; i >= 0; i--) {
      while (x.level[i]!.forward && x.level[i]!.forward!.score < min) x = x.level[i]!.forward!;
    }
    let n = x.level[0]!.forward;
    const out: string[] = [];
    while (n && n.score <= max) {
      out.push(n.member);
      n = n.level[0]!.forward;
    }
    return out;
  }

  /** Reverse walk via backward pointers (ZREVRANGE uses these). */
  reverse(): string[] {
    const out: string[] = [];
    for (let n = this.tail; n; n = n.backward) out.push(n.member);
    return out;
  }

  /** Check the structural invariants; used by property tests. */
  checkInvariants(): void {
    for (let i = 0; i < this.level; i++) {
      let x = this.header;
      let pos = 0;
      while (x.level[i]!.forward) {
        const next = x.level[i]!.forward!;
        // position of `next` on level 0 must equal pos + span
        pos += x.level[i]!.span;
        if (this.rank(next.member) !== pos - 1)
          throw new Error(`span invariant broken at level ${i}`);
        x = next;
      }
    }
  }
}

/** Deterministic PRNG (mulberry32) for reproducible skiplist shapes in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
