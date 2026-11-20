import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import {
  DistributedLockWithFencing,
  DoubleEntryLedger,
  DuplicateOrderError,
  FakeClock,
  FencedStorage,
  IdempotencyConflictError,
  InvalidMinorUnitError,
  PaymentService,
  PspTimeoutError,
  SeatInventory,
  StaleFencingTokenError,
  UnbalancedJournalError,
  VersionConflictError,
} from './lib/system-design-models.ts';

test('Flash-sale OCC version CAS prevents double-booking and TTL hold expiry releases abandoned holds', () => {
  const clock = new FakeClock(10_000);
  const inventory = new SeatInventory(['A1'], clock);

  // 50 concurrent buyers read version 0 and race to reserve seat A1
  const initialVersion = inventory.getSeat('A1').version;
  let successes = 0;
  let conflicts = 0;

  for (let i = 0; i < 50; i += 1) {
    try {
      inventory.reserveSeat('A1', `buyer-${i}`, initialVersion, 30_000);
      successes += 1;
    } catch (err) {
      if (err instanceof VersionConflictError) {
        conflicts += 1;
      } else {
        throw err;
      }
    }
  }

  assert.equal(successes, 1);
  assert.equal(conflicts, 49);
  assert.equal(inventory.getSeat('A1').status, 'HELD');
  assert.equal(inventory.getSeat('A1').holdOwner, 'buyer-0');

  // Hold expires after 30s TTL without confirmation -> next buyer acquires seat cleanly
  clock.advance(30_001);
  const heldVersion = inventory.getSeat('A1').version;
  const nextVersion = inventory.reserveSeat('A1', 'buyer-late', heldVersion, 30_000);
  const bookedVersion = inventory.confirmBooking('A1', 'buyer-late', nextVersion);

  assert.equal(inventory.getSeat('A1').status, 'BOOKED');
  assert.equal(inventory.getSeat('A1').holdOwner, 'buyer-late');
  assert.equal(bookedVersion, 3);
});

test('Negative test: Lock loss without fencing corrupts storage; monotonic fencing token rejects stale writer', () => {
  const clock = new FakeClock(0);
  const lock = new DistributedLockWithFencing(clock);
  const storage = new FencedStorage<string>();

  // Client A acquires lock (token 1, TTL 100ms)
  const lockA = lock.acquire('client-A', 100);
  assert.equal(lockA.acquired, true);
  assert.equal(lockA.token, 1);

  // Client A pauses past TTL (GC / network stall)
  clock.advance(150);

  // Client B acquires lock (token 2)
  const lockB = lock.acquire('client-B', 100);
  assert.equal(lockB.acquired, true);
  assert.equal(lockB.token, 2);

  // Negative demonstration without fencing: A overwrites B's fresh value
  storage.unfencedWrite('resource-1', 'written-by-B');
  storage.unfencedWrite('resource-1', 'stale-overwrite-by-A');
  assert.equal(storage.read('resource-1'), 'stale-overwrite-by-A');

  // With fencing token checked by storage: B writes with token 2, A's stale token 1 is rejected
  storage.fencedWrite('resource-2', 'written-by-B', lockB.token);
  assert.throws(
    () => storage.fencedWrite('resource-2', 'stale-overwrite-by-A', lockA.token),
    StaleFencingTokenError,
  );
  assert.equal(storage.read('resource-2'), 'written-by-B');
});

test('Property test (fast-check): Double-entry ledger conserves sum(debits) === sum(credits) and rejects invalid entries', () => {
  const accounts = ['cash', 'escrow', 'merchant', 'fees', 'user_a', 'user_b'];

  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          kind: fc.constantFrom('TRANSFER', 'REFUND', 'FEE'),
          fromIdx: fc.integer({ min: 0, max: accounts.length - 1 }),
          toIdx: fc.integer({ min: 0, max: accounts.length - 1 }),
          amountMinor: fc.integer({ min: 100, max: 100_000 }),
          feeMinor: fc.integer({ min: 1, max: 99 }),
        }),
        { minLength: 1, maxLength: 100 },
      ),
      (ops) => {
        const ledger = new DoubleEntryLedger();
        for (let i = 0; i < ops.length; i += 1) {
          const op = ops[i];
          if (!op) continue;
          const from = accounts[op.fromIdx] ?? 'user_a';
          const to =
            accounts[(op.toIdx === op.fromIdx ? op.toIdx + 1 : op.toIdx) % accounts.length] ??
            'user_b';

          if (op.kind === 'FEE') {
            const net = op.amountMinor - op.feeMinor;
            const journal = ledger.postJournalEntry(`entry-${i}`, [
              { accountId: from, side: 'CREDIT', amountMinor: op.amountMinor },
              { accountId: to, side: 'DEBIT', amountMinor: net },
              { accountId: 'fees', side: 'DEBIT', amountMinor: op.feeMinor },
            ]);
            assert.equal(journal.debitSum, journal.creditSum);
          } else {
            const journal = ledger.postJournalEntry(`entry-${i}`, [
              { accountId: from, side: 'CREDIT', amountMinor: op.amountMinor },
              { accountId: to, side: 'DEBIT', amountMinor: op.amountMinor },
            ]);
            assert.equal(journal.debitSum, journal.creditSum);
          }

          assert.equal(ledger.totalDebits(), ledger.totalCredits());
          assert.equal(ledger.netLedgerSum(), 0);
        }
      },
    ),
    { seed: 20261120, numRuns: 100 },
  );

  // Negative validations: imbalanced entries and non-integer/negative minor units rejected
  const strictLedger = new DoubleEntryLedger();
  assert.throws(
    () =>
      strictLedger.postJournalEntry('bad-balance', [
        { accountId: 'a', side: 'DEBIT', amountMinor: 500 },
        { accountId: 'b', side: 'CREDIT', amountMinor: 499 },
      ]),
    UnbalancedJournalError,
  );
  assert.throws(
    () =>
      strictLedger.postJournalEntry('bad-negative', [
        { accountId: 'a', side: 'DEBIT', amountMinor: -100 },
        { accountId: 'b', side: 'CREDIT', amountMinor: -100 },
      ]),
    InvalidMinorUnitError,
  );
  assert.throws(
    () =>
      strictLedger.postJournalEntry('bad-float', [
        { accountId: 'a', side: 'DEBIT', amountMinor: 10.5 },
        { accountId: 'b', side: 'CREDIT', amountMinor: 10.5 },
      ]),
    InvalidMinorUnitError,
  );
});

test('Payment idempotency replays receipt, returns 409 on payload mismatch, and reconciles PSP timeout', () => {
  let pspInvocations = 0;
  let shouldTimeout = false;

  const service = new PaymentService({
    charge: () => {
      pspInvocations += 1;
      if (shouldTimeout) {
        throw new PspTimeoutError();
      }
      return 'SUCCEEDED';
    },
  });

  // Duplicate idempotency key with identical payload replays receipt with 1 PSP call
  const first = service.charge({
    idempotencyKey: 'idem-1',
    orderId: 'ord-1',
    amountMinor: 2_500,
    currency: 'USD',
  });
  const replay = service.charge({
    idempotencyKey: 'idem-1',
    orderId: 'ord-1',
    amountMinor: 2_500,
    currency: 'USD',
  });

  assert.equal(pspInvocations, 1);
  assert.equal(replay.paymentId, first.paymentId);
  assert.equal(replay.status, 'SUCCEEDED');

  // Same key with altered amount throws 409 Conflict
  assert.throws(
    () =>
      service.charge({
        idempotencyKey: 'idem-1',
        orderId: 'ord-1',
        amountMinor: 9_900,
        currency: 'USD',
      }),
    (err: unknown) => err instanceof IdempotencyConflictError && err.statusCode === 409,
  );

  // PSP timeout is unknown outcome -> PENDING_RECONCILIATION, resolved via settlement report
  shouldTimeout = true;
  const timedOut = service.charge({
    idempotencyKey: 'idem-2',
    orderId: 'ord-2',
    amountMinor: 4_200,
    currency: 'USD',
  });
  assert.equal(timedOut.status, 'PENDING_RECONCILIATION');

  // Client retry during reconciliation replays PENDING_RECONCILIATION without double-charging
  const retryWhilePending = service.charge({
    idempotencyKey: 'idem-2',
    orderId: 'ord-2',
    amountMinor: 4_200,
    currency: 'USD',
  });
  assert.equal(retryWhilePending.status, 'PENDING_RECONCILIATION');
  assert.equal(pspInvocations, 2);

  // Settlement report confirms ord-2 actually succeeded at PSP
  const resolvedCount = service.reconcileSettlement(new Map([['ord-2', 'SUCCEEDED']]));
  assert.equal(resolvedCount, 1);

  const postReconcile = service.charge({
    idempotencyKey: 'idem-2',
    orderId: 'ord-2',
    amountMinor: 4_200,
    currency: 'USD',
  });
  assert.equal(postReconcile.status, 'SUCCEEDED');
});

test('Negative test (Double-charge guard): distinct idempotencyKey for SUCCEEDED or PENDING_RECONCILIATION order throws 409 DuplicateOrderError', () => {
  let pspInvocations = 0;
  let nextOutcome: 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' = 'SUCCEEDED';

  const service = new PaymentService({
    charge: () => {
      pspInvocations += 1;
      if (nextOutcome === 'TIMEOUT') {
        throw new PspTimeoutError();
      }
      return nextOutcome;
    },
  });

  // 1. Order ord-1 succeeds with idem-a
  const ord1 = service.charge({
    idempotencyKey: 'idem-a',
    orderId: 'ord-1',
    amountMinor: 1_500,
    currency: 'USD',
  });
  assert.equal(ord1.status, 'SUCCEEDED');
  assert.equal(pspInvocations, 1);

  // Attempting to charge ord-1 again with a fresh idempotencyKey must reject (409) without calling PSP
  assert.throws(
    () =>
      service.charge({
        idempotencyKey: 'idem-a-new',
        orderId: 'ord-1',
        amountMinor: 1_500,
        currency: 'USD',
      }),
    (err: unknown) => err instanceof DuplicateOrderError && err.statusCode === 409,
  );
  assert.equal(pspInvocations, 1);

  // 2. Order ord-2 times out -> PENDING_RECONCILIATION; fresh idempotencyKey must also reject (409)
  nextOutcome = 'TIMEOUT';
  const ord2 = service.charge({
    idempotencyKey: 'idem-b',
    orderId: 'ord-2',
    amountMinor: 3_000,
    currency: 'USD',
  });
  assert.equal(ord2.status, 'PENDING_RECONCILIATION');
  assert.equal(pspInvocations, 2);

  assert.throws(
    () =>
      service.charge({
        idempotencyKey: 'idem-b-retry-new-key',
        orderId: 'ord-2',
        amountMinor: 3_000,
        currency: 'USD',
      }),
    (err: unknown) => err instanceof DuplicateOrderError && err.statusCode === 409,
  );
  assert.equal(pspInvocations, 2);

  // 3. Order ord-3 initially FAILED -> retrying with a new idempotencyKey IS permitted
  nextOutcome = 'FAILED';
  const failedAttempt = service.charge({
    idempotencyKey: 'idem-c-1',
    orderId: 'ord-3',
    amountMinor: 5_000,
    currency: 'USD',
  });
  assert.equal(failedAttempt.status, 'FAILED');
  assert.equal(pspInvocations, 3);

  nextOutcome = 'SUCCEEDED';
  const recoveredAttempt = service.charge({
    idempotencyKey: 'idem-c-2',
    orderId: 'ord-3',
    amountMinor: 5_000,
    currency: 'USD',
  });
  assert.equal(recoveredAttempt.status, 'SUCCEEDED');
  assert.equal(pspInvocations, 4);
});
