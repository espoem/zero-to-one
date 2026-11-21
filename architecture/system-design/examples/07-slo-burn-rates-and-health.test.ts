import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistogram,
  computeBurnRateThreshold,
  estimateTsdbCardinality,
  evaluateBurnRateAlerts,
  histogramQuantile,
  mergeHistograms,
  type MinuteSlice,
  simulateLbHealthCheck,
  SRE_30D_BURN_RATE_RULES,
} from './lib/system-design-models.ts';

test('Google SRE Workbook multi-window multi-burn-rate thresholds and 5m short-window reset', () => {
  // Verify exact 30d (720h) thresholds from SRE Workbook Ch. 5
  assert.equal(computeBurnRateThreshold(720, 1, 0.02), 14.4);
  assert.equal(computeBurnRateThreshold(720, 6, 0.05), 6);
  assert.equal(computeBurnRateThreshold(720, 72, 0.1), 1);

  const sloTarget = 0.999; // 0.1% error budget
  const history: MinuteSlice[] = Array.from({ length: 5_000 }, () => ({
    requests: 1_000,
    errors: 0,
  }));

  // Inject an outage from minute 4320..4335 (15 minutes at 6% error rate -> 60x burn rate)
  // Over 1h (60m), 15m * 60x / 60m = 15x (> 14.4x threshold!)
  for (let m = 4_320; m < 4_335; m += 1) {
    history[m] = { requests: 1_000, errors: 60 };
  }

  // At minute 4335 (end of 15-minute outage): both 1h long (15x) and 5m short (60x) exceed 14.4x -> PAGE fires!
  const duringOutage = evaluateBurnRateAlerts(history, 4_335, sloTarget, SRE_30D_BURN_RATE_RULES);
  const page1hDuring = duringOutage.find((a) => a.name === 'page-1h-5m');
  assert.ok(page1hDuring);
  assert.equal(page1hDuring.firing, true);
  assert.ok(page1hDuring.longBurn >= 14.4);
  assert.ok(page1hDuring.shortBurn >= 14.4);

  // Mitigated at minute 4335 (errors return to 0).
  // At minute 4340 (5 minutes post-mitigation): 1h long burn is STILL 15x (>= 14.4x),
  // but the 5-minute short window (1/12 of 1h) drops to 0x -> alert clears in 5 minutes instead of 60!
  const fiveMinAfterFix = evaluateBurnRateAlerts(
    history,
    4_340,
    sloTarget,
    SRE_30D_BURN_RATE_RULES,
  );
  const page1hCleared = fiveMinAfterFix.find((a) => a.name === 'page-1h-5m');
  assert.ok(page1hCleared);
  assert.ok(page1hCleared.longBurn >= 14.4, '1h long window is still hot');
  assert.equal(page1hCleared.shortBurn, 0, '5m short window cleared to 0');
  assert.equal(page1hCleared.firing, false, 'ANDing short window clears alert in 5m');
});

test('Negative test: Averaging per-host p99s diverges wildly from exact merged-histogram p99', () => {
  const bounds = [5, 10, 20, 50, 100, 250, 500, 1_000, 2_000];

  // Host A handles 10,000 fast requests (~10ms); Host B & C handle 50 requests each with slow tails
  const hostASamples = Array.from({ length: 10_000 }, () => 10);
  const hostBSamples = Array.from({ length: 50 }, () => 1_000);
  const hostCSamples = Array.from({ length: 50 }, () => 500);

  const histA = buildHistogram(hostASamples, bounds);
  const histB = buildHistogram(hostBSamples, bounds);
  const histC = buildHistogram(hostCSamples, bounds);

  const p99A = histogramQuantile(histA, 0.99);
  const p99B = histogramQuantile(histB, 0.99);
  const p99C = histogramQuantile(histC, 0.99);

  // Naive average of per-host p99s gives ~500ms!
  const naiveAvgP99 = (p99A + p99B + p99C) / 3;
  assert.ok(naiveAvgP99 > 400, `Naive average p99 is inflated to ${naiveAvgP99.toFixed(1)}ms`);

  // Exact merged fleet histogram: 10,000/10,100 = 99.01% of traffic is <= 10ms -> true p99 <= 10ms!
  const merged = mergeHistograms([histA, histB, histC]);
  const trueFleetP99 = histogramQuantile(merged, 0.99);
  assert.ok(trueFleetP99 <= 10, `True fleet p99 is <= 10ms, got ${trueFleetP99}ms`);
  assert.ok(naiveAvgP99 / trueFleetP99 > 30, 'Averaging p99s is >30x wrong vs merged histogram');
});

test('Negative test: Deep DB health check ejects 100% of fleet on DB blip vs fail-open readiness', () => {
  const deepCheckOutcome = simulateLbHealthCheck({
    instanceCount: 10,
    dbReachable: false,
    probeMode: 'deep-db',
  });

  assert.equal(deepCheckOutcome.ejectedInstances, 10);
  assert.equal(deepCheckOutcome.healthyInstances, 0);
  assert.equal(deepCheckOutcome.canServeDegradedTraffic, false);

  const shallowFailOpenOutcome = simulateLbHealthCheck({
    instanceCount: 10,
    dbReachable: false,
    probeMode: 'shallow-liveness-fail-open-readiness',
  });

  assert.equal(shallowFailOpenOutcome.ejectedInstances, 0);
  assert.equal(shallowFailOpenOutcome.healthyInstances, 10);
  assert.equal(shallowFailOpenOutcome.canServeDegradedTraffic, true);
});

test('Negative test: Unbounded TSDB label (user_id) explodes active series by >10^5x and OOMs head RAM budget', () => {
  const ramBudgetBytes = 8 * 1024 ** 3; // 8 GiB TSDB head budget

  // Bounded low-cardinality instrumentation: method x status_class x route_template across 20 instances & 12 histogram series
  const bounded = estimateTsdbCardinality({
    metricNames: 1,
    seriesPerMetric: 12,
    instanceCount: 20,
    labelCardinalities: {
      method: 4,
      status_class: 5,
      route_template: 20,
    },
    bytesPerActiveSeries: 4_096,
    ramBudgetBytes,
  });

  assert.equal(bounded.labelProduct, 400);
  assert.equal(bounded.activeSeries, 96_000);
  assert.equal(bounded.exceedsRamBudget, false);
  assert.ok(bounded.ramUtilizationRatio < 0.1);

  // Adding a single unbounded label (250,000 daily active user_ids) multiplies series by 2.5e5x
  const unbounded = estimateTsdbCardinality({
    metricNames: 1,
    seriesPerMetric: 12,
    instanceCount: 20,
    labelCardinalities: {
      method: 4,
      status_class: 5,
      route_template: 20,
      user_id: 250_000,
    },
    bytesPerActiveSeries: 4_096,
    ramBudgetBytes,
  });

  const growthFactor = unbounded.activeSeries / bounded.activeSeries;
  assert.ok(growthFactor >= 100_000, `Expected >= 10^5x series explosion, got ${growthFactor}x`);
  assert.equal(unbounded.exceedsRamBudget, true);
  assert.ok(
    unbounded.ramUtilizationRatio > 10_000,
    `Expected TSDB head RAM >10,000x budget, got ${unbounded.ramUtilizationRatio.toFixed(1)}x`,
  );
});

test('ByteByteGo Ch. 20 Metrics Monitoring capacity: 10M metrics, 1M samples/s, Gorilla 1.37 B/sample storage sizing', () => {
  const pools = 1_000;
  const hostsPerPool = 100;
  const metricsPerHost = 100;
  const scrapeIntervalSec = 10;

  const totalHosts = pools * hostsPerPool; // 100,000 hosts
  assert.equal(totalHosts, 100_000);

  const activeMetrics = totalHosts * metricsPerHost; // 10,000,000 active metrics
  assert.equal(activeMetrics, 10_000_000);

  const samplesPerSec = activeMetrics / scrapeIntervalSec; // 1,000,000 samples/sec
  assert.equal(samplesPerSec, 1_000_000);

  // Uncompressed 16 bytes/sample (int64 timestamp + float64 value)
  const uncompressedBytesPerSec = samplesPerSec * 16;
  const uncompressedBytesPerDay = uncompressedBytesPerSec * 86_400; // ~1.3824 TB/day
  assert.equal(uncompressedBytesPerSec, 16_000_000);
  assert.equal(uncompressedBytesPerDay, 1_382_400_000_000);

  // Gorilla compressed at 1.37 bytes/sample (Facebook Gorilla VLDB 2015 measured average)
  const gorillaBytesPerSample = 1.37;
  const compressedBytesPerSec = samplesPerSec * gorillaBytesPerSample; // 1.37 MB/s
  const compressedBytesPerDay = compressedBytesPerSec * 86_400; // ~118.368 GB/day
  assert.equal(compressedBytesPerSec, 1_370_000);
  assert.equal(compressedBytesPerDay, 118_368_000_000);

  // Compression ratio: 16 / 1.37 ≈ 11.68x
  const compressionRatio = 16 / gorillaBytesPerSample;
  assert.ok(compressionRatio > 11.6 && compressionRatio < 11.7);

  // Tiered Retention Sizing:
  // Tier 1: 7 days raw 10s resolution
  const tier1RawBytes = 7 * compressedBytesPerDay; // ~828.58 GB
  assert.equal(tier1RawBytes, 828_576_000_000);

  // Tier 2: 30 days downsampled to 1m 4-field rollups (sum, count, min, max -> 6x fewer points * 4 fields = 1.5x byte reduction)
  const tier2WarmBytes = 30 * (compressedBytesPerDay / 1.5); // ~2,367.36 GB
  assert.equal(tier2WarmBytes, 2_367_360_000_000);

  // Tier 3: 365 days downsampled to 1h 4-field rollups (360x fewer points / 4 fields = 90x byte reduction)
  const tier3ColdBytes = 365 * (compressedBytesPerDay / 90); // ~480.048 GB
  assert.equal(Math.round(tier3ColdBytes), 480_048_000_000);

  // Total 1-year multi-tier sample payload is ~3.68 TB vs ~504.6 TB uncompressed!
  const totalTieredStorage = tier1RawBytes + tier2WarmBytes + tier3ColdBytes;
  assert.ok(totalTieredStorage < 3.8 * 10 ** 12, 'Total 1y tiered storage fits under 3.8 TB');
  const uncompressedYearStorage = 365 * uncompressedBytesPerDay;
  assert.ok(uncompressedYearStorage > 500 * 10 ** 12, 'Uncompressed 1y storage exceeds 500 TB');
});

test('Gorilla TSDB double-delta timestamp encoding and float64 XOR compression mechanics', () => {
  // 1. Double-delta (delta-of-delta) timestamp algorithm:
  // D = (t_n - t_{n-1}) - (t_{n-1} - t_{n-2})
  // If D = 0, store single bit '0'
  function encodeDoubleDeltaBits(timestamps: number[]): {
    totalBits: number;
    zeroDeltaCount: number;
  } {
    let totalBits = 0;
    let zeroDeltaCount = 0;
    for (let i = 2; i < timestamps.length; i += 1) {
      const prevDelta = timestamps[i - 1]! - timestamps[i - 2]!;
      const curDelta = timestamps[i]! - timestamps[i - 1]!;
      const d = curDelta - prevDelta;
      if (d === 0) {
        totalBits += 1; // single '0' bit
        zeroDeltaCount += 1;
      } else if (d >= -63 && d <= 64) {
        totalBits += 2 + 7; // '10' + 7 bits
      } else if (d >= -255 && d <= 256) {
        totalBits += 3 + 9; // '110' + 9 bits
      } else if (d >= -2047 && d <= 2048) {
        totalBits += 4 + 12; // '1110' + 12 bits
      } else {
        totalBits += 4 + 32; // '1111' + 32 bits
      }
    }
    return { totalBits, zeroDeltaCount };
  }

  // Regular 10-second scrape series: [1000, 1010, 1020, 1030, 1040, 1050, 1060]
  const regularTimestamps = [1000, 1010, 1020, 1030, 1040, 1050, 1060];
  const regularResult = encodeDoubleDeltaBits(regularTimestamps);
  assert.equal(regularResult.zeroDeltaCount, 5);
  assert.equal(regularResult.totalBits, 5, 'Every regular delta encodes as exactly 1 bit');

  // Timestamps with occasional 1-second network jitter:
  const jitteredTimestamps = [1000, 1010, 1021, 1031, 1040]; // deltas: 10, 11, 10, 9 -> D: +1, -1, -1
  const jitteredResult = encodeDoubleDeltaBits(jitteredTimestamps);
  assert.equal(jitteredResult.totalBits, 3 * (2 + 7), 'Jittered deltas fit in 9-bit bucket');

  // 2. Float64 XOR compression mechanics (Pelkonen et al., Gorilla VLDB 2015 §4.1.2):
  // If v_n XOR v_{n-1} == 0, store single bit '0'; otherwise emit control bits ('11'),
  // 5-bit leading-zero count (capped at 31), 6-bit meaningful length, and meaningful XOR bits.
  function xorFloatBitLength(v1: number, v2: number): number {
    const buf = new ArrayBuffer(16);
    const floats = new Float64Array(buf);
    const ints = new BigUint64Array(buf);
    floats[0] = v1;
    floats[1] = v2;
    const xor = ints[0]! ^ ints[1]!;
    if (xor === 0n) {
      return 1; // single '0' bit for unchanged value
    }
    const bitString = xor.toString(2).padStart(64, '0');
    const rawLeading = bitString.indexOf('1');
    const leading = Math.min(rawLeading, 31); // Gorilla 5-bit leading-zero field
    const trailing = 63 - bitString.lastIndexOf('1');
    const meaningfulBits = 64 - leading - trailing;
    return 2 + 5 + 6 + meaningfulBits;
  }

  assert.equal(xorFloatBitLength(42.5, 42.5), 1, 'Identical float value encodes as exactly 1 bit');
  assert.equal(
    xorFloatBitLength(42.5, 42.75),
    14,
    'Exact binary-fraction step (42.5 -> 42.75) carries 1 meaningful XOR bit plus 13 header bits',
  );
  assert.ok(
    xorFloatBitLength(42.5, 42.6) < 64,
    'Decimal-fraction step (42.5 -> 42.6) still compresses below raw 64-bit IEEE-754 width',
  );
});
