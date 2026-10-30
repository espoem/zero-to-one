import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * B+Tree Implementation:
 * Order M: Maximum M children per internal node, maximum M-1 keys per node.
 * Leaf nodes maintain a right-sibling pointer for sequential range scans.
 */
interface BPlusNode<K, V> {
  isLeaf: boolean;
  keys: K[];
}

interface InternalNode<K, V> extends BPlusNode<K, V> {
  isLeaf: false;
  children: BPlusNode<K, V>[];
}

interface LeafNode<K, V> extends BPlusNode<K, V> {
  isLeaf: true;
  values: V[];
  next: LeafNode<K, V> | null;
}

export class BPlusTree<K extends string | number, V> {
  readonly order: number;
  root: BPlusNode<K, V>;

  constructor(order = 4) {
    assert(order >= 3, 'B+Tree order must be at least 3');
    this.order = order;
    this.root = { isLeaf: true, keys: [], values: [], next: null } as LeafNode<K, V>;
  }

  get(key: K): V | null {
    let curr = this.root;
    while (!curr.isLeaf) {
      const internal = curr as InternalNode<K, V>;
      let idx = 0;
      while (idx < internal.keys.length && key >= internal.keys[idx]!) {
        idx++;
      }
      curr = internal.children[idx]!;
    }

    const leaf = curr as LeafNode<K, V>;
    const idx = leaf.keys.indexOf(key);
    return idx !== -1 ? leaf.values[idx]! : null;
  }

  insert(key: K, value: V): void {
    const split = this.insertInternal(this.root, key, value);
    if (split) {
      // Root split
      const newRoot: InternalNode<K, V> = {
        isLeaf: false,
        keys: [split.promotedKey],
        children: [this.root, split.newNode],
      };
      this.root = newRoot;
    }
  }

  private insertInternal(
    node: BPlusNode<K, V>,
    key: K,
    value: V
  ): { promotedKey: K; newNode: BPlusNode<K, V> } | null {
    if (node.isLeaf) {
      const leaf = node as LeafNode<K, V>;
      let idx = 0;
      while (idx < leaf.keys.length && leaf.keys[idx]! < key) {
        idx++;
      }

      if (idx < leaf.keys.length && leaf.keys[idx] === key) {
        // Update existing key
        leaf.values[idx] = value;
        return null;
      }

      leaf.keys.splice(idx, 0, key);
      leaf.values.splice(idx, 0, value);

      if (leaf.keys.length < this.order) {
        return null;
      }

      // Split leaf
      const mid = Math.floor(leaf.keys.length / 2);
      const rightLeaf: LeafNode<K, V> = {
        isLeaf: true,
        keys: leaf.keys.splice(mid),
        values: leaf.values.splice(mid),
        next: leaf.next,
      };
      leaf.next = rightLeaf;

      return { promotedKey: rightLeaf.keys[0]!, newNode: rightLeaf };
    } else {
      const internal = node as InternalNode<K, V>;
      let idx = 0;
      while (idx < internal.keys.length && key >= internal.keys[idx]!) {
        idx++;
      }

      const childSplit = this.insertInternal(internal.children[idx]!, key, value);
      if (!childSplit) return null;

      internal.keys.splice(idx, 0, childSplit.promotedKey);
      internal.children.splice(idx + 1, 0, childSplit.newNode);

      if (internal.children.length <= this.order) {
        return null;
      }

      // Split internal node
      const mid = Math.floor(internal.keys.length / 2);
      const promotedKey = internal.keys[mid]!;

      const rightInternal: InternalNode<K, V> = {
        isLeaf: false,
        keys: internal.keys.splice(mid + 1),
        children: internal.children.splice(mid + 1),
      };
      internal.keys.pop(); // Remove promoted key from left node

      return { promotedKey, newNode: rightInternal };
    }
  }

  rangeScan(startKey: K, endKey: K): { key: K; value: V }[] {
    let curr = this.root;
    while (!curr.isLeaf) {
      const internal = curr as InternalNode<K, V>;
      let idx = 0;
      while (idx < internal.keys.length && startKey >= internal.keys[idx]!) {
        idx++;
      }
      curr = internal.children[idx]!;
    }

    const results: { key: K; value: V }[] = [];
    let leaf: LeafNode<K, V> | null = curr as LeafNode<K, V>;

    while (leaf !== null) {
      for (let i = 0; i < leaf.keys.length; i++) {
        const k = leaf.keys[i]!;
        if (k >= startKey && k <= endKey) {
          results.push({ key: k, value: leaf.values[i]! });
        } else if (k > endKey) {
          return results;
        }
      }
      leaf = leaf.next;
    }

    return results;
  }
}

describe('B+Tree Indexing Engine', () => {
  it('correctly inserts and retrieves point keys across internal node splits', () => {
    const tree = new BPlusTree<number, string>(3);
    const entries: [number, string][] = [
      [10, 'ten'],
      [20, 'twenty'],
      [5, 'five'],
      [15, 'fifteen'],
      [25, 'twenty-five'],
      [30, 'thirty'],
    ];

    for (const [k, v] of entries) {
      tree.insert(k, v);
    }

    for (const [k, v] of entries) {
      assert.equal(tree.get(k), v);
    }
    assert.equal(tree.get(999), null);
  });

  it('executes efficient sequential range scans via leaf sibling pointers', () => {
    const tree = new BPlusTree<number, number>(4);
    for (let i = 1; i <= 50; i++) {
      tree.insert(i, i * 10);
    }

    const range = tree.rangeScan(15, 25);
    assert.equal(range.length, 11);
    assert.equal(range[0]?.key, 15);
    assert.equal(range[0]?.value, 150);
    assert.equal(range[10]?.key, 25);
    assert.equal(range[10]?.value, 250);
  });

  it('property-based: arbitrary randomized insertions maintain sorted order and lookup consistency', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 10, maxLength: 100 }),
        (keys) => {
          const tree = new BPlusTree<number, number>(4);
          const map = new Map<number, number>();

          for (const k of keys) {
            tree.insert(k, k * 2);
            map.set(k, k * 2);
          }

          for (const [k, v] of map.entries()) {
            assert.equal(tree.get(k), v);
          }

          // Verify range scan across entire bounds matches sorted map entries
          const allRange = tree.rangeScan(-1000, 1000);
          const expectedSorted = Array.from(map.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([key, value]) => ({ key, value }));

          assert.deepEqual(allRange, expectedSorted);
        }
      )
    );
  });
});
