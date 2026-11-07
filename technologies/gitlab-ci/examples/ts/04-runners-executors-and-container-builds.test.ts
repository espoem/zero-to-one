// Module 04: GitLab Runner Architecture: Executors, Autoscaling, Distributed Caching, Rootless BuildKit, and DinD Risks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  selectRunnerExecutor,
  auditContainerBuildSecurity,
  type RunnerConfig,
} from './lib/gitlab-ci-model.ts';

test('Executor selection maps deployment environment requirements to optimal runner model', () => {
  assert.equal(
    selectRunnerExecutor({
      isolatedContainer: true,
      k8sNative: false,
      vmScale: false,
      hostDirect: false,
    }),
    'docker',
  );

  assert.equal(
    selectRunnerExecutor({
      isolatedContainer: true,
      k8sNative: true,
      vmScale: false,
      hostDirect: false,
    }),
    'kubernetes',
  );

  assert.equal(
    selectRunnerExecutor({
      isolatedContainer: true,
      k8sNative: false,
      vmScale: true,
      hostDirect: false,
    }),
    'docker-autoscaler',
  );

  assert.equal(
    selectRunnerExecutor({
      isolatedContainer: false,
      k8sNative: false,
      vmScale: false,
      hostDirect: true,
    }),
    'shell',
  );
});

test('Gotcha 5: privileged docker:dind on shared multi-tenant runner presents CRITICAL container escape risk', () => {
  const sharedPrivilegedRunner: RunnerConfig = {
    executor: 'docker',
    privileged: true,
    tags: ['shared-ci'],
    shared: true,
  };

  const audit = auditContainerBuildSecurity(sharedPrivilegedRunner, {
    usesDinD: true,
    usesBuildKitRootless: false,
    usesKaniko: false,
  });

  assert.equal(audit.secure, false);
  assert.equal(audit.riskLevel, 'CRITICAL');
  assert.ok(
    audit.escapeVulnerabilities.some((v) =>
      v.includes('Shared multi-tenant runner grants privileged: true with docker:dind'),
    ),
  );
});

test('Rootless BuildKit and Kaniko provide daemonless, unprivileged container builds without host escape surface', () => {
  const sharedUnprivilegedRunner: RunnerConfig = {
    executor: 'docker',
    privileged: false,
    tags: ['shared-ci'],
    shared: true,
  };

  const buildkitAudit = auditContainerBuildSecurity(sharedUnprivilegedRunner, {
    usesDinD: false,
    usesBuildKitRootless: true,
    usesKaniko: false,
  });
  assert.equal(buildkitAudit.secure, true);
  assert.equal(buildkitAudit.riskLevel, 'NONE');
  assert.equal(buildkitAudit.escapeVulnerabilities.length, 0);

  const kanikoAudit = auditContainerBuildSecurity(sharedUnprivilegedRunner, {
    usesDinD: false,
    usesBuildKitRootless: false,
    usesKaniko: true,
  });
  assert.equal(kanikoAudit.secure, true);
  assert.equal(kanikoAudit.riskLevel, 'NONE');
});

test('negative test: dedicated privileged runner still carries MEDIUM risk on untrusted fork code', () => {
  const dedicatedRunner: RunnerConfig = {
    executor: 'docker',
    privileged: true,
    tags: ['dedicated-infra'],
    shared: false,
  };

  const audit = auditContainerBuildSecurity(dedicatedRunner, {
    usesDinD: true,
    usesBuildKitRootless: false,
    usesKaniko: false,
  });

  assert.equal(audit.secure, false);
  assert.equal(audit.riskLevel, 'MEDIUM');
  assert.ok(
    audit.escapeVulnerabilities.some((v) => v.includes('Dedicated runner with privileged: true')),
  );
});

test('property test: BuildKit rootless and Kaniko always yield riskLevel NONE regardless of runner tags', () => {
  fc.assert(
    fc.property(
      fc.boolean(), // shared
      fc.boolean(), // privileged
      (shared, privileged) => {
        const runner: RunnerConfig = {
          executor: 'docker',
          privileged,
          tags: ['test-tag'],
          shared,
        };

        const res = auditContainerBuildSecurity(runner, {
          usesDinD: false,
          usesBuildKitRootless: true,
          usesKaniko: false,
        });

        assert.equal(res.secure, true);
        assert.equal(res.riskLevel, 'NONE');
      },
    ),
    { numRuns: 20 },
  );
});
