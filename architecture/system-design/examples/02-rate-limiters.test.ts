import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import {
  FakeClock,
  FixedWindowLimiter,
  GcraLimiter,
  RoundRobinClusterLimiter,
  SlidingWindowCounterLimiter,
  TokenBucketLimiter,
} from './lib/system-design-models.ts';

test('TokenBucketLimiter enforces burst capacity and steady refill using FakeClock', () => {
  const clock = new FakeClock(1_000);
  const limiter = new TokenBucketLimiter(5, 2, clock); // cap=5, 2 tokens/sec

  for (let i = 0; i < 5; i += 1) {
    const res = limiter.allow('user-1');
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 4 - i);
  }

  const denied = limiter.allow('user-1');
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 500);

  clock.advance(500);
  assert.equal(limiter.allow('user-1').allowed, true);
  assert.equal(limiter.allow('user-1').allowed, false);

  clock.advance(2_500); // +5 tokens -> capped at 5
  let allowedAfterRefill = 0;
  for (let i = 0; i < 6; i += 1) {
    if (limiter.allow('user-1').allowed) allowedAfterRefill += 1;
  }
  assert.equal(allowedAfterRefill, 5);
});

test('Negative test: Fixed Window admits 2x limit across boundary while GCRA and Sliding Window reject', () => {
  const limit = 10;
  const windowMs = 60_000;

  const fixedClock = new FakeClock(59_999);
  const fixed = new FixedWindowLimiter(limit, windowMs, fixedClock);

  const slidingClock = new FakeClock(59_999);
  const sliding = new SlidingWindowCounterLimiter(limit, windowMs, slidingClock);

  const gcraClock = new FakeClock(59_999);
  const gcra = new GcraLimiter(limit, windowMs, limit, gcraClock);

  let fixedTotal = 0;
  let slidingTotal = 0;
  let gcraTotal = 0;

  // Send 10 requests right before window boundary at t = 59,999ms
  for (let i = 0; i < limit; i += 1) {
    if (fixed.allow('client').allowed) fixedTotal += 1;
    if (sliding.allow('client').allowed) slidingTotal += 1;
    if (gcra.allow('client').allowed) gcraTotal += 1;
  }
  assert.equal(fixedTotal, 10);
  assert.equal(slidingTotal, 10);
  assert.equal(gcraTotal, 10);

  // Advance 2ms across the 60,000ms boundary to t = 60,001ms
  fixedClock.set(60_001);
  slidingClock.set(60_001);
  gcraClock.set(60_001);

  for (let i = 0; i < limit; i += 1) {
    if (fixed.allow('client').allowed) fixedTotal += 1;
    if (sliding.allow('client').allowed) slidingTotal += 1;
    if (gcra.allow('client').allowed) gcraTotal += 1;
  }

  // Fixed Window admits 2x = 20 requests within 2ms!
  assert.equal(fixedTotal, 20);
  // Sliding Window Counter and GCRA strictly reject the 2x boundary burst
  assert.equal(slidingTotal, 10);
  assert.equal(gcraTotal, 10);
});

test('Negative test: N independent per-node limiters behind round-robin LB allow N*limit', () => {
  const clock = new FakeClock(0);
  const nodeCount = 4;
  const perNodeLimit = 10;
  const nodes = Array.from(
    { length: nodeCount },
    () => new TokenBucketLimiter(perNodeLimit, 1, clock),
  );
  const cluster = new RoundRobinClusterLimiter(nodes);

  let admitted = 0;
  for (let i = 0; i < nodeCount * perNodeLimit + 5; i += 1) {
    if (cluster.allow('hot-tenant').allowed) {
      admitted += 1;
    }
  }

  assert.equal(admitted, nodeCount * perNodeLimit);
});

test('Property test (fast-check): GCRA never admits > burst + floor(rate * elapsed) over arbitrary arrivals', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 25 }), // limit
      fc.integer({ min: 100, max: 10_000 }), // periodMs
      fc.integer({ min: 1, max: 15 }), // burst
      fc.array(fc.integer({ min: 0, max: 2_000 }), { minLength: 1, maxLength: 80 }), // inter-arrival deltas
      (limit, periodMs, burst, deltas) => {
        const clock = new FakeClock(0);
        const gcra = new GcraLimiter(limit, periodMs, burst, clock);
        const acceptedTimestamps: number[] = [];

        for (const delta of deltas) {
          clock.advance(delta);
          const now = clock.now();
          if (gcra.allow('k').allowed) {
            acceptedTimestamps.push(now);
          }
        }

        // Check every sub-interval [t_i, t_j] of accepted requests
        for (let i = 0; i < acceptedTimestamps.length; i += 1) {
          const start = acceptedTimestamps[i] ?? 0;
          for (let j = i; j < acceptedTimestamps.length; j += 1) {
            const end = acceptedTimestamps[j] ?? 0;
            const elapsed = end - start;
            const countInWindow = j - i + 1;
            const maxAllowed = burst + Math.floor((limit * elapsed) / periodMs);
            assert.ok(
              countInWindow <= maxAllowed,
              `Admitted ${countInWindow} > ${maxAllowed} in elapsed=${elapsed}ms`,
            );
          }
        }
      },
    ),
    { seed: 20261120, numRuns: 200 },
  );
});
