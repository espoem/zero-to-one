import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Treiber Stack: LIFO lock-free stack pattern.
 */
interface StackNode<T> {
  value: T;
  next: StackNode<T> | null;
}

export class TreiberStack<T> {
  private top: StackNode<T> | null = null;
  private opCount = 0;

  push(value: T): void {
    const newNode: StackNode<T> = { value, next: null };
    // Atomic CAS emulation
    while (true) {
      const oldTop = this.top;
      newNode.next = oldTop;
      this.opCount++;
      if (this.top === oldTop) {
        this.top = newNode;
        return;
      }
    }
  }

  pop(): T | null {
    while (true) {
      const oldTop = this.top;
      this.opCount++;
      if (oldTop === null) return null;
      const nextNode = oldTop.next;
      if (this.top === oldTop) {
        this.top = nextNode;
        return oldTop.value;
      }
    }
  }

  isEmpty(): boolean {
    return this.top === null;
  }
}

/**
 * Coordinate packing: Encodes 2D grid coordinates (r, c) into a single 32-bit integer.
 * Avoids string allocation in hot loops.
 */
export function packCoord(row: number, col: number, numCols: number): number {
  return (row * numCols + col) >>> 0;
}

export function unpackCoord(packed: number, numCols: number): [row: number, col: number] {
  const row = Math.floor(packed / numCols);
  const col = packed % numCols;
  return [row, col];
}

/**
 * Work-Span Simulator verifying Brent's Theorem:
 * T_p <= (T_1 / p) + T_infinity
 */
export function brentUpperBound(workT1: number, spanTinf: number, processors: number): number {
  return Math.floor((workT1 - spanTinf) / processors) + spanTinf;
}

test('Module 14: Parallel Algorithms, Concurrency & Interview Patterns', async (t) => {
  await t.test('TreiberStack executes LIFO push and pop correctly', () => {
    const stack = new TreiberStack<number>();
    assert.equal(stack.pop(), null);

    stack.push(10);
    stack.push(20);
    stack.push(30);

    assert.equal(stack.pop(), 30);
    assert.equal(stack.pop(), 20);
    assert.equal(stack.pop(), 10);
    assert.equal(stack.pop(), null);
    assert.equal(stack.isEmpty(), true);
  });

  await t.test('Grid coordinate packing matches unpacking without string allocations', () => {
    const numCols = 1000;
    const testCases: [number, number][] = [
      [0, 0],
      [0, 500],
      [123, 456],
      [999, 999],
    ];

    for (const [r, c] of testCases) {
      const packed = packCoord(r, c, numCols);
      const [unpackedR, unpackedC] = unpackCoord(packed, numCols);
      assert.equal(unpackedR, r);
      assert.equal(unpackedC, c);
    }
  });

  await t.test("Brent's Theorem bound strictly respects Span Law and Work Law", () => {
    const T1 = 1000; // total work
    const Tinf = 50;  // critical path span

    // On 1 processor, bound must be <= T1
    const boundP1 = brentUpperBound(T1, Tinf, 1);
    assert.equal(boundP1, T1);

    // On 10 processors
    const boundP10 = brentUpperBound(T1, Tinf, 10);
    assert.ok(boundP10 < T1);
    assert.ok(boundP10 >= Tinf); // Can never be faster than the critical path span
  });

  await t.test('Property test: Coordinate packing is an exact bijection for valid grids', () => {
    const numCols = 100;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: numCols - 1 }),
        (r, c) => {
          const packed = packCoord(r, c, numCols);
          const [unpackedR, unpackedC] = unpackCoord(packed, numCols);
          return unpackedR === r && unpackedC === c;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
