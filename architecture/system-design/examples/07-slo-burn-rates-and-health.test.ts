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
