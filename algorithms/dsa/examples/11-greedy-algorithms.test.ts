import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

export interface Interval {
  start: number;
  end: number;
}

/**
 * Interval Scheduling: Maximum non-overlapping intervals via Earliest Finish Time.
 * Time: O(n log n), Space: O(n).
 */
export function maxNonOverlappingIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.end - b.end);
  const selected: Interval[] = [sorted[0]!];
  let lastEnd = sorted[0]!.end;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start >= lastEnd) {
      selected.push(sorted[i]!);
      lastEnd = sorted[i]!.end;
    }
  }
  return selected;
}

/**
 * Jump Game: Can reach last index?
 * Time: O(n), Space: O(1).
 */
export function canJump(nums: number[]): boolean {
  let maxReach = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > maxReach) return false;
    maxReach = Math.max(maxReach, i + nums[i]!);
    if (maxReach >= nums.length - 1) return true;
  }
  return true;
}

/**
 * Gas Station: Complete circular tour index.
 * Time: O(n), Space: O(1).
 */
export function canCompleteCircuit(gas: number[], cost: number[]): number {
  let totalGas = 0;
  let totalCost = 0;
  let tank = 0;
  let startIdx = 0;

  for (let i = 0; i < gas.length; i++) {
    totalGas += gas[i]!;
    totalCost += cost[i]!;
    tank += gas[i]! - cost[i]!;
    if (tank < 0) {
      startIdx = i + 1;
      tank = 0;
    }
  }
  return totalGas >= totalCost ? startIdx : -1;
}

/**
 * Fractional Knapsack: Greedy by value-to-weight ratio.
 * Time: O(n log n), Space: O(n).
 */
export function fractionalKnapsack(weights: number[], values: number[], capacity: number): number {
  interface Item {
    weight: number;
    value: number;
    ratio: number;
  }
  const items: Item[] = weights.map((w, i) => ({
    weight: w,
    value: values[i]!,
    ratio: values[i]! / w,
  }));
  items.sort((a, b) => b.ratio - a.ratio);

  let totalValue = 0;
  let remainingCap = capacity;

  for (const item of items) {
    if (remainingCap <= 0) break;
    if (item.weight <= remainingCap) {
      totalValue += item.value;
      remainingCap -= item.weight;
    } else {
      totalValue += item.ratio * remainingCap;
      remainingCap = 0;
    }
  }
  return totalValue;
}

/**
 * Coin Change comparison: Demonstrates greedy failure on arbitrary denominations.
 */
export function coinChangeGreedy(coins: number[], target: number): number | null {
  const sorted = [...coins].sort((a, b) => b - a);
  let count = 0;
  let rem = target;
  for (const c of sorted) {
    if (rem >= c) {
      const take = Math.floor(rem / c);
      count += take;
      rem -= take * c;
    }
  }
  return rem === 0 ? count : null;
}

export function coinChangeDP(coins: number[], target: number): number {
  const dp = new Array<number>(target + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= target; i++) {
    for (const c of coins) {
      if (i >= c && dp[i - c]! !== Infinity) {
        dp[i] = Math.min(dp[i]!, dp[i - c]! + 1);
      }
    }
  }
  return dp[target]! === Infinity ? -1 : dp[target]!;
}

test('Module 11: Greedy Algorithms and Exchange Arguments', async (t) => {
  await t.test('Interval Scheduling selects maximum non-overlapping intervals', () => {
    const intervals: Interval[] = [
      { start: 1, end: 4 },
      { start: 3, end: 5 },
      { start: 0, end: 6 },
      { start: 5, end: 7 },
      { start: 3, end: 9 },
      { start: 5, end: 9 },
      { start: 6, end: 10 },
      { start: 8, end: 11 },
      { start: 8, end: 12 },
      { start: 2, end: 14 },
      { start: 12, end: 16 },
    ];
    const selected = maxNonOverlappingIntervals(intervals);
    // Canonical CLRS example: max non-overlapping count is 4
    assert.equal(selected.length, 4);
    // Verify each selected interval starts after previous ends
    for (let i = 1; i < selected.length; i++) {
      assert.ok(selected[i]!.start >= selected[i - 1]!.end);
    }
  });

  await t.test('Jump Game correctly detects reachable horizons', () => {
    assert.equal(canJump([2, 3, 1, 1, 4]), true);
    assert.equal(canJump([3, 2, 1, 0, 4]), false);
    assert.equal(canJump([0]), true);
  });

  await t.test('Gas Station circuit locates starting station or -1', () => {
    const gas = [1, 2, 3, 4, 5];
    const cost = [3, 4, 5, 1, 2];
    assert.equal(canCompleteCircuit(gas, cost), 3); // Start at station 3 (0-indexed)

    const impossibleGas = [2, 3, 4];
    const impossibleCost = [3, 4, 3];
    assert.equal(canCompleteCircuit(impossibleGas, impossibleCost), -1);
  });

  await t.test('Fractional Knapsack greedy optimization', () => {
    const weights = [10, 20, 30];
    const values = [60, 100, 120];
    const capacity = 50;
    // item 0: ratio 6, take all 10 (val 60)
    // item 1: ratio 5, take all 20 (val 100)
    // item 2: ratio 4, take 20 of 30 (val 4 * 20 = 80)
    // Total value: 60 + 100 + 80 = 240
    assert.equal(fractionalKnapsack(weights, values, capacity), 240);
  });

  await t.test('Demonstrates greedy failure on arbitrary coin change vs DP optimal', () => {
    const coins = [1, 3, 4];
    const target = 6;
    // Greedy picks 4 + 1 + 1 = 3 coins
    const greedyResult = coinChangeGreedy(coins, target);
    // Optimal DP picks 3 + 3 = 2 coins
    const dpResult = coinChangeDP(coins, target);

    assert.equal(greedyResult, 3);
    assert.equal(dpResult, 2);
    assert.notEqual(greedyResult, dpResult);
  });

  await t.test('Property test: Fractional knapsack value is monotonic with capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }),
        fc.integer({ min: 10, max: 100 }),
        (c1, c2) => {
          const weights = [5, 15, 25];
          const values = [30, 60, 100];
          const minCap = Math.min(c1, c2);
          const maxCap = Math.max(c1, c2);
          const vMin = fractionalKnapsack(weights, values, minCap);
          const vMax = fractionalKnapsack(weights, values, maxCap);
          return vMax >= vMin;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
