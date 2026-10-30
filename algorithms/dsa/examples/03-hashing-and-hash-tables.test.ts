import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

interface HashEntry<K, V> {
  key: K;
  value: V;
  dib: number; // Distance to Initial Bucket
}

// Robin Hood Open-Addressing Hash Table
export class RobinHoodHashTable<K, V> {
  private table: (HashEntry<K, V> | undefined)[];
  private count = 0;
  private maxLoadFactor = 0.75;

  constructor(initialCapacity = 16) {
    let cap = 1;
    while (cap < initialCapacity) cap <<= 1;
    this.table = new Array(cap);
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.table.length;
  }

  private hash(key: K): number {
    const str = String(key);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) & (this.table.length - 1);
  }

  set(key: K, value: V): void {
    if (this.count >= this.table.length * this.maxLoadFactor) {
      this.resize(this.table.length * 2);
    }

    let slot = this.hash(key);
    let entry: HashEntry<K, V> = { key, value, dib: 0 };

    while (true) {
      const existing = this.table[slot];

      if (!existing) {
        // Empty slot found: place entry
        this.table[slot] = entry;
        this.count++;
        return;
      }

      if (existing.key === key) {
        // Overwrite existing key
        existing.value = value;
        return;
      }

      // Robin Hood eviction: if incoming has traveled further than existing occupant, swap!
      if (entry.dib > existing.dib) {
        const temp = existing;
        this.table[slot] = entry;
        entry = temp;
      }

      slot = (slot + 1) & (this.table.length - 1);
      entry.dib++;
    }
  }

  get(key: K): V | undefined {
    let slot = this.hash(key);
    let dib = 0;

    while (true) {
      const entry = this.table[slot];

      if (!entry) return undefined;
      if (entry.key === key) return entry.value;

      // Robin Hood early exit: if current probe distance exceeds slot's DIB, key CANNOT exist!
      if (dib > entry.dib) return undefined;

      slot = (slot + 1) & (this.table.length - 1);
      dib++;
    }
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    let slot = this.hash(key);
    let dib = 0;

    while (true) {
      const entry = this.table[slot];
      if (!entry) return false;
      if (dib > entry.dib) return false;

      if (entry.key === key) {
        // Backward shift deletion: shift subsequent entries backwards until dib === 0
        this.table[slot] = undefined;
        this.count--;

        let currSlot = slot;
        let nextSlot = (currSlot + 1) & (this.table.length - 1);

        while (this.table[nextSlot] && this.table[nextSlot]!.dib > 0) {
          this.table[currSlot] = this.table[nextSlot];
          this.table[currSlot]!.dib--;
          this.table[nextSlot] = undefined;
          currSlot = nextSlot;
          nextSlot = (nextSlot + 1) & (this.table.length - 1);
        }
        return true;
      }

      slot = (slot + 1) & (this.table.length - 1);
      dib++;
    }
  }

  private resize(newCapacity: number): void {
    const oldTable = this.table;
    this.table = new Array(newCapacity);
    this.count = 0;

    for (const entry of oldTable) {
      if (entry) {
        this.set(entry.key, entry.value);
      }
    }
  }
}

// Rabin-Karp Rolling Hash Substring Search
export function rabinKarpSearch(text: string, pattern: string): number[] {
  const matches: number[] = [];
  const n = text.length;
  const m = pattern.length;
  if (m === 0 || n < m) return matches;

  const B = 256;
  const M = 1000000007; // 10^9 + 7 prime

  // Precompute B^(m - 1) % M
  let power = 1;
  for (let i = 0; i < m - 1; i++) {
    power = Number((BigInt(power) * BigInt(B)) % BigInt(M));
  }

  let patternHash = 0;
  let textHash = 0;

  for (let i = 0; i < m; i++) {
    patternHash = Number((BigInt(patternHash) * BigInt(B) + BigInt(pattern.charCodeAt(i))) % BigInt(M));
    textHash = Number((BigInt(textHash) * BigInt(B) + BigInt(text.charCodeAt(i))) % BigInt(M));
  }

  for (let i = 0; i <= n - m; i++) {
    if (patternHash === textHash) {
      // Confirm byte equality to eliminate spurious hash collisions
      if (text.slice(i, i + m) === pattern) {
        matches.push(i);
      }
    }

    if (i < n - m) {
      // Roll the hash: H_new = ((H_old - text[i]*power) * B + text[i+m]) % M
      const highTerm = Number((BigInt(text.charCodeAt(i)) * BigInt(power)) % BigInt(M));
      let rolled = (textHash - highTerm) % M;
      if (rolled < 0) rolled += M;
      textHash = Number((BigInt(rolled) * BigInt(B) + BigInt(text.charCodeAt(i + m))) % BigInt(M));
    }
  }

  return matches;
}

describe("Module 03: Hashing, Hash Tables & Rabin-Karp String Matching", () => {
  it("Robin Hood hash table correctly sets, retrieves, and backward-shift deletes keys", () => {
    const map = new RobinHoodHashTable<string, number>(8);

    map.set("apple", 100);
    map.set("banana", 200);
    map.set("cherry", 300);
    map.set("date", 400);

    assert.equal(map.get("apple"), 100);
    assert.equal(map.get("banana"), 200);
    assert.equal(map.get("cherry"), 300);
    assert.equal(map.get("date"), 400);
    assert.equal(map.get("elderberry"), undefined);

    // Overwrite existing key
    map.set("banana", 250);
    assert.equal(map.get("banana"), 250);

    // Deletion with backward shifting
    assert.equal(map.delete("banana"), true);
    assert.equal(map.has("banana"), false);
    assert.equal(map.get("banana"), undefined);

    // Verify remaining keys are still accessible after deletion
    assert.equal(map.get("apple"), 100);
    assert.equal(map.get("cherry"), 300);
    assert.equal(map.get("date"), 400);
  });

  it("proves Robin Hood hash table automatically resizes while preserving all entries", () => {
    const map = new RobinHoodHashTable<string, number>(4);
    const N = 500;

    for (let i = 0; i < N; i++) {
      map.set(`key_${i}`, i * 10);
    }

    assert.equal(map.size, N);
    assert.ok(map.capacity >= 512);

    for (let i = 0; i < N; i++) {
      assert.equal(map.get(`key_${i}`), i * 10);
    }
  });

  it("Rabin-Karp correctly finds all occurrences of substring patterns in O(n + m) time", () => {
    const text = "AABAACAADAABAABA";
    const pattern = "AABA";

    const matches = rabinKarpSearch(text, pattern);
    assert.deepEqual(matches, [0, 9, 12]);
  });

  it("property test: Rabin-Karp matches naive string search across arbitrary strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (text, pattern) => {
          const rkMatches = rabinKarpSearch(text, pattern);

          // Naive ground-truth search
          const expected: number[] = [];
          let idx = text.indexOf(pattern);
          while (idx !== -1) {
            expected.push(idx);
            idx = text.indexOf(pattern, idx + 1);
          }

          assert.deepEqual(rkMatches, expected);
        }
      ),
      { numRuns: 150 }
    );
  });
});
