import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SagaCoordinator, type SagaStep } from './lib/cloud-models.ts';

describe('Module 10: Serverless Workflows, Sagas & Retry Storms', () => {
  it('executes compensating transactions in reverse order when a step fails', async () => {
    const coordinator = new SagaCoordinator();
    const compensationLog: string[] = [];

    const steps: SagaStep[] = [
      {
        name: 'ReserveInventory',
        execute: async () => true,
        compensate: async () => {
          compensationLog.push('ReleaseInventory');
        },
      },
      {
        name: 'AuthorizePayment',
        execute: async () => true,
        compensate: async () => {
          compensationLog.push('RefundPayment');
        },
      },
      {
        name: 'DispatchOrder',
        execute: async () => false, // Failure here!
        compensate: async () => {
          compensationLog.push('CancelDispatch');
        },
      },
    ];

    const result = await coordinator.run(steps);
    assert.strictEqual(result.success, false);
    assert.equal(result.failedAt, 'DispatchOrder');

    // Compensations run in reverse order of successfully executed steps: AuthorizePayment -> ReserveInventory
    assert.deepEqual(compensationLog, ['RefundPayment', 'ReleaseInventory']);
  });

  it('calculates exponential backoff bounds to prevent retry storms', () => {
    const baseMs = 100;
    const maxMs = 5000;

    const noJitterAttempt0 = SagaCoordinator.calculateExponentialBackoff(0, baseMs, maxMs, false);
    const noJitterAttempt1 = SagaCoordinator.calculateExponentialBackoff(1, baseMs, maxMs, false);
    const noJitterAttempt2 = SagaCoordinator.calculateExponentialBackoff(2, baseMs, maxMs, false);
    const noJitterAttempt6 = SagaCoordinator.calculateExponentialBackoff(6, baseMs, maxMs, false);

    assert.equal(noJitterAttempt0, 100);
    assert.equal(noJitterAttempt1, 200);
    assert.equal(noJitterAttempt2, 400);
    assert.equal(noJitterAttempt6, 5000); // Capped at maxMs

    const withJitter = SagaCoordinator.calculateExponentialBackoff(3, baseMs, maxMs, true);
    assert.ok(withJitter >= 0 && withJitter <= 800);
  });
});
