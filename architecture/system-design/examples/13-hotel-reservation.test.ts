import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  DeadlockDetectedError,
  HotelReservationDatabase,
  IdempotencyPayloadMismatchError,
  OptimisticLockConflictError,
  OverbookingLimitExceededError,
  computeOverbookingCap,
  estimateHotelSystemCapacity,
  expandStayDates,
  simulateConcurrentLockOrder,
} from './lib/hotel-models.ts';

describe('Module 19: Hotel Reservation System Executable Proofs', () => {
  it('Half-open [checkIn, checkOut) prevents the SQL BETWEEN checkout-night off-by-one bug and enforces the 10% overbooking floor bound', () => {
    // A guest checking in 2026-06-01 and checking out 2026-06-03 sleeps 2 nights (June 1 and June 2)
    assert.deepEqual(expandStayDates('2026-06-01', '2026-06-03', 'half-open'), [
      '2026-06-01',
      '2026-06-02',
    ]);
    // ByteByteGo's naive `date BETWEEN startDate AND endDate` erroneously includes the checkout date (3 nights)
    assert.deepEqual(expandStayDates('2026-06-01', '2026-06-03', 'inclusive-between'), [
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);

    // Negative test: under naive BETWEEN, back-to-back guests (June 1->3 and June 3->5) collide on June 3!
    const buggyDb = new HotelReservationDatabase({ overbookingPct: 0 });
    buggyDb.seedInventoryHorizon({
      hotelId: 'h-211',
      roomTypeId: 'rt-king',
      startDate: '2026-06-01',
      days: 5,
      totalInventory: 1,
    });
    buggyDb.reserve(
      {
        reservationId: 'res-bug-1',
        hotelId: 'h-211',
        roomTypeId: 'rt-king',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        roomCount: 1,
      },
      { intervalMode: 'inclusive-between' },
    );
    assert.throws(
      () =>
        buggyDb.reserve(
          {
            reservationId: 'res-bug-2',
            hotelId: 'h-211',
            roomTypeId: 'rt-king',
            startDate: '2026-06-03',
            endDate: '2026-06-05',
            roomCount: 1,
          },
          { intervalMode: 'inclusive-between' },
        ),
      OverbookingLimitExceededError,
    );

    // Positive test: half-open [checkIn, checkOut) allows seamless back-to-back turnover on 2026-06-03
    // and enforces exact 10% overbooking floor bound (100 physical rooms -> cap 110)
    const db = new HotelReservationDatabase({ overbookingPct: 10 });
    db.seedInventoryHorizon({
      hotelId: 'h-211',
      roomTypeId: 'rt-1001',
      startDate: '2026-06-01',
      days: 5,
      totalInventory: 100,
    });
    assert.equal(computeOverbookingCap(100, 10), 110);
    assert.equal(computeOverbookingCap(15, 10), 16); // floor(16.5) = 16

    db.reserve({
      reservationId: 'res-1',
      hotelId: 'h-211',
      roomTypeId: 'rt-1001',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      roomCount: 100,
    });
    // Overbooking buffer (+10% = 10 extra rooms) accepts a 10-room reservation on June 1..3
    db.reserve({
      reservationId: 'res-2-overbook',
      hotelId: 'h-211',
      roomTypeId: 'rt-1001',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      roomCount: 10,
    });
    assert.equal(db.getInventoryRow('h-211', 'rt-1001', '2026-06-01')?.totalReserved, 110);
    assert.equal(db.getInventoryRow('h-211', 'rt-1001', '2026-06-02')?.totalReserved, 110);
    assert.equal(db.getInventoryRow('h-211', 'rt-1001', '2026-06-03')?.totalReserved, 0);

    // 111th room on June 1..3 breaches the 110 cap and rolls back
    assert.throws(
      () =>
        db.reserve({
          reservationId: 'res-3-overflow',
          hotelId: 'h-211',
          roomTypeId: 'rt-1001',
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          roomCount: 1,
        }),
      OverbookingLimitExceededError,
    );

    // Next guest checking in on checkout morning 2026-06-03 succeeds cleanly
    db.reserve({
      reservationId: 'res-4-turnover',
      hotelId: 'h-211',
      roomTypeId: 'rt-1001',
      startDate: '2026-06-03',
      endDate: '2026-06-05',
      roomCount: 110,
    });
    assert.equal(db.getInventoryRow('h-211', 'rt-1001', '2026-06-03')?.totalReserved, 110);
  });

  it('Idempotent reservation_id with 64-char SHA-256 payloadHash deduplicates retries, rejects drift, and executes PENDING_PAYMENT Saga transitions', () => {
    const db = new HotelReservationDatabase({ overbookingPct: 10 });
    db.seedInventoryHorizon({
      hotelId: 'h-245',
      roomTypeId: 'rt-suite',
      startDate: '2026-07-10',
      days: 4,
      totalInventory: 10,
    });

    const req = {
      reservationId: 'idem-13422445',
      hotelId: 'h-245',
      roomTypeId: 'rt-suite',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      roomCount: 3,
    };

    // Step 1 of Temporal Saga: reserve hold in PENDING_PAYMENT state
    const first = db.reserve(req, { initialStatus: 'PENDING_PAYMENT' });
    assert.equal(first.deduplicated, false);
    assert.equal(first.record.status, 'PENDING_PAYMENT');
    assert.equal(first.record.payloadHash.length, 64); // SHA-256 hex digest
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 3);

    // User double-clicks "Complete Booking" or client retries on timeout with same reservationId
    const second = db.reserve(req, { initialStatus: 'PENDING_PAYMENT' });
    assert.equal(second.deduplicated, true);
    assert.equal(second.record.reservationId, first.record.reservationId);
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 3);

    // Step 2 of Temporal Saga: external Payment Service succeeds -> transition to CONFIRMED
    assert.equal(db.confirmPayment(req.reservationId), true);
    assert.equal(first.record.status, 'CONFIRMED');

    // Negative test: reusing the same reservationId with modified roomCount or dates is rejected
    assert.throws(() => db.reserve({ ...req, roomCount: 5 }), IdempotencyPayloadMismatchError);
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 3);

    // Compensating Saga test: payment declines on a second booking -> cancelReservation releases inventory idempotently
    const declinedHold = db.reserve(
      { ...req, reservationId: 'idem-declined-2', roomCount: 4 },
      { initialStatus: 'PENDING_PAYMENT' },
    );
    assert.equal(declinedHold.record.status, 'PENDING_PAYMENT');
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 7);
    assert.equal(db.cancelReservation('idem-declined-2'), true);
    assert.equal(declinedHold.record.status, 'CANCELLED');
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 3);
    // Replaying compensation is an idempotent no-op
    assert.equal(db.cancelReservation('idem-declined-2'), false);
    assert.equal(db.getInventoryRow('h-245', 'rt-suite', '2026-07-10')?.totalReserved, 3);
  });

  it('Pessimistic ORDER BY hotel_id, room_type_id, date ASC prevents multi-night circular-wait deadlocks and OCC version CAS aborts stale concurrent writers', () => {
    // Negative test 1: 2-night mirrored unsorted lock acquisition deadlocks (SQLSTATE 40P01)
    assert.throws(
      () =>
        simulateConcurrentLockOrder({
          txADates: ['h-500:rt-deluxe:2026-08-01', 'h-500:rt-deluxe:2026-08-02'],
          txBDates: ['h-500:rt-deluxe:2026-08-02', 'h-500:rt-deluxe:2026-08-01'],
          canonicalSort: false,
        }),
      DeadlockDetectedError,
    );

    // Negative test 2: 3-night partial-overlap unsorted acquisition deadlocks on later steps
    assert.throws(
      () =>
        simulateConcurrentLockOrder({
          txADates: [
            'h-500:rt-deluxe:2026-08-01',
            'h-500:rt-deluxe:2026-08-03',
            'h-500:rt-deluxe:2026-08-02',
          ],
          txBDates: [
            'h-500:rt-deluxe:2026-08-02',
            'h-500:rt-deluxe:2026-08-04',
            'h-500:rt-deluxe:2026-08-03',
          ],
          canonicalSort: false,
        }),
      DeadlockDetectedError,
    );

    // Positive test: canonical `ORDER BY hotel_id ASC, room_type_id ASC, date ASC` eliminates circular wait across both 2-night and 3-night overlaps
    const sorted = simulateConcurrentLockOrder({
      txADates: [
        'h-500:rt-deluxe:2026-08-01',
        'h-500:rt-deluxe:2026-08-03',
        'h-500:rt-deluxe:2026-08-02',
      ],
      txBDates: [
        'h-500:rt-deluxe:2026-08-02',
        'h-500:rt-deluxe:2026-08-04',
        'h-500:rt-deluxe:2026-08-03',
      ],
      canonicalSort: true,
    });
    assert.deepEqual(sorted.committedInOrder, ['txA', 'txB']);

    // OCC version CAS test: two concurrent transactions read version=1 on 2026-08-01..03
    const db = new HotelReservationDatabase({ overbookingPct: 10 });
    db.seedInventoryHorizon({
      hotelId: 'h-500',
      roomTypeId: 'rt-deluxe',
      startDate: '2026-08-01',
      days: 3,
      totalInventory: 10,
    });

    const snapshotVersions = new Map<string, number>([
      ['2026-08-01', 1],
      ['2026-08-02', 1],
    ]);

    // Transaction 1 commits first and bumps row versions on 2026-08-01 and 2026-08-02 to 2
    db.reserve(
      {
        reservationId: 'occ-tx-1',
        hotelId: 'h-500',
        roomTypeId: 'rt-deluxe',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        roomCount: 2,
      },
      { expectedVersions: snapshotVersions },
    );
    assert.equal(db.getInventoryRow('h-500', 'rt-deluxe', '2026-08-01')?.version, 2);

    // Transaction 2 attempts to commit with its stale snapshot (version=1) -> fails with OptimisticLockConflictError
    assert.throws(
      () =>
        db.reserve(
          {
            reservationId: 'occ-tx-2',
            hotelId: 'h-500',
            roomTypeId: 'rt-deluxe',
            startDate: '2026-08-01',
            endDate: '2026-08-03',
            roomCount: 2,
          },
          { expectedVersions: snapshotVersions },
        ),
      OptimisticLockConflictError,
    );
    // Inventory remains strictly at 2 (Transaction 2 did not partially apply)
    assert.equal(db.getInventoryRow('h-500', 'rt-deluxe', '2026-08-01')?.totalReserved, 2);
  });

  it('Stale Valkey/Redis CDC inventory cache never causes overselling because the ACID database enforces the authoritative booking cap', () => {
    const db = new HotelReservationDatabase({ overbookingPct: 0 }); // 1 room total, 0% overbooking
    db.seedInventoryHorizon({
      hotelId: 'h-900',
      roomTypeId: 'rt-penthouse',
      startDate: '2026-09-01',
      days: 3,
      totalInventory: 1,
    });

    const stay = {
      hotelId: 'h-900',
      roomTypeId: 'rt-penthouse',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      roomCount: 1,
    };

    // Guest A checks cache (available=1) and commits booking in the relational DB
    assert.equal(db.checkCachedAvailability(stay), true);
    db.reserve({ ...stay, reservationId: 'cdc-guest-a' });

    // Before Debezium CDC flushes to Valkey/Redis, the cache is transiently stale and still reports true!
    assert.equal(db.checkCachedAvailability(stay), true);

    // Guest B passes the stale cache UI check and submits POST /v1/reservations -> DB deterministically rejects!
    assert.throws(
      () => db.reserve({ ...stay, reservationId: 'cdc-guest-b' }),
      OverbookingLimitExceededError,
    );

    // Once Debezium CDC flushes WAL changes to Valkey/Redis, cache reflects 0 available rooms
    const flushed = db.flushCdcToCache();
    assert.equal(flushed, 2);
    assert.equal(db.checkCachedAvailability(stay), false);
  });

  it('Property test proves overbooking invariant and cancellation conservation hold across arbitrary booking workloads, plus 73M-row / 16-shard capacity math', () => {
    const cap = computeOverbookingCap(10, 10); // 11 max reserved per night
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            idSuffix: fc.integer({ min: 1, max: 15 }),
            startOffset: fc.integer({ min: 0, max: 4 }),
            lengthDays: fc.integer({ min: 1, max: 3 }),
            roomCount: fc.integer({ min: 1, max: 4 }),
            cancelAfter: fc.boolean(),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        (ops) => {
          const db = new HotelReservationDatabase({ overbookingPct: 10 });
          db.seedInventoryHorizon({
            hotelId: 'h-prop',
            roomTypeId: 'rt-std',
            startDate: '2026-10-01',
            days: 10,
            totalInventory: 10,
          });

          const activeConfirmed: Array<{ id: string; nights: readonly string[]; count: number }> =
            [];

          for (const op of ops) {
            const startDay = 1 + op.startOffset;
            const endDay = startDay + op.lengthDays;
            const startDate = `2026-10-${String(startDay).padStart(2, '0')}`;
            const endDate = `2026-10-${String(endDay).padStart(2, '0')}`;
            const reservationId = `prop-res-${op.idSuffix}`;

            try {
              const res = db.reserve({
                reservationId,
                hotelId: 'h-prop',
                roomTypeId: 'rt-std',
                startDate,
                endDate,
                roomCount: op.roomCount,
              });
              if (!res.deduplicated) {
                activeConfirmed.push({
                  id: reservationId,
                  nights: res.record.nights,
                  count: op.roomCount,
                });
                if (op.cancelAfter) {
                  db.cancelReservation(reservationId);
                  activeConfirmed.pop();
                }
              }
            } catch (err) {
              assert.ok(
                err instanceof OverbookingLimitExceededError ||
                  err instanceof IdempotencyPayloadMismatchError,
              );
            }
          }

          // Verify that every night in the 10-day horizon satisfies 0 <= totalReserved <= cap (11)
          // and equals the exact sum of active confirmed reservations covering that night
          for (let d = 1; d <= 10; d++) {
            const date = `2026-10-${String(d).padStart(2, '0')}`;
            const row = db.getInventoryRow('h-prop', 'rt-std', date)!;
            const expectedReserved = activeConfirmed
              .filter((r) => r.nights.includes(date))
              .reduce((sum, r) => sum + r.count, 0);
            assert.equal(row.totalReserved, expectedReserved);
            assert.ok(row.totalReserved >= 0 && row.totalReserved <= cap);
          }
        },
      ),
      { seed: 20261121, numRuns: 100 },
    );

    // ByteByteGo Ch. 22 quantitative capacity & OTA sharding proof:
    const est = estimateHotelSystemCapacity({
      hotels: 5_000,
      totalRooms: 1_000_000,
      occupancyRatio: 0.7,
      avgStayDays: 3,
      roomTypesPerHotel: 20,
      horizonYears: 2,
      funnelStepConversion: 0.1,
      otaPeakQps: 30_000,
      shardCount: 16,
    });

    // 1,000,000 * 0.7 / 3 = 233,333.33 (~240k reservations/day)
    assert.ok(est.dailyReservations > 233_333 && est.dailyReservations < 233_334);
    // ~2.70 TPS exact (86,400 s/day), ~3 TPS mental-math anchor -> 10% funnel -> ~27 -> ~270 QPS
    assert.ok(est.averageReservationTps > 2.7 && est.averageReservationTps < 2.71);
    assert.ok(est.detailPageQps > 270 && est.detailPageQps < 271);
    // 5,000 * 20 * 2 * 365 = 73,000,000 rows
    assert.equal(est.inventoryHorizonRows, 73_000_000);
    // 30,000 QPS / 16 hotel_id shards = 1,875 QPS/shard
    assert.equal(est.otaPerShardQps, 1_875);
  });
});
