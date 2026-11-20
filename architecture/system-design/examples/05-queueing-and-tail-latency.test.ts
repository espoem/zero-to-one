import assert from 'node:assert/strict';
import test from 'node:test';
import {
  simulateFanOut,
  simulateQueueing,
  simulateRetryStorm,
} from './lib/system-design-models.ts';

test('M/M/1 and M/M/c queueing simulator satisfies Little’s Law and matches analytical M/M/1 bounds', () => {
  const assertAnalyticalMm1 = (
    lambda: number,
    mu: number,
    result: ReturnType<typeof simulateQueueing>,
    tolerance = 0.15,
  ): void => {
    const rho = lambda / mu;
    const expectedWMs = (1 / (mu - lambda)) * 1000;
    const expectedL = rho / (1 - rho);
    const little = result.empiricalLambdaPerSec * (result.meanSojournMs / 1000);
    assert.ok(Math.abs(result.empiricalMeanConcurrency - little) < 1e-6);
    assert.ok(
      Math.abs(result.meanSojournMs - expectedWMs) <= expectedWMs * tolerance,
      `Expected W ≈ ${expectedWMs.toFixed(1)}ms ±${tolerance * 100}%, got ${result.meanSojournMs.toFixed(2)}ms`,
    );
    assert.ok(
      Math.abs(result.empiricalMeanConcurrency - expectedL) <= expectedL * tolerance,
      `Expected L ≈ ${expectedL.toFixed(2)} ±${tolerance * 100}%, got ${result.empiricalMeanConcurrency.toFixed(3)}`,
    );
  };

  // M/M/1 at rho = 0.5 (lambda=50, mu=100 -> theoretical W = 1/(100-50) = 20ms, L = 1)
  const mm1Low = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 50,
    serviceRatePerServerPerSec: 100,
    numRequests: 25_000,
    seed: 1001,
  });
  assertAnalyticalMm1(50, 100, mm1Low);

  // M/M/1 at rho = 0.8 (lambda=80, mu=100 -> theoretical W = 50ms, L = 4)
  const mm1Mid = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 80,
    serviceRatePerServerPerSec: 100,
    numRequests: 25_000,
    seed: 1002,
  });
  assertAnalyticalMm1(80, 100, mm1Mid);

  // M/M/1 at rho = 0.95 (lambda=95, mu=100 -> theoretical W = 200ms, L = 19)
  const mm1Knee = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 95,
    serviceRatePerServerPerSec: 100,
    numRequests: 80_000,
    seed: 1003,
  });
  assertAnalyticalMm1(95, 100, mm1Knee);
  assert.ok(
    mm1Knee.meanSojournMs > mm1Low.meanSojournMs * 6,
    `Expected sharp latency knee at rho=0.95 (${mm1Knee.meanSojournMs.toFixed(1)}ms) vs rho=0.5 (${mm1Low.meanSojournMs.toFixed(1)}ms)`,
  );

  // M/M/4 at rho = 0.75 (lambda=300, 4 servers * 100 req/s)
  const mm4 = simulateQueueing({
    servers: 4,
    arrivalRatePerSec: 300,
    serviceRatePerServerPerSec: 100,
    numRequests: 25_000,
    seed: 1004,
  });
  const littleMm4 = mm4.empiricalLambdaPerSec * (mm4.meanSojournMs / 1000);
  assert.ok(Math.abs(mm4.empiricalMeanConcurrency - littleMm4) < 1e-6);
  assert.ok(mm4.empiricalMeanConcurrency > 3.0 && mm4.empiricalMeanConcurrency < 6.0);

  // Bounded queue (maxQueueDepth=4) under overload drops excess requests; Little's Law still holds using effective throughput lambda_eff
  const bounded = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 150,
    serviceRatePerServerPerSec: 100,
    numRequests: 10_000,
    maxQueueDepth: 4,
    seed: 1005,
  });
  assert.ok(bounded.droppedOrTimedOut > 0);
  assert.ok(bounded.completed < 10_000);
  assert.ok(bounded.empiricalLambdaPerSec < 150);
  const littleBounded = bounded.empiricalLambdaPerSec * (bounded.meanSojournMs / 1000);
  assert.ok(Math.abs(bounded.empiricalMeanConcurrency - littleBounded) < 1e-6);
});

test('LIFO vs FIFO under overload: FIFO goodput collapses near 0% while LIFO preserves high goodput', () => {
  // rho = 1.6 (160 req/s arrival vs 100 req/s capacity) with 100ms client deadline
  const fifo = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 160,
    serviceRatePerServerPerSec: 100,
    numRequests: 3_000,
    discipline: 'FIFO',
    deadlineMs: 100,
    seed: 2026,
  });

  const lifo = simulateQueueing({
    servers: 1,
    arrivalRatePerSec: 160,
    serviceRatePerServerPerSec: 100,
    numRequests: 3_000,
    discipline: 'LIFO',
    deadlineMs: 100,
    seed: 2026,
  });

  assert.ok(
    fifo.goodputFraction < 0.05,
    `Expected FIFO goodput collapse near 0%, got ${(fifo.goodputFraction * 100).toFixed(2)}%`,
  );
  assert.ok(
    lifo.goodputFraction > 0.55,
    `Expected LIFO to preserve high goodput (~62% server-capacity share), got ${(lifo.goodputFraction * 100).toFixed(2)}%`,
  );
});

test('Fan-out tail latency amplification (1 - 0.99^100 ≈ 63%) and hedged requests slashing p99', () => {
  const baseline = simulateFanOut({
    fanout: 100,
    numRequests: 5_000,
    slowProb: 0.01,
    fastMinMs: 5,
    fastMaxMs: 19,
    slowLatencyMs: 1_000,
    seed: 777,
  });

  // 1 - 0.99^100 ≈ 0.634 -> ~63% of fan-out calls hit the 1,000ms slow tail
  assert.ok(
    baseline.slowHitFraction > 0.58 && baseline.slowHitFraction < 0.68,
    `Expected ~63% slow tail hit rate, got ${(baseline.slowHitFraction * 100).toFixed(2)}%`,
  );
  assert.equal(baseline.fanoutP99Ms, 1_000);

  // Hedge after p95 (~18.5ms: only ~4.5% of sub-requests trigger a hedge)
  const hedged = simulateFanOut({
    fanout: 100,
    numRequests: 5_000,
    slowProb: 0.01,
    fastMinMs: 5,
    fastMaxMs: 19,
    slowLatencyMs: 1_000,
    hedgeDelayMs: 18.5,
    seed: 779,
  });

  assert.ok(
    hedged.extraRequestFraction <= 0.05,
    `Expected <= 5% extra hedge traffic, got ${(hedged.extraRequestFraction * 100).toFixed(2)}%`,
  );
  assert.ok(
    hedged.fanoutP99Ms < 100,
    `Expected hedging to slash fan-out p99 from 1000ms to <100ms, got ${hedged.fanoutP99Ms}ms`,
  );
});

test('Negative test (Retry Storm): blind 3x retries cause metastable outage; 10% budget + circuit breaker recovers', () => {
  const storm = simulateRetryStorm({
    capacityPerTick: 100,
    healthyBaseLoad: 60,
    spikeLoad: 160,
    spikeTicks: 5,
    totalTicks: 60,
    mode: 'blind-3x-retry',
  });

  assert.equal(storm.recovered, false);
  assert.ok(
    storm.finalOfferedLoad > 100,
    `Expected blind retries to pin rho > 1 permanently, got offered=${storm.finalOfferedLoad}`,
  );

  const protectedRun = simulateRetryStorm({
    capacityPerTick: 100,
    healthyBaseLoad: 60,
    spikeLoad: 160,
    spikeTicks: 5,
    totalTicks: 60,
    mode: 'retry-budget-circuit-breaker',
  });

  assert.equal(protectedRun.recovered, true);
  assert.equal(protectedRun.finalSuccessRate, 1);
  assert.ok(protectedRun.finalOfferedLoad <= 100);
});
