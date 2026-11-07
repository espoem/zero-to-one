// Module 06: Software Supply-Chain Security: SBOM, Keyless Cosign v3 OIDC Signing, and SLSA v1.0 Provenance
// Owned by technologies/gitlab-ci per .agents/OWNERSHIP.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  verifyCycloneDXSBOM,
  signAndGenerateSigstoreBundle,
  verifySigstoreCosignBundle,
  verifySLSALevel3Provenance,
  type CycloneDXSBOM,
  type SLSAProvenanceStatement,
} from './lib/gitlab-ci-model.ts';

test('CycloneDX SBOM component graph verification confirms integrity of third-party dependencies', () => {
  const sbom: CycloneDXSBOM = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: {
      component: {
        name: 'order-service',
        version: '1.4.0',
        purl: 'pkg:golang/gitlab.com/org/order-service@1.4.0',
      },
    },
    components: [
      {
        name: 'github.com/google/uuid',
        version: 'v1.6.0',
        purl: 'pkg:golang/github.com/google/uuid@v1.6.0',
        hashes: [
          {
            alg: 'SHA-256',
            content: '96b1a21e4b85da8e9e24823974fb7c12666a7b73c09b83b8a1c97f1f0a57492c',
          },
        ],
        licenses: [{ license: { id: 'BSD-3-Clause' } }],
      },
      {
        name: 'go.uber.org/zap',
        version: 'v1.27.0',
        purl: 'pkg:golang/go.uber.org/zap@v1.27.0',
        hashes: [
          {
            alg: 'SHA-256',
            content: '8f432029b31d041a7d6ff84cb121a97d91361952a233634027731a5405e3ecaa',
          },
        ],
        licenses: [{ license: { id: 'MIT' } }],
      },
    ],
  };

  const expectedDigests = {
    'github.com/google/uuid': '96b1a21e4b85da8e9e24823974fb7c12666a7b73c09b83b8a1c97f1f0a57492c',
    'go.uber.org/zap': '8f432029b31d041a7d6ff84cb121a97d91361952a233634027731a5405e3ecaa',
  };

  const result = verifyCycloneDXSBOM(sbom, expectedDigests);
  assert.equal(result.verified, true);
  assert.equal(result.tamperedComponents.length, 0);
  assert.equal(result.missingDigests.length, 0);
});

test('negative test: tampered component in CycloneDX SBOM fails cryptographic hash verification', () => {
  const sbom: CycloneDXSBOM = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: {
      component: {
        name: 'payment-gateway',
        version: '2.0.0',
        purl: 'pkg:golang/gitlab.com/org/payment@2.0.0',
      },
    },
    components: [
      {
        name: 'crypto-helper',
        version: '1.0.0',
        purl: 'pkg:golang/github.com/attacker/crypto-helper@1.0.0',
        hashes: [
          { alg: 'SHA-256', content: 'tampered-compromised-hash-00000000000000000000000000000000' },
        ],
      },
    ],
  };

  const expectedDigests = {
    'crypto-helper': 'legitimate-sha256-hash-11111111111111111111111111111111',
  };

  const result = verifyCycloneDXSBOM(sbom, expectedDigests);
  assert.equal(result.verified, false);
  assert.deepEqual(result.tamperedComponents, ['crypto-helper']);
});

test('Sigstore Cosign v3 keyless signing with GitLab OIDC id_tokens and Rekor transparency log proof', () => {
  const artifactDigest = 'sha256:d8c0b396a84c6ef512140bbfa64269d7a22839b03940c83a731efc1b4ec37059';
  const oidcClaims = {
    iss: 'https://gitlab.example.com',
    sub: 'project_path:production-org/core-api:ref_type:branch:ref:main',
    aud: 'sigstore',
    jobUrl: 'https://gitlab.example.com/production-org/core-api/-/jobs/1049281',
    sha: '9c533fd0b9ef8063a8a3a0e6a14352f75476d0ab',
  };

  // Generate Cosign bundle via GitLab OIDC token
  const bundle = signAndGenerateSigstoreBundle(oidcClaims, artifactDigest);

  // Verify bundle against trusted policy
  const verification = verifySigstoreCosignBundle(bundle, artifactDigest, {
    expectedIssuer: 'https://gitlab.example.com',
    expectedProjectSubPrefix: 'project_path:production-org/core-api',
    expectedAud: 'sigstore',
  });

  assert.equal(verification.verified, true);
  assert.equal(verification.error, undefined);
});

test('negative test: Cosign bundle verification fails on audience or issuer mismatch', () => {
  const artifactDigest = 'sha256:valid-digest-123456';
  const oidcClaims = {
    iss: 'https://untrusted-gitlab.attacker.io', // Untrusted issuer!
    sub: 'project_path:production-org/core-api:ref_type:branch:ref:main',
    aud: 'sigstore',
    jobUrl: 'https://untrusted-gitlab.attacker.io/jobs/1',
    sha: 'commit-sha-999',
  };

  const bundle = signAndGenerateSigstoreBundle(oidcClaims, artifactDigest);

  const verification = verifySigstoreCosignBundle(bundle, artifactDigest, {
    expectedIssuer: 'https://gitlab.example.com',
    expectedProjectSubPrefix: 'project_path:production-org/core-api',
    expectedAud: 'sigstore',
  });

  assert.equal(verification.verified, false);
  assert.ok(verification.error?.includes('Issuer mismatch'));
});

test('SLSA v1.0 Build Level 3 provenance attestation confirms hermetic build and trusted runner identity', () => {
  const artifactDigest = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
  const trustedBuilder = 'https://gitlab.com/gitlab-org/gitlab-runner/hosted-runner';

  const slsaStmt: SLSAProvenanceStatement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: 'registry.gitlab.com/production-org/core-api',
        digest: { sha256: artifactDigest },
      },
    ],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://gitlab.com/gitlab-org/gitlab-runner/slsa-build/v1',
        externalParameters: {
          entrypoint: 'docker:build',
          sourceRepo: 'https://gitlab.com/production-org/core-api.git',
        },
        resolvedDependencies: [
          {
            uri: 'pkg:docker/alpine@3.20',
            digest: { sha256: '0a4eaa0eecf5f8cba784da1661214a45c8b567e305c104f453472919da5e8b11' },
          },
        ],
      },
      runDetails: {
        builder: {
          id: `${trustedBuilder}@v1.17.0`,
        },
        metadata: {
          invocationId: 'pipeline-run-482019',
          startedOn: '2026-10-28T10:00:00Z',
          finishedOn: '2026-10-28T10:05:00Z',
        },
      },
    },
  };

  const evalResult = verifySLSALevel3Provenance(slsaStmt, artifactDigest, trustedBuilder);
  assert.equal(evalResult.verified, true);
  assert.equal(evalResult.slsaLevel, 'L3');
  assert.equal(evalResult.reasons.length, 0);
});

test('negative test: SLSA provenance without resolvedDependencies downgrades security from L3', () => {
  const artifactDigest = 'sha256-unhermetic-build';
  const trustedBuilder = 'https://gitlab.com/gitlab-org/gitlab-runner/hosted-runner';

  const unhermeticStmt: SLSAProvenanceStatement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'image', digest: { sha256: artifactDigest } }],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://gitlab.com/custom-build',
        externalParameters: {},
        // resolvedDependencies is omitted -> unhermetic!
      },
      runDetails: {
        builder: { id: `${trustedBuilder}@v1` },
        metadata: {
          invocationId: 'run-1',
          startedOn: '2026-10-28T10:00:00Z',
          finishedOn: '2026-10-28T10:01:00Z',
        },
      },
    },
  };

  const evalResult = verifySLSALevel3Provenance(unhermeticStmt, artifactDigest, trustedBuilder);
  assert.equal(evalResult.verified, false);
  assert.ok(evalResult.reasons.some((r) => r.includes('Missing resolvedDependencies')));
});

test('property test: valid matching hashes across all components always verify CycloneDX SBOM', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          name: fc.stringMatching(/^[a-z0-9-]{3,10}$/),
          hash: fc.stringMatching(/^[a-f0-9]{64}$/),
        }),
        { minLength: 1, maxLength: 8 },
      ),
      (components) => {
        // Deduplicate component names
        const uniqueComps = Array.from(new Map(components.map((c) => [c.name, c])).values());
        const sbom: CycloneDXSBOM = {
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          metadata: {
            component: { name: 'app', version: '1.0.0', purl: 'pkg:npm/app@1.0.0' },
          },
          components: uniqueComps.map((c) => ({
            name: c.name,
            version: '1.0.0',
            purl: `pkg:npm/${c.name}@1.0.0`,
            hashes: [{ alg: 'SHA-256', content: c.hash }],
          })),
        };

        const expectedDigests: Record<string, string> = {};
        for (const c of uniqueComps) {
          expectedDigests[c.name] = c.hash;
        }

        const res = verifyCycloneDXSBOM(sbom, expectedDigests);
        assert.equal(res.verified, true);
        assert.equal(res.tamperedComponents.length, 0);
      },
    ),
    { numRuns: 20 },
  );
});
