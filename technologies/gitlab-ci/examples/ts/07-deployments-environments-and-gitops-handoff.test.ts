// Module 07: Continuous Deployment Mechanics: Environments, Resource Groups, Review Apps, and GitOps Handoff
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  evaluateResourceGroup,
  detectConcurrentDeployRaceWithoutResourceGroup,
  computeEnvironmentRollback,
  createGitOpsHandoffCommit,
  type DeploymentJob,
} from './lib/gitlab-ci-model.ts';

test('Gotcha 11: concurrent deployments racing without resource_group creates deploy ordering race', () => {
  const concurrentRunningJobs: DeploymentJob[] = [
    {
      id: 201,
      pipelineId: 10,
      commitSha: 'sha-older-commit',
      environment: 'production',
      createdAt: 1000,
      status: 'running',
    },
    {
      id: 202,
      pipelineId: 11,
      commitSha: 'sha-newer-commit',
      environment: 'production',
      createdAt: 2000,
      status: 'running',
    },
  ];

  const raceAudit = detectConcurrentDeployRaceWithoutResourceGroup(concurrentRunningJobs);
  assert.equal(raceAudit.raceDetected, true);
  assert.ok(raceAudit.warning?.includes('CRITICAL: Concurrent deployments'));
});

test('resource_group serializes deployments: running job forces queued jobs to wait', () => {
  const activeJob: DeploymentJob = {
    id: 100,
    pipelineId: 50,
    commitSha: 'sha-active',
    environment: 'production',
    createdAt: 1000,
    status: 'running',
  };

  const queue: DeploymentJob[] = [
    {
      id: 101,
      pipelineId: 51,
      commitSha: 'sha-queued-1',
      environment: 'production',
      createdAt: 1500,
      status: 'waiting',
    },
  ];

  const result = evaluateResourceGroup('oldest_first', queue, activeJob);
  assert.equal(result.nextToRun, null, 'Queued job must wait until active deployment finishes');
});

test('resource_group mode newest_first selects newest commit, superseding older queued deploys', () => {
  const queue: DeploymentJob[] = [
    {
      id: 301,
      pipelineId: 101,
      commitSha: 'commit-older',
      environment: 'production',
      createdAt: 1000,
      status: 'waiting',
    },
    {
      id: 302,
      pipelineId: 102,
      commitSha: 'commit-newest',
      environment: 'production',
      createdAt: 2000,
      status: 'waiting',
    },
  ];

  const result = evaluateResourceGroup('newest_first', queue, null);
  assert.equal(result.nextToRun?.id, 302);
  assert.equal(result.nextToRun?.commitSha, 'commit-newest');
});

test('Environment rollback accurately targets previous verified deployment digest', () => {
  const deployHistory = [
    {
      id: 503,
      environment: 'production',
      status: 'failed' as const, // Latest deployment failed
      imageDigest: 'sha256:broken-digest-999',
      deployedAt: 3000,
    },
    {
      id: 502,
      environment: 'production',
      status: 'success' as const, // Current working production deployment
      imageDigest: 'sha256:current-live-digest-222',
      deployedAt: 2000,
    },
    {
      id: 501,
      environment: 'production',
      status: 'success' as const, // Previous stable deployment (rollback target)
      imageDigest: 'sha256:rollback-target-digest-111',
      deployedAt: 1000,
    },
  ];

  const rollback = computeEnvironmentRollback(deployHistory);
  assert.equal(rollback.canRollback, true);
  assert.equal(rollback.targetDigest, 'sha256:rollback-target-digest-111');
  assert.equal(rollback.targetDeploymentId, 501);
});

test('GitOps handoff creates immutable digest commit and rejects mutable tags', () => {
  const manifest = {
    repo: 'gitlab.com/org/gitops-manifests',
    app: 'payments-api',
    environment: 'production',
  };

  const validCommit = createGitOpsHandoffCommit(
    manifest,
    'sha256:4d708fb562a1a8c9b2e88a381a17e08b29f0450bb4ddfefc5861448ebf5223c7',
    'sha256:old-digest-000',
  );

  assert.equal(validCommit.repo, 'gitlab.com/org/gitops-manifests');
  assert.ok(validCommit.targetFile.includes('environments/production/apps/payments-api'));
  assert.ok(validCommit.commitMessage.includes('chore(gitops): promote payments-api'));

  // Negative test: rejects mutable tag
  assert.throws(
    () => createGitOpsHandoffCommit(manifest, 'v1.4.2-latest', 'sha256:old'),
    /requires an immutable sha256 digest/,
  );
});

test('property test: newest_first always picks the job with maximal createdAt epoch', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          createdAt: fc.integer({ min: 1000, max: 50000 }),
        }),
        { minLength: 1, maxLength: 10 },
      ),
      (items) => {
        const queue: DeploymentJob[] = items.map((it) => ({
          id: it.id,
          pipelineId: 1,
          commitSha: 'sha',
          environment: 'production',
          createdAt: it.createdAt,
          status: 'waiting',
        }));

        const res = evaluateResourceGroup('newest_first', queue, null);
        const maxCreated = Math.max(...items.map((i) => i.createdAt));
        assert.equal(res.nextToRun?.createdAt, maxCreated);
      },
    ),
    { numRuns: 30 },
  );
});
