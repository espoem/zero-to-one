import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateCapacity,
  estimateLlmKvCacheBytes,
  littlesLawConcurrency,
} from './lib/system-design-models.ts';

const TB = 10 ** 12;
const PB = 10 ** 15;
const GB = 10 ** 9;
const GiB = 1024 ** 3;

test('URL Shortener capacity estimation matches order-of-magnitude bands', () => {
  // 100M DAU, 10 redirects/day, 1 new link/day, 500B record, 3x peak
  const est = estimateCapacity({
    dau: 100_000_000,
    readsPerUserPerDay: 10,
    writesPerUserPerDay: 1,
    peakMultiplier: 3,
    avgWritePayloadBytes: 500,
    avgReadPayloadBytes: 500,
    avgLatencySeconds: 0.01,
    perServerQps: 5_000,
    dailyUniqueReadFraction: 0.2,
  });

  // ~1,157 write QPS, ~11,574 read QPS, ~38k peak QPS
  assert.ok(est.avgWriteQps > 1_000 && est.avgWriteQps < 2_000);
  assert.ok(est.avgReadQps > 10_000 && est.avgReadQps < 15_000);
  assert.ok(est.peakTotalQps > 35_000 && est.peakTotalQps < 45_000);

  // 50 GB/day raw * 1825 days * 3 replicas * 1.2 index ≈ 328.5 TB
  assert.ok(est.fiveYearStorageBytes > 250 * TB && est.fiveYearStorageBytes < 450 * TB);
  assert.ok(est.peakEgressGbps > 0.1 && est.peakEgressGbps < 0.5);
  assert.ok(est.cacheRamBytes > 10 * GB && est.cacheRamBytes < 50 * GB);
  assert.ok(est.littlesLawConcurrency > 350 && est.littlesLawConcurrency < 450);
  assert.equal(est.baseServerCount, 8);
  // 3 AZs: ceil(8 * 3/2) + 2 = 14 servers with N+2 headroom
  assert.equal(est.provisionedServerCount, 14);
});

test('News Feed capacity estimation matches order-of-magnitude bands', () => {
  // 50M DAU, 20 feed loads/day, 0.5 posts/day, 1KB post, 50KB feed response
  const est = estimateCapacity({
    dau: 50_000_000,
    readsPerUserPerDay: 20,
    writesPerUserPerDay: 0.5,
    peakMultiplier: 3,
    avgWritePayloadBytes: 1_024,
    avgReadPayloadBytes: 50_000,
    avgLatencySeconds: 0.05,
    perServerQps: 2_000,
    dailyUniqueReadFraction: 0.01,
  });

  // ~11.5k read QPS avg, ~35k peak
  assert.ok(est.avgReadQps > 10_000 && est.avgReadQps < 15_000);
  assert.ok(est.peakReadQps > 30_000 && est.peakReadQps < 40_000);
  // Peak egress ~ 34.7k * 50KB * 8 ≈ 13.9 Gbps
  assert.ok(est.peakEgressGbps > 10 && est.peakEgressGbps < 25);
  // 5-year storage ≈ 168 TB
  assert.ok(est.fiveYearStorageBytes > 100 * TB && est.fiveYearStorageBytes < 250 * TB);
});

test('Chat / WhatsApp capacity estimation matches order-of-magnitude bands', () => {
  // 500M DAU, 40 messages sent/day, 40 received/day, 200B per message
  const est = estimateCapacity({
    dau: 500_000_000,
    readsPerUserPerDay: 40,
    writesPerUserPerDay: 40,
    peakMultiplier: 3,
    avgWritePayloadBytes: 200,
    avgReadPayloadBytes: 200,
    avgLatencySeconds: 0.02,
    perServerQps: 10_000,
  });

  // 20B msgs/day ≈ 231k write QPS, ~463k total avg QPS, ~1.39M peak QPS
  assert.ok(est.avgWriteQps > 200_000 && est.avgWriteQps < 300_000);
  assert.ok(est.peakTotalQps > 1_000_000 && est.peakTotalQps < 2_000_000);
  // 4 TB/day raw * 1825 * 3 * 1.2 ≈ 26.3 PB over 5 years
  assert.ok(est.fiveYearStorageBytes > 20 * PB && est.fiveYearStorageBytes < 40 * PB);
});

test('YouTube video streaming capacity estimation matches order-of-magnitude bands', () => {
  // 200M DAU, 5 video plays/day @ 300MB streamed, 0.005 uploads/day @ 500MB raw
  const est = estimateCapacity({
    dau: 200_000_000,
    readsPerUserPerDay: 5,
    writesPerUserPerDay: 0.005,
    peakMultiplier: 2,
    avgWritePayloadBytes: 500_000_000,
    avgReadPayloadBytes: 300_000_000,
    avgLatencySeconds: 0.1,
    perServerQps: 500,
    dailyUniqueReadFraction: 0.001,
  });

  // 1M uploads/day * 500MB = 500 TB/day raw -> ~3.28 EB over 5 years (with 3x rep + 20% overhead)
  assert.ok(est.fiveYearStorageBytes > 2_000 * PB && est.fiveYearStorageBytes < 5_000 * PB);
  // 1B video views/day * 300MB -> ~27.8 Tbps avg, ~55 Tbps peak CDN egress
  assert.ok(est.avgEgressGbps > 20_000 && est.avgEgressGbps < 40_000);
  assert.ok(est.peakEgressGbps > 50_000 && est.peakEgressGbps < 80_000);
});

test('estimateLlmKvCacheBytes computes exact GQA KV-cache VRAM for Llama-70B class', () => {
  // Llama-3 70B architecture: 80 layers, 8 KV heads (GQA), headDim 128, BF16 (2 bytes)
  const llama70b = {
    numLayers: 80,
    numKvHeads: 8,
    headDim: 128,
    bytesPerElement: 2,
  };

  // Per token: 2 * 80 * 8 * 128 * 2 = 327,680 bytes = 320 KiB
  const singleToken = estimateLlmKvCacheBytes({ ...llama70b, batchSize: 1, contextLength: 1 });
  assert.equal(singleToken, 327_680);

  // 8k context, batch 1 -> exactly 2.5 GiB
  const ctx8kBatch1 = estimateLlmKvCacheBytes({ ...llama70b, batchSize: 1, contextLength: 8_192 });
  assert.equal(ctx8kBatch1, 2.5 * GiB);

  // 128k context, batch 1 -> exactly 40 GiB
  const ctx128kBatch1 = estimateLlmKvCacheBytes({
    ...llama70b,
    batchSize: 1,
    contextLength: 131_072,
  });
  assert.equal(ctx128kBatch1, 40 * GiB);

  // 8k context, batch 32 -> 80 GiB (exhausts single 80GB H100 before even counting weights!)
  const ctx8kBatch32 = estimateLlmKvCacheBytes({
    ...llama70b,
    batchSize: 32,
    contextLength: 8_192,
  });
  assert.equal(ctx8kBatch32, 80 * GiB);
});

test("Negative test (Little's Law): 10x DB latency jump at constant QPS overflows fixed pool", () => {
  const constantQps = 500;
  const fixedPoolSize = 50;

  const healthyLatencySec = 0.02; // 20 ms
  const healthyConcurrency = littlesLawConcurrency(constantQps, healthyLatencySec);
  assert.equal(healthyConcurrency, 10);
  assert.ok(healthyConcurrency < fixedPoolSize, 'Healthy concurrency fits in 50-conn pool');

  const degradedLatencySec = healthyLatencySec * 10; // 200 ms (10x jump)
  const degradedConcurrency = littlesLawConcurrency(constantQps, degradedLatencySec);
  assert.equal(degradedConcurrency, 100);
  assert.equal(degradedConcurrency / healthyConcurrency, 10);
  assert.ok(
    degradedConcurrency > fixedPoolSize,
    '10x latency jump multiplies L 10x and overflows the 50-connection pool',
  );
});
