import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// ---------------------------------------------------------------------------
// Master theorem classifier for T(n) = a T(n/b) + Theta(n^c log^k n)  (CLRS 4e §4.5)
// ---------------------------------------------------------------------------
type MasterResult =
  | { kind: "case1"; exponent: number; logPower: 0 }
  | { kind: "case2"; exponent: number; logPower: number }
  | { kind: "case3"; exponent: number; logPower: number }
  | { kind: "gap"; reason: string };

export function classifyMaster(a: number, b: number, c: number, k: number): MasterResult {
  if (!(a >= 1) || !(b > 1)) throw new RangeError("need a >= 1, b > 1");
  const p = Math.log(a) / Math.log(b); // watershed exponent log_b a
  const eps = 1e-12;
  if (c < p - eps) return { kind: "case1", exponent: p, logPower: 0 };
  if (Math.abs(c - p) <= eps) {
    // CLRS 4e Case 2 is stated for k >= 0 only.
    if (k >= 0) return { kind: "case2", exponent: p, logPower: k + 1 };
    return { kind: "gap", reason: "k < 0: f(n) is only polylog-smaller than the watershed; Case 2 as stated needs k >= 0" };
  }
  // c > p: polynomially larger. For f(n) = n^c log^k n the regularity condition holds
  // (a f(n/b) = a b^-c n^c log^k(n/b) <= (a / b^c + o(1)) f(n) and a / b^c < 1 because c > log_b a).
  return { kind: "case3", exponent: c, logPower: k };
}

function exactPowerRecurrence(a: number, base: number, f: (n: number) => number, maxJ: number): number[] {
  // T(1) = base, T(2^j) = a * T(2^(j-1)) + f(2^j)   (b = 2, exact powers of two only)
  const t: number[] = [base];
  for (let j = 1; j <= maxJ; j++) t.push(a * t[j - 1]! + f(2 ** j));
  return t;
}

function akraBazziP(terms: Array<[a: number, b: number]>): number {
  // unique p with sum a_i b_i^p = 1; the sum is strictly decreasing in p when every 0 < b_i < 1.
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const s = terms.reduce((acc, [a, b]) => acc + a * b ** mid, 0);
    if (s > 1) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe("Module 01 (deep): recurrences", () => {
  it("classifies the textbook recurrences", () => {
    assert.deepEqual(classifyMaster(2, 2, 1, 0), { kind: "case2", exponent: 1, logPower: 1 }); // merge sort
    assert.deepEqual(classifyMaster(1, 2, 0, 0), { kind: "case2", exponent: 0, logPower: 1 }); // binary search
    const kara = classifyMaster(3, 2, 1, 0);
    assert.equal(kara.kind, "case1");
    assert.ok(Math.abs((kara as { exponent: number }).exponent - Math.log2(3)) < 1e-12);
    assert.equal(classifyMaster(7, 2, 2, 0).kind, "case1"); // Strassen
    assert.deepEqual(classifyMaster(1, 2, 1, 0), { kind: "case3", exponent: 1, logPower: 0 }); // T(n/2) + n
    assert.deepEqual(classifyMaster(2, 2, 1, 1), { kind: "case2", exponent: 1, logPower: 2 }); // n log^2 n
  });

  it("refuses the gap case 2T(n/2) + n / log n instead of guessing", () => {
    const r = classifyMaster(2, 2, 1, -1);
    assert.equal(r.kind, "gap");
  });

  it("matches the exact closed forms on powers of two", () => {
    // 2T(n/2) + n, T(1) = 1  =>  T(2^j) = 2^j (j + 1)
    const merge = exactPowerRecurrence(2, 1, (n) => n, 30);
    for (let j = 0; j <= 30; j++) assert.equal(merge[j], 2 ** j * (j + 1));
    // 3T(n/2) + n, T(1) = 1  =>  T(2^j) = 3^(j+1) - 2^(j+1)
    const kara = exactPowerRecurrence(3, 1, (n) => n, 25);
    for (let j = 0; j <= 25; j++) assert.equal(kara[j], 3 ** (j + 1) - 2 ** (j + 1));
  });

  it("negative test: the classic bogus substitution proof T(n) <= c n for merge sort fails numerically", () => {
    // 'Inductive step': T(n) <= 2 c (n/2) + n = c n + n, which is NOT <= c n. The ratio T(n)/n must be unbounded.
    const merge = exactPowerRecurrence(2, 1, (n) => n, 40);
    const ratios = merge.map((t, j) => t / 2 ** j);
    assert.equal(ratios[40], 41);
    assert.ok(ratios.every((r, j) => j === 0 || r > ratios[j - 1]!), "ratio T(n)/n strictly increases");
  });

  it("subtracting a lower-order term repairs a stuck substitution: T(n) = 2T(n/2) + 1 is <= 2n - 1", () => {
    // Guess T(n) <= c n fails to close inductively (c n + 1 > c n) but the stronger T(n) <= c n - 1 closes.
    const t = exactPowerRecurrence(2, 1, () => 1, 30);
    for (let j = 0; j <= 30; j++) assert.equal(t[j], 2 ** (j + 1) - 1);
  });

  it("Akra-Bazzi exponent for T(n/3) + T(2n/3) + n is p = 1 and the floor/ceil recurrence is Theta(n log n)", () => {
    const p = akraBazziP([
      [1, 1 / 3],
      [1, 2 / 3],
    ]);
    assert.ok(Math.abs(p - 1) < 1e-9);
    const N = 20000;
    const T = new Float64Array(N + 1);
    T[1] = 1;
    for (let n = 2; n <= N; n++) T[n] = T[Math.floor(n / 3)]! + T[Math.ceil((2 * n) / 3)]! + n;
    let lo = Infinity;
    let hi = 0;
    for (let n = 100; n <= N; n++) {
      const r = T[n]! / (n * Math.log2(n));
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    assert.ok(lo > 0.5 && hi < 2.5, `ratio band [${lo}, ${hi}]`);
    // and T(n) / n is not bounded: Omega(n log n) is genuinely needed
    assert.ok(T[N]! / N > T[1000]! / 1000);
  });

  it("Akra-Bazzi exponent solves T(n) = T(n/2) + T(n/4) + n  (p < 1, so the root dominates)", () => {
    const p = akraBazziP([
      [1, 1 / 2],
      [1, 1 / 4],
    ]);
    // (1/2)^p + (1/4)^p = 1  =>  with x = 2^-p: x + x^2 = 1  =>  x = (sqrt 5 - 1) / 2
    assert.ok(Math.abs(2 ** -p - (Math.sqrt(5) - 1) / 2) < 1e-9);
    assert.ok(p < 1 && p > 0);
  });
});

describe("Module 01 (deep): asymptotic notation pitfalls", () => {
  it("2^(n+1) = O(2^n) but 2^(2n) is not O(2^n)", () => {
    for (let n = 1; n <= 40; n++) {
      assert.equal(2 ** (n + 1) / 2 ** n, 2);
    }
    const ratio = (n: number) => 4 ** n / 2 ** n;
    assert.ok(ratio(40) > ratio(20) * 1000);
  });

  it("logarithm bases differ by a constant factor only", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 2 ** 40 }), (n) => {
        const r = Math.log2(n) / Math.log(n);
        return Math.abs(r - 1 / Math.LN2) < 1e-9;
      }),
      { seed: 1, numRuns: 200 },
    );
  });

  it("Number loses integer precision above 2^53: a Word-RAM 'unit cost' claim needs w-bit values", () => {
    assert.equal(2 ** 53 + 1, 2 ** 53);
    assert.equal(Number.MAX_SAFE_INTEGER, 2 ** 53 - 1);
    assert.equal(BigInt(2 ** 53) + 1n === BigInt(2 ** 53), false);
  });

  it("(lo + hi) >> 1 breaks past 2^31, (lo + hi) >>> 1 breaks past 2^32, lo + floor((hi-lo)/2) does not", () => {
    const lo = 1_500_000_000;
    const hi = 1_800_000_000;
    assert.ok(((lo + hi) >> 1) < 0, "int32 coercion makes the midpoint negative");
    assert.equal((lo + hi) >>> 1, 1_650_000_000);
    const lo2 = 2 ** 32;
    const hi2 = 2 ** 32 + 2;
    assert.notEqual((lo2 + hi2) >>> 1, lo2 + 1, "uint32 coercion wraps");
    assert.equal(lo2 + Math.floor((hi2 - lo2) / 2), lo2 + 1);
  });
});

// ---------------------------------------------------------------------------
// Insertion sort with an executable loop invariant (CLRS 4e §2.1)
// ---------------------------------------------------------------------------
export function insertionSortChecked(input: readonly number[]): { sorted: number[]; comparisons: number } {
  const A = input.slice();
  let comparisons = 0;
  const original = input.slice();
  for (let j = 1; j < A.length; j++) {
    // Invariant: A[0..j) is a sorted permutation of original[0..j)
    const prefix = A.slice(0, j);
    assert.deepEqual(prefix, prefix.slice().sort((x, y) => x - y), "prefix sorted at loop top");
    assert.deepEqual(prefix.slice().sort((x, y) => x - y), original.slice(0, j).sort((x, y) => x - y), "prefix is a permutation");
    const key = A[j]!;
    let i = j - 1;
    while (i >= 0) {
      comparisons++;
      if (A[i]! > key) {
        A[i + 1] = A[i]!;
        i--;
      } else break;
    }
    A[i + 1] = key;
  }
  return { sorted: A, comparisons };
}

describe("Module 01 (deep): insertion sort invariant", () => {
  it("property: invariant holds at every iteration and output equals the library sort", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 40 }), (xs) => {
        const { sorted } = insertionSortChecked(xs);
        assert.deepEqual(sorted, xs.slice().sort((a, b) => a - b));
      }),
      { seed: 7, numRuns: 150 },
    );
  });

  it("comparison counts: n-1 on sorted input, n(n-1)/2 on strictly reversed input", () => {
    for (const n of [2, 5, 17, 64]) {
      const asc = Array.from({ length: n }, (_, i) => i);
      const desc = asc.slice().reverse();
      assert.equal(insertionSortChecked(asc).comparisons, n - 1);
      assert.equal(insertionSortChecked(desc).comparisons, (n * (n - 1)) / 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Amortization: binary counter (potential = number of 1 bits) and shrinking policies
// ---------------------------------------------------------------------------
function popcount(x: number): number {
  let c = 0;
  for (let v = x; v > 0; v = Math.floor(v / 2)) c += v % 2;
  return c;
}

class BinaryCounter {
  bits: number[];
  constructor(width: number) {
    this.bits = new Array<number>(width).fill(0);
  }
  /** returns number of bit flips */
  increment(): number {
    let i = 0;
    let flips = 0;
    while (i < this.bits.length && this.bits[i] === 1) {
      this.bits[i] = 0;
      flips++;
      i++;
    }
    if (i < this.bits.length) {
      this.bits[i] = 1;
      flips++;
    }
    return flips;
  }
  decrement(): number {
    let i = 0;
    let flips = 0;
    while (i < this.bits.length && this.bits[i] === 0) {
      this.bits[i] = 1;
      flips++;
      i++;
    }
    if (i < this.bits.length) {
      this.bits[i] = 0;
      flips++;
    }
    return flips;
  }
  get ones(): number {
    return this.bits.reduce((a, b) => a + b, 0);
  }
}

describe("Module 01 (deep): amortized analysis beyond the dynamic array", () => {
  it("binary counter: potential Phi = popcount gives amortized cost <= 2 per increment", () => {
    const c = new BinaryCounter(24);
    let total = 0;
    for (let i = 1; i <= 5000; i++) {
      const before = c.ones;
      const flips = c.increment();
      const amortized = flips + (c.ones - before);
      assert.ok(amortized <= 2, `amortized cost ${amortized} at step ${i}`);
      total += flips;
    }
    assert.equal(total, 2 * 5000 - popcount(5000)); // exact identity: total flips = 2n - popcount(n)
  });

  it("negative test: alternating increment/decrement across 2^k - 1 <-> 2^k costs k+1 flips per op (no O(1) amortization)", () => {
    const k = 16;
    const c = new BinaryCounter(k + 1);
    for (let i = 0; i < 2 ** k - 1; i++) c.increment(); // 0111...1
    let total = 0;
    const ops = 200;
    for (let i = 0; i < ops; i++) total += i % 2 === 0 ? c.increment() : c.decrement();
    assert.equal(total, ops * (k + 1));
  });

  class Vec {
    cap = 1;
    size = 0;
    copies = 0;
    readonly shrinkAt: number;
    constructor(shrinkAt: number) {
      this.shrinkAt = shrinkAt;
    }
    push(): void {
      if (this.size === this.cap) {
        this.copies += this.size;
        this.cap *= 2;
      }
      this.size++;
    }
    pop(): void {
      this.size--;
      if (this.cap > 1 && this.size <= this.cap * this.shrinkAt) {
        this.copies += this.size;
        this.cap = Math.max(1, Math.floor(this.cap / 2));
      }
    }
  }

  it("shrinking at size = cap/2 thrashes; shrinking at cap/4 keeps copies O(operations)", () => {
    const run = (shrinkAt: number) => {
      const v = new Vec(shrinkAt);
      for (let i = 0; i < 1024; i++) v.push(); // size = cap = 1024
      v.push(); // forces cap -> 2048, size = 1025
      const start = v.copies;
      const ops = 2000;
      for (let i = 0; i < ops; i++) {
        if (i % 2 === 0) v.pop();
        else v.push();
      }
      return { extra: v.copies - start, ops };
    };
    // Naive policy: shrink as soon as size <= cap/2. Alternating pop/push at 1025 <-> 1024 copies ~1024 every op.
    const naive = run(0.5);
    assert.ok(naive.extra > naive.ops * 500, `naive copies ${naive.extra}`);
    // Quarter policy: after the doubling above the vector is exactly half full, so the alternation never reaches cap/4.
    const quarter = run(0.25);
    assert.equal(quarter.extra, 0);
  });

  it("quarter policy: every sequence of n operations performs at most 3n element copies (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 400 }), (ops) => {
        const v = new Vec(0.25);
        let n = 0;
        for (const push of ops) {
          if (push || v.size === 0) v.push();
          else v.pop();
          n++;
        }
        assert.ok(v.copies <= 3 * n, `${v.copies} copies in ${n} ops`);
      }),
      { seed: 11, numRuns: 300 },
    );
  });
});
