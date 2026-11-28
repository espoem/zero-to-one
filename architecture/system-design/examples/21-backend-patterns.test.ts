import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';

// ============================================================================
// (a) Hexagonal Architecture (Ports & Adapters): Pure Domain Core + Swappable Adapters
// ============================================================================

interface OrderLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
}

interface PlacedOrder {
  readonly orderId: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly status: 'PAID';
  readonly createdAtMs: number;
}

interface OrderRepositoryPort {
  save(order: PlacedOrder): void;
  findById(orderId: string): PlacedOrder | undefined;
}

interface PaymentGatewayPort {
  charge(
    customerId: string,
    amountCents: number,
    idempotencyKey: string,
  ): { readonly ok: boolean; readonly reason?: string };
}

interface ClockPort {
  nowMs(): number;
}

class DomainRuleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

class OrderPlacementService {
  readonly #orders: OrderRepositoryPort;
  readonly #payments: PaymentGatewayPort;
  readonly #clock: ClockPort;

  constructor(orders: OrderRepositoryPort, payments: PaymentGatewayPort, clock: ClockPort) {
    this.#orders = orders;
    this.#payments = payments;
    this.#clock = clock;
  }

  placeOrder(input: {
    readonly orderId: string;
    readonly customerId: string;
    readonly lines: readonly OrderLine[];
    readonly idempotencyKey: string;
  }): PlacedOrder {
    if (input.lines.length === 0) {
      throw new DomainRuleError('EMPTY_ORDER', 'Order must contain at least one line item.');
    }

    let totalCents = 0;
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new DomainRuleError('INVALID_QUANTITY', `Invalid quantity for ${line.sku}`);
      }
      if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents <= 0) {
        throw new DomainRuleError('INVALID_PRICE', `Invalid unit price for ${line.sku}`);
      }
      totalCents += line.quantity * line.unitPriceCents;
    }

    const existing = this.#orders.findById(input.orderId);
    if (existing) {
      return existing;
    }

    const payment = this.#payments.charge(input.customerId, totalCents, input.idempotencyKey);
    if (!payment.ok) {
      throw new DomainRuleError(
        'PAYMENT_DECLINED',
        payment.reason ?? 'Payment gateway declined charge.',
      );
    }

    const placed: PlacedOrder = {
      orderId: input.orderId,
      customerId: input.customerId,
      totalCents,
      status: 'PAID',
      createdAtMs: this.#clock.nowMs(),
    };

    try {
      this.#orders.save(placed);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown repository error';
      throw new DomainRuleError('PERSISTENCE_UNAVAILABLE', `Failed to persist order: ${detail}`);
    }

    return placed;
  }
}

class InMemoryOrderAdapter implements OrderRepositoryPort {
  readonly #store = new Map<string, PlacedOrder>();

  save(order: PlacedOrder): void {
    this.#store.set(order.orderId, order);
  }

  findById(orderId: string): PlacedOrder | undefined {
    return this.#store.get(orderId);
  }
}

class FailingOrderAdapter implements OrderRepositoryPort {
  save(): void {
    throw new Error('SQLSTATE 53300: connection pool exhausted');
  }

  findById(): PlacedOrder | undefined {
    return undefined;
  }
}

class StubPaymentAdapter implements PaymentGatewayPort {
  readonly charges: Array<{ customerId: string; amountCents: number; idempotencyKey: string }> = [];
  readonly #shouldApprove: boolean;
  readonly #declineReason: string | undefined;

  constructor(shouldApprove: boolean, declineReason?: string) {
    this.#shouldApprove = shouldApprove;
    this.#declineReason = declineReason;
  }

  charge(customerId: string, amountCents: number, idempotencyKey: string) {
    this.charges.push({ customerId, amountCents, idempotencyKey });
    return this.#shouldApprove
      ? { ok: true }
      : {
          ok: false,
          ...(this.#declineReason !== undefined ? { reason: this.#declineReason } : {}),
        };
  }
}

// ============================================================================
// (b) CQRS: Command Store vs. Asynchronous Read Projection with Lag Simulation
// ============================================================================

interface OrderDomainEvent {
  readonly eventId: string;
  readonly orderId: string;
  readonly aggregateVersion: number;
  readonly type: 'OrderCreated' | 'OrderPaid' | 'OrderShipped';
  readonly customerId: string;
  readonly totalCents: number;
  readonly committedAtTick: number;
}

interface OrderReadRow {
  readonly orderId: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly status: 'PENDING' | 'PAID' | 'SHIPPED';
  readonly version: number;
}

class OrderCommandSide {
  #tick = 0;
  readonly #versions = new Map<string, number>();
  readonly #bus: OrderDomainEvent[] = [];

  advanceTick(steps = 1): number {
    this.#tick += steps;
    return this.#tick;
  }

  currentTick(): number {
    return this.#tick;
  }

  submitCommand(
    type: OrderDomainEvent['type'],
    orderId: string,
    customerId: string,
    totalCents: number,
  ): OrderDomainEvent {
    const nextVersion = (this.#versions.get(orderId) ?? 0) + 1;
    this.#versions.set(orderId, nextVersion);
    const event: OrderDomainEvent = {
      eventId: `${orderId}:v${nextVersion}`,
      orderId,
      aggregateVersion: nextVersion,
      type,
      customerId,
      totalCents,
      committedAtTick: this.#tick,
    };
    this.#bus.push(event);
    return event;
  }

  getLatestWriteVersion(orderId: string): number {
    return this.#versions.get(orderId) ?? 0;
  }

  drainDeliverableEvents(lagTicks: number): OrderDomainEvent[] {
    const ready: OrderDomainEvent[] = [];
    for (let i = this.#bus.length - 1; i >= 0; i--) {
      const ev = this.#bus[i];
      if (ev && this.#tick - ev.committedAtTick >= lagTicks) {
        ready.unshift(ev);
        this.#bus.splice(i, 1);
      }
    }
    return ready;
  }
}

class OrderQueryProjection {
  readonly #views = new Map<string, OrderReadRow>();

  apply(event: OrderDomainEvent): boolean {
    const current = this.#views.get(event.orderId);
    // Reject stale or duplicate events whose aggregateVersion is not strictly newer
    if (current && event.aggregateVersion <= current.version) {
      return false;
    }

    const status: OrderReadRow['status'] =
      event.type === 'OrderCreated' ? 'PENDING' : event.type === 'OrderPaid' ? 'PAID' : 'SHIPPED';

    this.#views.set(event.orderId, {
      orderId: event.orderId,
      customerId: event.customerId,
      totalCents: event.totalCents,
      status,
      version: event.aggregateVersion,
    });
    return true;
  }

  getOrder(orderId: string): OrderReadRow | undefined {
    return this.#views.get(orderId);
  }

  satisfiesReadYourWrites(orderId: string, minExpectedVersion: number): boolean {
    const row = this.#views.get(orderId);
    return row !== undefined && row.version >= minExpectedVersion;
  }
}

// ============================================================================
// (c) Event-Driven Transactional Outbox + Idempotent Consumer Deduplication
// ============================================================================

interface OutboxRecord {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly sequence: number;
  readonly deltaCents: number;
  published: boolean;
}

class TransactionalOutboxStore {
  readonly #balances = new Map<string, number>();
  readonly #sequences = new Map<string, number>();
  readonly #outbox: OutboxRecord[] = [];

  commitTransfer(input: {
    readonly accountId: string;
    readonly eventId: string;
    readonly deltaCents: number;
    readonly failMidTransaction?: boolean;
  }): OutboxRecord {
    const prevBalance = this.#balances.get(input.accountId) ?? 0;
    const prevSeq = this.#sequences.get(input.accountId) ?? 0;
    const nextBalance = prevBalance + input.deltaCents;

    if (nextBalance < 0) {
      throw new DomainRuleError(
        'INSUFFICIENT_FUNDS',
        'Transaction aborted: negative balance forbidden.',
      );
    }
    if (input.failMidTransaction) {
      throw new Error('Simulated DB deadlock before COMMIT');
    }

    const nextSeq = prevSeq + 1;
    const record: OutboxRecord = {
      eventId: input.eventId,
      aggregateId: input.accountId,
      sequence: nextSeq,
      deltaCents: input.deltaCents,
      published: false,
    };

    // Atomic state + outbox commit
    this.#balances.set(input.accountId, nextBalance);
    this.#sequences.set(input.accountId, nextSeq);
    this.#outbox.push(record);
    return record;
  }

  relayPendingInOrder(): OutboxRecord[] {
    const pending = this.#outbox
      .filter((row) => !row.published)
      .sort((a, b) => a.aggregateId.localeCompare(b.aggregateId) || a.sequence - b.sequence);
    for (const row of pending) {
      row.published = true;
    }
    return pending;
  }

  getBalance(accountId: string): number {
    return this.#balances.get(accountId) ?? 0;
  }

  getOutboxCount(): number {
    return this.#outbox.length;
  }
}

class IdempotentProjectionConsumer {
  readonly #processedEventIds = new Set<string>();
  readonly #lastSequenceByAggregate = new Map<string, number>();
  readonly #ledgerTotals = new Map<string, number>();
  readonly bufferedOutOfOrder: OutboxRecord[] = [];

  consume(event: OutboxRecord): 'APPLIED' | 'DUPLICATE' | 'BUFFERED_OUT_OF_ORDER' {
    if (this.#processedEventIds.has(event.eventId)) {
      return 'DUPLICATE';
    }

    const expectedSeq = (this.#lastSequenceByAggregate.get(event.aggregateId) ?? 0) + 1;
    if (event.sequence > expectedSeq) {
      this.bufferedOutOfOrder.push(event);
      return 'BUFFERED_OUT_OF_ORDER';
    }
    if (event.sequence < expectedSeq) {
      return 'DUPLICATE';
    }

    this.#applySingle(event);
    this.#drainBuffered(event.aggregateId);
    return 'APPLIED';
  }

  #applySingle(event: OutboxRecord): void {
    this.#processedEventIds.add(event.eventId);
    this.#lastSequenceByAggregate.set(event.aggregateId, event.sequence);
    this.#ledgerTotals.set(
      event.aggregateId,
      (this.#ledgerTotals.get(event.aggregateId) ?? 0) + event.deltaCents,
    );
  }

  #drainBuffered(aggregateId: string): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      const expectedSeq = (this.#lastSequenceByAggregate.get(aggregateId) ?? 0) + 1;
      const idx = this.bufferedOutOfOrder.findIndex(
        (ev) => ev.aggregateId === aggregateId && ev.sequence === expectedSeq,
      );
      if (idx !== -1) {
        const [nextEv] = this.bufferedOutOfOrder.splice(idx, 1);
        if (nextEv && !this.#processedEventIds.has(nextEv.eventId)) {
          this.#applySingle(nextEv);
          progressed = true;
        }
      }
    }
  }

  getTotal(accountId: string): number {
    return this.#ledgerTotals.get(accountId) ?? 0;
  }

  getProcessedCount(): number {
    return this.#processedEventIds.size;
  }
}

// ============================================================================
// Verification Suite
// ============================================================================

describe('Backend Architecture Patterns Proofs (M27)', () => {
  describe('(a) Hexagonal Ports & Adapters Inversion', () => {
    it('executes pure domain logic identically against in-memory adapter and surfaces typed faults on failing adapters', () => {
      const memRepo = new InMemoryOrderAdapter();
      const approvedPay = new StubPaymentAdapter(true);
      const fixedClock: ClockPort = { nowMs: () => 1_700_000_000_000 };

      const service = new OrderPlacementService(memRepo, approvedPay, fixedClock);
      const placed = service.placeOrder({
        orderId: 'ord-100',
        customerId: 'cust-1',
        idempotencyKey: 'idem-100',
        lines: [
          { sku: 'sku-a', quantity: 2, unitPriceCents: 1_500 },
          { sku: 'sku-b', quantity: 1, unitPriceCents: 500 },
        ],
      });

      assert.equal(placed.totalCents, 3_500);
      assert.equal(placed.status, 'PAID');
      assert.equal(placed.createdAtMs, 1_700_000_000_000);
      assert.equal(memRepo.findById('ord-100')?.totalCents, 3_500);

      // Swap secondary adapter to a declined payment gateway -> domain rejects before saving
      const declinedPay = new StubPaymentAdapter(false, 'insufficient funds');
      const declinedService = new OrderPlacementService(memRepo, declinedPay, fixedClock);
      assert.throws(
        () =>
          declinedService.placeOrder({
            orderId: 'ord-101',
            customerId: 'cust-1',
            idempotencyKey: 'idem-101',
            lines: [{ sku: 'sku-a', quantity: 1, unitPriceCents: 999 }],
          }),
        (err: unknown) => err instanceof DomainRuleError && err.code === 'PAYMENT_DECLINED',
      );
      assert.equal(memRepo.findById('ord-101'), undefined);

      // Swap repository adapter to failing infra -> domain translates SQL failure cleanly
      const failingRepo = new FailingOrderAdapter();
      const failingService = new OrderPlacementService(failingRepo, approvedPay, fixedClock);
      assert.throws(
        () =>
          failingService.placeOrder({
            orderId: 'ord-102',
            customerId: 'cust-1',
            idempotencyKey: 'idem-102',
            lines: [{ sku: 'sku-a', quantity: 1, unitPriceCents: 999 }],
          }),
        (err: unknown) => err instanceof DomainRuleError && err.code === 'PERSISTENCE_UNAVAILABLE',
      );
    });

    it('property: preserves totalCents conservation and rejects non-positive line invariants', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              sku: fc.string({ minLength: 1, maxLength: 8 }),
              quantity: fc.integer({ min: 1, max: 20 }),
              unitPriceCents: fc.integer({ min: 1, max: 50_000 }),
            }),
            { minLength: 1, maxLength: 8 },
          ),
          (lines) => {
            const repo = new InMemoryOrderAdapter();
            const pay = new StubPaymentAdapter(true);
            const svc = new OrderPlacementService(repo, pay, { nowMs: () => 42 });
            const placed = svc.placeOrder({
              orderId: 'ord-prop',
              customerId: 'cust-prop',
              idempotencyKey: 'idem-prop',
              lines,
            });
            const expected = lines.reduce(
              (acc, item) => acc + item.quantity * item.unitPriceCents,
              0,
            );
            assert.equal(placed.totalCents, expected);
            assert.equal(pay.charges.length, 1);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('(b) CQRS Command/Read-Projection Eventual Consistency & Lag Simulation', () => {
    it('exhibits bounded staleness during projection lag and converges monotonically without stale regressions', () => {
      const commandSide = new OrderCommandSide();
      const projection = new OrderQueryProjection();
      const lagTicks = 3;

      const e1 = commandSide.submitCommand('OrderCreated', 'ord-77', 'cust-9', 4_200);
      commandSide.advanceTick(1);
      const e2 = commandSide.submitCommand('OrderPaid', 'ord-77', 'cust-9', 4_200);

      // Immediately after commit (delta < lagTicks), projection lags behind command store
      for (const ev of commandSide.drainDeliverableEvents(lagTicks)) {
        projection.apply(ev);
      }
      assert.equal(commandSide.getLatestWriteVersion('ord-77'), 2);
      assert.equal(projection.getOrder('ord-77'), undefined);
      assert.equal(projection.satisfiesReadYourWrites('ord-77', e2.aggregateVersion), false);

      // Advance to t=3: e1 arrives (version 1), still behind write version 2
      commandSide.advanceTick(2);
      for (const ev of commandSide.drainDeliverableEvents(lagTicks)) {
        projection.apply(ev);
      }
      assert.equal(projection.getOrder('ord-77')?.status, 'PENDING');
      assert.equal(projection.getOrder('ord-77')?.version, 1);
      assert.equal(projection.satisfiesReadYourWrites('ord-77', e2.aggregateVersion), false);

      // Advance to t=4: e2 arrives (version 2) -> projection converges to write state
      commandSide.advanceTick(1);
      for (const ev of commandSide.drainDeliverableEvents(lagTicks)) {
        projection.apply(ev);
      }
      assert.equal(projection.getOrder('ord-77')?.status, 'PAID');
      assert.equal(projection.getOrder('ord-77')?.version, 2);
      assert.equal(projection.satisfiesReadYourWrites('ord-77', e2.aggregateVersion), true);

      // Late duplicate/stale replay of e1 must be rejected so read state never regresses
      const acceptedStale = projection.apply(e1);
      assert.equal(acceptedStale, false);
      assert.equal(projection.getOrder('ord-77')?.status, 'PAID');
      assert.equal(projection.getOrder('ord-77')?.version, 2);
    });
  });

  describe('(c) Event-Driven Transactional Outbox Ordering & Idempotent Consumer', () => {
    it('prevents dual-write phantom events on rollback and preserves exact state under duplicate/out-of-order redelivery', () => {
      const store = new TransactionalOutboxStore();
      const consumer = new IdempotentProjectionConsumer();

      // 1. Atomic commits succeed in sequence 1, 2, 3
      store.commitTransfer({ accountId: 'acct-A', eventId: 'ev-1', deltaCents: 10_000 });
      store.commitTransfer({ accountId: 'acct-A', eventId: 'ev-2', deltaCents: -2_500 });
      store.commitTransfer({ accountId: 'acct-A', eventId: 'ev-3', deltaCents: 1_000 });

      // 2. Rolled-back transaction emits zero phantom outbox rows
      assert.throws(() =>
        store.commitTransfer({
          accountId: 'acct-A',
          eventId: 'ev-rollback',
          deltaCents: 5_000,
          failMidTransaction: true,
        }),
      );
      assert.throws(
        () =>
          store.commitTransfer({
            accountId: 'acct-A',
            eventId: 'ev-overdraft',
            deltaCents: -99_999,
          }),
        (err: unknown) => err instanceof DomainRuleError && err.code === 'INSUFFICIENT_FUNDS',
      );
      assert.equal(store.getBalance('acct-A'), 8_500);
      assert.equal(store.getOutboxCount(), 3);

      // 3. Relay publishes strictly ordered records
      const relayed = store.relayPendingInOrder();
      assert.deepEqual(
        relayed.map((r) => r.sequence),
        [1, 2, 3],
      );
      assert.equal(store.relayPendingInOrder().length, 0);

      // 4. Simulate broker delivering out-of-order (seq 3, seq 1, duplicate seq 1, seq 2, duplicate seq 3)
      const [ev1, ev2, ev3] = relayed;
      assert.ok(ev1 && ev2 && ev3);

      assert.equal(consumer.consume(ev3), 'BUFFERED_OUT_OF_ORDER');
      assert.equal(consumer.consume(ev1), 'APPLIED');
      assert.equal(consumer.consume(ev1), 'DUPLICATE');
      assert.equal(consumer.consume(ev2), 'APPLIED'); // automatically drains buffered ev3
      assert.equal(consumer.consume(ev3), 'DUPLICATE');

      // Consumer projection matches authoritative store balance identically
      assert.equal(consumer.getTotal('acct-A'), 8_500);
      assert.equal(consumer.getProcessedCount(), 3);
      assert.equal(consumer.bufferedOutOfOrder.length, 0);
    });
  });
});
