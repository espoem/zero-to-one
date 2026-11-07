// Module 05: Automated Testing and Quality Gates: Matrix Parallelism, JUnit Reports, Flaky Test Quarantine, and Merge Trains
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  expandParallelMatrix,
  evaluateFlakyTestQuarantine,
  simulateMergeTrainCascade,
  type MergeTrainCar,
} from './lib/gitlab-ci-model.ts';

test('parallel: matrix expands multi-dimensional axes into full Cartesian product of job configurations', () => {
  const matrix = {
    NODE_VERSION: [20, 22, 26],
    OS: ['ubuntu-24.04', 'rocky-linux-9'],
  };

  const expanded = expandParallelMatrix(matrix);
  assert.equal(expanded.length, 6);

  const hasNode26Ubuntu = expanded.some(
    (e) => e['NODE_VERSION'] === 26 && e['OS'] === 'ubuntu-24.04',
  );
  assert.equal(hasNode26Ubuntu, true);
});

test('Flaky test quarantine automatically isolates tests with high flip rates to protect trunk merge velocity', () => {
  const testResults = [
    {
      testName: 'testAuthTokenRefresh',
      totalRuns: 50,
      failures: 15,
      retriedSuccesses: 15, // 30% flake rate -> quarantine!
    },
    {
      testName: 'testDatabaseMigration',
      totalRuns: 50,
      failures: 0,
      retriedSuccesses: 0, // 0% -> healthy
    },
    {
      testName: 'testPaymentWebhook',
      totalRuns: 50,
      failures: 2,
      retriedSuccesses: 2, // 4% flake rate -> below 20% threshold
    },
  ];

  const evalResult = evaluateFlakyTestQuarantine(testResults, 0.2);
  assert.deepEqual(evalResult.quarantined, ['testAuthTokenRefresh']);
  assert.deepEqual(evalResult.healthy, ['testDatabaseMigration', 'testPaymentWebhook']);
  assert.equal(evalResult.passTrunk, false); // Quarantined test triggers alert
});

test('Merge Train speculative cascade: failure in train car #2 drops car and automatically rebases downstream cars', () => {
  const initialTrain: MergeTrainCar[] = [
    {
      mrId: 101,
      targetBranch: 'main',
      sourceBranch: 'feat/cart-calc',
      commitSha: 'sha-101',
      status: 'running',
    },
    {
      mrId: 102, // Fails CI during train run!
      targetBranch: 'main',
      sourceBranch: 'fix/broken-regex',
      commitSha: 'sha-102',
      status: 'running',
    },
    {
      mrId: 103, // Speculatively layered on 101 + 102
      targetBranch: 'main',
      sourceBranch: 'feat/checkout-ui',
      commitSha: 'sha-103',
      status: 'running',
    },
    {
      mrId: 104, // Speculatively layered on 101 + 102 + 103
      targetBranch: 'main',
      sourceBranch: 'refactor/auth-tokens',
      commitSha: 'sha-104',
      status: 'running',
    },
  ];

  // Car index 1 (MR 102) fails
  const cascade = simulateMergeTrainCascade(initialTrain, 1);

  assert.equal(cascade.ejectedCar.mrId, 102);
  assert.equal(cascade.ejectedCar.status, 'failed');

  // Surviving cars are MR 101, MR 103, MR 104
  assert.equal(cascade.survivingCars.length, 3);
  assert.equal(cascade.survivingCars[0]?.mrId, 101);

  // Downstream cars MR 103 and 104 must be rebased against MR 101 and re-run
  assert.deepEqual(
    cascade.rebasedCars.map((c) => c.mrId),
    [103, 104],
  );
  assert.ok(cascade.rebasedCars.every((c) => c.status === 'running'));
});

test('property test: matrix expansion Cartesian size equals product of dimension lengths', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 1, max: 4 }),
      (lenA, lenB, lenC) => {
        const matrix = {
          DIM_A: Array.from({ length: lenA }, (_, i) => `a_${i}`),
          DIM_B: Array.from({ length: lenB }, (_, i) => `b_${i}`),
          DIM_C: Array.from({ length: lenC }, (_, i) => `c_${i}`),
        };

        const result = expandParallelMatrix(matrix);
        assert.equal(result.length, lenA * lenB * lenC);
      },
    ),
    { numRuns: 20 },
  );
});

test('negative test: invalid failure index in merge train throws an error', () => {
  const train: MergeTrainCar[] = [
    {
      mrId: 1,
      targetBranch: 'main',
      sourceBranch: 'feat/1',
      commitSha: 'sha1',
      status: 'running',
    },
  ];

  assert.throws(() => simulateMergeTrainCascade(train, 5), /Invalid failure index/);
});
