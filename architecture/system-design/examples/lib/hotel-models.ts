/**
 * Executable models for Module 19: Hotel Reservation System (ByteByteGo Ch. 22).
 * Covers:
 *  1. Half-open `[checkIn, checkOut)` date intervals vs naive inclusive `BETWEEN` off-by-one bug,
 *     plus controlled overbooking (`total_reserved + roomCount <= floor(total_inventory * (100 + overbookingPct) / 100)`)
 *  2. Idempotent reservation API (`reservationId` UNIQUE key + SHA-256 payload-hash drift rejection)
 *     and Temporal Saga state transitions (`PENDING_PAYMENT -> CONFIRMED / CANCELLED`)
 *  3. Pessimistic locking with canonical `ORDER BY hotel_id ASC, room_type_id ASC, date ASC` deadlock
 *     avoidance vs unsorted circular-wait deadlocks (`SQLSTATE 40P01`), plus OCC (`version` CAS)
 *  4. Asynchronous Debezium-style CDC -> Valkey/Redis inventory cache proving stale cache reads never cause
 *     overselling when the ACID database enforces the authoritative booking invariant
 *  5. Back-of-the-envelope capacity, funnel conversion (3 -> 30 -> 300 QPS), 73M-row horizon, and 16-shard OTA sizing
 */

import { createHash } from 'node:crypto';

export interface RoomTypeInventoryRow {
  readonly hotelId: string;
  readonly roomTypeId: string;
  readonly date: string; // ISO YYYY-MM-DD
  readonly totalInventory: number;
  totalReserved: number;
  version: number;
}

export interface ReservationRequest {
  readonly reservationId: string;
  readonly hotelId: string;
  readonly roomTypeId: string;
  readonly startDate: string; // check-in (inclusive)
  readonly endDate: string; // check-out (exclusive in correct half-open [startDate, endDate))
  readonly roomCount: number;
}

type ReservationStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';

export interface ReservationRecord {
  readonly reservationId: string;
  readonly hotelId: string;
  readonly roomTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly nights: readonly string[];
  readonly roomCount: number;
  readonly payloadHash: string; // 64-char hex SHA-256 digest
  status: ReservationStatus;
}

export class OverbookingLimitExceededError extends Error {
  readonly date: string;
  readonly requested: number;
  readonly totalReserved: number;
  readonly maxAllowed: number;

  constructor(date: string, requested: number, totalReserved: number, maxAllowed: number) {
    super(
      `OverbookingLimitExceededError on ${date}: totalReserved(${totalReserved}) + requested(${requested}) > cap(${maxAllowed})`,
    );
    this.name = 'OverbookingLimitExceededError';
    this.date = date;
    this.requested = requested;
    this.totalReserved = totalReserved;
    this.maxAllowed = maxAllowed;
  }
}

export class IdempotencyPayloadMismatchError extends Error {
  constructor(reservationId: string) {
    super(
      `IdempotencyPayloadMismatchError: reservationId ${reservationId} reused with different booking parameters`,
    );
    this.name = 'IdempotencyPayloadMismatchError';
  }
}

export class OptimisticLockConflictError extends Error {
  constructor(date: string, expectedVersion: number, actualVersion: number) {
    super(
      `OptimisticLockConflictError on ${date}: expected version ${expectedVersion}, found ${actualVersion}`,
    );
    this.name = 'OptimisticLockConflictError';
  }
}

export class DeadlockDetectedError extends Error {
  constructor(txA: string, txB: string, keyA: string, keyB: string) {
    super(
      `DeadlockDetectedError (SQLSTATE 40P01): circular wait between ${txA} (holds ${keyA}, waits ${keyB}) and ${txB} (holds ${keyB}, waits ${keyA})`,
    );
    this.name = 'DeadlockDetectedError';
  }
}

/**
 * Generates ISO `YYYY-MM-DD` date strings for a stay under either:
 *  - `'half-open'` (`[startDate, endDate)` — `date >= startDate AND date < endDate`), where checkout morning is NOT reserved.
 *  - `'inclusive-between'` (`[startDate, endDate]` — ByteByteGo's naive `date BETWEEN startDate AND endDate` off-by-one bug).
 */
export function expandStayDates(
  startDate: string,
  endDate: string,
  mode: 'half-open' | 'inclusive-between' = 'half-open',
): string[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    throw new RangeError(`Invalid stay interval: startDate=${startDate}, endDate=${endDate}`);
  }

  const dayMs = 86_400_000;
  const dates: string[] = [];
  const limitMs = mode === 'half-open' ? endMs - dayMs : endMs;
  for (let cur = startMs; cur <= limitMs; cur += dayMs) {
    dates.push(new Date(cur).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Computes the maximum bookable rooms for a night given physical `totalInventory`
 * and an integer `overbookingPct` (e.g. 10 for 10% overbooking) using exact integer floor arithmetic:
 * `floor(totalInventory * (100 + overbookingPct) / 100)`.
 */
export function computeOverbookingCap(totalInventory: number, overbookingPct: number): number {
  if (totalInventory < 0 || overbookingPct < 0) {
    throw new RangeError('totalInventory and overbookingPct must be non-negative');
  }
  return Math.floor((totalInventory * (100 + overbookingPct)) / 100);
}

function canonicalReservationHash(req: ReservationRequest): string {
  const canonical = `${req.hotelId}|${req.roomTypeId}|${req.startDate}|${req.endDate}|${req.roomCount}`;
  return createHash('sha256').update(canonical).digest('hex');
}

function inventoryKey(hotelId: string, roomTypeId: string, date: string): string {
  return `${hotelId}:${roomTypeId}:${date}`;
}

/**
 * Authoritative relational database engine for `room_type_inventory` and `reservation`,
 * paired with an asynchronous Debezium-style CDC stream feeding a Valkey/Redis inventory cache.
 */
export class HotelReservationDatabase {
  readonly overbookingPct: number;
  private readonly inventory = new Map<string, RoomTypeInventoryRow>();
  private readonly reservations = new Map<string, ReservationRecord>();
  private readonly cdcOutbox: Array<{ key: string; availableToSell: number }> = [];
  private readonly valkeyCache = new Map<string, number>();

  constructor(options: { overbookingPct?: number } = {}) {
    this.overbookingPct = options.overbookingPct ?? 10;
  }

  /**
   * Pre-populates `room_type_inventory` rows (modeling the daily rolling CRON job).
   * Idempotent: existing `(hotel_id, room_type_id, date)` rows are preserved untouched.
   */
  seedInventoryHorizon(params: {
    hotelId: string;
    roomTypeId: string;
    startDate: string;
    days: number;
    totalInventory: number;
  }): number {
    const startMs = Date.parse(`${params.startDate}T00:00:00Z`);
    const dayMs = 86_400_000;
    let inserted = 0;

    for (let i = 0; i < params.days; i++) {
      const date = new Date(startMs + i * dayMs).toISOString().slice(0, 10);
      const key = inventoryKey(params.hotelId, params.roomTypeId, date);
      if (!this.inventory.has(key)) {
        const row: RoomTypeInventoryRow = {
          hotelId: params.hotelId,
          roomTypeId: params.roomTypeId,
          date,
          totalInventory: params.totalInventory,
          totalReserved: 0,
          version: 1,
        };
        this.inventory.set(key, row);
        this.valkeyCache.set(
          key,
          computeOverbookingCap(row.totalInventory, this.overbookingPct) - row.totalReserved,
        );
        inserted++;
      }
    }
    return inserted;
  }

  getInventoryRow(
    hotelId: string,
    roomTypeId: string,
    date: string,
  ): RoomTypeInventoryRow | undefined {
    return this.inventory.get(inventoryKey(hotelId, roomTypeId, date));
  }

  /**
   * Fast read path from the Valkey/Redis inventory cache (may lag behind the DB before CDC flush).
   */
  checkCachedAvailability(req: Omit<ReservationRequest, 'reservationId'>): boolean {
    const nights = expandStayDates(req.startDate, req.endDate, 'half-open');
    for (const date of nights) {
      const available = this.valkeyCache.get(inventoryKey(req.hotelId, req.roomTypeId, date)) ?? 0;
      if (available < req.roomCount) return false;
    }
    return true;
  }

  /**
   * Flushes pending Debezium CDC events from the database WAL/binlog into the Valkey/Redis cache.
   */
  flushCdcToCache(): number {
    let applied = 0;
    while (this.cdcOutbox.length > 0) {
      const event = this.cdcOutbox.shift();
      if (event) {
        this.valkeyCache.set(event.key, event.availableToSell);
        applied++;
      }
    }
    return applied;
  }

  /**
   * Reserves rooms atomically in the ACID database using deterministic ascending composite key order
   * (`ORDER BY hotel_id ASC, room_type_id ASC, date ASC`), enforcing:
   *  - Idempotency key deduplication (`reservationId`) with 64-char SHA-256 `payloadHash` verification
   *  - Half-open `[startDate, endDate)` or legacy `'inclusive-between'` interval selection
   *  - Optional OCC (`expectedVersions` per date)
   *  - Controlled overbooking `CHECK (total_reserved + roomCount <= (total_inventory * (100 + overbookingPct)) / 100)`
   */
  reserve(
    req: ReservationRequest,
    options: {
      intervalMode?: 'half-open' | 'inclusive-between';
      expectedVersions?: ReadonlyMap<string, number>;
      initialStatus?: 'PENDING_PAYMENT' | 'CONFIRMED';
    } = {},
  ): { record: ReservationRecord; deduplicated: boolean } {
    if (!Number.isInteger(req.roomCount) || req.roomCount <= 0) {
      throw new RangeError('roomCount must be a positive integer');
    }

    const payloadHash = canonicalReservationHash(req);
    const existing = this.reservations.get(req.reservationId);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new IdempotencyPayloadMismatchError(req.reservationId);
      }
      return { record: existing, deduplicated: true };
    }

    // Canonical lock/update ordering across composite PK (`ORDER BY hotel_id ASC, room_type_id ASC, date ASC`)
    const nights = expandStayDates(
      req.startDate,
      req.endDate,
      options.intervalMode ?? 'half-open',
    ).sort((a, b) =>
      inventoryKey(req.hotelId, req.roomTypeId, a).localeCompare(
        inventoryKey(req.hotelId, req.roomTypeId, b),
      ),
    );

    const rowsToMutate: Array<{ key: string; row: RoomTypeInventoryRow; cap: number }> = [];
    for (const date of nights) {
      const key = inventoryKey(req.hotelId, req.roomTypeId, date);
      const row = this.inventory.get(key);
      if (!row) {
        throw new Error(`Missing pre-populated inventory row for ${key}`);
      }

      if (options.expectedVersions) {
        const expectedVer = options.expectedVersions.get(date);
        if (expectedVer !== undefined && row.version !== expectedVer) {
          throw new OptimisticLockConflictError(date, expectedVer, row.version);
        }
      }

      const cap = computeOverbookingCap(row.totalInventory, this.overbookingPct);
      if (row.totalReserved + req.roomCount > cap) {
        throw new OverbookingLimitExceededError(date, req.roomCount, row.totalReserved, cap);
      }
      rowsToMutate.push({ key, row, cap });
    }

    // Commit phase: mutate all nights atomically and enqueue Debezium CDC events
    for (const { key, row, cap } of rowsToMutate) {
      row.totalReserved += req.roomCount;
      row.version += 1;
      this.cdcOutbox.push({ key, availableToSell: cap - row.totalReserved });
    }

    const record: ReservationRecord = {
      reservationId: req.reservationId,
      hotelId: req.hotelId,
      roomTypeId: req.roomTypeId,
      startDate: req.startDate,
      endDate: req.endDate,
      nights,
      roomCount: req.roomCount,
      payloadHash,
      status: options.initialStatus ?? 'CONFIRMED',
    };
    this.reservations.set(req.reservationId, record);
    return { record, deduplicated: false };
  }

  /**
   * Transitions a `PENDING_PAYMENT` reservation hold to `CONFIRMED` once the Payment Service
   * captures the charge in the Temporal Saga forward path.
   */
  confirmPayment(reservationId: string): boolean {
    const existing = this.reservations.get(reservationId);
    if (!existing || existing.status === 'CANCELLED') {
      return false;
    }
    existing.status = 'CONFIRMED';
    return true;
  }

  /**
   * Idempotent cancellation / Saga compensating action releasing reserved inventory across all nights.
   */
  cancelReservation(reservationId: string): boolean {
    const existing = this.reservations.get(reservationId);
    if (!existing || existing.status === 'CANCELLED') {
      return false;
    }

    for (const date of existing.nights) {
      const key = inventoryKey(existing.hotelId, existing.roomTypeId, date);
      const row = this.inventory.get(key);
      if (row) {
        row.totalReserved -= existing.roomCount;
        row.version += 1;
        const cap = computeOverbookingCap(row.totalInventory, this.overbookingPct);
        this.cdcOutbox.push({ key, availableToSell: cap - row.totalReserved });
      }
    }
    existing.status = 'CANCELLED';
    return true;
  }
}

/**
 * Step-by-step row-lock acquisition simulator proving why unsorted multi-row `SELECT ... FOR UPDATE`
 * across overlapping `(hotel_id, room_type_id, date)` targets deadlocks (`SQLSTATE 40P01`) when two
 * concurrent transactions interleave lock requests in opposite order, whereas canonical ascending
 * composite-key ordering (`ORDER BY hotel_id ASC, room_type_id ASC, date ASC`) serializes cleanly.
 */
export function simulateConcurrentLockOrder(params: {
  txADates: readonly string[];
  txBDates: readonly string[];
  canonicalSort: boolean;
}): { committedInOrder: readonly ['txA', 'txB'] } {
  if (params.txADates.length === 0 || params.txBDates.length === 0) {
    throw new RangeError('txADates and txBDates must be non-empty');
  }

  const orderA = params.canonicalSort ? [...params.txADates].sort() : [...params.txADates];
  const orderB = params.canonicalSort ? [...params.txBDates].sort() : [...params.txBDates];

  const heldByA = new Set<string>();
  const heldByB = new Set<string>();
  let idxA = 0;
  let idxB = 0;

  while (idxA < orderA.length || idxB < orderB.length) {
    const targetA = orderA[idxA];
    const targetB = orderB[idxB];

    const aBlockedByB = targetA !== undefined && heldByB.has(targetA);
    const bBlockedByA = targetB !== undefined && heldByA.has(targetB);

    if (aBlockedByB && bBlockedByA) {
      throw new DeadlockDetectedError('txA', 'txB', targetB!, targetA!);
    }

    // Interleave lock acquisition steps while neither transaction is blocked;
    // once one transaction blocks on a lock held by the other, the holder runs to commit and releases its locks.
    if (
      targetA !== undefined &&
      !aBlockedByB &&
      (idxA <= idxB || bBlockedByA || targetB === undefined)
    ) {
      if (targetB === targetA && !heldByB.has(targetA)) {
        // Both contend for the exact same next key: txA wins the lock, txB blocks behind txA
        heldByA.add(targetA);
        idxA++;
        while (idxA < orderA.length) {
          const nextA = orderA[idxA]!;
          if (heldByB.has(nextA)) {
            throw new DeadlockDetectedError('txA', 'txB', targetA, nextA);
          }
          heldByA.add(nextA);
          idxA++;
        }
        heldByA.clear();
      } else {
        heldByA.add(targetA);
        idxA++;
        if (idxA === orderA.length) heldByA.clear();
      }
    } else if (targetB !== undefined && !bBlockedByA) {
      heldByB.add(targetB);
      idxB++;
      if (idxB === orderB.length) heldByB.clear();
    }
  }

  return { committedInOrder: ['txA', 'txB'] };
}

export interface HotelCapacityEstimate {
  readonly dailyReservations: number;
  readonly averageReservationTps: number;
  readonly reservationPageQps: number;
  readonly detailPageQps: number;
  readonly inventoryHorizonRows: number;
  readonly otaPerShardQps: number;
}

/**
 * Quantitative capacity and funnel conversion model for ByteByteGo Ch. 22:
 *  - 5,000 hotels, 1,000,000 rooms, 70% occupancy, 3-day average stay
 *  - 10% funnel conversion per step (Detail Page -> Reservation Page -> Confirmed Booking)
 *  - 2-year (730-day) rolling `room_type_inventory` horizon across 20 room types/hotel
 *  - OTA 1,000x scale-out across 16 `hotel_id` shards
 */
export function estimateHotelSystemCapacity(options: {
  hotels: number;
  totalRooms: number;
  occupancyRatio: number;
  avgStayDays: number;
  roomTypesPerHotel: number;
  horizonYears: number;
  funnelStepConversion: number;
  otaPeakQps: number;
  shardCount: number;
}): HotelCapacityEstimate {
  const dailyReservations = (options.totalRooms * options.occupancyRatio) / options.avgStayDays;
  const averageReservationTps = dailyReservations / 86_400;
  const reservationPageQps = averageReservationTps / options.funnelStepConversion;
  const detailPageQps = reservationPageQps / options.funnelStepConversion;
  const inventoryHorizonRows =
    options.hotels * options.roomTypesPerHotel * options.horizonYears * 365;
  const otaPerShardQps = options.otaPeakQps / options.shardCount;

  return {
    dailyReservations,
    averageReservationTps,
    reservationPageQps,
    detailPageQps,
    inventoryHorizonRows,
    otaPerShardQps,
  };
}
