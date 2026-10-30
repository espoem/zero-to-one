import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// Dynamic array simulator tracking raw memory allocations and copies
class ResizingArray<T> {
  private buffer: (T | undefined)[];
  private size = 0;
  public totalCopies = 0;
  public totalAllocations = 0;

  constructor(initialCapacity = 1) {
    this.buffer = new Array(initialCapacity);
    this.totalAllocations++;
  }

  push(value: T): void {
    if (this.size === this.buffer.length) {
      // Double capacity
      const newCapacity = this.buffer.length * 2;
      const newBuffer = new Array<T | undefined>(newCapacity);
      this.totalAllocations++;

      for (let i = 0; i < this.size; i++) {
        newBuffer[i] = this.buffer[i];
        this.totalCopies++;
      }
      this.buffer = newBuffer;
    }
    this.buffer[this.size] = value;
    this.size++;
  }

  get length(): number {
    return this.size;
  }

  get capacity(): number {
    return this.buffer.length;
  }
}

// Formal Binary Search lower_bound maintaining loop invariant
function lowerBound(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length; // Range is [left, right)

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (arr[mid]! < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

describe("Module 01: Models of Computation, Asymptotics & Amortized Analysis", () => {
  it("proves dynamic array doubling achieves amortized O(1) insertions (Aggregate & Potential Method)", () => {
    const N = 100_000;
    const array = new ResizingArray<number>(1);

    for (let i = 0; i < N; i++) {
      array.push(i);
    }

    assert.equal(array.length, N);
    // Theoretical limit: total copies for doubling from 1 to N is sum(2^j) < 2*N
    assert.ok(
      array.totalCopies < 2 * N,
      `Total copies (${array.totalCopies}) must be strictly less than 2*N (${2 * N})`
    );

    // Amortized copies per push is strictly < 2.0 (total operations per push < 3.0)
    const averageCopiesPerPush = array.totalCopies / N;
    assert.ok(averageCopiesPerPush < 2.0, `Average copies per push (${averageCopiesPerPush}) must be < 2.0`);
  });

  it("verifies binary search lower_bound invariant: all elements before result are strictly < target", () => {
    const sorted = [10, 20, 20, 20, 30, 40, 50];

    assert.equal(lowerBound(sorted, 5), 0); // Target smaller than all elements
    assert.equal(lowerBound(sorted, 20), 1); // Target matches first of duplicate range
    assert.equal(lowerBound(sorted, 25), 4); // Target between 20 and 30
    assert.equal(lowerBound(sorted, 50), 6); // Target matches last element
    assert.equal(lowerBound(sorted, 60), 7); // Target greater than all elements
  });

  it("property test: lowerBound always returns the first index where arr[index] >= target", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 })),
        fc.integer({ min: -1000, max: 1000 }),
        (rawArray, target) => {
          const sorted = [...rawArray].sort((a, b) => a - b);
          const index = lowerBound(sorted, target);

          // Invariant 1: index is within [0, sorted.length]
          assert.ok(index >= 0 && index <= sorted.length);

          // Invariant 2: all elements at i < index must be < target
          for (let i = 0; i < index; i++) {
            assert.ok(sorted[i]! < target);
          }

          // Invariant 3: if index < sorted.length, sorted[index] must be >= target
          if (index < sorted.length) {
            assert.ok(sorted[index]! >= target);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
