import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * 0/1 Knapsack with 1-D space optimization (reverse loop).
 * Time: O(n * W), Space: O(W).
 */
export function knapsack01(weights: number[], values: number[], capacity: number): number {
  const dp = new Array<number>(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    const v = values[i]!;
    for (let cap = capacity; cap >= w; cap--) {
      dp[cap] = Math.max(dp[cap]!, dp[cap - w]! + v);
    }
  }
  return dp[capacity]!;
}

/**
 * Unbounded Knapsack with 1-D space optimization (forward loop).
 * Time: O(n * W), Space: O(W).
 */
export function knapsackUnbounded(weights: number[], values: number[], capacity: number): number {
  const dp = new Array<number>(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    const v = values[i]!;
    for (let cap = w; cap <= capacity; cap++) {
      dp[cap] = Math.max(dp[cap]!, dp[cap - w]! + v);
    }
  }
  return dp[capacity]!;
}

/**
 * Longest Increasing Subsequence via Patience Sorting.
 * Invariant: tails[i] stores the minimal tail of an increasing subsequence of length i + 1.
 * Time: O(n log n), Space: O(n).
 */
export function lengthOfLIS(nums: number[]): number {
  if (nums.length === 0) return 0;
  const tails: number[] = [];

  for (const x of nums) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >>> 1);
      if (tails[mid]! >= x) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    if (lo === tails.length) {
      tails.push(x);
    } else {
      tails[lo] = x;
    }
  }
  return tails.length;
}

/**
 * Naive O(n^2) LIS for property testing verification oracle.
 */
export function naiveLIS(nums: number[]): number {
  if (nums.length === 0) return 0;
  const dp = new Array<number>(nums.length).fill(1);
  let maxLen = 1;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j]! < nums[i]!) {
        dp[i] = Math.max(dp[i]!, dp[j]! + 1);
      }
    }
    maxLen = Math.max(maxLen, dp[i]!);
  }
  return maxLen;
}

/**
 * Longest Common Subsequence (LCS) with O(min(m, n)) rolling row space.
 * Time: O(m * n), Space: O(min(m, n)).
 */
export function longestCommonSubsequence(s1: string, s2: string): number {
  if (s1.length < s2.length) {
    return longestCommonSubsequence(s2, s1);
  }
  const m = s1.length;
  const n = s2.length;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    const c1 = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      if (c1 === s2.charCodeAt(j - 1)) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }
  return prev[n]!;
}

/**
 * Levenshtein Edit Distance.
 * Time: O(m * n), Space: O(n).
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] = 1 + Math.min(
          prev[j]!,     // Delete
          curr[j - 1]!, // Insert
          prev[j - 1]!  // Replace
        );
      }
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }
  return prev[n]!;
}

/**
 * Held-Karp Bitmask DP for Traveling Salesperson Problem (TSP).
 * Returns min tour cost starting at vertex 0, visiting all n nodes, and returning to 0.
 * Time: O(n^2 * 2^n), Space: O(n * 2^n).
 */
export function tspHeldKarp(dist: number[][]): number {
  const n = dist.length;
  if (n <= 1) return 0;
  const numStates = 1 << n;
  const INF = 1e9;
  // memo[mask][u]
  const memo = Array.from({ length: numStates }, () => new Array<number>(n).fill(-1));

  function solve(mask: number, u: number): number {
    // If all vertices visited, return to start (0)
    if (mask === numStates - 1) {
      return dist[u]![0]!;
    }
    if (memo[mask]![u]! !== -1) {
      return memo[mask]![u]!;
    }

    let minCost = INF;
    for (let v = 0; v < n; v++) {
      if ((mask & (1 << v)) === 0) {
        const cost = dist[u]![v]! + solve(mask | (1 << v), v);
        minCost = Math.min(minCost, cost);
      }
    }
    memo[mask]![u] = minCost;
    return minCost;
  }

  return solve(1, 0); // start at node 0 with mask 1 (bit 0 set)
}

test('Module 10: Dynamic Programming: Foundations to Advanced Dimensions', async (t) => {
  await t.test('0/1 Knapsack vs Unbounded Knapsack semantics', () => {
    const weights = [2, 3, 4];
    const values = [3, 4, 5];
    const capacity = 5;

    // 0/1: Best is items 0 & 1 (weight 2+3=5, value 3+4=7)
    const val01 = knapsack01(weights, values, capacity);
    assert.equal(val01, 7);

    // Unbounded: Best is item 0 taken twice (weight 2*2=4, value 3*2=6) or item 0 + 1 (val 7)
    assert.equal(knapsack01([2], [3], 6), 3);
    assert.equal(knapsackUnbounded([2], [3], 6), 9);
  });

  await t.test('Longest Increasing Subsequence O(n log n) Patience Sorting', () => {
    const nums = [10, 9, 2, 5, 3, 7, 101, 18];
    assert.equal(lengthOfLIS(nums), 4);
    assert.equal(lengthOfLIS([0, 1, 0, 3, 2, 3]), 4);
    assert.equal(lengthOfLIS([7, 7, 7, 7]), 1);
    assert.equal(lengthOfLIS([]), 0);
  });

  await t.test('String DP: LCS and Levenshtein Edit Distance', () => {
    assert.equal(longestCommonSubsequence('abcde', 'ace'), 3);
    assert.equal(longestCommonSubsequence('abc', 'abc'), 3);
    assert.equal(longestCommonSubsequence('abc', 'def'), 0);

    assert.equal(levenshteinDistance('horse', 'ros'), 3);
    assert.equal(levenshteinDistance('intention', 'execution'), 5);
    assert.equal(levenshteinDistance('', 'hello'), 5);
    assert.equal(levenshteinDistance('hello', 'hello'), 0);
  });

  await t.test('Held-Karp Bitmask DP for TSP', () => {
    const dist = [
      [0, 10, 15, 20],
      [10, 0, 35, 25],
      [15, 35, 0, 30],
      [20, 25, 30, 0],
    ];
    assert.equal(tspHeldKarp(dist), 80);
  });

  await t.test('Property test: O(n log n) LIS equals naive O(n^2) LIS oracle', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 0, maxLength: 50 }),
        (nums) => {
          const expected = naiveLIS(nums);
          const actual = lengthOfLIS(nums);
          return expected === actual;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
