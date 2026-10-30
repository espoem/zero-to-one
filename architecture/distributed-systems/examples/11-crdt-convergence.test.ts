import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Grow-Only Counter (G-Counter).
 */
export class GCounter {
  readonly nodeId: string;
  readonly counts = new Map<string, number>();

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  inc(val = 1): void {
    const cur = this.counts.get(this.nodeId) ?? 0;
    this.counts.set(this.nodeId, cur + val);
  }

  value(): number {
    let sum = 0;
    for (const v of this.counts.values()) sum += v;
    return sum;
  }

  static merge(a: GCounter, b: GCounter): GCounter {
    const res = new GCounter('merged');
    const allKeys = new Set([...a.counts.keys(), ...b.counts.keys()]);
    for (const k of allKeys) {
      const vA = a.counts.get(k) ?? 0;
      const vB = b.counts.get(k) ?? 0;
      res.counts.set(k, Math.max(vA, vB));
    }
    return res;
  }
}

/**
 * Observed-Remove Set (OR-Set) with Add-Wins semantics.
 */
export class ORSet<T> {
  // Map element -> Set of unique tags
  readonly addSet = new Map<T, Set<string>>();
  readonly tombstoneSet = new Set<string>();

  add(elem: T, tag: string): void {
    let tags = this.addSet.get(elem);
    if (!tags) {
      tags = new Set();
      this.addSet.set(elem, tags);
    }
    tags.add(tag);
  }

  remove(elem: T): void {
    const tags = this.addSet.get(elem);
    if (tags) {
      for (const tag of tags) {
        this.tombstoneSet.add(tag);
      }
    }
  }

  has(elem: T): boolean {
    const tags = this.addSet.get(elem);
    if (!tags) return false;
    for (const tag of tags) {
      if (!this.tombstoneSet.has(tag)) return true;
    }
    return false;
  }

  merge(other: ORSet<T>): void {
    // Union addSets
    for (const [elem, tags] of other.addSet.entries()) {
      let myTags = this.addSet.get(elem);
      if (!myTags) {
        myTags = new Set();
        this.addSet.set(elem, myTags);
      }
      for (const t of tags) myTags.add(t);
    }
    // Union tombstones
    for (const t of other.tombstoneSet) {
      this.tombstoneSet.add(t);
    }
  }
}

test('Module 11: CRDT Convergence & Strong Eventual Consistency', async (t) => {
  await t.test('G-Counter merges deterministically regardless of message delivery order', () => {
    const n1 = new GCounter('node1');
    const n2 = new GCounter('node2');

    n1.inc(5);
    n2.inc(3);

    // Merge n1 into n2 and n2 into n1
    const m1 = GCounter.merge(n1, n2);
    const m2 = GCounter.merge(n2, n1);

    // Commutativity: merge(a, b) === merge(b, a)
    assert.equal(m1.value(), 8);
    assert.equal(m2.value(), 8);

    // Idempotence: merge(m, m) === m
    const mIdempotent = GCounter.merge(m1, m1);
    assert.equal(mIdempotent.value(), 8);
  });

  await t.test('OR-Set guarantees Add-Wins semantics during concurrent add/remove', () => {
    const s1 = new ORSet<string>();
    const s2 = new ORSet<string>();

    // Initial state: Item 'apple' added with tag 't1' on s1
    s1.add('apple', 'tag_1');
    s2.merge(s1);
    assert.equal(s2.has('apple'), true);

    // Concurrently:
    // Replica 1 removes 'apple' (observes and marks 'tag_1' as tombstone)
    s1.remove('apple');
    // Replica 2 adds 'apple' again with new tag 'tag_2'
    s2.add('apple', 'tag_2');

    // Merge both replicas
    s1.merge(s2);
    s2.merge(s1);

    // Add wins! 'tag_2' was not observed by s1's remove, so 'apple' is preserved
    assert.equal(s1.has('apple'), true);
    assert.equal(s2.has('apple'), true);
  });

  await t.test('Property test: G-Counter merge is commutative and associative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (v1, v2, v3) => {
          const a = new GCounter('A');
          const b = new GCounter('B');
          const c = new GCounter('C');

          a.inc(v1);
          b.inc(v2);
          c.inc(v3);

          // Commutativity
          const ab = GCounter.merge(a, b);
          const ba = GCounter.merge(b, a);
          assert.equal(ab.value(), ba.value());

          // Associativity: (A join B) join C === A join (B join C)
          const ab_c = GCounter.merge(ab, c);
          const bc = GCounter.merge(b, c);
          const a_bc = GCounter.merge(a, bc);
          assert.equal(ab_c.value(), a_bc.value());
          return true;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
