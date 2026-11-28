import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface ModelGeometry {
  layers: number;
  queryHeads: number;
  kvHeads: number;
  headDim: number;
  bytesPerElem: number;
}

function kvBytesPerToken(g: ModelGeometry): number {
  if (g.layers <= 0 || g.kvHeads <= 0 || g.headDim <= 0 || g.bytesPerElem <= 0) {
    throw new RangeError('Model geometry dimensions and byte width must be positive');
  }
  return 2 * g.layers * g.kvHeads * g.headDim * g.bytesPerElem;
}

function mhaBytes(g: ModelGeometry, seqLen: number, batchSize: number): number {
  return kvBytesPerToken(g) * seqLen * batchSize;
}

function mqaBytes(g: ModelGeometry, seqLen: number, batchSize: number): number {
  return kvBytesPerToken({ ...g, kvHeads: 1 }) * seqLen * batchSize;
}

function gqaBytes(g: ModelGeometry, groupSize: number, seqLen: number, batchSize: number): number {
  if (groupSize <= 0 || g.queryHeads % groupSize !== 0) {
    throw new RangeError('groupSize must positively divide queryHeads');
  }
  const kvHeads = g.queryHeads / groupSize;
  return kvBytesPerToken({ ...g, kvHeads }) * seqLen * batchSize;
}

function mlaBytes(
  layers: number,
  dc: number,
  dhRope: number,
  bytesPerElem: number,
  seqLen: number,
  batchSize: number,
): number {
  return layers * (dc + dhRope) * bytesPerElem * seqLen * batchSize;
}

function slidingWindowBytes(
  g: ModelGeometry,
  seqLen: number,
  windowSize: number,
  batchSize: number,
): number {
  return kvBytesPerToken(g) * Math.min(seqLen, windowSize) * batchSize;
}

function streamingLlmBytes(
  g: ModelGeometry,
  sinkTokens: number,
  windowSize: number,
  batchSize: number,
): number {
  return kvBytesPerToken(g) * (sinkTokens + windowSize) * batchSize;
}

function pagedAttentionBytes(
  g: ModelGeometry,
  seqLen: number,
  blockSize: number,
  batchSize: number,
): { allocatedBytes: number; wasteRatio: number } {
  const blocks = Math.ceil(seqLen / blockSize);
  const allocatedTokens = blocks * blockSize;
  const allocatedBytes = kvBytesPerToken(g) * allocatedTokens * batchSize;
  const wasteRatio = (allocatedTokens - seqLen) / allocatedTokens;
  return { allocatedBytes, wasteRatio };
}

function radixAttentionBytes(
  g: ModelGeometry,
  sharedPrefixLen: number,
  suffixLens: readonly number[],
): number {
  const uniqueTokens = sharedPrefixLen + suffixLens.reduce((acc, n) => acc + n, 0);
  return kvBytesPerToken(g) * uniqueTokens;
}

function kiviQuantizedBytes(
  g: ModelGeometry,
  seqLen: number,
  batchSize: number,
  bits: number,
  groupSize: number,
  residualFp16Len: number,
): number {
  const quantizedTokens = Math.max(0, seqLen - residualFp16Len);
  const residualTokens = Math.min(seqLen, residualFp16Len);
  const elemsPerToken = 2 * g.layers * g.kvHeads * g.headDim;
  const numGroupsPerToken = elemsPerToken / groupSize;
  const payloadBytesPerToken = (elemsPerToken * bits) / 8;
  // Scale + zero-point stored in FP16 (4 bytes total per group)
  const metaBytesPerToken = numGroupsPerToken * 4;
  const quantTotal = quantizedTokens * (payloadBytesPerToken + metaBytesPerToken);
  const residualTotal = residualTokens * elemsPerToken * 2;
  return (quantTotal + residualTotal) * batchSize;
}

const KIB = 1024;
const GIB = 1024 ** 3;

describe('KV-Cache Compression (All 8 Methods)', () => {
  const llama2_7b: ModelGeometry = {
    layers: 32,
    queryHeads: 32,
    kvHeads: 32,
    headDim: 128,
    bytesPerElem: 2,
  };
  const llama3_8b: ModelGeometry = {
    layers: 32,
    queryHeads: 32,
    kvHeads: 8,
    headDim: 128,
    bytesPerElem: 2,
  };
  const llama2_70b: ModelGeometry = {
    layers: 80,
    queryHeads: 64,
    kvHeads: 8,
    headDim: 128,
    bytesPerElem: 2,
  };

  it('matches MHA baseline calibration and H100 max batch concurrency', () => {
    assert.equal(kvBytesPerToken(llama2_7b), 512 * KIB);
    assert.equal(kvBytesPerToken(llama2_70b), 320 * KIB);
    assert.equal(kvBytesPerToken(llama3_8b), 128 * KIB);

    const singleSeq128k = mhaBytes(llama3_8b, 131_072, 1);
    assert.equal(singleSeq128k, 16 * GIB);

    const h100KvBudget = (80 - 16 - 4) * GIB;
    const maxBatch = Math.floor(h100KvBudget / singleSeq128k);
    assert.equal(maxBatch, 3);
  });

  it('proves Method 1 (MQA) and Method 2 (GQA) head compression', () => {
    const base = mhaBytes(llama2_7b, 4096, 1);
    const mqa = mqaBytes(llama2_7b, 4096, 1);
    assert.equal(base / mqa, 32);

    const gqa8 = gqaBytes(llama2_7b, 4, 4096, 1);
    assert.equal(base / gqa8, 4);
    assert.equal(gqa8 / 4096, 128 * KIB);
  });

  it('proves Method 3 (DeepSeek-V2 MLA) latent compression ratio', () => {
    // DeepSeek-V2: L=60, d_c=512, d_h^R=64, BF16 (2 bytes) => 67.5 KiB/token
    const bytesPerTok = mlaBytes(60, 512, 64, 2, 1, 1);
    assert.equal(bytesPerTok, 67.5 * KIB);

    // Per-layer comparison vs MHA-128 (2 * 128 * 128 = 32768 elems/layer)
    const mlaElemsPerLayer = 512 + 64;
    const mhaElemsPerLayer = 2 * 128 * 128;
    const ratio = mlaElemsPerLayer / mhaElemsPerLayer;
    assert.ok(Math.abs(ratio - 0.017578125) < 1e-12);
    assert.ok(Math.abs(1 / ratio - 56.8888888889) < 1e-6);
  });

  it('proves Methods 4 & 5 (Sliding Window and StreamingLLM Attention Sinks)', () => {
    const window = 4096;
    const swaAt1M = slidingWindowBytes(llama3_8b, 1_000_000, window, 1);
    assert.equal(swaAt1M, 128 * KIB * 4096);

    const sinksAt4M = streamingLlmBytes(llama3_8b, 4, window, 1);
    assert.equal(sinksAt4M, 128 * KIB * 4100);
    assert.ok(sinksAt4M < 515 * 1024 * 1024);
  });

  it('proves Method 6 (PagedAttention <4% tail waste vs static max-context waste)', () => {
    const blockSize = 16;
    const actualLen = 500;
    const maxContext = 2048;
    const paged = pagedAttentionBytes(llama3_8b, actualLen, blockSize, 1);
    const staticAllocated = mhaBytes(llama3_8b, maxContext, 1);
    const staticWaste = (maxContext - actualLen) / maxContext;

    assert.ok(paged.wasteRatio < 0.04);
    assert.ok(staticWaste > 0.75);
    assert.ok(paged.allocatedBytes < staticAllocated / 3);
  });

  it('proves Method 7 (RadixAttention prefix sharing) and Method 8 (FP8/KIVI 2-bit)', () => {
    const sharedSystem = 2048;
    const suffixes = Array.from({ length: 32 }, () => 128);
    const unshared = mhaBytes(llama3_8b, sharedSystem + 128, 32);
    const radix = radixAttentionBytes(llama3_8b, sharedSystem, suffixes);
    assert.ok(unshared / radix > 10);

    const bf16 = mhaBytes(llama3_8b, 4096, 1);
    const fp8 = mhaBytes({ ...llama3_8b, bytesPerElem: 1 }, 4096, 1);
    assert.equal(bf16 / fp8, 2);

    const kivi2 = kiviQuantizedBytes(llama3_8b, 4096, 1, 2, 64, 128);
    assert.ok(bf16 / kivi2 > 5);
  });

  it('rejects invalid zero or negative geometry parameters', () => {
    assert.throws(() => kvBytesPerToken({ ...llama3_8b, kvHeads: 0 }), RangeError);
    assert.throws(() => gqaBytes(llama3_8b, 5, 1024, 1), RangeError);
  });
});
