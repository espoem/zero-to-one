import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Simple Bloom Filter for LSM SSTables
 */
class SimpleBloomFilter {
  readonly bits: Uint8Array;
  readonly size: number;

  constructor(size = 256) {
    this.size = size;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  private hash1(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return Math.abs(h) % this.size;
  }

  private hash2(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % this.size;
  }

  add(key: string): void {
    const h1 = this.hash1(key);
    const h2 = this.hash2(key);
    this.bits[h1 >> 3]! |= 1 << (h1 & 7);
    this.bits[h2 >> 3]! |= 1 << (h2 & 7);
  }

  mightContain(key: string): boolean {
    const h1 = this.hash1(key);
    const h2 = this.hash2(key);
    const bit1 = (this.bits[h1 >> 3]! & (1 << (h1 & 7))) !== 0;
    const bit2 = (this.bits[h2 >> 3]! & (1 << (h2 & 7))) !== 0;
    return bit1 && bit2;
  }
}

interface SSTable {
  entries: { key: string; value: string | null }[]; // null = tombstone
  filter: SimpleBloomFilter;
}

export class MiniLSM {
  readonly memtableThreshold: number;
  memtable: Map<string, string | null>;
  sstables: SSTable[];

  constructor(memtableThreshold = 5) {
    this.memtableThreshold = memtableThreshold;
    this.memtable = new Map();
    this.sstables = [];
  }

  put(key: string, value: string): void {
    this.memtable.set(key, value);
    this.checkFlush();
  }

  delete(key: string): void {
    this.memtable.set(key, null); // Append tombstone
    this.checkFlush();
  }

  private checkFlush(): void {
    if (this.memtable.size >= this.memtableThreshold) {
      this.flush();
    }
  }

  flush(): void {
    if (this.memtable.size === 0) return;

    const sortedEntries = Array.from(this.memtable.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, value }));

    const filter = new SimpleBloomFilter();
    for (const { key } of sortedEntries) {
      filter.add(key);
    }

    // Newest SSTable is unshifted to front of list
    this.sstables.unshift({ entries: sortedEntries, filter });
    this.memtable.clear();
  }

  get(key: string): string | null {
    // 1. Check active memtable
    if (this.memtable.has(key)) {
      return this.memtable.get(key)!;
    }

    // 2. Check SSTables from newest to oldest
    for (const sstable of this.sstables) {
      if (!sstable.filter.mightContain(key)) {
        continue; // Bloom filter skips disk read!
      }

      // Binary search inside SSTable
      let left = 0;
      let right = sstable.entries.length - 1;
      while (left <= right) {
        const mid = (left + right) >> 1;
        const entry = sstable.entries[mid]!;
        const cmp = key.localeCompare(entry.key);
        if (cmp === 0) {
          return entry.value; // May be null (tombstone)
        } else if (cmp < 0) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }
    }

    return null; // Not found
  }

  compact(): void {
    if (this.sstables.length < 2) return;

    // Merge-sort all SSTables from oldest to newest into single combined map
    const merged = new Map<string, string | null>();

    // Process from oldest to newest so newer updates overwrite older ones
    for (let i = this.sstables.length - 1; i >= 0; i--) {
      for (const entry of this.sstables[i]!.entries) {
        merged.set(entry.key, entry.value);
      }
    }

    // Discard tombstones during major compaction
    const compactedEntries: { key: string; value: string | null }[] = [];
    const filter = new SimpleBloomFilter();

    for (const [key, value] of Array.from(merged.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (value !== null) {
        compactedEntries.push({ key, value });
        filter.add(key);
      }
    }

    this.sstables = [{ entries: compactedEntries, filter }];
  }
}

describe('Log-Structured Merge-Tree (LSM)', () => {
  it('correctly handles memtable flush, tombstones, and point lookups', () => {
    const lsm = new MiniLSM(3);

    lsm.put('k1', 'v1');
    lsm.put('k2', 'v2');
    lsm.put('k3', 'v3'); // Triggers flush to SSTable 1

    assert.equal(lsm.memtable.size, 0);
    assert.equal(lsm.sstables.length, 1);
    assert.equal(lsm.get('k1'), 'v1');
    assert.equal(lsm.get('k2'), 'v2');
    assert.equal(lsm.get('k3'), 'v3');

    // Update k1 and delete k2
    lsm.put('k1', 'v1_updated');
    lsm.delete('k2');
    lsm.put('k4', 'v4'); // Triggers flush to SSTable 2

    assert.equal(lsm.sstables.length, 2);
    assert.equal(lsm.get('k1'), 'v1_updated');
    assert.equal(lsm.get('k2'), null); // Correctly resolved to null via tombstone
    assert.equal(lsm.get('k4'), 'v4');
  });

  it('purges dead tombstones and merges files during compaction', () => {
    const lsm = new MiniLSM(2);
    lsm.put('a', 'apple');
    lsm.put('b', 'banana'); // SSTable 1

    lsm.delete('b');
    lsm.put('c', 'cherry'); // SSTable 2

    assert.equal(lsm.sstables.length, 2);
    assert.equal(lsm.get('b'), null);

    lsm.compact();

    assert.equal(lsm.sstables.length, 1);
    const compacted = lsm.sstables[0]!.entries;
    // 'b' tombstone purged, only active keys 'a' and 'c' remain
    assert.deepEqual(compacted, [
      { key: 'a', value: 'apple' },
      { key: 'c', value: 'cherry' },
    ]);
  });

  it('property-based: arbitrary series of puts and deletes match reference Map', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom('put', 'delete'),
            key: fc.stringMatching(/^[a-z]{1,3}$/),
            val: fc.stringMatching(/^[A-Z]{1,5}$/),
          }),
          { minLength: 10, maxLength: 60 }
        ),
        (operations) => {
          const lsm = new MiniLSM(4);
          const model = new Map<string, string>();

          for (const op of operations) {
            if (op.op === 'put') {
              lsm.put(op.key, op.val);
              model.set(op.key, op.val);
            } else {
              lsm.delete(op.key);
              model.delete(op.key);
            }
          }

          // Force flush and compaction
          lsm.flush();
          lsm.compact();

          // Assert all model keys match
          for (const [k, v] of model.entries()) {
            assert.equal(lsm.get(k), v);
          }
        }
      )
    );
  });
});
