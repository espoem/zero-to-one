import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * 1. Okapi BM25 Lexical Inverted Index
 */
export class InvertedIndexBM25 {
  readonly k1: number;
  readonly b: number;
  documents = new Map<number, string[]>(); // docId -> tokens
  postings = new Map<string, Map<number, number>>(); // term -> (docId -> termFreq)
  totalLength = 0;

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  addDocument(docId: number, text: string): void {
    const tokens = text.toLowerCase().match(/\b\w+\b/g) ?? [];
    this.documents.set(docId, tokens);
    this.totalLength += tokens.length;

    const tfMap = new Map<number, number>();
    for (const t of tokens) {
      if (!this.postings.has(t)) {
        this.postings.set(t, new Map());
      }
      const termPostings = this.postings.get(t)!;
      termPostings.set(docId, (termPostings.get(docId) ?? 0) + 1);
    }
  }

  score(query: string): { docId: number; score: number }[] {
    const queryTokens = query.toLowerCase().match(/\b\w+\b/g) ?? [];
    const N = this.documents.size;
    if (N === 0) return [];
    const avgdl = this.totalLength / N;

    const scores = new Map<number, number>();

    for (const term of queryTokens) {
      const termPostings = this.postings.get(term);
      if (!termPostings) continue;

      const n = termPostings.size; // Document frequency
      // IDF = ln((N - n + 0.5) / (n + 0.5) + 1)
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      for (const [docId, tf] of termPostings.entries()) {
        const docLen = this.documents.get(docId)!.length;
        // BM25 term weight
        const tfWeight = (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * (docLen / avgdl)));
        const termScore = idf * tfWeight;
        scores.set(docId, (scores.get(docId) ?? 0) + termScore);
      }
    }

    return Array.from(scores.entries())
      .map(([docId, score]) => ({ docId, score }))
      .sort((a, b) => b.score - a.score);
  }
}

/**
 * 2. Vector Approximate Nearest Neighbor (ANN) Proximity Graph
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export class ToyHNSW {
  readonly m: number; // Max connections per node
  nodes: { id: number; vector: number[]; neighbors: Set<number> }[] = [];

  constructor(m = 8) {
    this.m = m;
  }

  insert(id: number, vector: number[]): void {
    const newNode = { id, vector, neighbors: new Set<number>() };

    if (this.nodes.length > 0) {
      // Find closest existing nodes to link
      const distances = this.nodes.map((node) => ({
        node,
        dist: euclideanDistance(vector, node.vector),
      }));

      distances.sort((a, b) => a.dist - b.dist);
      const connections = distances.slice(0, this.m);

      for (const { node } of connections) {
        newNode.neighbors.add(node.id);
        node.neighbors.add(newNode.id);
      }
    }

    this.nodes.push(newNode);
  }

  // Greedy graph routing search
  search(query: number[], k: number): { id: number; dist: number }[] {
    if (this.nodes.length === 0) return [];

    let current = this.nodes[0]!;
    let currentDist = euclideanDistance(query, current.vector);

    const visited = new Set<number>([current.id]);
    const candidates = [{ id: current.id, dist: currentDist }];

    let changed = true;
    while (changed) {
      changed = false;
      for (const neighborId of current.neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const neighbor = this.nodes.find((n) => n.id === neighborId)!;
          const d = euclideanDistance(query, neighbor.vector);
          candidates.push({ id: neighbor.id, dist: d });

          if (d < currentDist) {
            current = neighbor;
            currentDist = d;
            changed = true;
          }
        }
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, k);
  }
}

describe('Indexing Retrieval: BM25 Lexical & Vector ANN Search', () => {
  it('correctly ranks documents using Okapi BM25 relevance scoring', () => {
    const bm25 = new InvertedIndexBM25();

    bm25.addDocument(1, 'Distributed systems use consensus protocols like Paxos and Raft.');
    bm25.addDocument(2, 'Relational databases use B-Trees and Write-Ahead Logging.');
    bm25.addDocument(3, 'Raft is a consensus algorithm designed for ease of understanding in distributed systems.');

    // Query for 'consensus distributed'
    const results = bm25.score('consensus distributed');

    assert.equal(results.length > 0, true);
    // Doc 1 and Doc 3 mention both terms; Doc 2 mentions neither
    const topDocIds = results.slice(0, 2).map((r) => r.docId);
    assert.equal(topDocIds.includes(1), true);
    assert.equal(topDocIds.includes(3), true);
    assert.equal(results.some((r) => r.docId === 2), false);
  });

  it('evaluates Vector Approximate Nearest Neighbor search against brute-force ground truth', () => {
    const ann = new ToyHNSW(8);
    const vectorDim = 16;
    const numVectors = 100;

    // Generate deterministic pseudo-random vectors
    const dataset: { id: number; vector: number[] }[] = [];
    for (let i = 0; i < numVectors; i++) {
      const vec: number[] = [];
      for (let d = 0; d < vectorDim; d++) {
        vec.push(Math.sin(i * 10 + d));
      }
      dataset.push({ id: i, vector: vec });
      ann.insert(i, vec);
    }

    const queryVec: number[] = Array.from({ length: vectorDim }, (_, d) => Math.cos(d));

    // 1. Brute-force exact search (ground truth)
    const exact = dataset
      .map((item) => ({ id: item.id, dist: euclideanDistance(queryVec, item.vector) }))
      .sort((a, b) => a.dist - b.dist);
    const exactTopK = exact.slice(0, 5).map((x) => x.id);

    // 2. ANN graph search
    const annResults = ann.search(queryVec, 5).map((x) => x.id);

    // Assert that ANN search discovered top candidates with high overlap
    const overlap = annResults.filter((id) => exactTopK.includes(id));
    assert(overlap.length >= 3, `Expected at least 3/5 overlap with exact top-5, got ${overlap.length}`);
  });
});
