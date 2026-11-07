// Module 03: Pipeline Reuse and Composition: CI/CD Components, Spec Inputs, Extends, and Child Pipelines
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  validateComponentInputs,
  resolveReferencesAndExtends,
  generateDynamicChildPipeline,
  type ComponentInputSpec,
} from './lib/gitlab-ci-model.ts';

test('CI/CD Components: spec:inputs validates types, default values, and allowed options', () => {
  const specs: Record<string, ComponentInputSpec> = {
    stage: {
      name: 'stage',
      type: 'string',
      default: 'test',
      options: ['build', 'test', 'deploy'],
    },
    retries: {
      name: 'retries',
      type: 'number',
      default: 2,
    },
    enableCoverage: {
      name: 'enableCoverage',
      type: 'boolean',
      default: true,
    },
    semverTag: {
      name: 'semverTag',
      type: 'string',
      regex: '^v?[0-9]+\\.[0-9]+\\.[0-9]+$',
    },
  };

  const validInputs = {
    stage: 'deploy',
    semverTag: 'v2.1.0',
  };

  const res = validateComponentInputs(specs, validInputs);
  assert.equal(res.valid, true);
  assert.equal(res.resolved['stage'], 'deploy');
  assert.equal(res.resolved['retries'], 2); // Default used
  assert.equal(res.resolved['enableCoverage'], true); // Default used
  assert.equal(res.resolved['semverTag'], 'v2.1.0');
});

test('negative test: spec:inputs rejects invalid regex, invalid types, and missing required parameters', () => {
  const specs: Record<string, ComponentInputSpec> = {
    apiKey: {
      name: 'apiKey',
      type: 'string',
      // No default -> required
    },
    version: {
      name: 'version',
      type: 'string',
      regex: '^[0-9]+\\.[0-9]+$',
    },
    environment: {
      name: 'environment',
      type: 'string',
      options: ['staging', 'production'],
    },
  };

  const invalidInputs = {
    version: 'bad-version-tag',
    environment: 'development', // Not in allowed options
    // apiKey missing
  };

  const res = validateComponentInputs(specs, invalidInputs);
  assert.equal(res.valid, false);
  assert.equal(res.errors.length, 3);
  assert.ok(res.errors.some((e) => e.includes("Required input 'apiKey' is missing")));
  assert.ok(res.errors.some((e) => e.includes('does not match regex')));
  assert.ok(res.errors.some((e) => e.includes('not in allowed options')));
});

test('extends and !reference resolution deep-merges configurations and reuses script blocks', () => {
  const rawConfig = {
    '.base-node-job': {
      image: 'node:26-alpine',
      before_script: ['corepack enable', 'pnpm install --frozen-lockfile'],
      variables: { CI: 'true', NODE_ENV: 'test' },
    },
    'shared-scripts': {
      cleanup: ['rm -rf ./tmp', 'echo "Cleanup done"'],
    },
    'test:unit': {
      extends: '.base-node-job',
      stage: 'test',
      script: ['pnpm test:unit'],
      after_script: { $ref: ['shared-scripts', 'cleanup'] },
    },
  };

  const resolved = resolveReferencesAndExtends(rawConfig);

  assert.equal(resolved['test:unit'].image, 'node:26-alpine');
  assert.deepEqual(resolved['test:unit'].before_script, [
    'corepack enable',
    'pnpm install --frozen-lockfile',
  ]);
  assert.deepEqual(resolved['test:unit'].after_script, ['rm -rf ./tmp', 'echo "Cleanup done"']);
  assert.equal(resolved['test:unit'].stage, 'test');
});

test('Dynamic Child Pipeline generator builds targeted build and test jobs for modified services', () => {
  const services = [
    { name: 'auth-service', path: 'services/auth', hasChanges: true },
    { name: 'billing-service', path: 'services/billing', hasChanges: false },
    { name: 'notifications', path: 'services/notifications', hasChanges: true },
  ];

  const childPipeline = generateDynamicChildPipeline(services);

  assert.equal(childPipeline.activeJobsCount, 4); // 2 jobs for auth, 2 for notifications
  assert.ok(childPipeline.generatedConfig['build:auth-service']);
  assert.ok(childPipeline.generatedConfig['test:auth-service']);
  assert.ok(childPipeline.generatedConfig['build:notifications']);
  assert.ok(childPipeline.generatedConfig['test:notifications']);
  assert.equal(childPipeline.generatedConfig['build:billing-service'], undefined);
});

test('property test: dynamic child pipeline job count is always exactly 2x the number of changed services', () => {
  fc.assert(
    fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (changeFlags) => {
      const services = changeFlags.map((hasChanges, idx) => ({
        name: `svc-${idx}`,
        path: `services/svc-${idx}`,
        hasChanges,
      }));

      const changedCount = changeFlags.filter(Boolean).length;
      const pipeline = generateDynamicChildPipeline(services);
      assert.equal(pipeline.activeJobsCount, changedCount * 2);
    }),
    { numRuns: 30 },
  );
});
