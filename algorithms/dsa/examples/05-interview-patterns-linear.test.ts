import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// Sliding Window Maximum using Monotonic Decreasing Deque in O(n) time
export function maxSlidingWindow(nums: number[], k: number): number[] {
  if (nums.length === 0 || k === 0) return [];
  const result: number[] = [];
  const deque: number[] = []; // Stores indices

  for (let i = 0; i < nums.length; i++) {
    // 1. Remove indices that are outside the current window
    while (deque.length > 0 && deque[0]! <= i - k) {
      deque.shift();
    }

    // 2. Maintain monotonic decreasing order: pop elements smaller than current
    while (deque.length > 0 && nums[deque[deque.length - 1]!]! <= nums[i]!) {
      deque.pop();
    }

    // 3. Push current index
    deque.push(i);

    // 4. Record max once first window of size k is complete
    if (i >= k - 1) {
      result.push(nums[deque[0]!]!);
    }
  }

  return result;
}

// Subarray Sum Equals K using Prefix Sums + Hash Map (handles negative integers)
export function subarraySum(nums: number[], k: number): number {
  let count = 0;
  let prefixSum = 0;
  const prefixMap = new Map<number, number>();
  prefixMap.set(0, 1); // Base case: prefix before index 0 has sum 0

  for (const num of nums) {
    prefixSum += num;
    const complement = prefixSum - k;
    if (prefixMap.has(complement)) {
      count += prefixMap.get(complement)!;
    }
    prefixMap.set(prefixSum, (prefixMap.get(prefixSum) ?? 0) + 1);
  }

  return count;
}

// Cyclic Sort: In-place O(n) sorting of numbers in range [1, n] in O(1) space
export function cyclicSort(nums: number[]): void {
  let i = 0;
  while (i < nums.length) {
    const correctIdx = nums[i]! - 1;
    if (nums[i]! > 0 && nums[i]! <= nums.length && nums[i]! !== nums[correctIdx]) {
      [nums[i], nums[correctIdx]] = [nums[correctIdx]!, nums[i]!];
    } else {
      i++;
    }
  }
}

// Kadane's Algorithm: O(n) Maximum Subarray Sum
export function maxSubArray(nums: number[]): number {
  let currentSum = nums[0]!;
  let maxSum = nums[0]!;

  for (let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i]!, currentSum + nums[i]!);
    maxSum = Math.max(maxSum, currentSum);
  }

  return maxSum;
}

describe("Module 05: Interview Pattern Catalog (Linear & Pointers)", () => {
  it("Sliding Window Maximum computes running window maximums in O(n) time", () => {
    const nums = [1, 3, -1, -3, 5, 3, 6, 7];
    const k = 3;
    const expected = [3, 3, 5, 5, 6, 7];

    assert.deepEqual(maxSlidingWindow(nums, k), expected);
  });

  it("Subarray Sum Equals K correctly counts subarrays in arrays with negative numbers", () => {
    // Array: [1, -1, 1, 1, 1, -1], k = 2
    // Exactly 6 subarrays sum to 2: [0..3], [2..3], [1..4], [3..4], [0..5], [2..5]
    const nums = [1, -1, 1, 1, 1, -1];
    assert.equal(subarraySum(nums, 2), 6);

    // Negative target: exactly 2 subarrays sum to -2: [-2] and [1, -1, -2]
    assert.equal(subarraySum([1, -1, -2, 2], -2), 2);
  });

  it("Cyclic Sort sorts unsorted 1-to-N permutations in-place in O(n) time", () => {
    const nums = [3, 5, 2, 1, 4];
    cyclicSort(nums);
    assert.deepEqual(nums, [1, 2, 3, 4, 5]);
  });

  it("property test: Kadane's algorithm matches exhaustive O(n^2) brute force", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 30 }),
        (nums) => {
          const kadaneResult = maxSubArray(nums);

          // Ground-truth brute force O(n^2)
          let bruteMax = -Infinity;
          for (let start = 0; start < nums.length; start++) {
            let sum = 0;
            for (let end = start; end < nums.length; end++) {
              sum += nums[end]!;
              if (sum > bruteMax) bruteMax = sum;
            }
          }

          assert.equal(kadaneResult, bruteMax);
        }
      ),
      { numRuns: 150 }
    );
  });
});
