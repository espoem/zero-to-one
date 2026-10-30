import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// Quicksort with 3-Way Dutch National Flag Partitioning
export function quickSort3Way(arr: number[], low = 0, high = arr.length - 1): void {
  if (low >= high) return;

  // Randomized pivot selection to avoid adversarial O(n^2)
  const pivotIdx = low + Math.floor(Math.random() * (high - low + 1));
  const pivot = arr[pivotIdx]!;
  [arr[low], arr[pivotIdx]] = [arr[pivotIdx]!, arr[low]!];

  let lt = low;      // arr[low ... lt - 1] < pivot
  let i = low + 1;   // arr[lt ... i - 1] === pivot
  let gt = high;     // arr[gt + 1 ... high] > pivot

  while (i <= gt) {
    if (arr[i]! < pivot) {
      [arr[lt], arr[i]] = [arr[i]!, arr[lt]!];
      lt++;
      i++;
    } else if (arr[i]! > pivot) {
      [arr[i], arr[gt]] = [arr[gt]!, arr[i]!];
      gt--;
    } else {
      i++;
    }
  }

  quickSort3Way(arr, low, lt - 1);
  quickSort3Way(arr, gt + 1, high);
}

// Quickselect: O(n) average time k-th smallest element finder (0-indexed)
export function quickSelect(arr: number[], k: number): number {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    if (low === high) return arr[low]!;

    const pivotIdx = low + Math.floor(Math.random() * (high - low + 1));
    const pivot = arr[pivotIdx]!;
    [arr[low], arr[pivotIdx]] = [arr[pivotIdx]!, arr[low]!];

    let lt = low;
    let i = low + 1;
    let gt = high;

    while (i <= gt) {
      if (arr[i]! < pivot) {
        [arr[lt], arr[i]] = [arr[i]!, arr[lt]!];
        lt++;
        i++;
      } else if (arr[i]! > pivot) {
        [arr[i], arr[gt]] = [arr[gt]!, arr[i]!];
        gt--;
      } else {
        i++;
      }
    }

    // After 3-way partition:
    // arr[low ... lt-1] < pivot
    // arr[lt ... gt] === pivot
    // arr[gt+1 ... high] > pivot
    if (k < lt) {
      high = lt - 1;
    } else if (k > gt) {
      low = gt + 1;
    } else {
      return arr[k]!;
    }
  }
  throw new Error("k out of bounds");
}

// "Binary Search on Answer": Minimum capacity to ship packages within D days
export function shipWithinDays(weights: number[], days: number): number {
  let left = Math.max(...weights); // Lower bound: must carry at least the heaviest package
  let right = weights.reduce((sum, w) => sum + w, 0); // Upper bound: ship everything in 1 day

  // Monotonic predicate P(capacity): Can we ship within `days`?
  const canShip = (capacity: number): boolean => {
    let daysNeeded = 1;
    let currentLoad = 0;

    for (const w of weights) {
      if (currentLoad + w > capacity) {
        daysNeeded++;
        currentLoad = w;
      } else {
        currentLoad += w;
      }
    }
    return daysNeeded <= days;
  };

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (canShip(mid)) {
      right = mid; // Try smaller capacity
    } else {
      left = mid + 1; // Need larger capacity
    }
  }

  return left;
}

describe("Module 04: Sorting, Selection & Monotone Predicate Search", () => {
  it("3-way Quicksort sorts arrays with high duplicate density efficiently", () => {
    const data = [4, 2, 4, 3, 4, 1, 4, 2, 4, 4];
    quickSort3Way(data);
    assert.deepEqual(data, [1, 2, 2, 3, 4, 4, 4, 4, 4, 4]);
  });

  it("Quickselect accurately finds the k-th smallest element in O(n) average time", () => {
    const data = [7, 10, 4, 3, 20, 15]; // Sorted: [3, 4, 7, 10, 15, 20]

    assert.equal(quickSelect([...data], 0), 3);  // 1st smallest
    assert.equal(quickSelect([...data], 1), 4);  // 2nd smallest
    assert.equal(quickSelect([...data], 2), 7);  // 3rd smallest
    assert.equal(quickSelect([...data], 3), 10); // 4th smallest
    assert.equal(quickSelect([...data], 5), 20); // Largest
  });

  it("Binary Search on Answer solves the package shipping capacity problem correctly", () => {
    // Packages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Days = 5
    // Capacity 15 ships: [1..5] (15), [6, 7] (13), [8] (8), [9] (9), [10] (10) in 5 days
    const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(shipWithinDays(weights, 5), 15);
  });

  it("property test: 3-way Quicksort always matches native Array.prototype.sort()", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1000, max: 1000 })), (rawArray) => {
        const copy1 = [...rawArray];
        const copy2 = [...rawArray];

        quickSort3Way(copy1);
        copy2.sort((a, b) => a - b);

        assert.deepEqual(copy1, copy2);
      }),
      { numRuns: 150 }
    );
  });
});
