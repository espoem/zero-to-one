// Module 01: CI/CD Fundamentals, Trunk-Based Development, Pipeline-as-Code, and DORA Metrics
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { calculateDORAMetrics, type DeploymentRecord } from './lib/gitlab-ci-model.ts';

test('DORA metrics: Elite tier engineering team achieves high frequency, short lead time, low CFR, and rapid recovery', () => {
  const now = Date.now();
  const deployments: DeploymentRecord[] = [];

  // Generate 60 deployments over 30 days (2 deploys/day)
  for (let i = 0; i < 60; i++) {
    const deployedAt = now - i * 12 * 3600 * 1000;
    const commitTimestamp = deployedAt - 2 * 3600 * 1000; // 2 hour lead time
    // 2 failed deployments out of 60 (3.3% CFR)
    const isFailure = i === 10 || i === 25;
    deployments.push({
      id: `deploy-${i}`,
      commitSha: `sha-${i}`,
      commitTimestamp,
      deployedAt,
      environment: 'production',
      status: isFailure ? 'failure' : 'success',
      failureResolvedAt: isFailure ? deployedAt + 30 * 60 * 1000 : undefined, // 30 min recovery
    });
  }

  const metrics = calculateDORAMetrics(deployments, 30);

  assert.equal(metrics.deploymentFrequency.rating, 'Elite');
  assert.equal(metrics.leadTimeForChanges.rating, 'Elite');
  assert.equal(metrics.changeFailureRate.rating, 'Elite');
  assert.equal(metrics.failedDeploymentRecoveryTime.rating, 'Elite');
  assert.equal(metrics.overallTier, 'Elite');

  assert.ok(metrics.deploymentFrequency.value >= 1.0);
  assert.ok(metrics.leadTimeForChanges.value <= 24.0);
  assert.ok(metrics.changeFailureRate.value <= 15.0);
  assert.ok(metrics.failedDeploymentRecoveryTime.value <= 1.0);
});

test('DORA metrics: Low tier team exhibits batch deployments, multi-week lead times, and high failure rates', () => {
  const now = Date.now();
  const deployments: DeploymentRecord[] = [];

  // 1 deployment every 60 days, 6 weeks lead time, 50% failure rate over 90 days
  for (let i = 0; i < 2; i++) {
    const deployedAt = now - i * 60 * 24 * 3600 * 1000;
    const commitTimestamp = deployedAt - 42 * 24 * 3600 * 1000; // 6 weeks lead time (> 720h)
    const isFailure = i === 0;
    deployments.push({
      id: `deploy-${i}`,
      commitSha: `sha-${i}`,
      commitTimestamp,
      deployedAt,
      environment: 'production',
      status: isFailure ? 'failure' : 'success',
      failureResolvedAt: isFailure ? deployedAt + 10 * 24 * 3600 * 1000 : undefined, // 10 days recovery
    });
  }

  const metrics = calculateDORAMetrics(deployments, 90);

  assert.equal(metrics.deploymentFrequency.rating, 'Low');
  assert.equal(metrics.leadTimeForChanges.rating, 'Low');
  assert.equal(metrics.overallTier, 'Low');
  assert.ok(metrics.changeFailureRate.value >= 45.0);
});

test('Trunk-based development branch lifecycle invariant: branches merge into trunk within 24 hours', () => {
  const trunkBranchRule = {
    maxBranchLifespanHours: 24,
    prohibitLongLivedReleaseBranches: true,
    requireLinearHistoryOrFastForward: true,
  };

  const sampleFeatureBranches = [
    { name: 'feat/auth-token-refresh', lifespanHours: 6, mergedToTrunk: true },
    { name: 'fix/nil-pointer-deref', lifespanHours: 2, mergedToTrunk: true },
    { name: 'feat/dora-calculator', lifespanHours: 14, mergedToTrunk: true },
  ];

  for (const b of sampleFeatureBranches) {
    assert.ok(
      b.lifespanHours <= trunkBranchRule.maxBranchLifespanHours,
      `Branch ${b.name} exceeded 24h trunk-based limit`,
    );
    assert.equal(b.mergedToTrunk, true);
  }
});

test('property test: Lead Time for Changes is strictly non-negative and monotonic with commit duration', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 1000 }), // hours
      (leadHours) => {
        const now = Date.now();
        const commitTimestamp = now - leadHours * 3600 * 1000;
        const deploy: DeploymentRecord = {
          id: 'dep-1',
          commitSha: 'sha-abc',
          commitTimestamp,
          deployedAt: now,
          environment: 'production',
          status: 'success',
        };

        const metrics = calculateDORAMetrics([deploy], 30);
        assert.ok(metrics.leadTimeForChanges.value >= 0);
        assert.ok(Math.abs(metrics.leadTimeForChanges.value - leadHours) < 0.1);
      },
    ),
    { numRuns: 50 },
  );
});

test('negative test: unmitigated production failures without resolution timestamp flag visibility gap', () => {
  const now = Date.now();
  const deployments: DeploymentRecord[] = [
    {
      id: 'dep-unresolved',
      commitSha: 'sha-broken',
      commitTimestamp: now - 3600 * 1000,
      deployedAt: now,
      environment: 'production',
      status: 'failure',
      // failureResolvedAt omitted
    },
  ];

  const metrics = calculateDORAMetrics(deployments, 30);
  assert.equal(metrics.changeFailureRate.value, 100);
  assert.equal(metrics.failedDeploymentRecoveryTime.value, 0); // Cannot compute elapsed resolution
});
