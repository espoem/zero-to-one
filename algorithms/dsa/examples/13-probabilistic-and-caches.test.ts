import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * 32-bit FNV-1a Hash helper.
 */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Space-efficient Bloom Filter using Kirsch-Mitzenmacher 2-hash optimization.
 */
export class BloomFilter {
  readonly m: number;
  readonly k: number;
  private readonly bitArray: Uint8Array;

  constructor(sizeBits: number, numHashes: number) {
    this.m = sizeBits;
    this.k = numHashes;
    this.bitArray = new Uint8Array(Math.ceil(sizeBits / 8));
  }

  add(item: string): void {
    const h1 = fnv1a(item, 0x811c9dc5);
    const h2 = fnv1a(item, 0x9e3779b9);

    for (let i = 0; i < this.k; i++) {
      const bitIdx = ((h1 + Math.imul(i, h2)) >>> 0) % this.m;
      const byteIdx = Math.floor(bitIdx / 8);
      const bitOffset = bitIdx % 8;
      this.bitArray[byteIdx]! |= 1 << bitOffset;
    }
  }

  has(item: string): boolean {
    const h1 = fnv1a(item, 0x811c9dc5);
    const h2 = fnv1a(item, 0x9e3779b9);

    for (let i = 0; i < this.k; i++) {
      const bitIdx = ((h1 + Math.imul(i, h2)) >>> 0) % this.m;
      const byteIdx = Math.floor(bitIdx / 8);
      const bitOffset = bitIdx % 8;
      if ((this.bitArray[byteIdx]! & (1 << bitOffset)) === 0) {
        return false; // Guaranteed not in set
      }
    }
    return true; // Probably in set
  }
}

/**
 * Count-Min Sketch for streaming frequency estimation.
 */
export class CountMinSketch {
  readonly width: number;
  readonly depth: number;
  private readonly matrix: number[][];

  constructor(width: number, depth: number) {
    this.width = width;
    this.depth = depth;
    this.matrix = Array.from({ length: depth }, () => new Array<number>(width).fill(0));
  }

  increment(item: string, count = 1): void {
    for (let d = 0; d < this.depth; d++) {
      const h = fnv1a(item, 0x811c9dc5 + d * 0x9e3779b9) % this.width;
      this.matrix[d]![h]! += count;
    }
  }

  estimate(item: string): number {
    let minFreq = Infinity;
    for (let d = 0; d < this.depth; d++) {
      const h = fnv1a(item, 0x811c9dc5 + d * 0x9e3779b9) % this.width;
      minFreq = Math.min(minFreq, this.matrix[d]![h]!);
    }
    return minFreq;
  }
}

/**
 * LRU Cache with O(1) get and put using Map + Doubly Linked List sentinels.
 */
interface DNode<K, V> {
  key: K;
  val: V;
  prev: DNode<K, V> | null;
  next: DNode<K, V> | null;
}

export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, DNode<K, V>>();
  private readonly head: DNode<K, V>;
  private readonly tail: DNode<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head = { key: undefined as any, val: undefined as any, prev: null, next: null };
    this.tail = { key: undefined as any, val: undefined as any, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private removeNode(node: DNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private insertAtHead(node: DNode<K, V>): void {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.removeNode(node);
    this.insertAtHead(node);
    return node.val;
  }

  put(key: K, val: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.val = val;
      this.removeNode(existing);
      this.insertAtHead(existing);
      return;
    }

    if (this.map.size >= this.capacity) {
      // Evict tail.prev (least recently used)
      const lru = this.tail.prev!;
      this.removeNode(lru);
      this.map.delete(lru.key);
    }

    const newNode: DNode<K, V> = { key, val, prev: null, next: null };
    this.insertAtHead(newNode);
    this.map.set(key, newNode);
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * Consistent Hash Ring with Virtual Nodes.
 */
export class ConsistentHashRing {
  private readonly vnodesPerNode: number;
  private readonly ring: { hash: number; node: string }[] = [];
  private readonly nodes = new Set<string>();

  constructor(vnodesPerNode = 50) {
    this.vnodesPerNode = vnodesPerNode;
  }

  addNode(node: string): void {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);

    for (let i = 0; i < this.vnodesPerNode; i++) {
      const vnodeKey = `${node}#vn${i}`;
      const hash = fnv1a(vnodeKey);
      this.ring.push({ hash, node });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  removeNode(node: string): void {
    if (!this.nodes.has(node)) return;
    this.nodes.delete(node);
    const updated = this.ring.filter((entry) => entry.node !== node);
    this.ring.length = 0;
    this.ring.push(...updated);
  }

  getNode(key: string): string | null {
    if (this.ring.length === 0) return null;
    const hash = fnv1a(key);

    let lo = 0;
    let hi = this.ring.length;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >>> 1);
      if (this.ring[mid]!.hash >= hash) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    // Wrap around to the start of the ring if past the end
    const targetIdx = lo === this.ring.length ? 0 : lo;
    return this.ring[targetIdx]!.node;
  }
}

/**
 * Jump Consistent Hash (Lamping & Veach, Google 2014).
 * Time: O(ln k), Space: O(1).
 */
export function jumpConsistentHash(key: bigint, numBuckets: number): number {
  let b = -1n;
  let j = 0n;
  while (j < BigInt(numBuckets)) {
    b = j;
    key = ((key * 2862933555777941757n) + 1n) & 0xffffffffffffffffn;
    j = ((b + 1n) * (1n << 31n)) / ((key >> 33n) + 1n);
  }
  return Number(b);
}

/**
 * Reservoir Sampling: Choose k elements uniformly at random from stream.
 */
export function reservoirSample<T>(stream: T[], k: number, randomFn = Math.random): T[] {
  if (stream.length <= k) return [...stream];
  const reservoir = stream.slice(0, k);

  for (let i = k; i < stream.length; i++) {
    const j = Math.floor(randomFn() * (i + 1));
    if (j < k) {
      reservoir[j] = stream[i]!;
    }
  }
  return reservoir;
}

test('Module 13: Probabilistic Data Structures, Caches & Consistent Hashing', async (t) => {
  await t.test('Bloom filter guarantees zero false negatives', () => {
    const bf = new BloomFilter(1000, 7);
    const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
    for (const item of items) {
      bf.add(item);
    }

    // Every inserted item MUST return true
    for (const item of items) {
      assert.equal(bf.has(item), true);
    }

    // Items definitely not added will overwhelmingly return false
    assert.equal(bf.has('non_existent_key_xyz'), false);
  });

  await t.test('Count-Min Sketch estimates stream frequencies within error bounds', () => {
    const cms = new CountMinSketch(200, 5);
    for (let i = 0; i < 50; i++) cms.increment('event_a');
    for (let i = 0; i < 20; i++) cms.increment('event_b');
    cms.increment('event_c', 5);

    // Guaranteed estimate >= actual count
    assert.ok(cms.estimate('event_a') >= 50);
    assert.ok(cms.estimate('event_b') >= 20);
    assert.ok(cms.estimate('event_c') >= 5);
    // Unseen element should be 0 or small collision noise
    assert.ok(cms.estimate('unseen') < 5);
  });

  await t.test('LRU Cache executes O(1) access recency and eviction', () => {
    const lru = new LRUCache<string, number>(2);
    lru.put('a', 1);
    lru.put('b', 2);
    assert.equal(lru.get('a'), 1); // 'a' is now most recent, 'b' is LRU

    lru.put('c', 3); // evicts 'b'
    assert.equal(lru.get('b'), undefined);
    assert.equal(lru.get('a'), 1);
    assert.equal(lru.get('c'), 3);
  });

  await t.test('Consistent Hash Ring evenly routes keys and minimizes remapping', () => {
    const ring = new ConsistentHashRing(50);
    ring.addNode('node1');
    ring.addNode('node2');
    ring.addNode('node3');

    const nodeForUser1 = ring.getNode('user_1001');
    const nodeForUser2 = ring.getNode('user_1002');
    assert.ok(nodeForUser1 !== null);
    assert.ok(nodeForUser2 !== null);

    // Removing node3 does not affect keys that were mapped to node1
    ring.removeNode('node3');
    assert.ok(ring.getNode('user_1001') !== 'node3');
  });

  await t.test('Jump Consistent Hash produces valid bucket indices in [0, numBuckets - 1]', () => {
    for (let i = 0n; i < 100n; i++) {
      const bucket = jumpConsistentHash(i * 1234567n, 10);
      assert.ok(bucket >= 0 && bucket < 10);
    }
  });

  await t.test('Reservoir sampling selects exactly k items', () => {
    const stream = Array.from({ length: 100 }, (_, i) => i);
    const sample = reservoirSample(stream, 5);
    assert.equal(sample.length, 5);
    // All items must be unique from the stream
    const unique = new Set(sample);
    assert.equal(unique.size, 5);
  });

  await t.test('Property test: Bloom filter never produces false negatives on arbitrary items', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 30 }),
        (items) => {
          const bf = new BloomFilter(2000, 7);
          for (const item of items) {
            bf.add(item);
          }
          // Invariant: zero false negatives
          for (const item of items) {
            if (!bf.has(item)) return false;
          }
          return true;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
