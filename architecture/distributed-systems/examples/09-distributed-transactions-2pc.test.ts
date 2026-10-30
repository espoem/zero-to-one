import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Participant in Two-Phase Commit.
 */
export type ParticipantState = 'INIT' | 'PREPARED' | 'COMMITTED' | 'ABORTED';

export class TwoPhaseParticipant {
  state: ParticipantState = 'INIT';
  heldLock: string | null = null;

  prepare(resource: string, canCommit = true): boolean {
    if (!canCommit) {
      this.state = 'ABORTED';
      return false;
    }
    this.heldLock = resource;
    this.state = 'PREPARED';
    return true;
  }

  commit(): void {
    if (this.state !== 'PREPARED') throw new Error('Cannot commit un-prepared participant');
    this.state = 'COMMITTED';
    this.heldLock = null; // Release lock
  }

  abort(): void {
    this.state = 'ABORTED';
    this.heldLock = null; // Release lock
  }
}

/**
 * Saga Orchestrator for distributed workflows.
 */
export interface SagaStep<T> {
  name: string;
  forward: (state: T) => boolean;
  compensate: (state: T) => void;
}

export class SagaOrchestrator<T> {
  private readonly executedSteps: SagaStep<T>[] = [];

  execute(state: T, steps: SagaStep<T>[]): { success: boolean; rolledBack: boolean } {
    for (const step of steps) {
      const ok = step.forward(state);
      if (ok) {
        this.executedSteps.push(step);
      } else {
        // Step failed: Execute backward compensating transactions in reverse order!
        while (this.executedSteps.length > 0) {
          const compStep = this.executedSteps.pop()!;
          compStep.compensate(state);
        }
        return { success: false, rolledBack: true };
      }
    }
    return { success: true, rolledBack: false };
  }
}

test('Module 09: Distributed Transactions, 2PC & Sagas', async (t) => {
  await t.test('2PC successfully commits across participants when all vote YES', () => {
    const p1 = new TwoPhaseParticipant();
    const p2 = new TwoPhaseParticipant();

    // Phase 1: Prepare
    const v1 = p1.prepare('account_A', true);
    const v2 = p2.prepare('account_B', true);
    assert.equal(v1 && v2, true);
    assert.equal(p1.state, 'PREPARED');
    assert.equal(p2.state, 'PREPARED');

    // Phase 2: Global Commit
    p1.commit();
    p2.commit();
    assert.equal(p1.state, 'COMMITTED');
    assert.equal(p2.state, 'COMMITTED');
    assert.equal(p1.heldLock, null);
    assert.equal(p2.heldLock, null);
  });

  await t.test('2PC blocks participants with locks held if coordinator crashes during PREPARED', () => {
    const p1 = new TwoPhaseParticipant();
    const p2 = new TwoPhaseParticipant();

    p1.prepare('row_100', true);
    p2.prepare('row_200', true);

    // Coordinator crashes before broadcasting Phase 2 decision!
    // Invariants: Both participants remain locked in PREPARED state indefinitely
    assert.equal(p1.state, 'PREPARED');
    assert.equal(p2.state, 'PREPARED');
    assert.equal(p1.heldLock, 'row_100');
    assert.equal(p2.heldLock, 'row_200');
    // They cannot unilaterally release locks without coordinator resolution
  });

  await t.test('Saga Orchestrator rolls back already committed steps when later step fails', () => {
    const context = {
      orderCreated: false,
      paymentCharged: 0,
      inventoryReserved: false,
    };

    const steps: SagaStep<typeof context>[] = [
      {
        name: 'CreateOrder',
        forward: (ctx) => {
          ctx.orderCreated = true;
          return true;
        },
        compensate: (ctx) => {
          ctx.orderCreated = false;
        },
      },
      {
        name: 'ChargePayment',
        forward: (ctx) => {
          ctx.paymentCharged = 100;
          return true;
        },
        compensate: (ctx) => {
          ctx.paymentCharged = 0; // Refund
        },
      },
      {
        name: 'ReserveInventory',
        forward: (_ctx) => {
          // Out of stock failure!
          return false;
        },
        compensate: (ctx) => {
          ctx.inventoryReserved = false;
        },
      },
    ];

    const saga = new SagaOrchestrator<typeof context>();
    const res = saga.execute(context, steps);

    assert.equal(res.success, false);
    assert.equal(res.rolledBack, true);
    // Compensations executed: Order cancelled, payment refunded
    assert.equal(context.orderCreated, false);
    assert.equal(context.paymentCharged, 0);
  });
});
