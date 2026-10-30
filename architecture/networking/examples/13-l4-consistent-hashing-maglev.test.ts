import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * Simplified Google Maglev Consistent Hashing Lookup Table (ACM EuroSys 2016)
 */
export class MaglevLookupTable {
  readonly M: number; // Prime table size
  private backends: string[];
  private lookupTable: number[]; // Index into backends array

  constructor(backends: string[], tableSize = 1009) { // 1009 is prime
    this.backends = [...backends];
    this.M = tableSize;
    this.lookupTable = new Array(this.M).fill(-1);
    this.populateTable();
  }

  private hashOffset(name: string): number {
    const hash = crypto.createHash('md5').update(`offset:${name}`).digest();
    return hash.readUInt32BE(0) % this.M;
  }

  private hashSkip(name: string): number {
    const hash = crypto.createHash('sha256').update(`skip:${name}`).digest();
    return (hash.readUInt32BE(0) % (this.M - 1)) + 1;
  }

  private generatePermutations(): number[][] {
    const permutations: number[][] = [];
    for (let i = 0; i < this.backends.length; i++) {
      const name = this.backends[i]!;
      const offset = this.hashOffset(name);
      const skip = this.hashSkip(name);
      const perm = new Array(this.M);
      for (let j = 0; j < this.M; j++) {
        perm[j] = (offset + j * skip) % this.M;
      }
      permutations.push(perm);
    }
    return permutations;
  }

  private populateTable(): void {
    const permutations = this.generatePermutations();
    const next = new Array(this.backends.length).fill(0);
    let filledSlots = 0;

    while (filledSlots < this.M) {
      for (let i = 0; i < this.backends.length; i++) {
        let c = permutations[i]![next[i]!]!;
        while (this.lookupTable[c] !== -1) {
          next[i]++;
          c = permutations[i]![next[i]!]!;
        }
        this.lookupTable[c] = i;
        next[i]++;
        filledSlots++;
        if (filledSlots === this.M) break;
      }
    }
  }

  lookup(packet5Tuple: string): string {
    const hash = crypto.createHash('sha1').update(packet5Tuple).digest();
    const index = hash.readUInt32BE(0) % this.M;
    const backendIndex = this.lookupTable[index]!;
    return this.backends[backendIndex]!;
  }

  getTable(): number[] {
    return [...this.lookupTable];
  }
}

describe('Module 13: Layer 4 Consistent Hashing (Google Maglev Algorithm)', () => {
  it('populates Maglev lookup table with even distribution across backends', () => {
    const backends = ['srv-1', 'srv-2', 'srv-3', 'srv-4'];
    const maglev = new MaglevLookupTable(backends, 1009);

    const counts = new Map<string, number>();
    for (const b of backends) counts.set(b, 0);

    const table = maglev.getTable();
    for (const idx of table) {
      const name = backends[idx]!;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const expectedMean = 1009 / backends.length; // ~252
    for (const [name, count] of counts.entries()) {
      const ratio = count / expectedMean;
      assert.ok(ratio > 0.85 && ratio < 1.15, `Backend ${name} distribution variance (${count}) out of bounds`);
    }
  });

  it('demonstrates minimal disruption property when removing a backend node', () => {
    const backends5 = ['nodeA', 'nodeB', 'nodeC', 'nodeD', 'nodeE'];
    const maglev5 = new MaglevLookupTable(backends5, 1009);

    // Remove nodeE
    const backends4 = ['nodeA', 'nodeB', 'nodeC', 'nodeD'];
    const maglev4 = new MaglevLookupTable(backends4, 1009);

    let preservedCount = 0;
    let nodeEChurn = 0;

    // Test across 1,000 distinct synthetic flows
    for (let i = 0; i < 1000; i++) {
      const flow = `192.168.1.${i % 250}:54210->203.0.113.1:443:tcp`;
      const picked5 = maglev5.lookup(flow);
      const picked4 = maglev4.lookup(flow);

      if (picked5 === 'nodeE') {
        nodeEChurn++;
      } else if (picked5 === picked4) {
        preservedCount++;
      }
    }

    // Almost all flows originally pointing to A, B, C, D should STILL point to A, B, C, D
    const expectedPreserved = 1000 - nodeEChurn;
    const preservationRate = preservedCount / expectedPreserved;
    assert.ok(preservationRate > 0.85, `Expected high preservation rate (>85%), got ${(preservationRate * 100).toFixed(1)}%`);
  });
});
