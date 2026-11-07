// Module 02: GitLab CI Execution Model: Stages vs Needs DAG, Workflow Rules, Variables, and Artifacts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  validateJobSyntax,
  evaluateDuplicatePipelineRisk,
  evaluateRulesChanges,
  resolveArtifactPropagation,
  validateCacheKey,
  validateArtifactConfig,
  resolveVariablePrecedence,
  buildPipelineDAG,
  type JobDefinition,
  type VariableScopeContext,
} from './lib/gitlab-ci-model.ts';

test('Gotcha 8: mixing legacy only/except keywords with modern rules throws parser error', () => {
  const invalidJob: JobDefinition = {
    name: 'test:unit',
    stage: 'test',
    rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'on_success' }],
    only: ['master'], // Invalid combination
  };

  const check = validateJobSyntax(invalidJob);
  assert.equal(check.valid, false);
  assert.ok(check.errors[0]?.includes("mixes legacy 'only'/'except' keywords with modern 'rules'"));

  const validJob: JobDefinition = {
    name: 'test:unit-valid',
    stage: 'test',
    rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'on_success' }],
  };
  assert.equal(validateJobSyntax(validJob).valid, true);
});

test('Gotcha 2: branch push with open MR creates duplicate pipelines without workflow:rules', () => {
  const context = {
    pipelineSource: 'push' as const,
    branch: 'feat/checkout-flow',
    openMergeRequests: true,
  };

  // Without workflow:rules: two pipelines created (branch + MR)
  const legacyEval = evaluateDuplicatePipelineRisk(context, false);
  assert.equal(legacyEval.duplicateDetected, true);
  assert.deepEqual(legacyEval.createdPipelines, ['branch', 'merge_request']);

  // With workflow:rules: only MR pipeline created, suppressing duplicate branch pipeline
  const safeEval = evaluateDuplicatePipelineRisk(context, true);
  assert.equal(safeEval.duplicateDetected, false);
  assert.deepEqual(safeEval.createdPipelines, []); // branch push skipped when MR is open
});

test('Gotcha 1: rules:changes without compare_to traps scheduled and tag pipelines to always run', () => {
  const changeCondition = {
    changes: { paths: ['services/payment/**'] },
  };

  // On scheduled pipeline without compare_to: evaluates true even if no files changed
  const scheduledCtx = {
    pipelineSource: 'schedule' as const,
    changedFiles: [], // No files changed
  };
  assert.equal(evaluateRulesChanges(changeCondition, scheduledCtx), true);

  // On tag pipeline without compare_to: evaluates true
  const tagCtx = {
    pipelineSource: 'tag' as const,
    tag: 'v1.4.0',
    changedFiles: [],
  };
  assert.equal(evaluateRulesChanges(changeCondition, tagCtx), true);

  // Normal push: properly evaluates file changes
  const normalPushCtx = {
    pipelineSource: 'push' as const,
    changedFiles: ['docs/readme.md'],
  };
  assert.equal(evaluateRulesChanges(changeCondition, normalPushCtx), false);
});

test('Gotcha 9: cross-stage needs skips implicit artifact downloads from earlier stages', () => {
  const pipelineJobs: Record<string, JobDefinition> = {
    'build:binary': {
      name: 'build:binary',
      stage: 'build',
      artifacts: { paths: ['bin/app'], expireIn: '1 day' },
    },
    'build:assets': {
      name: 'build:assets',
      stage: 'build',
      artifacts: { paths: ['public/assets'], expireIn: '1 day' },
    },
    'test:classic': {
      name: 'test:classic',
      stage: 'test',
      // No needs specified: classic stage execution implicitly downloads ALL build stage artifacts
    },
    'test:isolated': {
      name: 'test:isolated',
      stage: 'test',
      needs: [{ job: 'build:binary' }], // Needs DAG: only downloads build:binary, skips build:assets!
    },
  };

  const classicArtifacts = resolveArtifactPropagation(pipelineJobs, 'test:classic');
  assert.deepEqual(classicArtifacts.downloadedFrom, ['build:binary', 'build:assets']);
  assert.deepEqual(classicArtifacts.skippedEarlierStageJobs, []);

  const isolatedArtifacts = resolveArtifactPropagation(pipelineJobs, 'test:isolated');
  assert.deepEqual(isolatedArtifacts.downloadedFrom, ['build:binary']);
  assert.deepEqual(isolatedArtifacts.skippedEarlierStageJobs, ['build:assets']);
});

test('Gotcha 6: unkeyed or global cache key risks cross-branch dependency poisoning', () => {
  const unkeyedCache = {};
  const unkeyedCheck = validateCacheKey(unkeyedCache);
  assert.equal(unkeyedCheck.safe, false);
  assert.equal(unkeyedCheck.riskLevel, 'HIGH');

  const globalCache = { key: 'global' };
  const globalCheck = validateCacheKey(globalCache);
  assert.equal(globalCheck.safe, false);

  const safeBranchCache = {
    key: { files: ['package-lock.json'], prefix: 'deps-linux' },
  };
  assert.equal(validateCacheKey(safeBranchCache).safe, true);
});

test('Gotcha 7: missing artifacts:expire_in risks storage volume exhaustion', () => {
  const missingExpire = { paths: ['dist/'] };
  const check = validateArtifactConfig(missingExpire);
  assert.equal(check.safe, false);
  assert.ok(check.warning?.includes('kept indefinitely'));

  const safeExpire = { paths: ['dist/'], expireIn: '3 days' };
  assert.equal(validateArtifactConfig(safeExpire).safe, true);
});

test('Variable precedence: 14-level hierarchy prioritizes trigger and pipeline variables over root/predefined', () => {
  const ctx: VariableScopeContext = {
    triggerVariables: { API_KEY: 'trigger-override-val' },
    projectVariables: { API_KEY: 'project-secret-val', DB_NAME: 'prod_db' },
    rootVariables: { DB_NAME: 'root_default_db', LOG_LEVEL: 'info' },
    predefinedVariables: { LOG_LEVEL: 'debug', CI_COMMIT_SHA: 'abc1234' },
  };

  const resolvedApiKey = resolveVariablePrecedence('API_KEY', ctx);
  assert.equal(resolvedApiKey.value, 'trigger-override-val');
  assert.equal(resolvedApiKey.level, 1);

  const resolvedDb = resolveVariablePrecedence('DB_NAME', ctx);
  assert.equal(resolvedDb.value, 'prod_db');
  assert.equal(resolvedDb.level, 5); // Project CI variable overrides root .gitlab-ci.yml

  const resolvedLogLevel = resolveVariablePrecedence('LOG_LEVEL', ctx);
  assert.equal(resolvedLogLevel.value, 'info');
  assert.equal(resolvedLogLevel.level, 11); // Root .gitlab-ci.yml overrides predefined
});

test('DAG topological sorting and cycle detection with Kahn algorithm', () => {
  const dagJobs: Record<string, JobDefinition> = {
    compile: { name: 'compile' },
    unit_test: { name: 'unit_test', needs: ['compile'] },
    lint: { name: 'lint', needs: ['compile'] },
    package: { name: 'package', needs: ['unit_test', 'lint'] },
  };

  const dag = buildPipelineDAG(dagJobs);
  assert.equal(dag.hasCycle, false);
  assert.equal(dag.executionOrder[0], 'compile');
  assert.equal(dag.executionOrder[3], 'package');

  // Cyclic DAG
  const cyclicJobs: Record<string, JobDefinition> = {
    jobA: { name: 'jobA', needs: ['jobB'] },
    jobB: { name: 'jobB', needs: ['jobA'] },
  };
  const cyclicResult = buildPipelineDAG(cyclicJobs);
  assert.equal(cyclicResult.hasCycle, true);
  assert.deepEqual(cyclicResult.cycleNodes.sort(), ['jobA', 'jobB']);
});

test('property test: acyclic linear chains always produce exact sequential topological execution order', () => {
  fc.assert(
    fc.property(fc.integer({ min: 2, max: 10 }), (chainLength) => {
      const jobs: Record<string, JobDefinition> = {};
      for (let i = 0; i < chainLength; i++) {
        const name = `job_${i}`;
        jobs[name] = {
          name,
          needs: i > 0 ? [`job_${i - 1}`] : undefined,
        };
      }

      const res = buildPipelineDAG(jobs);
      assert.equal(res.hasCycle, false);
      assert.equal(res.executionOrder.length, chainLength);
      for (let i = 0; i < chainLength; i++) {
        assert.equal(res.executionOrder[i], `job_${i}`);
      }
    }),
    { numRuns: 30 },
  );
});
