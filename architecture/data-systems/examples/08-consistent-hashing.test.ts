import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export class ConsistentHashRing {
  readonly vnodes: number;
  private ring: { hash: number; node: string }[] = [];

  constructor(vnodes = 50) {
    this.vnodes = vnodes;
  }

  // FNV-1a 32-bit hash with Murmur3 avalanche mixing
  hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0; // Unsigned 32-bit integer
  }

  addNode(node: string): void {
    for (let i = 0; i < this.vnodes; i++) {
      const vnodeKey = `${node}#vn${i}`;
      const hash = this.hash(vnodeKey);
      this.ring.push({ hash, node });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  removeNode(node: string): void {
    this.ring = this.ring.filter((item) => item.node !== node);
  }

  getNode(key: string): string {
    if (this.ring.length === 0) {
      throw new Error('Ring is empty');
    }

    const keyHash = this.hash(key);

    // Binary search for first node with hash >= keyHash
    let left = 0;
    let right = this.ring.length - 1;
    let resultIdx = 0;

    if (keyHash > this.ring[right]!.hash) {
      // Wrap around to start of ring
      return this.ring[0]!.node;
    }

    while (left <= right) {
      const mid = (left + right) >> 1;
      if (this.ring[mid]!.hash >= keyHash) {
        resultIdx = mid;
        right = mid - 1; // Try to find smaller valid index
      } else {
        left = mid + 1;
      }
    }

    return this.ring[resultIdx]!.node;
  }
}

describe('Consistent Hashing with Virtual Nodes', () => {
  it('distributes keys across physical nodes with balanced variance', () => {
    const ring = new ConsistentHashRing(128);
    const nodes = ['node-A', 'node-B', 'node-C', 'node-D'];
    for (const n of nodes) {
      ring.addNode(n);
    }

    const distribution = new Map<string, number>();
    for (const n of nodes) distribution.set(n, 0);

    const totalKeys = 10000;
    for (let i = 0; i < totalKeys; i++) {
      const target = ring.getNode(`key_${i}`);
      distribution.set(target, distribution.get(target)! + 1);
    }

    const expectedAverage = totalKeys / nodes.length; // 2500 keys per node
    for (const [node, count] of distribution.entries()) {
      // With 128 vnodes and avalanche mixing, distribution is well within 25% of average
      const deviation = Math.abs(count - expectedAverage) / expectedAverage;
      assert(
        deviation < 0.25,
        `Node ${node} has ${count} keys (expected ~${expectedAverage}, deviation: ${(deviation * 100).toFixed(1)}%)`
      );
    }
  });

  it('demonstrates minimal key migration when adding a new node', () => {
    const ring = new ConsistentHashRing(128);
    const initialNodes = ['node-1', 'node-2', 'node-3', 'node-4'];
    for (const n of initialNodes) ring.addNode(n);

    const initialAssignments = new Map<string, string>();
    const totalKeys = 5000;
    for (let i = 0; i < totalKeys; i++) {
      initialAssignments.set(`user_${i}`, ring.getNode(`user_${i}`));
    }

    // Add 5th node
    ring.addNode('node-5');

    let migratedKeys = 0;
    for (let i = 0; i < totalKeys; i++) {
      const key = `user_${i}`;
      const newAssignment = ring.getNode(key);
      if (newAssignment !== initialAssignments.get(key)) {
        migratedKeys++;
        // Any migrated key must have moved to the new node-5!
        assert.equal(newAssignment, 'node-5');
      }
    }

    // In a 4 -> 5 node transition, expected migration is roughly 1/5 = 20%
    const migrationFraction = migratedKeys / totalKeys;
    assert(
      migrationFraction > 0.12 && migrationFraction < 0.28,
      `Migrated fraction was ${(migrationFraction * 100).toFixed(1)}% (expected ~20%)`
    );
  });
});
