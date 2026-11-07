import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// ---------------------------------------------------------------------------
// 1. Growth factor g: total element copies < n * g / (g - 1)
// ---------------------------------------------------------------------------
function simulateGrowth(n: number, grow: (cap: number) => number): { copies: number; finalCap: number } {
  let cap = 1;
  let copies = 0;
  for (let size = 0; size < n; size++) {
    if (size === cap) {
      copies += size;
      const next = grow(cap);
      assert.ok(next > cap, "growth policy must strictly increase capacity");
      cap = next;
    }
  }
  return { copies, finalCap: cap };
}

// V8: JSObject::NewElementsCapacity(old) = old + (old >> 1) + kMinAddedElementsCapacity (16 at time of writing)
const v8Grow = (cap: number) => cap + (cap >> 1) + 16;

describe("Module 02 (deep): dynamic array growth factors", () => {
  it("copies stay below n g / (g - 1) for g in {1.5, 2, 4}", () => {
    for (const g of [1.5, 2, 4]) {
      for (const n of [10, 1000, 100_000]) {
        const { copies } = simulateGrowth(n, (c) => Math.max(c + 1, Math.ceil(c * g)));
        assert.ok(copies < (n * g) / (g - 1), `g=${g} n=${n} copies=${copies}`);
      }
    }
  });

  it("the V8 formula (factor 1.5 plus a constant) obeys the same bound with g = 1.5", () => {
    for (const n of [10, 1000, 100_000, 1_000_000]) {
      const { copies, finalCap } = simulateGrowth(n, v8Grow);
      assert.ok(copies < n * 3, `copies=${copies}`);
      assert.ok(finalCap < 1.5 * n + 32 * 2);
    }
  });

  it("negative test: additive growth (cap + 16) is quadratic", () => {
    const small = simulateGrowth(10_000, (c) => c + 16).copies;
    const large = simulateGrowth(20_000, (c) => c + 16).copies;
    assert.ok(large / small > 3.5, `doubling n multiplied copies by ${large / small}`);
  });
});

// ---------------------------------------------------------------------------
// 2. Array.prototype.shift as the specification defines it is a loop of Get/Set
// ---------------------------------------------------------------------------
describe("Module 02 (deep): specification-level cost of shift()", () => {
  it("shift() on an array-like Proxy performs about n [[Get]] and n [[Set]] operations", () => {
    for (const n of [10, 100, 1000]) {
      let gets = 0;
      let sets = 0;
      const target: Record<string, unknown> = { length: n };
      for (let i = 0; i < n; i++) target[String(i)] = i;
      const proxy = new Proxy(target, {
        get(t, k, r) {
          if (typeof k === "string" && /^\d+$/.test(k)) gets++;
          return Reflect.get(t, k, r);
        },
        set(t, k, v, r) {
          if (typeof k === "string" && /^\d+$/.test(k)) sets++;
          return Reflect.set(t, k, v, r);
        },
      });
      const first = Array.prototype.shift.call(proxy);
      assert.equal(first, 0);
      assert.equal(gets, n); // index 0 once plus indices 1..n-1
      assert.equal(sets, n - 1);
      assert.equal(target["length"], n - 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Head-index queue with compaction: amortized O(1)
// ---------------------------------------------------------------------------
class HeadIndexQueue<T> {
  private items: T[] = [];
  private head = 0;
  moved = 0;
  get length(): number {
    return this.items.length - this.head;
  }
  enqueue(x: T): void {
    this.items.push(x);
  }
  dequeue(): T | undefined {
    if (this.head === this.items.length) return undefined;
    const x = this.items[this.head];
    this.items[this.head] = undefined as T; // release reference for GC
    this.head++;
    if (this.head >= 32 && this.head * 2 >= this.items.length) {
      this.moved += this.items.length - this.head;
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return x;
  }
}

describe("Module 02 (deep): head-index queue", () => {
  it("property: behaves like a naive queue and moves at most one element per dequeue", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer(), { nil: undefined }), { maxLength: 600 }), (ops) => {
        const q = new HeadIndexQueue<number>();
        const model: number[] = [];
        let dequeues = 0;
        for (const op of ops) {
          if (op === undefined) {
            dequeues++;
            assert.equal(q.dequeue(), model.shift());
          } else {
            q.enqueue(op);
            model.push(op);
          }
          assert.equal(q.length, model.length);
        }
        assert.ok(q.moved <= dequeues, `moved ${q.moved} > dequeues ${dequeues}`);
      }),
      { seed: 21, numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Two-stack queue and min-stack
// ---------------------------------------------------------------------------
class TwoStackQueue<T> {
  private inbox: T[] = [];
  private outbox: T[] = [];
  transfers = 0;
  lastTransfer = 0;
  enqueue(x: T): void {
    this.inbox.push(x);
  }
  dequeue(): T | undefined {
    this.lastTransfer = 0;
    if (this.outbox.length === 0) {
      while (this.inbox.length > 0) {
        this.outbox.push(this.inbox.pop() as T);
        this.transfers++;
        this.lastTransfer++;
      }
    }
    return this.outbox.pop();
  }
}

class MinStack {
  private data: number[] = [];
  private mins: number[] = []; // mins[i] = min(data[0..i])
  push(x: number): void {
    this.data.push(x);
    this.mins.push(this.mins.length === 0 ? x : Math.min(x, this.mins[this.mins.length - 1]!));
  }
  pop(): number | undefined {
    this.mins.pop();
    return this.data.pop();
  }
  min(): number | undefined {
    return this.mins[this.mins.length - 1];
  }
}

describe("Module 02 (deep): queue from two stacks, min-stack", () => {
  it("each element is transferred at most once, but a single dequeue can cost n", () => {
    const q = new TwoStackQueue<number>();
    for (let i = 0; i < 1000; i++) q.enqueue(i);
    assert.equal(q.dequeue(), 0);
    assert.equal(q.lastTransfer, 1000, "one dequeue moved the whole inbox");
    for (let i = 1; i < 1000; i++) assert.equal(q.dequeue(), i);
    assert.equal(q.transfers, 1000);
  });

  it("property: FIFO order matches a model and transfers <= enqueues", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer(), { nil: undefined }), { maxLength: 300 }), (ops) => {
        const q = new TwoStackQueue<number>();
        const model: number[] = [];
        let enq = 0;
        for (const op of ops) {
          if (op === undefined) assert.equal(q.dequeue(), model.shift());
          else {
            q.enqueue(op);
            model.push(op);
            enq++;
          }
        }
        assert.ok(q.transfers <= enq);
      }),
      { seed: 5, numRuns: 200 },
    );
  });

  it("property: MinStack.min() equals the minimum of the live contents after every operation", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer({ min: -20, max: 20 }), { nil: undefined }), { maxLength: 200 }), (ops) => {
        const s = new MinStack();
        const model: number[] = [];
        for (const op of ops) {
          if (op === undefined) assert.equal(s.pop(), model.pop());
          else {
            s.push(op);
            model.push(op);
          }
          assert.equal(s.min(), model.length === 0 ? undefined : Math.min(...model));
        }
      }),
      { seed: 6, numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Linked lists: reversal invariant and Floyd cycle detection
// ---------------------------------------------------------------------------
interface LNode {
  val: number;
  next: LNode | null;
}

function buildRho(mu: number, lambda: number): { head: LNode | null; nodes: LNode[] } {
  // mu tail nodes followed by a cycle of lambda nodes; lambda = 0 means acyclic with mu nodes.
  const total = mu + lambda;
  const nodes: LNode[] = Array.from({ length: total }, (_, i) => ({ val: i, next: null }));
  for (let i = 0; i + 1 < total; i++) nodes[i]!.next = nodes[i + 1]!;
  if (lambda > 0) nodes[total - 1]!.next = nodes[mu]!;
  return { head: nodes[0] ?? null, nodes };
}

function floyd(head: LNode | null): { meetStep: number; mu: number; lambda: number; meetNode: LNode } | null {
  let slow = head;
  let fast = head;
  let steps = 0;
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
    steps++;
    if (slow === fast) {
      let mu = 0;
      let a = head!;
      let b = slow!;
      while (a !== b) {
        a = a.next!;
        b = b.next!;
        mu++;
      }
      let lambda = 1;
      let c = a.next!;
      while (c !== a) {
        c = c.next!;
        lambda++;
      }
      return { meetStep: steps, mu, lambda, meetNode: slow! };
    }
  }
  return null;
}

function reverseList(head: LNode | null, check: (prev: LNode | null, curr: LNode | null) => void): LNode | null {
  let prev: LNode | null = null;
  let curr = head;
  while (curr !== null) {
    check(prev, curr); // invariant: prev heads the reversed prefix, curr heads the untouched suffix
    const next: LNode | null = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}

describe("Module 02 (deep): linked list algorithms", () => {
  it("reversal keeps the invariant 'reversed prefix + untouched suffix' at every iteration", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), (n) => {
        const { head, nodes } = buildRho(n, 0);
        let iteration = 0;
        const out = reverseList(head, (prev, curr) => {
          // prefix nodes[0..iteration) reversed behind prev, suffix starts at nodes[iteration]
          assert.equal(curr, nodes[iteration]);
          assert.equal(prev, iteration === 0 ? null : nodes[iteration - 1]);
          let p: LNode | null = prev;
          for (let i = iteration - 1; i >= 0; i--) {
            assert.equal(p, nodes[i]);
            p = p!.next;
          }
          assert.equal(p, null);
          iteration++;
        });
        const seen: number[] = [];
        for (let x = out; x; x = x.next) seen.push(x.val);
        assert.deepEqual(seen, Array.from({ length: n }, (_, i) => n - 1 - i));
      }),
      { seed: 3, numRuns: 60 },
    );
  });

  it("Floyd: first meeting step is the least positive multiple of lambda that is >= mu; phase 2 returns exact mu and lambda", () => {
    for (let mu = 0; mu <= 25; mu++) {
      for (let lambda = 1; lambda <= 25; lambda++) {
        const { head } = buildRho(mu, lambda);
        const r = floyd(head);
        assert.ok(r, `mu=${mu} lambda=${lambda}`);
        let k = Math.max(mu, 1);
        while (k % lambda !== 0) k++;
        assert.equal(r.meetStep, k);
        assert.equal(r.mu, mu);
        assert.equal(r.lambda, lambda);
      }
    }
  });

  it("Floyd returns null on acyclic lists, and the meeting node is not the cycle entry in general (negative test)", () => {
    for (let n = 0; n < 10; n++) assert.equal(floyd(buildRho(n, 0).head), null);
    const { head, nodes } = buildRho(3, 5);
    const r = floyd(head)!;
    assert.notEqual(r.meetNode, nodes[3], "returning the meeting node would be a wrong 'cycle start'");
    assert.equal(r.mu, 3);
  });
});

// ---------------------------------------------------------------------------
// 6. Bit tricks with proofs
// ---------------------------------------------------------------------------
function popcountSwar(x: number): number {
  let v = x >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return Math.imul(v, 0x01010101) >>> 24;
}

function popcountNaive(x: number): number {
  let c = 0;
  for (let v = x >>> 0; v !== 0; v >>>= 1) c += v & 1;
  return c;
}

function* submasks(mask: number): Generator<number> {
  for (let s = mask; s > 0; s = (s - 1) & mask) yield s;
}

function* gosper(n: number, k: number): Generator<number> {
  if (k === 0) {
    yield 0;
    return;
  }
  let x = (1 << k) - 1;
  const limit = 1 << n;
  while (x < limit) {
    yield x;
    const c = x & -x;
    const r = x + c;
    x = (((r ^ x) >>> 2) / c) | r;
  }
}

describe("Module 02 (deep): bit manipulation", () => {
  it("property: SWAR popcount equals the naive loop for every uint32", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (x) => popcountSwar(x) === popcountNaive(x)),
      { seed: 9, numRuns: 500 },
    );
  });

  it("two's complement identities: -x === ~x + 1, x & -x isolates the lowest set bit", () => {
    fc.assert(
      fc.property(fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 }), (x) => {
        assert.equal(-x | 0, (~x + 1) | 0);
        if (x !== 0 && x !== -(2 ** 31)) {
          const low = x & -x;
          assert.equal(popcountSwar(low), 1);
          assert.equal(x & (x - 1), x - low);
        }
      }),
      { seed: 10, numRuns: 300 },
    );
  });

  it("submask enumeration visits each of the 2^popcount - 1 non-empty submasks once, in decreasing order", () => {
    for (const mask of [0b1, 0b101, 0b110110, 0b1111111, 0b10010010010]) {
      const seen = [...submasks(mask)];
      assert.equal(seen.length, 2 ** popcountSwar(mask) - 1);
      assert.equal(new Set(seen).size, seen.length);
      assert.ok(seen.every((s) => (s & mask) === s));
      for (let i = 1; i < seen.length; i++) assert.ok(seen[i]! < seen[i - 1]!);
    }
  });

  it("Gosper's hack lists all C(n, k) k-subsets of an n-bit universe in increasing order", () => {
    const choose = (n: number, k: number): number => {
      let r = 1;
      for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
      return r;
    };
    for (let n = 1; n <= 12; n++) {
      for (let k = 1; k <= n; k++) {
        const seen = [...gosper(n, k)];
        assert.equal(seen.length, choose(n, k), `n=${n} k=${k}`);
        assert.ok(seen.every((m) => popcountSwar(m) === k));
        for (let i = 1; i < seen.length; i++) assert.ok(seen[i]! > seen[i - 1]!);
      }
    }
  });

  it("failure modes: shift counts wrap mod 32, 1 << 31 is negative, Math.clz32 counts leading zeros of the uint32", () => {
    assert.equal(1 << 32, 1);
    assert.equal(1 << 31, -(2 ** 31));
    assert.equal(5 >> 32, 5);
    assert.equal(Math.clz32(0), 32);
    assert.equal(Math.clz32(1), 31);
    assert.equal(Math.clz32(-1), 0);
    assert.equal(2 ** 32 | 0, 0, "ToInt32 discards bits above 31");
    assert.equal(BigInt.asUintN(64, -1n), 2n ** 64n - 1n);
  });

  it("typed arrays fix the element width and wrap or clamp deterministically", () => {
    assert.equal(Int32Array.BYTES_PER_ELEMENT, 4);
    assert.equal(Float64Array.BYTES_PER_ELEMENT, 8);
    assert.equal(new Int32Array([2 ** 31])[0], -(2 ** 31));
    assert.equal(new Uint8Array([257])[0], 1);
    assert.equal(new Uint8ClampedArray([300, -5])[0], 255);
    assert.equal(new Uint8ClampedArray([300, -5])[1], 0);
  });
});
