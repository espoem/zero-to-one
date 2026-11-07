// Module 08: Secrets Management and Keyless Cloud Federation: OIDC ID Tokens, AWS/GCP/Vault Auth, and Debug Masking
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  validateCloudFederationOIDC,
  detectVariableExfiltrationRisk,
  auditLogMaskingSafety,
  type GitLabOidcClaims,
  type CloudFederationPolicy,
} from './lib/gitlab-ci-model.ts';

test('Cloud OIDC Federation: AWS IAM role assumption succeeds with valid audience, protected ref, and matching subject', () => {
  const claims: GitLabOidcClaims = {
    iss: 'https://gitlab.com',
    sub: 'project_path:enterprise-org/payment-service:ref_type:branch:ref:main',
    aud: 'https://iam.amazonaws.com',
    ref: 'main',
    ref_type: 'branch',
    ref_protected: 'true',
    project_path: 'enterprise-org/payment-service',
    environment: 'production',
  };

  const policy: CloudFederationPolicy = {
    provider: 'aws',
    expectedAudience: 'https://iam.amazonaws.com',
    requiredSubjectPattern:
      /^project_path:enterprise-org\/payment-service:ref_type:branch:ref:(main|release-.*)$/,
    requireProtectedRef: true,
    allowedEnvironments: ['production', 'staging'],
  };

  const auth = validateCloudFederationOIDC(claims, policy);
  assert.equal(auth.authorized, true);
  assert.equal(auth.reason, undefined);
});

test('negative test: untrusted feature branch cannot assume cloud IAM role due to ref_protected check', () => {
  const untrustedClaims: GitLabOidcClaims = {
    iss: 'https://gitlab.com',
    sub: 'project_path:enterprise-org/payment-service:ref_type:branch:ref:feature/exploit-attempt',
    aud: 'https://iam.amazonaws.com',
    ref: 'feature/exploit-attempt',
    ref_type: 'branch',
    ref_protected: 'false', // Unprotected ref!
    project_path: 'enterprise-org/payment-service',
  };

  const policy: CloudFederationPolicy = {
    provider: 'aws',
    expectedAudience: 'https://iam.amazonaws.com',
    requiredSubjectPattern: /^project_path:enterprise-org\/payment-service:.*/,
    requireProtectedRef: true,
  };

  const auth = validateCloudFederationOIDC(untrustedClaims, policy);
  assert.equal(auth.authorized, false);
  assert.ok(auth.reason?.includes('ref_protected == "true"'));
});

test('Gotcha 4: unprotected variables exfiltrated by untrusted MR branches or fork pipelines', () => {
  const unprotectedApiKey = {
    key: 'STRIPE_SECRET_KEY',
    value: 'sk_live_948201948201948201',
    protected: false, // Danger: unprotected!
    masked: true,
  };

  const forkMrContext = {
    branch: 'patch-1',
    isProtected: false,
    isMergeRequest: true,
    isFork: true,
  };

  const risk = detectVariableExfiltrationRisk(unprotectedApiKey, forkMrContext);
  assert.equal(risk.exfiltratable, true);
  assert.equal(risk.riskLevel, 'CRITICAL');
  assert.ok(risk.reason?.includes('exfiltrate this credential'));

  // Protected variable is safely withheld from untrusted contexts
  const protectedApiKey = { ...unprotectedApiKey, protected: true };
  const safeCheck = detectVariableExfiltrationRisk(protectedApiKey, forkMrContext);
  assert.equal(safeCheck.exfiltratable, false);
});

test('Gotcha 3: CI_DEBUG_TRACE=true leaks masked secrets into runner console logs via shell set -x expansion', () => {
  const maskedSecret = 'super_secret_production_token_123';
  const consoleLog = `
    + export API_TOKEN=${maskedSecret}
    + curl -H "Authorization: Bearer ${maskedSecret}" https://api.prod.example.com
  `;

  // Without CI_DEBUG_TRACE: safe masking expected
  const safeAudit = auditLogMaskingSafety(
    '+ export API_TOKEN=[MASKED]\n+ curl -H "Authorization: Bearer [MASKED]" https://api.prod.example.com',
    [maskedSecret],
    false,
  );
  assert.equal(safeAudit.maskedSafely, true);
  assert.equal(safeAudit.leakedSecrets.length, 0);

  // With CI_DEBUG_TRACE=true: shell tracing prints expanded variable into logs
  const traceLeakAudit = auditLogMaskingSafety(consoleLog, [maskedSecret], true);
  assert.equal(traceLeakAudit.maskedSafely, false);
  assert.deepEqual(traceLeakAudit.leakedSecrets, [maskedSecret]);
  assert.ok(traceLeakAudit.warning?.includes('CRITICAL: CI_DEBUG_TRACE=true'));
});

test('property test: cloud federation always fails when claims audience differs from policy', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 5, maxLength: 20 }),
      fc.string({ minLength: 5, maxLength: 20 }),
      (tokenAud, policyAud) => {
        fc.pre(tokenAud !== policyAud);

        const claims: GitLabOidcClaims = {
          iss: 'https://gitlab.com',
          sub: 'project_path:org/repo:ref_type:branch:ref:main',
          aud: tokenAud,
          ref: 'main',
          ref_type: 'branch',
          ref_protected: 'true',
          project_path: 'org/repo',
        };

        const policy: CloudFederationPolicy = {
          provider: 'vault',
          expectedAudience: policyAud,
          requiredSubjectPattern: /.*/,
          requireProtectedRef: false,
        };

        const res = validateCloudFederationOIDC(claims, policy);
        assert.equal(res.authorized, false);
      },
    ),
    { numRuns: 30 },
  );
});
