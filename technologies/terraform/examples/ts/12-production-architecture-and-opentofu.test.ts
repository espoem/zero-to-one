// Module 12: Production State Architecture, Blast Radius, BSL Licensing, OpenTofu 1.13 Parity, and Version History
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptOpenTofuState, decryptOpenTofuState, type StateV4 } from './lib/terraform-model.ts';

test('blast radius comparison: monolithic state vs segmented per-environment state', () => {
  interface StatePartition {
    name: string;
    resourceCount: number;
    failureBlastRadiusPercent: number;
  }

  // Monolithic state holds all 500 company resources in one state file
  const monolithic: StatePartition = {
    name: 'monolith-all-infra',
    resourceCount: 500,
    failureBlastRadiusPercent: 100, // A single lock contention, corrupt state, or bad plan blocks whole company!
  };

  // Segmented architecture: blast radius strictly partitioned
  const segmented: StatePartition[] = [
    { name: 'prod-network', resourceCount: 40, failureBlastRadiusPercent: 8 },
    { name: 'prod-database', resourceCount: 30, failureBlastRadiusPercent: 6 },
    { name: 'prod-k8s-apps', resourceCount: 150, failureBlastRadiusPercent: 30 },
    { name: 'dev-network', resourceCount: 40, failureBlastRadiusPercent: 8 },
  ];

  assert.equal(monolithic.failureBlastRadiusPercent, 100);
  for (const part of segmented) {
    assert.ok(
      part.failureBlastRadiusPercent < monolithic.failureBlastRadiusPercent,
      'Segmented state blast radius must be strictly smaller than monolith',
    );
  }
});

test('OpenTofu 1.13 native state encryption with AES-256-GCM and PBKDF2', () => {
  const sampleState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 1,
    lineage: 'tofu-lineage-secure',
    resources: [
      {
        mode: 'managed',
        type: 'aws_db_instance',
        name: 'secure_db',
        provider: 'provider.aws',
        instances: [
          {
            schema_version: 1,
            attributes: {
              id: 'db-production-01',
              password: 'SuperSecretDbPassword123!',
            },
          },
        ],
      },
    ],
  };

  const rawJson = JSON.stringify(sampleState);
  const passphrase = 'MyProductionTofuKeyPassphrase!2026';

  // Encrypt state
  const encryptedEnvelope = encryptOpenTofuState(rawJson, passphrase);

  assert.equal(encryptedEnvelope.format, 'opentofu.state.encrypted.v1');
  assert.equal(encryptedEnvelope.cipher, 'aes-256-gcm');
  assert.equal(encryptedEnvelope.key_provider, 'pbkdf2');
  assert.equal(encryptedEnvelope.ciphertext.includes('SuperSecretDbPassword123!'), false);

  // Decrypt with valid passphrase
  const decryptedJson = decryptOpenTofuState(encryptedEnvelope, passphrase);
  const parsedState = JSON.parse(decryptedJson) as StateV4;

  assert.deepEqual(parsedState, sampleState);
  assert.equal(
    parsedState.resources[0]?.instances[0]?.attributes['password'],
    'SuperSecretDbPassword123!',
  );

  // Negative test: Decrypting with wrong passphrase fails authentication (GCM auth tag check)
  assert.throws(
    () => decryptOpenTofuState(encryptedEnvelope, 'WrongPassphrase!'),
    /unsupported state or unable to authenticate data/i,
  );
});

test('OpenTofu dynamic prevent_destroy evaluation vs Terraform static constraint', () => {
  // In standard Terraform <= 1.16, lifecycle { prevent_destroy = ... } MUST be a literal boolean.
  // In OpenTofu, dynamic expressions are supported!

  const evaluatePreventDestroy = (
    tool: 'terraform_legacy' | 'opentofu',
    expression: { isLiteral: boolean; evaluatesTo: (env: string) => boolean },
    env: string,
  ): boolean => {
    if (tool === 'terraform_legacy' && !expression.isLiteral) {
      throw new Error(
        'Terraform syntax error: lifecycle.prevent_destroy must be a literal boolean true or false',
      );
    }
    return expression.evaluatesTo(env);
  };

  const dynamicExpr = {
    isLiteral: false,
    evaluatesTo: (env: string) => env === 'production',
  };

  // OpenTofu dynamically evaluates expression:
  const tofuProdResult = evaluatePreventDestroy('opentofu', dynamicExpr, 'production');
  assert.equal(tofuProdResult, true);

  const tofuDevResult = evaluatePreventDestroy('opentofu', dynamicExpr, 'development');
  assert.equal(tofuDevResult, false);

  // Negative test: Standard Terraform rejects dynamic expressions at parse time
  assert.throws(
    () => evaluatePreventDestroy('terraform_legacy', dynamicExpr, 'production'),
    /lifecycle.prevent_destroy must be a literal boolean/,
  );
});

test('production gotcha: state divergence when mixing Terraform >= 1.6 and OpenTofu', () => {
  // Scenario:
  // OpenTofu creates an encrypted state file.
  // Standard Terraform binary is invoked on the same backend state file.

  const simulateTerraformRead = (rawContent: string) => {
    const parsed = JSON.parse(rawContent) as Record<string, unknown>;
    // Standard Terraform expects top-level `format_version` equal to "1.0"
    if (parsed.format === 'opentofu.state.encrypted.v1') {
      throw new Error(
        'Terraform error: state file is encrypted with OpenTofu state encryption format and cannot be read by Terraform',
      );
    }
    return parsed;
  };

  const encryptedEnvelope = encryptOpenTofuState('{"format_version": "1.0"}', 'test-key');
  const envelopeJson = JSON.stringify(encryptedEnvelope);

  // Terraform rejects OpenTofu encrypted state!
  assert.throws(() => simulateTerraformRead(envelopeJson), /state file is encrypted with OpenTofu/);
});
