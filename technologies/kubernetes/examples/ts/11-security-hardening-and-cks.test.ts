// Module 11: Cluster Security Hardening (CKS): RBAC, PSA, and CEL Admission
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRbac, evaluatePodSecurity, type RbacRule } from './lib/kubernetes-model.ts';

test('RBAC evaluator enforces least privilege and handles wildcards', () => {
  const readOnlyRules: RbacRule[] = [
    {
      apiGroups: [''],
      resources: ['pods', 'services'],
      verbs: ['get', 'list', 'watch'],
    },
  ];

  assert.equal(evaluateRbac(readOnlyRules, { apiGroup: '', resource: 'pods', verb: 'get' }), true);
  assert.equal(
    evaluateRbac(readOnlyRules, { apiGroup: '', resource: 'pods', verb: 'delete' }),
    false,
  );
  assert.equal(
    evaluateRbac(readOnlyRules, { apiGroup: '', resource: 'secrets', verb: 'get' }),
    false,
  );

  const clusterAdminRules: RbacRule[] = [
    {
      apiGroups: ['*'],
      resources: ['*'],
      verbs: ['*'],
    },
  ];
  assert.equal(
    evaluateRbac(clusterAdminRules, { apiGroup: 'apps', resource: 'deployments', verb: 'delete' }),
    true,
  );
});

test('negative test: Pod Security Admission baseline level rejects privileged containers and host namespaces', () => {
  const privilegedPod = {
    spec: {
      hostPID: true,
      containers: [
        {
          securityContext: { privileged: true },
        },
      ],
    },
  };

  const baselineResult = evaluatePodSecurity(privilegedPod, 'baseline');
  assert.equal(baselineResult.allowed, false);
  assert.ok(baselineResult.violations.some((v) => v.includes('hostPID is forbidden')));
  assert.ok(baselineResult.violations.some((v) => v.includes('privileged container')));

  // Privileged level permits everything
  const privilegedResult = evaluatePodSecurity(privilegedPod, 'privileged');
  assert.equal(privilegedResult.allowed, true);
});

test('negative test: Pod Security Admission restricted level requires runAsNonRoot, dropped capabilities, and seccomp', () => {
  const nonCompliantPod = {
    spec: {
      hostPID: false,
      containers: [
        {
          securityContext: {
            privileged: false,
            allowPrivilegeEscalation: true, // Violation!
          },
        },
      ],
    },
  };

  const result = evaluatePodSecurity(nonCompliantPod, 'restricted');
  assert.equal(result.allowed, false);
  assert.ok(result.violations.some((v) => v.includes('runAsNonRoot must be true')));
  assert.ok(result.violations.some((v) => v.includes('allowPrivilegeEscalation must be false')));
  assert.ok(result.violations.some((v) => v.includes('capabilities.drop must contain ALL')));
  assert.ok(result.violations.some((v) => v.includes('seccompProfile must be RuntimeDefault')));

  // Fully hardened pod passes restricted
  const hardenedPod = {
    spec: {
      securityContext: {
        runAsNonRoot: true,
        seccompProfile: { type: 'RuntimeDefault' },
      },
      containers: [
        {
          securityContext: {
            privileged: false,
            allowPrivilegeEscalation: false,
            capabilities: { drop: ['ALL'], add: ['NET_BIND_SERVICE'] },
          },
        },
      ],
    },
  };

  const hardenedResult = evaluatePodSecurity(hardenedPod, 'restricted');
  assert.equal(hardenedResult.allowed, true);
  assert.equal(hardenedResult.violations.length, 0);
});
