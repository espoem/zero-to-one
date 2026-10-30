import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Disjoint-Set Union (DSU) with Path Compression and Union by Rank
export class DisjointSetUnion {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]!); // Path compression
    }
    return this.parent[x]!;
  }

  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return false; // Already in same set

    // Union by rank
    if (this.rank[rootX]! < this.rank[rootY]!) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX]! > this.rank[rootY]!) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]!++;
    }
    return true;
  }
}

// Dijkstra's Shortest Path Algorithm
export function dijkstra(
  numNodes: number,
  edges: [number, number, number][],
  source: number
): number[] {
  const adj: [number, number][][] = Array.from({ length: numNodes }, () => []);
  for (const [u, v, w] of edges) {
    adj[u]!.push([v, w]);
  }

  const dist = new Array(numNodes).fill(Infinity);
  dist[source] = 0;

  // Min-Heap queue storing [distance, node]
  const pq: [number, number][] = [[0, source]];

  while (pq.length > 0) {
    // Sort to simulate min-heap extraction
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift()!;

    if (d > dist[u]!) continue; // Outdated entry in lazy heap

    for (const [v, weight] of adj[u]!) {
      if (dist[u]! + weight < dist[v]!) {
        dist[v] = dist[u]! + weight;
        pq.push([dist[v]!, v]);
      }
    }
  }

  return dist;
}

// Bellman-Ford Algorithm with Negative Cycle Detection
export function bellmanFord(
  numNodes: number,
  edges: [number, number, number][],
  source: number
): { dist: number[]; hasNegativeCycle: boolean } {
  const dist = new Array(numNodes).fill(Infinity);
  dist[source] = 0;

  // Relax all edges |V| - 1 times
  for (let i = 0; i < numNodes - 1; i++) {
    for (const [u, v, w] of edges) {
      if (dist[u] !== Infinity && dist[u] + w < dist[v]!) {
        dist[v] = dist[u] + w;
      }
    }
  }

  // Check for negative-weight cycle on V-th pass
  let hasNegativeCycle = false;
  for (const [u, v, w] of edges) {
    if (dist[u] !== Infinity && dist[u] + w < dist[v]!) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { dist, hasNegativeCycle };
}

// Kruskal's Minimum Spanning Tree Algorithm
export function kruskalMST(
  numNodes: number,
  edges: [number, number, number][]
): { totalWeight: number; mstEdges: [number, number, number][] } {
  // Sort edges by weight in ascending order
  const sortedEdges = [...edges].sort((a, b) => a[2] - b[2]);
  const dsu = new DisjointSetUnion(numNodes);

  let totalWeight = 0;
  const mstEdges: [number, number, number][] = [];

  for (const [u, v, w] of sortedEdges) {
    if (dsu.union(u, v)) {
      totalWeight += w;
      mstEdges.push([u, v, w]);
      if (mstEdges.length === numNodes - 1) break;
    }
  }

  return { totalWeight, mstEdges };
}

// Floyd-Warshall All-Pairs Shortest Paths
export function floydWarshall(
  numNodes: number,
  edges: [number, number, number][]
): number[][] {
  const dist: number[][] = Array.from({ length: numNodes }, (_, i) =>
    Array.from({ length: numNodes }, (_, j) => (i === j ? 0 : Infinity))
  );

  for (const [u, v, w] of edges) {
    dist[u]![v] = Math.min(dist[u]![v]!, w);
  }

  for (let k = 0; k < numNodes; k++) {
    for (let i = 0; i < numNodes; i++) {
      for (let j = 0; j < numNodes; j++) {
        if (dist[i]![k]! !== Infinity && dist[k]![j]! !== Infinity) {
          dist[i]![j] = Math.min(dist[i]![j]!, dist[i]![k]! + dist[k]![j]!);
        }
      }
    }
  }

  return dist;
}

describe("Module 08: Shortest Paths, MST & Disjoint-Set Union", () => {
  it("Dijkstra accurately finds shortest paths on non-negative weighted graphs", () => {
    // 0 --(4)--> 1 --(1)--> 2
    // 0 --(2)--> 3 --(1)--> 1
    // Shortest path 0 -> 1 is: 0 -> 3 -> 1 (cost 3)
    const edges: [number, number, number][] = [
      [0, 1, 4],
      [1, 2, 1],
      [0, 3, 2],
      [3, 1, 1]
    ];

    const dist = dijkstra(4, edges, 0);
    assert.equal(dist[0], 0);
    assert.equal(dist[3], 2);
    assert.equal(dist[1], 3);
    assert.equal(dist[2], 4);
  });

  it("Bellman-Ford handles negative edge weights and flags negative-weight cycles", () => {
    // Valid negative edge graph without cycle
    const edgesNoCycle: [number, number, number][] = [
      [0, 1, 4],
      [0, 2, 5],
      [1, 2, -2] // 0 -> 1 -> 2 costs 4 + (-2) = 2 (better than 5)
    ];

    const res1 = bellmanFord(3, edgesNoCycle, 0);
    assert.equal(res1.hasNegativeCycle, false);
    assert.equal(res1.dist[2], 2);

    // Negative cycle: 1 -> 2 (cost 1), 2 -> 3 (cost -3), 3 -> 1 (cost 1) -> sum = -1
    const edgesWithCycle: [number, number, number][] = [
      [0, 1, 5],
      [1, 2, 1],
      [2, 3, -3],
      [3, 1, 1]
    ];

    const res2 = bellmanFord(4, edgesWithCycle, 0);
    assert.equal(res2.hasNegativeCycle, true);
  });

  it("Kruskal's algorithm computes the Minimum Spanning Tree using DSU", () => {
    // Undirected graph with 4 nodes:
    // (0, 1, 1), (1, 2, 2), (2, 3, 3), (0, 3, 4), (0, 2, 5)
    const edges: [number, number, number][] = [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 3],
      [0, 3, 4],
      [0, 2, 5]
    ];

    const { totalWeight, mstEdges } = kruskalMST(4, edges);
    assert.equal(totalWeight, 1 + 2 + 3); // 6
    assert.equal(mstEdges.length, 3);     // 3 edges for 4 nodes
  });

  it("Floyd-Warshall calculates all-pairs shortest paths accurately", () => {
    const edges: [number, number, number][] = [
      [0, 1, 3],
      [1, 2, 1],
      [0, 2, 8],
      [2, 0, 2]
    ];

    const matrix = floydWarshall(3, edges);
    assert.equal(matrix[0]![0], 0);
    assert.equal(matrix[0]![1], 3);
    assert.equal(matrix[0]![2], 4); // 0 -> 1 -> 2
    assert.equal(matrix[2]![1], 5); // 2 -> 0 -> 1
  });
});
