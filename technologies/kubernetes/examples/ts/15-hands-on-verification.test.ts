// Hands-on verification suite for the CKA, CKAD, and CKS mock exams.
// Each test models the logic behind one performance-based task so the task has
// a runnable, deterministic verification in `examples/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditRbacEscalate,
  classifyNodeConditions,
  evaluateAuditPolicy,
  evaluateAuthorizationMode,
  evaluateCapabilities,
  evaluateCertificateExpiry,
  evaluateConfigMapEnvInjection,
  evaluateDeploymentScaling,
  evaluateEncryptionAtRest,
  evaluateEphemeralDebugTarget,
  evaluateHelmChart,
  evaluateImagePullSecret,
  evaluateJobPolicy,
  evaluateKubeconfigContext,
  evaluateKustomizeOverlay,
  evaluateLogForwarding,
  evaluateNetworkPolicyIngress,
  evaluateReadOnlyRootFilesystem,
  evaluateResourceQuota,
  evaluateRollbackTarget,
  evaluateRuntimeDetection,
  evaluateSeccompProfile,
  evaluateSecretVolumeMount,
  evaluateServiceAccountTokenMounting,
  evaluateServiceEndpoints,
  evaluateUserNamespaces,
  evaluateVolumeExpansion,
  scanImageVulnerabilities,
  validateCrdInstance,
  verifyImageSignature,
} from './lib/hands-on-models.ts';

test('classifyNodeConditions reports Ready and NotReady from the Ready condition', () => {
  assert.equal(
    classifyNodeConditions([
      { type: 'Ready', status: 'True' },
      { type: 'MemoryPressure', status: 'False' },
    ]),
    'Ready',
  );
  assert.equal(
    classifyNodeConditions([{ type: 'Ready', status: 'False', reason: 'KubeletNotReady' }]),
    'NotReady',
  );
  assert.equal(classifyNodeConditions([]), 'Unknown');
});

test('evaluateRollbackTarget selects the previous ReplicaSet', () => {
  const revisions = [
    { name: 'web-aaa', revision: 1, replicas: 3, image: 'app:v1' },
    { name: 'web-bbb', revision: 2, replicas: 3, image: 'app:v2' },
    { name: 'web-ccc', revision: 3, replicas: 3, image: 'app:v3' },
  ];
  const target = evaluateRollbackTarget(revisions, 3);
  assert.equal(target?.name, 'web-bbb');
  assert.equal(target?.image, 'app:v2');
  assert.equal(evaluateRollbackTarget(revisions, 1), undefined);
});

test('evaluateKubeconfigContext selects the active context', () => {
  const contexts = [
    { name: 'staging-admin', cluster: 'staging', user: 'admin', namespace: 'default' },
    { name: 'production-admin', cluster: 'production', user: 'admin', namespace: 'kube-system' },
  ];
  assert.equal(evaluateKubeconfigContext('production-admin', contexts)?.cluster, 'production');
  assert.equal(evaluateKubeconfigContext(undefined, contexts), undefined);
});

test('evaluateCertificateExpiry computes days remaining', () => {
  const now = new Date('2026-11-09T00:00:00Z');
  assert.equal(evaluateCertificateExpiry('2026-12-09T00:00:00Z', now), 30);
  assert.equal(evaluateCertificateExpiry('2026-11-01T00:00:00Z', now), -8);
});

test('evaluateServiceEndpoints matches the label selector', () => {
  const pods = [
    { name: 'web-1', labels: { app: 'web', tier: 'front' }, ready: true },
    { name: 'web-2', labels: { app: 'web', tier: 'front' }, ready: false },
    { name: 'api-1', labels: { app: 'api', tier: 'back' }, ready: true },
  ];
  assert.deepEqual(evaluateServiceEndpoints({ app: 'web' }, pods), ['web-1']);
  assert.deepEqual(evaluateServiceEndpoints({ app: 'api' }, pods), ['api-1']);
});

test('evaluateVolumeExpansion validates the requested size', () => {
  assert.equal(evaluateVolumeExpansion(5, 10, true), 'allowed');
  assert.equal(evaluateVolumeExpansion(5, 10, false), 'rejected');
  assert.equal(evaluateVolumeExpansion(10, 5, true), 'no-change');
});

test('evaluateConfigMapEnvInjection expands all keys', () => {
  assert.deepEqual(evaluateConfigMapEnvInjection({ API_URL: 'https://api', APP_COLOR: 'blue' }), {
    API_URL: 'https://api',
    APP_COLOR: 'blue',
  });
  assert.deepEqual(evaluateConfigMapEnvInjection({ APP_COLOR: 'blue' }, { EXISTING: '1' }), {
    APP_COLOR: 'blue',
    EXISTING: '1',
  });
});

test('evaluateResourceQuota enforces the aggregate limit', () => {
  const quota = { requestsCpu: 2, limitsMemoryGi: 4 };
  assert.deepEqual(evaluateResourceQuota(quota, { requestsCpu: 0.5, limitsMemoryGi: 1 }), {
    allowed: true,
    remainingCpu: 1.5,
    remainingMemoryGi: 3,
  });
  assert.deepEqual(
    evaluateResourceQuota(
      quota,
      { requestsCpu: 0.5, limitsMemoryGi: 1 },
      {
        requestsCpu: 1.6,
        limitsMemoryGi: 3,
      },
    ).allowed,
    false,
  );
});

test('evaluateHelmChart validates the chart structure', () => {
  assert.deepEqual(
    evaluateHelmChart({
      chartYaml: { name: 'web', version: '1.0.0', apiVersion: 'v2' },
      values: { replicas: 2 },
      templates: ['deployment.yaml'],
    }),
    { valid: true, errors: [] },
  );
  const invalid = evaluateHelmChart({
    chartYaml: { name: '', version: '', apiVersion: 'v2' },
    values: {},
    templates: [],
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 3);
});

test('evaluateKustomizeOverlay applies labels and replicas', () => {
  const base = [
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'web', labels: { app: 'web' } },
      spec: { replicas: 1 },
    },
  ];
  const result = evaluateKustomizeOverlay({ base, labels: { env: 'prod' }, replicas: 5 });
  const resource = result[0] as {
    metadata: { labels: Record<string, string> };
    spec: { replicas: number };
  };
  assert.equal(resource.metadata.labels.env, 'prod');
  assert.equal(resource.spec.replicas, 5);
});

test('evaluateJobPolicy enforces backoff and concurrency', () => {
  assert.deepEqual(
    evaluateJobPolicy({
      backoffLimit: 3,
      completions: 1,
      parallelism: 1,
      concurrencyPolicy: 'Forbid',
    }),
    { valid: true, errors: [] },
  );
  const invalid = evaluateJobPolicy({
    backoffLimit: -1,
    completions: 0,
    parallelism: 1,
    concurrencyPolicy: 'Sometimes' as 'Allow',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('evaluateEphemeralDebugTarget resolves the target container', () => {
  const pod = { name: 'web-0', containers: ['app', 'sidecar'] };
  assert.deepEqual(evaluateEphemeralDebugTarget(pod, 'app'), {
    sharesNamespaces: true,
    targetContainer: 'app',
    errors: [],
  });
  assert.equal(evaluateEphemeralDebugTarget(pod, 'missing').errors.length, 1);
  assert.equal(evaluateEphemeralDebugTarget(pod).targetContainer, undefined);
});

test('evaluateUserNamespaces reports the mapping', () => {
  assert.deepEqual(evaluateUserNamespaces(true), {
    enabled: false,
    mapping: 'container root maps to host root',
  });
  assert.deepEqual(evaluateUserNamespaces(false), {
    enabled: true,
    mapping: 'container root maps to a non-root host UID',
  });
});

test('evaluateSeccompProfile resolves the profile', () => {
  assert.deepEqual(evaluateSeccompProfile('RuntimeDefault'), {
    effective: 'RuntimeDefault',
    errors: [],
  });
  assert.deepEqual(evaluateSeccompProfile('Localhost', 'profiles/custom.json'), {
    effective: 'profiles/custom.json',
    errors: [],
  });
  assert.deepEqual(evaluateSeccompProfile('Localhost'), {
    effective: '',
    errors: ['Localhost requires localhostProfile'],
  });
});

test('verifyImageSignature validates the digest', () => {
  const signature = {
    image: 'registry.example.com/app',
    digest: 'sha256:abc',
    signature: 'registry.example.com/app@sha256:abc:cosign-pub',
  };
  assert.equal(verifyImageSignature(signature, 'cosign-pub'), true);
  assert.equal(verifyImageSignature(signature, 'attacker-key'), false);
});

test('evaluateImagePullSecret authenticates the pull', () => {
  assert.deepEqual(
    evaluateImagePullSecret('kubernetes.io/dockerconfigjson', 'regcred', ['regcred']),
    { authenticated: true, secret: 'regcred' },
  );
  assert.deepEqual(evaluateImagePullSecret('kubernetes.io/dockerconfigjson', 'regcred', []), {
    authenticated: false,
    secret: undefined,
  });
  assert.deepEqual(evaluateImagePullSecret('Opaque', 'regcred', ['regcred']), {
    authenticated: false,
    secret: 'regcred',
  });
});

test('scanImageVulnerabilities flags critical CVEs', () => {
  const result = scanImageVulnerabilities([
    { id: 'CVE-1', severity: 'CRITICAL' },
    { id: 'CVE-2', severity: 'HIGH' },
    { id: 'CVE-3', severity: 'CRITICAL' },
  ]);
  assert.equal(result.critical.length, 2);
  assert.equal(result.total, 3);
});

test('evaluateAuditPolicy matches the rule and stage', () => {
  const rules = [
    { namespace: 'finance', verb: 'get', resource: 'secrets', stage: 'Metadata' as const },
    { verb: 'get', resource: 'pods', stage: 'Metadata' as const },
    { verb: 'get', resource: 'secrets', stage: 'None' as const },
  ];
  assert.deepEqual(
    evaluateAuditPolicy(rules, { namespace: 'finance', verb: 'get', resource: 'secrets' }),
    rules[0],
  );
  assert.equal(
    evaluateAuditPolicy(rules, { namespace: 'other', verb: 'get', resource: 'secrets' }),
    undefined,
  );
});

test('evaluateRuntimeDetection flags the syscall', () => {
  assert.deepEqual(
    evaluateRuntimeDetection(['sh', 'curl'], { process: 'sh', network: '10.0.0.99' }),
    { detected: true, reasons: ['process sh executed'] },
  );
  assert.deepEqual(evaluateRuntimeDetection(['nginx'], { process: 'sh', network: '10.0.0.99' }), {
    detected: false,
    reasons: [],
  });
});

test('evaluateLogForwarding targets the external store', () => {
  assert.deepEqual(evaluateLogForwarding('https://logs.example.com/audit'), {
    forwarded: true,
    target: 'https://logs.example.com/audit',
  });
  assert.deepEqual(evaluateLogForwarding('/var/log/audit.log'), {
    forwarded: false,
    target: '/var/log/audit.log',
  });
});

test('evaluateEncryptionAtRest reports the provider', () => {
  assert.deepEqual(evaluateEncryptionAtRest('kms-v2', ['secrets']), {
    encrypted: true,
    provider: 'kms-v2',
    resources: ['secrets'],
  });
  assert.deepEqual(evaluateEncryptionAtRest(undefined, ['secrets']), {
    encrypted: false,
    provider: undefined,
    resources: ['secrets'],
  });
});

test('evaluateAuthorizationMode reports the secure mode', () => {
  assert.deepEqual(evaluateAuthorizationMode(['Node', 'RBAC'], false), {
    secure: true,
    reasons: [],
  });
  const insecure = evaluateAuthorizationMode(['AlwaysAllow'], true);
  assert.equal(insecure.secure, false);
  assert.equal(insecure.reasons.length, 3);
});

test('auditRbacEscalate finds the escalate verb', () => {
  const findings = auditRbacEscalate([
    { name: 'deployer', verbs: ['get', 'list'], resources: ['pods'] },
    { name: 'role-manager', verbs: ['escalate'], resources: ['roles'] },
    { name: 'wildcard', verbs: ['*'], resources: ['*'] },
  ]);
  assert.deepEqual(
    findings.map((f) => f.name),
    ['role-manager', 'wildcard'],
  );
});

test('evaluateServiceAccountTokenMounting disables the token', () => {
  assert.deepEqual(evaluateServiceAccountTokenMounting(false), { mounted: false });
  assert.deepEqual(evaluateServiceAccountTokenMounting(undefined), { mounted: true });
  assert.deepEqual(evaluateServiceAccountTokenMounting(true), { mounted: true });
});

test('evaluateCapabilities resolves the effective set', () => {
  assert.deepEqual(evaluateCapabilities(true, ['NET_BIND_SERVICE']), {
    effective: ['NET_BIND_SERVICE'],
  });
  const withDefaults = evaluateCapabilities(false, ['SYS_TIME']);
  assert.ok(withDefaults.effective.includes('NET_BIND_SERVICE'));
  assert.ok(withDefaults.effective.includes('SYS_TIME'));
});

test('evaluateReadOnlyRootFilesystem reports the posture', () => {
  assert.deepEqual(evaluateReadOnlyRootFilesystem(true), {
    readOnly: true,
    ephemeralWritable: true,
  });
  assert.deepEqual(evaluateReadOnlyRootFilesystem(false), {
    readOnly: false,
    ephemeralWritable: true,
  });
});

test('evaluateNetworkPolicyIngress allows the frontend Pods', () => {
  const from = [{ podSelector: { app: 'frontend' } }];
  assert.equal(evaluateNetworkPolicyIngress(from, { app: 'frontend' }, 8080, [8080]), true);
  assert.equal(evaluateNetworkPolicyIngress(from, { app: 'other' }, 8080, [8080]), false);
  assert.equal(evaluateNetworkPolicyIngress(from, { app: 'frontend' }, 9090, [8080]), false);
  assert.equal(evaluateNetworkPolicyIngress(undefined, { app: 'other' }, 8080, [8080]), true);
});

test('evaluateSecretVolumeMount mounts the Secret', () => {
  const volumes = [{ name: 'tls', secretName: 'tls-secret' }];
  const mounts = [{ name: 'tls', mountPath: '/etc/tls' }];
  assert.deepEqual(evaluateSecretVolumeMount('tls-secret', volumes, mounts), {
    mounted: true,
    mountPath: '/etc/tls',
    errors: [],
  });
  assert.equal(evaluateSecretVolumeMount('missing', volumes, mounts).mounted, false);
  assert.equal(evaluateSecretVolumeMount('tls-secret', volumes, []).mounted, false);
});

test('validateCrdInstance accepts a conforming custom resource', () => {
  const schema = { properties: { spec: { type: 'object' }, metadata: { type: 'object' } } };
  assert.deepEqual(validateCrdInstance(schema, { spec: { replicas: 2 }, metadata: {} }), {
    valid: true,
    errors: [],
  });
  const invalid = validateCrdInstance(schema, { spec: 'not-an-object' });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 2);
  assert.equal(validateCrdInstance(schema, {}).errors.length, 2);
});

test('evaluateDeploymentScaling reaches the desired replicas', () => {
  assert.deepEqual(evaluateDeploymentScaling(3, 5), { action: 'scale-up', delta: 2 });
  assert.deepEqual(evaluateDeploymentScaling(5, 3), { action: 'scale-down', delta: 2 });
  assert.deepEqual(evaluateDeploymentScaling(3, 3), { action: 'none', delta: 0 });
});
