import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import {
  FakeClock,
  FixedWindowLimiter,
  GcraLimiter,
  LeakyBucketLimiter,
  RoundRobinClusterLimiter,
  SlidingWindowCounterLimiter,
  SlidingWindowLogLimiter,
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

test('LeakyBucketLimiter caps burst at capacity, drains at leakRatePerSec, and returns exact retryAfterMs', () => {
  const clock = new FakeClock(1_000);
  const limiter = new LeakyBucketLimiter(4, 2, clock); // cap=4, leaks 2 req/sec (1 every 500ms)

  // Initial burst fills capacity 0 -> 4
  for (let i = 0; i < 4; i += 1) {
    const res = limiter.allow('tenant-a');
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 3 - i);
    assert.equal(res.retryAfterMs, 0);
  }

  // 5th immediate request overflows capacity
  const overflow = limiter.allow('tenant-a');
  assert.equal(overflow.allowed, false);
  assert.equal(overflow.remaining, 0);
  assert.equal(overflow.retryAfterMs, 500);

  // Partial drain after 250ms: water = 4 - 0.25*2 = 3.5 -> still rejects with 250ms remaining
  clock.advance(250);
  const partial = limiter.allow('tenant-a');
  assert.equal(partial.allowed, false);
  assert.equal(partial.remaining, 0);
  assert.equal(partial.retryAfterMs, 250);

  // Remaining 250ms drains water to 3.0 -> exactly 1 slot recovers
  clock.advance(250);
  const recovered = limiter.allow('tenant-a');
  assert.equal(recovered.allowed, true);
  assert.equal(recovered.remaining, 0);
  assert.equal(recovered.retryAfterMs, 0);

  // Immediately full again
  const refilledOverflow = limiter.allow('tenant-a');
  assert.equal(refilledOverflow.allowed, false);
  assert.equal(refilledOverflow.retryAfterMs, 500);

  // Long idle period clamps water at 0 (never negative) and allows full capacity again
  clock.advance(10_000);
  let admittedAfterIdle = 0;
  for (let i = 0; i < 5; i += 1) {
    if (limiter.allow('tenant-a').allowed) admittedAfterIdle += 1;
  }
  assert.equal(admittedAfterIdle, 4);

  // Negative constructor validation
  assert.throws(() => new LeakyBucketLimiter(0, 2, clock), RangeError);
  assert.throws(() => new LeakyBucketLimiter(4, 0, clock), RangeError);
});

test('SlidingWindowLogLimiter rejects 2x boundary burst and evicts expired timestamps cleanly', () => {
  const limit = 10;
  const windowMs = 60_000;
  const clock = new FakeClock(59_999);
  const limiter = new SlidingWindowLogLimiter(limit, windowMs, clock);

  // 10 requests at t = 59,999ms are admitted
  for (let i = 0; i < limit; i += 1) {
    const res = limiter.allow('client');
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, limit - 1 - i);
    assert.equal(res.retryAfterMs, 0);
  }

  // Advance across fixed boundary to t = 60,001ms -> all 10 rejected with exact retryAfterMs
  clock.set(60_001);
  for (let i = 0; i < limit; i += 1) {
    const denied = limiter.allow('client');
    assert.equal(denied.allowed, false);
    assert.equal(denied.remaining, 0);
    assert.equal(denied.retryAfterMs, 59_998);
  }

  // Just before expiration at t = 119,998ms (cutoff = 59,998ms): timestamps at 59,999ms still active
  clock.set(119_998);
  const stillBlocked = limiter.allow('client');
  assert.equal(stillBlocked.allowed, false);
  assert.equal(stillBlocked.retryAfterMs, 1);

  // At t = 120,000ms (cutoff = 60,000ms): all 59,999ms timestamps are evicted cleanly
  clock.set(120_000);
  for (let i = 0; i < limit; i += 1) {
    const fresh = limiter.allow('client');
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.remaining, limit - 1 - i);
  }
  assert.equal(limiter.allow('client').allowed, false);

  // Negative constructor validation
  assert.throws(() => new SlidingWindowLogLimiter(0, windowMs, clock), RangeError);
  assert.throws(() => new SlidingWindowLogLimiter(limit, 0, clock), RangeError);
});

test('Property test (fast-check): LeakyBucketLimiter bounds admissions and recovers after retryAfterMs', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }), // capacity
      fc.integer({ min: 1, max: 20 }), // leakRatePerSec
      fc.array(fc.integer({ min: 0, max: 1_500 }), { minLength: 1, maxLength: 80 }),
      (capacity, leakRatePerSec, deltas) => {
        const clock = new FakeClock(0);
        const limiter = new LeakyBucketLimiter(capacity, leakRatePerSec, clock);
        const acceptedTimestamps: number[] = [];

        for (const delta of deltas) {
          clock.advance(delta);
          const now = clock.now();
          const res = limiter.allow('k');
          if (res.allowed) {
            acceptedTimestamps.push(now);
            assert.equal(res.retryAfterMs, 0);
          } else {
            assert.ok(res.retryAfterMs >= 1);
          }
        }

        // Over any interval [t_i, t_j], admitted requests <= capacity + floor(elapsedSec * leakRatePerSec)
        for (let i = 0; i < acceptedTimestamps.length; i += 1) {
          const start = acceptedTimestamps[i] ?? 0;
          for (let j = i; j < acceptedTimestamps.length; j += 1) {
            const end = acceptedTimestamps[j] ?? 0;
            const elapsedSec = (end - start) / 1000;
            const countInWindow = j - i + 1;
            const maxAllowed = Math.floor(capacity + elapsedSec * leakRatePerSec + 1e-9);
            assert.ok(
              countInWindow <= maxAllowed,
              `Admitted ${countInWindow} > ${maxAllowed} in elapsed=${end - start}ms`,
            );
          }
        }
      },
    ),
    { seed: 20261121, numRuns: 200 },
  );
});

test('Property test (fast-check): SlidingWindowLogLimiter satisfies exact sliding-window invariant', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }), // limit
      fc.integer({ min: 50, max: 5_000 }), // windowMs
      fc.array(fc.integer({ min: 0, max: 1_200 }), { minLength: 1, maxLength: 80 }),
      (limit, windowMs, deltas) => {
        const clock = new FakeClock(0);
        const limiter = new SlidingWindowLogLimiter(limit, windowMs, clock);
        const accepted: number[] = [];

        for (const delta of deltas) {
          clock.advance(delta);
          const now = clock.now();
          const cutoff = now - windowMs;
          const active = accepted.filter((ts) => ts > cutoff);
          const decision = limiter.allow('k');

          if (active.length < limit) {
            assert.equal(decision.allowed, true);
            assert.equal(decision.remaining, limit - (active.length + 1));
            assert.equal(decision.retryAfterMs, 0);
            accepted.push(now);
          } else {
            assert.equal(decision.allowed, false);
            assert.equal(decision.remaining, 0);
            const oldestActive = active[0] ?? now;
            assert.equal(decision.retryAfterMs, Math.max(1, oldestActive + windowMs - now));
          }
        }
      },
    ),
    { seed: 20261122, numRuns: 200 },
  );
});
