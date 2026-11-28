import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

export interface IndexedDoc {
  id: string;
  tenantId: string;
  text: string;
  embedding: readonly number[];
}

export interface RankedHit {
  id: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 0);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  assert.equal(a.length, b.length, 'Vector dimensions must match');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function scoreBm25(
  docs: readonly IndexedDoc[],
  query: string,
  k1 = 1.5,
  b = 0.75,
): RankedHit[] {
  const queryTerms = Array.from(new Set(tokenize(query)));
  const tokenizedDocs = docs.map((d) => ({
    id: d.id,
    tokens: tokenize(d.text),
  }));
  const N = tokenizedDocs.length;
  if (N === 0) return [];

  const avgdl = tokenizedDocs.reduce((acc, d) => acc + d.tokens.length, 0) / N;

  const docFreq = new Map<string, number>();
  for (const term of queryTerms) {
    let df = 0;
    for (const d of tokenizedDocs) {
      if (d.tokens.includes(term)) df++;
    }
    docFreq.set(term, df);
  }

  return tokenizedDocs
    .map((d) => {
      let score = 0;
      const dl = d.tokens.length || 1;
      for (const term of queryTerms) {
        const tf = d.tokens.filter((t) => t === term).length;
        if (tf === 0) continue;
        const df = docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = tf + k1 * (1 - b + b * (dl / avgdl));
        score += idf * ((tf * (k1 + 1)) / denom);
      }
      return { id: d.id, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, bHit) => bHit.score - a.score || a.id.localeCompare(bHit.id));
}

export function scoreDense(
  docs: readonly IndexedDoc[],
  queryEmbedding: readonly number[],
): RankedHit[] {
  return docs
    .map((d) => ({ id: d.id, score: cosineSimilarity(queryEmbedding, d.embedding) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function reciprocalRankFusion(
  rankedLists: readonly (readonly RankedHit[])[],
  k = 60,
): RankedHit[] {
  const fused = new Map<string, number>();
  for (const list of rankedLists) {
    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      if (!item) continue;
      const rank = idx + 1; // 1-based ordinal rank
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (k + rank));
    }
  }
  return Array.from(fused.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function postFilterSearch(
  docs: readonly IndexedDoc[],
  queryEmbedding: readonly number[],
  tenantId: string,
  globalTopK: number,
  finalK: number,
): IndexedDoc[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const globalAnn = scoreDense(docs, queryEmbedding).slice(0, globalTopK);
  const filtered: IndexedDoc[] = [];
  for (const hit of globalAnn) {
    const doc = byId.get(hit.id);
    if (doc && doc.tenantId === tenantId) {
      filtered.push(doc);
      if (filtered.length >= finalK) break;
    }
  }
  return filtered;
}

export function preFilterSearch(
  docs: readonly IndexedDoc[],
  queryEmbedding: readonly number[],
  tenantId: string,
  finalK: number,
): IndexedDoc[] {
  const scoped = docs.filter((d) => d.tenantId === tenantId);
  const byId = new Map(scoped.map((d) => [d.id, d]));
  return scoreDense(scoped, queryEmbedding)
    .slice(0, finalK)
    .map((h) => byId.get(h.id))
    .filter((d): d is IndexedDoc => d !== undefined);
}

// Ragas 0.4.4 deterministic metric formulas
export function computeFaithfulness(supportedClaims: number, totalClaims: number): number {
  if (totalClaims === 0) return 1;
  return supportedClaims / totalClaims;
}

export function computeContextRecall(
  attributableRefClaims: number,
  totalRefClaims: number,
): number {
  if (totalRefClaims === 0) return 1;
  return attributableRefClaims / totalRefClaims;
}

export function computeContextPrecisionAtK(relevanceMask: readonly (0 | 1)[]): number {
  const totalRelevant = relevanceMask.reduce<number>((sum, v) => sum + v, 0);
  if (totalRelevant === 0) return 0;
  let runningRelevant = 0;
  let weightedPrecisionSum = 0;
  for (let idx = 0; idx < relevanceMask.length; idx++) {
    const v = relevanceMask[idx] ?? 0;
    runningRelevant += v;
    if (v === 1) {
      weightedPrecisionSum += runningRelevant / (idx + 1);
    }
  }
  return weightedPrecisionSum / totalRelevant;
}

describe('RAG Hybrid Search, Filtering Selectivity & Ragas Metrics', () => {
  const corpus: IndexedDoc[] = [
    {
      id: 'doc-exact-err',
      tenantId: 'acme',
      text: 'Kubernetes pod exit code 137 triggers ERR_OOM_KILLED when cgroup memory limit is exceeded.',
      embedding: [0.65, 0.75, 0.1],
    },
    {
      id: 'doc-semantic',
      tenantId: 'acme',
      text: 'Container exhaustion terminates processes abruptly once RAM caps saturate.',
      embedding: [0.96, 0.28, 0.0],
    },
    {
      id: 'doc-noise-1',
      tenantId: 'acme',
      text: 'Pod restart policies control CrashLoopBackOff backoff intervals.',
      embedding: [0.91, 0.41, 0.0],
    },
    {
      id: 'doc-noise-2',
      tenantId: 'acme',
      text: 'Horizontal pod autoscalers scale replicas based on CPU utilization targets.',
      embedding: [0.85, 0.52, 0.0],
    },
  ];

  it('fuses BM25 exact identifier match and dense semantic match via RRF (k=60)', () => {
    const query = 'troubleshoot container memory crash ERR_OOM_KILLED';
    const queryEmbedding = [0.95, 0.31, 0.0];

    const bm25Hits = scoreBm25(corpus, query);
    const denseHits = scoreDense(corpus, queryEmbedding);

    // Dense alone ranks doc-semantic #1 and misses exact ERR_OOM_KILLED priority
    assert.equal(denseHits[0]?.id, 'doc-semantic');
    // BM25 ranks doc-exact-err #1 due to rare token ERR_OOM_KILLED
    assert.equal(bm25Hits[0]?.id, 'doc-exact-err');

    const fused = reciprocalRankFusion([bm25Hits, denseHits], 60);
    const topTwo = new Set(fused.slice(0, 2).map((h) => h.id));
    assert.ok(topTwo.has('doc-exact-err'));
    assert.ok(topTwo.has('doc-semantic'));
    assert.ok((fused[1]?.score ?? 0) - (fused[2]?.score ?? 0) > 0.01);
  });

  it('proves RRF scores are strictly bounded and monotone with rank', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        (lenBeforeBetter, gap, k) => {
          const prefix: RankedHit[] = Array.from({ length: lenBeforeBetter - 1 }, (_, i) => ({
            id: `p-${i}`,
            score: 1,
          }));
          const middle: RankedHit[] = Array.from({ length: gap }, (_, i) => ({
            id: `m-${i}`,
            score: 0.5,
          }));
          const list: RankedHit[] = [
            ...prefix,
            { id: 'better', score: 0.8 },
            ...middle,
            { id: 'worse', score: 0.2 },
          ];
          const fused = reciprocalRankFusion([list], k);
          const scoreBetter = fused.find((h) => h.id === 'better')?.score ?? 0;
          const scoreWorse = fused.find((h) => h.id === 'worse')?.score ?? 0;
          assert.ok(scoreBetter > scoreWorse);
          assert.ok(scoreBetter <= 1 / (k + 1) + 1e-12);
        },
      ),
    );
  });

  it('demonstrates the post-filter selectivity trap vs pre-filter recall preservation', () => {
    // 104 docs: 99 belong to tenant-big with slightly higher cosine similarity; 5 belong to tenant-small
    const mixedCorpus: IndexedDoc[] = [];
    for (let i = 0; i < 99; i++) {
      mixedCorpus.push({
        id: `big-${i}`,
        tenantId: 'tenant-big',
        text: `Generic policy chunk ${i}`,
        embedding: [0.99 - i * 0.0005, 0.1, 0.0],
      });
    }
    for (let i = 0; i < 5; i++) {
      mixedCorpus.push({
        id: `small-${i}`,
        tenantId: 'tenant-small',
        text: `Tenant small specific policy ${i}`,
        embedding: [0.85 - i * 0.01, 0.2, 0.0],
      });
    }

    const queryVec = [1.0, 0.0, 0.0];
    // Post-filtering top-50 global ANN returns 0 hits for tenant-small!
    const postResults = postFilterSearch(mixedCorpus, queryVec, 'tenant-small', 50, 5);
    assert.equal(postResults.length, 0);

    // Pre-filtering preserves 100% of tenant-small top-5 recall
    const preResults = preFilterSearch(mixedCorpus, queryVec, 'tenant-small', 5);
    assert.equal(preResults.length, 5);
    assert.equal(preResults[0]?.id, 'small-0');
  });

  it('computes Ragas faithfulness, context recall, and rank-aware context precision@K', () => {
    // Grounded answer: 3 of 4 claims supported (1 hallucinated deadline)
    assert.equal(computeFaithfulness(3, 4), 0.75);
    // Reference had 5 claims, 4 attributable to retrieved context
    assert.equal(computeContextRecall(4, 5), 0.8);

    // Rank-aware precision: relevant chunks ranked at [1, 2] score 1.0,
    // while burying the same 2 relevant chunks at [4, 5] drops Context Precision@5 sharply.
    const topRanked = computeContextPrecisionAtK([1, 1, 0, 0, 0]);
    const bottomRanked = computeContextPrecisionAtK([0, 0, 0, 1, 1]);

    assert.equal(topRanked, 1.0);
    // (1/4 + 2/5) / 2 = 0.325
    assert.ok(Math.abs(bottomRanked - 0.325) < 1e-9);
    assert.ok(topRanked > bottomRanked);
  });
});
