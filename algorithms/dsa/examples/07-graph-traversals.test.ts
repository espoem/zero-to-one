import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Kahn's Algorithm for Topological Sort & Cycle Detection
export function topologicalSortKahn(numNodes: number, edges: [number, number][]): number[] | null {
  const adj: number[][] = Array.from({ length: numNodes }, () => []);
  const inDegree = new Array(numNodes).fill(0);

  for (const [u, v] of edges) {
    adj[u]!.push(v);
    inDegree[v]++;
  }

  const queue: number[] = [];
  for (let i = 0; i < numNodes; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const result: number[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    for (const v of adj[u]!) {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    }
  }

  // Cycle detection: if not all nodes visited, graph is not a DAG
  return result.length === numNodes ? result : null;
}

// Tarjan's Strongly Connected Components Algorithm
export function tarjanSCC(numNodes: number, edges: [number, number][]): number[][] {
  const adj: number[][] = Array.from({ length: numNodes }, () => []);
  for (const [u, v] of edges) {
    adj[u]!.push(v);
  }

  const discovery = new Array(numNodes).fill(-1);
  const low = new Array(numNodes).fill(-1);
  const onStack = new Array(numNodes).fill(false);
  const stack: number[] = [];
  const sccs: number[][] = [];
  let time = 0;

  function dfs(u: number): void {
    discovery[u] = low[u] = time++;
    stack.push(u);
    onStack[u] = true;

    for (const v of adj[u]!) {
      if (discovery[v] === -1) {
        dfs(v);
        low[u] = Math.min(low[u]!, low[v]!);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u]!, discovery[v]!);
      }
    }

    if (low[u] === discovery[u]) {
      const component: number[] = [];
      while (true) {
        const v = stack.pop()!;
        onStack[v] = false;
        component.push(v);
        if (v === u) break;
      }
      sccs.push(component.sort((a, b) => a - b));
    }
  }

  for (let i = 0; i < numNodes; i++) {
    if (discovery[i] === -1) dfs(i);
  }

  return sccs.sort((a, b) => a[0]! - b[0]!);
}

// 0-1 BFS Shortest Path using Deque
export function zeroOneBFS(
  numNodes: number,
  edges: [number, number, 0 | 1][],
  source: number
): number[] {
  const adj: [number, 0 | 1][][] = Array.from({ length: numNodes }, () => []);
  for (const [u, v, w] of edges) {
    adj[u]!.push([v, w]);
  }

  const dist = new Array(numNodes).fill(Infinity);
  dist[source] = 0;

  const deque: number[] = [source];

  while (deque.length > 0) {
    const u = deque.shift()!;

    for (const [v, weight] of adj[u]!) {
      if (dist[u]! + weight < dist[v]!) {
        dist[v] = dist[u]! + weight;
        if (weight === 0) {
          deque.unshift(v); // Push front for weight 0
        } else {
          deque.push(v);    // Push back for weight 1
        }
      }
    }
  }

  return dist;
}

// Bipartite Graph Detection (2-Coloring via BFS)
export function isBipartite(numNodes: number, edges: [number, number][]): boolean {
  const adj: number[][] = Array.from({ length: numNodes }, () => []);
  for (const [u, v] of edges) {
    adj[u]!.push(v);
    adj[v]!.push(u); // Undirected
  }

  const colors = new Array(numNodes).fill(-1); // -1: uncolored, 0: red, 1: blue

  for (let start = 0; start < numNodes; start++) {
    if (colors[start] !== -1) continue;

    colors[start] = 0;
    const queue: number[] = [start];

    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of adj[u]!) {
        if (colors[v] === -1) {
          colors[v] = 1 - colors[u]!; // Alternate color
          queue.push(v);
        } else if (colors[v] === colors[u]) {
          return false; // Adjacent nodes have same color -> NOT bipartite!
        }
      }
    }
  }

  return true;
}

describe("Module 07: Graph Foundations, Traversals & Topological Sorting", () => {
  it("Kahn's algorithm produces valid topological sort on DAG and detects cycles", () => {
    // Valid DAG: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3
    const dagEdges: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3]
    ];
    const order = topologicalSortKahn(4, dagEdges);
    assert.ok(order !== null);
    assert.equal(order[0], 0);
    assert.equal(order[3], 3);

    // Cyclic graph: 0 -> 1 -> 2 -> 0
    const cycleEdges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 0]
    ];
    assert.equal(topologicalSortKahn(3, cycleEdges), null);
  });

  it("Tarjan's algorithm correctly decomposes graph into Strongly Connected Components", () => {
    // 0 -> 1 -> 2 -> 0 (SCC 1), 2 -> 3 (cross), 3 -> 4 -> 3 (SCC 2)
    const edges: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 3]
    ];

    const sccs = tarjanSCC(5, edges);
    assert.deepEqual(sccs, [
      [0, 1, 2],
      [3, 4]
    ]);
  });

  it("0-1 BFS finds shortest paths in O(V + E) time without binary heap overhead", () => {
    // Graph:
    // 0 --(1)--> 1 --(0)--> 2
    // 0 --(0)--> 3 --(1)--> 2
    // Shortest path to 2 should be: 0 -> 3 -> 2 (cost: 0 + 1 = 1)
    const edges: [number, number, 0 | 1][] = [
      [0, 1, 1],
      [1, 2, 0],
      [0, 3, 0],
      [3, 2, 1]
    ];

    const dist = zeroOneBFS(4, edges, 0);
    assert.equal(dist[0], 0);
    assert.equal(dist[1], 1);
    assert.equal(dist[2], 1);
    assert.equal(dist[3], 0);
  });

  it("Bipartite detection correctly identifies 2-colorable graphs vs odd-cycle graphs", () => {
    // Even cycle: 0 - 1 - 2 - 3 - 0 (Bipartite)
    const evenCycle: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ];
    assert.equal(isBipartite(4, evenCycle), true);

    // Triangle (odd cycle of 3): 0 - 1 - 2 - 0 (NOT Bipartite)
    const oddCycle: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 0]
    ];
    assert.equal(isBipartite(3, oddCycle), false);
  });
});
