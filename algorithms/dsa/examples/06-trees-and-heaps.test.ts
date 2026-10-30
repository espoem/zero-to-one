import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

// Standard Min-Heap
export class MinHeap<T> {
  private data: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare?: (a: T, b: T) => number) {
    this.compare = compare ?? ((a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0));
  }

  static fromArray<T>(items: T[], compare?: (a: T, b: T) => number): MinHeap<T> {
    const heap = new MinHeap<T>(compare);
    heap.data = [...items];
    // O(n) buildHeap
    for (let i = Math.floor(heap.data.length / 2) - 1; i >= 0; i--) {
      heap.siftDown(i);
    }
    return heap;
  }

  get size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.siftUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    let curr = index;
    while (curr > 0) {
      const parent = (curr - 1) >> 1;
      if (this.compare(this.data[curr]!, this.data[parent]!) < 0) {
        [this.data[curr], this.data[parent]] = [this.data[parent]!, this.data[curr]!];
        curr = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let curr = index;
    const len = this.data.length;

    while (true) {
      let smallest = curr;
      const left = (curr << 1) + 1;
      const right = (curr << 1) + 2;

      if (left < len && this.compare(this.data[left]!, this.data[smallest]!) < 0) {
        smallest = left;
      }
      if (right < len && this.compare(this.data[right]!, this.data[smallest]!) < 0) {
        smallest = right;
      }

      if (smallest !== curr) {
        [this.data[curr], this.data[smallest]] = [this.data[smallest]!, this.data[curr]!];
        curr = smallest;
      } else {
        break;
      }
    }
  }
}

// Binary Tree Node for Morris Traversal
export class TreeNode<T> {
  val: T;
  left: TreeNode<T> | null = null;
  right: TreeNode<T> | null = null;

  constructor(val: T) {
    this.val = val;
  }
}

// Morris In-Order Traversal (O(1) Auxiliary Space)
export function morrisInOrder<T>(root: TreeNode<T> | null): T[] {
  const result: T[] = [];
  let curr = root;

  while (curr !== null) {
    if (curr.left === null) {
      result.push(curr.val);
      curr = curr.right;
    } else {
      // Find in-order predecessor
      let pred = curr.left;
      while (pred.right !== null && pred.right !== curr) {
        pred = pred.right;
      }

      if (pred.right === null) {
        // Thread creation
        pred.right = curr;
        curr = curr.left;
      } else {
        // Thread destruction
        pred.right = null;
        result.push(curr.val);
        curr = curr.right;
      }
    }
  }

  return result;
}

// Two-Heaps Running Median
export class MedianFinder {
  private maxHeap = new MinHeap<number>((a, b) => b - a); // Invert for max-heap
  private minHeap = new MinHeap<number>((a, b) => a - b);

  addNum(num: number): void {
    if (this.maxHeap.size === 0 || num <= this.maxHeap.peek()!) {
      this.maxHeap.push(num);
    } else {
      this.minHeap.push(num);
    }

    // Balance heap sizes
    if (this.maxHeap.size > this.minHeap.size + 1) {
      this.minHeap.push(this.maxHeap.pop()!);
    } else if (this.minHeap.size > this.maxHeap.size) {
      this.maxHeap.push(this.minHeap.pop()!);
    }
  }

  findMedian(): number {
    if (this.maxHeap.size > this.minHeap.size) {
      return this.maxHeap.peek()!;
    }
    return (this.maxHeap.peek()! + this.minHeap.peek()!) / 2.0;
  }
}

// Fenwick Tree (Binary Indexed Tree)
export class FenwickTree {
  private tree: number[];

  constructor(size: number) {
    this.tree = new Array(size + 1).fill(0);
  }

  add(index: number, delta: number): void {
    let i = index + 1; // 1-indexed internally
    while (i < this.tree.length) {
      this.tree[i]! += delta;
      i += i & -i; // i + lowbit(i)
    }
  }

  prefixSum(index: number): number {
    let sum = 0;
    let i = index + 1;
    while (i > 0) {
      sum += this.tree[i]!;
      i -= i & -i; // i - lowbit(i)
    }
    return sum;
  }

  rangeSum(left: number, right: number): number {
    return this.prefixSum(right) - (left > 0 ? this.prefixSum(left - 1) : 0);
  }
}

// Trie (Prefix Tree)
export class Trie {
  private children = new Map<string, Trie>();
  private isEnd = false;

  insert(word: string): void {
    let node: Trie = this;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new Trie());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
  }

  search(word: string): boolean {
    let node: Trie = this;
    for (const char of word) {
      if (!node.children.has(char)) return false;
      node = node.children.get(char)!;
    }
    return node.isEnd;
  }

  startsWith(prefix: string): boolean {
    let node: Trie = this;
    for (const char of prefix) {
      if (!node.children.has(char)) return false;
      node = node.children.get(char)!;
    }
    return true;
  }
}

describe("Module 06: Trees, Heaps & Priority Queues", () => {
  it("MinHeap buildHeap constructs heap in linear time and extracts in sorted order", () => {
    const numbers = [9, 4, 7, 1, -2, 6, 5];
    const heap = MinHeap.fromArray(numbers);

    const sorted: number[] = [];
    while (heap.size > 0) {
      sorted.push(heap.pop()!);
    }

    assert.deepEqual(sorted, [-2, 1, 4, 5, 6, 7, 9]);
  });

  it("Morris In-Order Traversal visits BST in sorted order in O(1) auxiliary space", () => {
    // Construct BST:
    //       4
    //     /   \
    //    2     6
    //   / \   / \
    //  1   3 5   7
    const root = new TreeNode(4);
    root.left = new TreeNode(2);
    root.right = new TreeNode(6);
    root.left.left = new TreeNode(1);
    root.left.right = new TreeNode(3);
    root.right.left = new TreeNode(5);
    root.right.right = new TreeNode(7);

    const visited = morrisInOrder(root);
    assert.deepEqual(visited, [1, 2, 3, 4, 5, 6, 7]);
  });

  it("MedianFinder computes running stream medians via Two Heaps", () => {
    const mf = new MedianFinder();
    mf.addNum(1);
    assert.equal(mf.findMedian(), 1);
    mf.addNum(2);
    assert.equal(mf.findMedian(), 1.5);
    mf.addNum(3);
    assert.equal(mf.findMedian(), 2);
    mf.addNum(10);
    assert.equal(mf.findMedian(), 2.5);
    mf.addNum(4);
    assert.equal(mf.findMedian(), 3);
  });

  it("Fenwick Tree executes point updates and range sum queries accurately", () => {
    const bit = new FenwickTree(6);
    const initial = [1, 3, 5, 7, 9, 11];

    for (let i = 0; i < initial.length; i++) {
      bit.add(i, initial[i]!);
    }

    assert.equal(bit.rangeSum(0, 2), 1 + 3 + 5);      // 9
    assert.equal(bit.rangeSum(1, 4), 3 + 5 + 7 + 9);  // 24
    assert.equal(bit.rangeSum(0, 5), 36);

    // Update index 2 by adding 6 (5 -> 11)
    bit.add(2, 6);
    assert.equal(bit.rangeSum(0, 2), 1 + 3 + 11);     // 15
    assert.equal(bit.rangeSum(2, 2), 11);
  });

  it("Trie correctly inserts, searches full words, and matches prefixes", () => {
    const trie = new Trie();
    trie.insert("apple");

    assert.equal(trie.search("apple"), true);
    assert.equal(trie.search("app"), false);
    assert.equal(trie.startsWith("app"), true);

    trie.insert("app");
    assert.equal(trie.search("app"), true);
  });
});
