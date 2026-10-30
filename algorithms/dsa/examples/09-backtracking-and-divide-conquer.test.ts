import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// N-Queens solver with O(1) bitmask pruning
export function totalNQueens(n: number): number {
  let count = 0;
  const done = (1 << n) - 1; // Mask of n bits set to 1

  function backtrack(cols: number, diag1: number, diag2: number): void {
    if (cols === done) {
      count++;
      return;
    }

    // Available positions are 0-bits in (cols | diag1 | diag2) within n bits
    let available = done & ~(cols | diag1 | diag2);

    while (available > 0) {
      const bit = available & -available; // Extract lowest set bit
      available -= bit;

      backtrack(
        cols | bit,
        (diag1 | bit) << 1,
        (diag2 | bit) >> 1
      );
    }
  }

  backtrack(0, 0, 0);
  return count;
}

// Meet-in-the-Middle: Closest Subset Sum to Target
export function minSubsetSumDiff(nums: number[], target: number): number {
  const n = nums.length;
  const mid = Math.floor(n / 2);

  const left = nums.slice(0, mid);
  const right = nums.slice(mid);

  function getSubsetSums(arr: number[]): number[] {
    const sums: number[] = [0];
    for (const num of arr) {
      const len = sums.length;
      for (let i = 0; i < len; i++) {
        sums.push(sums[i]! + num);
      }
    }
    return sums;
  }

  const leftSums = getSubsetSums(left);
  const rightSums = getSubsetSums(right).sort((a, b) => a - b);

  let closestDiff = Infinity;

  for (const s1 of leftSums) {
    const needed = target - s1;

    // Binary search for closest value in rightSums
    let low = 0;
    let high = rightSums.length - 1;

    while (low <= high) {
      const m = low + Math.floor((high - low) / 2);
      const val = rightSums[m]!;
      closestDiff = Math.min(closestDiff, Math.abs(target - (s1 + val)));

      if (val < needed) {
        low = m + 1;
      } else if (val > needed) {
        high = m - 1;
      } else {
        return 0; // Exact match found!
      }
    }
  }

  return closestDiff;
}

// Karatsuba Integer Multiplication (BigInt strings)
export function karatsubaMultiply(x: bigint, y: bigint): bigint {
  if (x < 10n || y < 10n) {
    return x * y;
  }

  const strX = x.toString();
  const strY = y.toString();
  const n = Math.max(strX.length, strY.length);
  const m = Math.floor(n / 2);
  const base = 10n ** BigInt(m);

  const x1 = x / base;
  const x0 = x % base;
  const y1 = y / base;
  const y0 = y % base;

  const z2 = karatsubaMultiply(x1, y1);
  const z0 = karatsubaMultiply(x0, y0);
  const z1 = karatsubaMultiply(x1 + x0, y1 + y0) - z2 - z0;

  return z2 * (10n ** BigInt(2 * m)) + z1 * base + z0;
}

describe("Module 09: Recursion, Backtracking & Divide-and-Conquer", () => {
  it("N-Queens bitmask solver accurately computes distinct solutions for N=4 and N=8", () => {
    assert.equal(totalNQueens(4), 2);
    assert.equal(totalNQueens(8), 92);
    assert.equal(totalNQueens(1), 1);
  });

  it("Meet-in-the-Middle solves closest subset sum in O(2^(n/2) * n) time", () => {
    // Array of 20 elements (2^20 ~ 10^6 iterations)
    const nums = [
      5, 12, 19, 23, 29, 31, 37, 41, 43, 47,
      53, 59, 61, 67, 71, 73, 79, 83, 89, 97
    ];
    const target = 500;

    const diff = minSubsetSumDiff(nums, target);
    assert.equal(diff, 0); // Exact subset exists
  });

  it("Karatsuba multiplication matches native BigInt multiplication", () => {
    const a = 12345678901234567890n;
    const b = 98765432109876543210n;

    assert.equal(karatsubaMultiply(a, b), a * b);
  });

  it("property test: Karatsuba multiplication is mathematically identical to BigInt *", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1000000000000000n }),
        fc.bigInt({ min: 0n, max: 1000000000000000n }),
        (x, y) => {
          assert.equal(karatsubaMultiply(x, y), x * y);
        }
      ),
      { numRuns: 100 }
    );
  });
});
