import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApimLlmTokenLimiter,
  DEFAULT_DUPLICATE_DETECTION_WINDOW_MS,
  NonDeterministicWorkflowError,
  ServiceBusQueue,
  calculateKedaReplicas,
  executeWithReplayCheck,
  parseImdsScheduledEvents,
  simulateSlotSwap,
  simulateSwapWarmup,
  stepBSeriesCpu,
  validateRevisionTrafficWeights,
  type SlotSetting,
} from './lib/azure-models.ts';

const FIXED_UTC = new Date('2026-06-01T12:00:00.000Z');

describe('Compute and serverless: slots, durable replay, Service Bus', () => {
  test('Negative: non-sticky staging connection string swaps into production and moves one-sided settings', () => {
    const production: Record<string, SlotSetting> = {
      DB: { value: 'prod-db', slotSticky: false },
      PROD_ONLY: { value: 'from-prod', slotSticky: false },
    };
    const staging: Record<string, SlotSetting> = {
      DB: { value: 'staging-db', slotSticky: false },
      STAGING_ONLY: { value: 'from-staging', slotSticky: false },
    };
    const result = simulateSlotSwap({ production, staging });
    assert.equal(result.newProduction.DB, 'staging-db');
    assert.equal(result.newStaging.DB, 'prod-db');
    // A staging-only non-sticky setting moves to production and disappears from staging.
    assert.equal(result.newProduction.STAGING_ONLY, 'from-staging');
    assert.equal('STAGING_ONLY' in result.newStaging, false);
    assert.equal(result.newStaging.PROD_ONLY, 'from-prod');
    assert.equal('PROD_ONLY' in result.newProduction, false);
    assert.deepEqual(result.swappedKeys, ['DB', 'PROD_ONLY', 'STAGING_ONLY']);
  });

  test('Marking the setting slot-sticky keeps production isolated across swaps', () => {
    const production: Record<string, SlotSetting> = {
      DB: { value: 'prod-db', slotSticky: true },
    };
    const staging: Record<string, SlotSetting> = {
      DB: { value: 'staging-db', slotSticky: false },
    };
    const result = simulateSlotSwap({ production, staging });
    assert.equal(result.newProduction.DB, 'prod-db');
    assert.equal(result.newStaging.DB, 'staging-db');
    assert.deepEqual(result.stickyKeys, ['DB']);
    assert.deepEqual(result.swappedKeys, []);
  });

  test('Negative: skipped applicationInitialization warm-up causes a 503 burst on swap', () => {
    const skipped = simulateSwapWarmup({ instanceCount: 4, warmedInstances: 0 });
    assert.equal(skipped.http503, 4);
    assert.equal(skipped.ok, 0);

    const warmed = simulateSwapWarmup({ instanceCount: 4, warmedInstances: 4 });
    assert.equal(warmed.http503, 0);
    assert.equal(warmed.ok, 4);
  });

  test('Durable orchestrator using ctx time + activities replays deterministically', () => {
    const outcome = executeWithReplayCheck(
      (ctx) => {
        const check = ctx.callActivity('CheckInventory', { sku: 'A' });
        return { at: ctx.currentUtcDateTime.toISOString(), check };
      },
      { fixedUtc: FIXED_UTC, replayWallClockMs: FIXED_UTC.getTime() + 3_600_000 },
    );
    assert.equal(outcome.ok, true);
    assert.match(JSON.stringify(outcome.result), /2026-06-01T12:00:00/);
  });

  test('Negative: orchestrator reading the wall clock fails replay deterministically', () => {
    assert.throws(
      () =>
        executeWithReplayCheck((_ctx, deps) => ({ at: deps.wallClockNow() }), {
          fixedUtc: FIXED_UTC,
          replayWallClockMs: FIXED_UTC.getTime() + 3_600_000,
        }),
      NonDeterministicWorkflowError,
    );
    assert.throws(
      () =>
        executeWithReplayCheck((_ctx, deps) => ({ pick: deps.random() }), {
          fixedUtc: FIXED_UTC,
          replayWallClockMs: FIXED_UTC.getTime() + 1,
        }),
      /diverged on replay/,
    );
  });

  test('Negative: handler slower than lockDuration triggers MessageLockLost and redelivery', () => {
    const queue = new ServiceBusQueue({ lockDurationMs: 1_000, maxDeliveryCount: 10 });
    const sent = queue.send('order-1', undefined, 0);
    assert.equal(sent.accepted, true);

    const received = queue.receive(0);
    assert.ok(received?.lockToken);
    const token = received?.lockToken ?? '';

    // Handler takes 5s > 1s lock: completing now must fail with MessageLockLost.
    const late = queue.complete(token, 5_000);
    assert.equal(late.ok, false);
    assert.equal(late.error, 'MessageLockLost');

    const sweep = queue.sweep(5_001);
    assert.equal(sweep.expired, 1);
    assert.equal(sweep.redelivered, 1);
    assert.equal(sweep.deadLettered, 0);

    const redelivered = queue.receive(5_001);
    assert.equal(redelivered?.deliveryCount, 2);
    const done = queue.complete(redelivered?.lockToken ?? '', 5_002);
    assert.equal(done.ok, true);
  });

  test('Negative: after MaxDeliveryCount (default 10) failures the message moves to the DLQ', () => {
    const queue = new ServiceBusQueue({ lockDurationMs: 1_000 });
    assert.equal(queue.maxDeliveryCount, 10);
    queue.send('poison', undefined, 0);
    let nowMs = 0;
    for (let i = 0; i < 10; i += 1) {
      const msg = queue.receive(nowMs);
      assert.ok(msg);
      nowMs += 1_001;
      queue.sweep(nowMs);
    }
    assert.equal(queue.deadLetterCount(), 1);
    const poisonId = 'msg-1';
    assert.equal(queue.deadLetterReason(poisonId), 'MaxDeliveryCountExceeded');
    assert.equal(queue.pendingCount(), 0);
  });

  test('Sessions preserve strict per-session FIFO ordering', () => {
    const queue = new ServiceBusQueue({ lockDurationMs: 60_000 });
    queue.send('s1-first', { sessionId: 's1' }, 0);
    queue.send('s1-second', { sessionId: 's1' }, 0);
    queue.send('s2-first', { sessionId: 's2' }, 0);

    const first = queue.receiveSession('s1', 1);
    assert.equal(first?.body, 's1-first');
    // Head is locked: the session receiver must not skip ahead to s1-second.
    assert.equal(queue.receiveSession('s1', 2)?.body, undefined);
    assert.equal(queue.complete(first?.lockToken ?? '', 3).ok, true);

    const second = queue.receiveSession('s1', 4);
    assert.equal(second?.body, 's1-second');

    const other = queue.receiveSession('s2', 5);
    assert.equal(other?.body, 's2-first');
    // Plain receive never takes session messages.
    assert.equal(queue.receive(6)?.body, undefined);
  });

  test('Duplicate detection accepts and silently drops repeated (messageId, partitionKey) inside 10m default window', () => {
    const defaultQueue = new ServiceBusQueue();
    assert.equal(DEFAULT_DUPLICATE_DETECTION_WINDOW_MS, 10 * 60_000);
    assert.equal(defaultQueue.duplicateDetectionWindowMs, 10 * 60_000);

    // Valid range is 20s..7d.
    assert.throws(() => new ServiceBusQueue({ duplicateDetectionWindowMs: 10_000 }), /between/);
    assert.throws(
      () => new ServiceBusQueue({ duplicateDetectionWindowMs: 8 * 24 * 60 * 60_000 }),
      /between/,
    );

    const first = defaultQueue.send('payload', { messageId: 'order-42', partitionKey: 'p1' }, 0);
    assert.equal(first.accepted, true);
    assert.equal(first.deduplicated, false);

    // Within 10-minute window (5 minutes elapsed): broker accepts and silently drops duplicate.
    const duplicate = defaultQueue.send(
      'payload',
      { messageId: 'order-42', partitionKey: 'p1' },
      5 * 60_000,
    );
    assert.equal(duplicate.accepted, true);
    assert.equal(duplicate.deduplicated, true);
    assert.equal(duplicate.message, undefined);
    assert.equal(defaultQueue.pendingCount(), 1);

    // Different partitionKey with same messageId is NOT deduplicated on partitioned entities.
    const otherPartition = defaultQueue.send(
      'payload-p2',
      { messageId: 'order-42', partitionKey: 'p2' },
      5 * 60_000,
    );
    assert.equal(otherPartition.accepted, true);
    assert.equal(otherPartition.deduplicated, false);
    assert.equal(defaultQueue.pendingCount(), 2);

    // Outside 10-minute window: accepted as a fresh message.
    const afterWindow = defaultQueue.send(
      'payload',
      { messageId: 'order-42', partitionKey: 'p1' },
      10 * 60_000 + 1,
    );
    assert.equal(afterWindow.accepted, true);
    assert.equal(afterWindow.deduplicated, false);
    assert.equal(defaultQueue.pendingCount(), 3);
  });

  test('KEDA replica scaling scales to 0 on empty queue and caps at maxReplicas', () => {
    assert.equal(calculateKedaReplicas({ backlog: 0, targetQueueLength: 10, maxReplicas: 5 }), 0);
    assert.equal(calculateKedaReplicas({ backlog: 21, targetQueueLength: 10, maxReplicas: 5 }), 3);
    assert.equal(calculateKedaReplicas({ backlog: 120, targetQueueLength: 10, maxReplicas: 5 }), 5);
  });

  test('Negative: Container Apps revision traffic split must sum to 100%', () => {
    const valid = validateRevisionTrafficWeights([
      { revisionName: 'rev-1', weight: 80 },
      { revisionName: 'rev-2', weight: 20 },
    ]);
    assert.equal(valid.valid, true);
    assert.equal(valid.totalWeight, 100);

    const under = validateRevisionTrafficWeights([
      { revisionName: 'rev-1', weight: 70 },
      { revisionName: 'rev-2', weight: 20 },
    ]);
    assert.equal(under.valid, false);
    assert.match(under.reason, /90%/);

    const over = validateRevisionTrafficWeights([
      { revisionName: 'rev-1', weight: 60 },
      { revisionName: 'rev-2', weight: 50 },
    ]);
    assert.equal(over.valid, false);

    const negative = validateRevisionTrafficWeights([
      { revisionName: 'rev-1', weight: 110 },
      { revisionName: 'rev-2', weight: -10 },
    ]);
    assert.equal(negative.valid, false);
  });

  test('Negative: B-series VM accrues credits below baseline and throttles to baseline at 0 credits', () => {
    // Idle 10 minutes at 5% with 20% baseline accrues 1.5 credits.
    const accrued = stepBSeriesCpu({ credits: 0, baselinePercent: 20, maxCredits: 100 }, 5, 10);
    assert.equal(accrued.throttled, false);
    assert.ok(Math.abs(accrued.creditsRemaining - 1.5) < 1e-9);

    // Burst 100% for 2 minutes: spends remaining 1.5 credits and drains to 0, throttling mid-window.
    const drained = stepBSeriesCpu(
      { credits: accrued.creditsRemaining, baselinePercent: 20, maxCredits: 100 },
      100,
      2,
    );
    assert.equal(drained.creditsRemaining, 0);
    assert.equal(drained.throttled, true);

    // Subsequent burst at 0 credits is hard-capped at the 20% baseline.
    const throttled = stepBSeriesCpu(
      { credits: drained.creditsRemaining, baselinePercent: 20, maxCredits: 100 },
      100,
      1,
    );
    assert.equal(throttled.throttled, true);
    assert.equal(throttled.effectiveCpuPercent, 20);
    assert.equal(throttled.creditsRemaining, 0);
  });

  test('IMDS Scheduled Events JSON parser detects 30-second Spot Preempt eviction notice', () => {
    const nowMs = Date.parse('2026-06-01T12:00:00.000Z');
    const payload = JSON.stringify({
      DocumentIncarnation: 4,
      Events: [
        {
          EventId: 'evt-preempt-1',
          EventStatus: 'Scheduled',
          EventType: 'Preempt',
          ResourceType: 'VirtualMachine',
          Resources: ['vm-spot-01'],
          NotBefore: 'Mon, 01 Jun 2026 12:00:30 GMT',
          Description: 'Spot VM eviction',
          EventSource: 'Platform',
        },
      ],
    });
    const parsed = parseImdsScheduledEvents(payload, nowMs);
    assert.equal(parsed.hasPreemptNotice, true);
    assert.equal(parsed.documentIncarnation, 4);
    assert.equal(parsed.preemptEvents.length, 1);
    assert.equal(parsed.preemptEvents[0]?.secondsRemaining, 30);
    assert.deepEqual(parsed.ackPayload, { StartRequests: [{ EventId: 'evt-preempt-1' }] });

    const empty = parseImdsScheduledEvents({ DocumentIncarnation: 5, Events: [] }, nowMs);
    assert.equal(empty.hasPreemptNotice, false);
    assert.equal(empty.preemptEvents.length, 0);
  });

  test('Negative: APIM llm-token-limit rejects requests exceeding tokens-per-minute with 429', () => {
    const limiter = new ApimLlmTokenLimiter(1_000);
    const first = limiter.consume('sub-alpha', 600, 0);
    assert.equal(first.allowed, true);
    assert.equal(first.status, 200);
    assert.equal(first.remainingTokens, 400);

    const over = limiter.consume('sub-alpha', 500, 0);
    assert.equal(over.allowed, false);
    assert.equal(over.status, 429);
    assert.ok(over.retryAfterSeconds > 0);

    // Different subscription counter key has an independent token bucket.
    const otherSub = limiter.consume('sub-beta', 500, 0);
    assert.equal(otherSub.allowed, true);

    // After 60 seconds the bucket refills to 1,000 tokens.
    const refilled = limiter.consume('sub-alpha', 500, 60_000);
    assert.equal(refilled.allowed, true);
    assert.equal(refilled.status, 200);
  });
});
