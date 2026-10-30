import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Lamport Logical Clock.
 */
export class LamportClock {
  private time = 0;

  tick(): number {
    this.time++;
    return this.time;
  }

  update(receivedTime: number): number {
    this.time = Math.max(this.time, receivedTime) + 1;
    return this.time;
  }

  getTime(): number {
    return this.time;
  }
}

/**
 * Vector Clock with causal relation comparison.
 */
export type CausalRelation = 'LESS' | 'GREATER' | 'EQUAL' | 'CONCURRENT';

export class VectorClock {
  readonly nodeId: number;
  readonly vector: number[];

  constructor(nodeId: number, numNodes: number) {
    this.nodeId = nodeId;
    this.vector = new Array<number>(numNodes).fill(0);
  }

  tick(): void {
    this.vector[this.nodeId]!++;
  }

  update(received: number[]): void {
    for (let i = 0; i < this.vector.length; i++) {
      this.vector[i] = Math.max(this.vector[i]!, received[i] ?? 0);
    }
    this.vector[this.nodeId]!++;
  }

  static compare(v1: number[], v2: number[]): CausalRelation {
    let hasLess = false;
    let hasGreater = false;

    for (let i = 0; i < v1.length; i++) {
      const a = v1[i] ?? 0;
      const b = v2[i] ?? 0;
      if (a < b) hasLess = true;
      if (a > b) hasGreater = true;
    }

    if (!hasLess && !hasGreater) return 'EQUAL';
    if (hasLess && !hasGreater) return 'LESS';       // v1 -> v2
    if (hasGreater && !hasLess) return 'GREATER';    // v2 -> v1
    return 'CONCURRENT';                             // v1 || v2
  }
}

/**
 * Storage-Enforced Fencing Token store.
 */
export class FencedStorage {
  private highestToken = 0;
  private data: string | null = null;

  write(token: number, value: string): { success: boolean; error?: string } {
    if (token < this.highestToken) {
      return {
        success: false,
        error: `Fencing token ${token} expired; highest token seen is ${this.highestToken}`,
      };
    }
    this.highestToken = token;
    this.data = value;
    return { success: true };
  }

  read(): string | null {
    return this.data;
  }
}

test('Module 03: Time, Clocks & Fencing Tokens', async (t) => {
  await t.test('Lamport Clock preserves unidirectional causality', () => {
    const c1 = new LamportClock();
    const c2 = new LamportClock();

    const t1 = c1.tick(); // Event a on P1: t1 = 1
    const t2 = c2.update(t1); // Event b on P2 receives t1: t2 = max(0, 1) + 1 = 2

    assert.ok(t1 < t2); // a -> b implies L(a) < L(b)
  });

  await t.test('Vector Clocks accurately distinguish causal sequence from concurrency', () => {
    // 3 nodes
    const p0 = new VectorClock(0, 3);
    const p1 = new VectorClock(1, 3);
    const p2 = new VectorClock(2, 3);

    // Event on P0
    p0.tick(); // [1, 0, 0]
    // Message from P0 to P1
    p1.update(p0.vector); // [1, 1, 0]

    // Event on P2 concurrently with no communication from P0 or P1
    p2.tick(); // [0, 0, 1]

    // Causality: P0 -> P1
    assert.equal(VectorClock.compare(p0.vector, p1.vector), 'LESS');
    assert.equal(VectorClock.compare(p1.vector, p0.vector), 'GREATER');

    // Concurrency: P1 and P2 are concurrent
    assert.equal(VectorClock.compare(p1.vector, p2.vector), 'CONCURRENT');
    assert.equal(VectorClock.compare(p0.vector, p2.vector), 'CONCURRENT');
  });

  await t.test('Fenced storage rejects stale writes from paused former lock holder', () => {
    const storage = new FencedStorage();

    // Client 1 acquires lock, assigned token 33
    // Client 1 pauses (GC pause)
    // Lease expires; Client 2 acquires lock, assigned token 34
    const res2 = storage.write(34, 'Client 2 Write');
    assert.equal(res2.success, true);
    assert.equal(storage.read(), 'Client 2 Write');

    // Client 1 wakes up from pause and attempts write with stale token 33
    const res1 = storage.write(33, 'Client 1 Stale Overwrite');
    assert.equal(res1.success, false);
    assert.ok(res1.error?.includes('expired'));

    // Verify storage was protected from split-brain corruption
    assert.equal(storage.read(), 'Client 2 Write');
  });
});
