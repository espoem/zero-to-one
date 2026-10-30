import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// High-performance circular ring-buffer Deque
export class CircularDeque<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(initialCapacity = 8) {
    // Capacity MUST be a power of two for bitwise mask wrapping
    let cap = 1;
    while (cap < initialCapacity) cap <<= 1;
    this.buffer = new Array(cap);
  }

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this.buffer.length;
  }

  pushBack(item: T): void {
    if (this.count === this.buffer.length) {
      this.resize(this.buffer.length * 2);
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) & (this.buffer.length - 1);
    this.count++;
  }

  pushFront(item: T): void {
    if (this.count === this.buffer.length) {
      this.resize(this.buffer.length * 2);
    }
    this.head = (this.head - 1 + this.buffer.length) & (this.buffer.length - 1);
    this.buffer[this.head] = item;
    this.count++;
  }

  popFront(): T | undefined {
    if (this.count === 0) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined; // Avoid memory leaks
    this.head = (this.head + 1) & (this.buffer.length - 1);
    this.count--;
    return item;
  }

  popBack(): T | undefined {
    if (this.count === 0) return undefined;
    this.tail = (this.tail - 1 + this.buffer.length) & (this.buffer.length - 1);
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.count--;
    return item;
  }

  peekFront(): T | undefined {
    return this.count === 0 ? undefined : this.buffer[this.head];
  }

  peekBack(): T | undefined {
    if (this.count === 0) return undefined;
    const index = (this.tail - 1 + this.buffer.length) & (this.buffer.length - 1);
    return this.buffer[index];
  }

  private resize(newCapacity: number): void {
    const newBuffer = new Array<T | undefined>(newCapacity);
    for (let i = 0; i < this.count; i++) {
      newBuffer[i] = this.buffer[(this.head + i) & (this.buffer.length - 1)];
    }
    this.buffer = newBuffer;
    this.head = 0;
    this.tail = this.count;
  }
}

// Doubly Linked List with Sentinel
class ListNode<T> {
  value: T;
  prev: ListNode<T>;
  next: ListNode<T>;

  constructor(value: T, prev?: ListNode<T>, next?: ListNode<T>) {
    this.value = value;
    this.prev = prev ?? this;
    this.next = next ?? this;
  }
}

export class SentinelLinkedList<T> {
  private sentinel: ListNode<T>;
  private count = 0;

  constructor() {
    this.sentinel = new ListNode<T>(undefined as unknown as T);
    this.sentinel.next = this.sentinel;
    this.sentinel.prev = this.sentinel;
  }

  get length(): number {
    return this.count;
  }

  pushBack(val: T): void {
    const node = new ListNode(val, this.sentinel.prev, this.sentinel);
    this.sentinel.prev.next = node;
    this.sentinel.prev = node;
    this.count++;
  }

  popFront(): T | undefined {
    if (this.count === 0) return undefined;
    const first = this.sentinel.next;
    this.sentinel.next = first.next;
    first.next.prev = this.sentinel;
    this.count--;
    return first.value;
  }

  toArray(): T[] {
    const result: T[] = [];
    let curr = this.sentinel.next;
    while (curr !== this.sentinel) {
      result.push(curr.value);
      curr = curr.next;
    }
    return result;
  }
}

// Bitwise helper primitives
export function countSetBitsKernighan(n: number): number {
  let count = 0;
  let x = n >>> 0; // Coerce to unsigned 32-bit uint
  while (x > 0) {
    x = (x & (x - 1)) >>> 0; // Re-coerce to unsigned after bitwise operator
    count++;
  }
  return count;
}

export function lowestSetBit(n: number): number {
  return n & -n;
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

describe("Module 02: Linear Data Structures, Ring Buffer Deque & Bitwise Math", () => {
  it("executes double-ended queue operations in O(1) time without array-shifting penalties", () => {
    const deque = new CircularDeque<number>(4);

    deque.pushBack(10);
    deque.pushBack(20);
    deque.pushFront(5);
    deque.pushFront(1);

    assert.equal(deque.length, 4);
    assert.equal(deque.peekFront(), 1);
    assert.equal(deque.peekBack(), 20);

    // Dynamic resize triggered
    deque.pushBack(30);
    assert.ok(deque.capacity >= 8);

    assert.equal(deque.popFront(), 1);
    assert.equal(deque.popFront(), 5);
    assert.equal(deque.popBack(), 30);
    assert.equal(deque.popBack(), 20);
    assert.equal(deque.popFront(), 10);
    assert.equal(deque.popFront(), undefined);
    assert.equal(deque.length, 0);
  });

  it("proves sentinel doubly linked list eliminates edge cases on head/tail insertions & deletions", () => {
    const list = new SentinelLinkedList<string>();

    list.pushBack("Alpha");
    list.pushBack("Beta");
    list.pushBack("Gamma");

    assert.equal(list.length, 3);
    assert.deepEqual(list.toArray(), ["Alpha", "Beta", "Gamma"]);

    assert.equal(list.popFront(), "Alpha");
    assert.equal(list.popFront(), "Beta");
    assert.equal(list.popFront(), "Gamma");
    assert.equal(list.popFront(), undefined);
    assert.equal(list.length, 0);
  });

  it("verifies bitwise Word-RAM primitives: Kernighan count, lowest set bit, and power of two", () => {
    assert.equal(countSetBitsKernighan(0), 0);
    assert.equal(countSetBitsKernighan(1), 1);
    assert.equal(countSetBitsKernighan(7), 3); // 0b111
    assert.equal(countSetBitsKernighan(0b10101010), 4);
    assert.equal(countSetBitsKernighan(0xffffffff), 32);

    assert.equal(lowestSetBit(12), 4);  // 12 = 0b1100 -> lowest bit is 4 (0b0100)
    assert.equal(lowestSetBit(16), 16); // 16 = 0b10000 -> 16
    assert.equal(lowestSetBit(7), 1);   // 7 = 0b0111 -> 1

    assert.equal(isPowerOfTwo(1), true);
    assert.equal(isPowerOfTwo(2), true);
    assert.equal(isPowerOfTwo(1024), true);
    assert.equal(isPowerOfTwo(1023), false);
    assert.equal(isPowerOfTwo(0), false);
    assert.equal(isPowerOfTwo(-8), false);
  });

  it("property test: CircularDeque behaves identically to a naive array-based queue model", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom("pushFront", "pushBack", "popFront", "popBack"),
            val: fc.integer()
          })
        ),
        (operations) => {
          const deque = new CircularDeque<number>();
          const model: number[] = [];

          for (const { op, val } of operations) {
            if (op === "pushFront") {
              deque.pushFront(val);
              model.unshift(val);
            } else if (op === "pushBack") {
              deque.pushBack(val);
              model.push(val);
            } else if (op === "popFront") {
              const res = deque.popFront();
              const exp = model.shift();
              assert.equal(res, exp);
            } else if (op === "popBack") {
              const res = deque.popBack();
              const exp = model.pop();
              assert.equal(res, exp);
            }
            assert.equal(deque.length, model.length);
          }
        }
      ),
      { numRuns: 150 }
    );
  });
});
