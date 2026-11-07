// Module 09: Pipeline Performance, Monorepo Change Detection, Cost Economics, and Debugging Hazards
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  optimizeMonorepoDAG,
  evaluatePipelineInterruptibility,
  calculateCacheEfficiency,
  type MonorepoPackage,
} from './lib/gitlab-ci-model.ts';

test('Monorepo DAG optimizer detects transitive impact across package dependencies and skips untouched subtrees', () => {
  const packages: MonorepoPackage[] = [
    { name: 'core-utils', path: 'packages/core', dependencies: [] },
    { name: 'auth-service', path: 'services/auth', dependencies: ['core-utils'] },
    { name: 'billing-service', path: 'services/billing', dependencies: ['core-utils'] },
    { name: 'web-frontend', path: 'apps/web', dependencies: ['auth-service'] },
    { name: 'docs-site', path: 'apps/docs', dependencies: [] },
  ];

  // Changes only inside packages/core/src/hash.ts
  const changedFiles = ['packages/core/src/hash.ts'];
  const optimized = optimizeMonorepoDAG(packages, changedFiles);

  // Directly changed: core-utils
  // Transitive dependents: auth-service, billing-service, web-frontend
  // Untouched: docs-site
  assert.equal(optimized.affectedPackages.includes('core-utils'), true);
  assert.equal(optimized.affectedPackages.includes('auth-service'), true);
  assert.equal(optimized.affectedPackages.includes('billing-service'), true);
  assert.equal(optimized.affectedPackages.includes('web-frontend'), true);
  assert.deepEqual(optimized.skippedPackages, ['docs-site']);

  // Verify minimal DAG edge generation
  assert.ok(optimized.dagEdges.some((e) => e.from === 'core-utils' && e.to === 'auth-service'));
  assert.ok(optimized.dagEdges.some((e) => e.from === 'auth-service' && e.to === 'web-frontend'));
});

test('Gotcha 10: non-interruptible jobs continue running on superseded commits, wasting runner resources', () => {
  const activePipelineJobs = [
    { id: 1, name: 'lint', interruptible: true, durationSec: 120 },
    { id: 2, name: 'unit-test', interruptible: true, durationSec: 300 },
    { id: 3, name: 'e2e-browser-test', interruptible: false, durationSec: 600 }, // Non-interruptible!
  ];

  // A new commit arrives while pipeline is running
  const result = evaluatePipelineInterruptibility(activePipelineJobs, true);

  // Interruptible jobs (lint, unit-test) cancelled immediately, saving 420 seconds of runner time
  assert.deepEqual(result.cancelledJobs, [1, 2]);
  assert.deepEqual(result.continuedJobs, [3]); // E2E wasted runner compute
  assert.equal(result.savedRunnerSeconds, 420);
});

test('Distributed cache economics: evaluates network transfer vs compilation speedup', () => {
  // Case A: High hit ratio, large compilation time saved
  const highValueCache = calculateCacheEfficiency(
    80, // hitCount
    20, // missCount
    30, // uploadDurationSec
    10, // downloadDurationSec
    120, // buildTimeWithoutCacheSec
    20, // buildTimeWithCacheSec
  );

  assert.equal(highValueCache.hitRatio, 0.8);
  assert.ok(highValueCache.netTimeSavedSec > 0);
  assert.equal(highValueCache.recommendCache, true);

  // Case B: Poor hit ratio with slow upload overhead
  const poorValueCache = calculateCacheEfficiency(
    10, // hitCount
    90, // missCount
    60, // uploadDurationSec
    40, // downloadDurationSec
    50, // buildTimeWithoutCacheSec
    30, // buildTimeWithCacheSec
  );

  assert.equal(poorValueCache.hitRatio, 0.1);
  assert.ok(poorValueCache.netTimeSavedSec < 0);
  assert.equal(poorValueCache.recommendCache, false);
});

test('property test: saved runner seconds is strictly non-negative and bounded by total duration of interruptible jobs', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 1000 }),
          durationSec: fc.integer({ min: 10, max: 600 }),
          interruptible: fc.boolean(),
        }),
        { minLength: 1, maxLength: 10 },
      ),
      (jobs) => {
        const fullJobs = jobs.map((j) => ({ ...j, name: `job-${j.id}` }));
        const res = evaluatePipelineInterruptibility(fullJobs, true);

        const expectedSaved = fullJobs
          .filter((j) => j.interruptible)
          .reduce((sum, j) => sum + j.durationSec, 0);

        assert.equal(res.savedRunnerSeconds, expectedSaved);
        assert.ok(res.savedRunnerSeconds >= 0);
      },
    ),
    { numRuns: 30 },
  );
});

test('negative test: isolated changes in independent leaf node do not trigger sibling subtrees', () => {
  const packages: MonorepoPackage[] = [
    { name: 'service-a', path: 'services/a', dependencies: [] },
    { name: 'service-b', path: 'services/b', dependencies: [] },
  ];

  const res = optimizeMonorepoDAG(packages, ['services/a/handler.ts']);
  assert.deepEqual(res.affectedPackages, ['service-a']);
  assert.deepEqual(res.skippedPackages, ['service-b']);
  assert.equal(res.dagEdges.length, 0);
});
