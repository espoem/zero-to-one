// Module 03: Core Workflow and CLI Mechanics: Init, Lock Files, Plan Refresh Modes, and Apply
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LockfileManager,
  computeSha256ZhHash,
  computeH1Hash,
  executeRefresh,
  type StateV4,
} from './lib/terraform-model.ts';

test('.terraform.lock.hcl verifies provider checksums (zh: and h1:)', () => {
  const manager = new LockfileManager();

  const awsZip = Buffer.from('mock-aws-provider-binary-v5.80.0');
  const zhHash = computeSha256ZhHash(awsZip);
  const h1Hash = computeH1Hash(awsZip);

  manager.setLock({
    address: 'registry.terraform.io/hashicorp/aws',
    version: '5.80.0',
    constraints: '~> 5.0',
    hashes: [zhHash, h1Hash],
  });

  // Verification succeeds with matching hash
  const validRes = manager.verify('registry.terraform.io/hashicorp/aws', '5.80.0', zhHash);
  assert.equal(validRes.ok, true);

  // Negative test: Tampered package or hash mismatch
  const tamperedHash = computeSha256ZhHash('tampered-binary-data');
  const tamperedRes = manager.verify('registry.terraform.io/hashicorp/aws', '5.80.0', tamperedHash);
  assert.equal(tamperedRes.ok, false);
  assert.match(tamperedRes.reason!, /Hash mismatch/);

  // Negative test: Missing provider in lockfile
  const missingRes = manager.verify('registry.terraform.io/hashicorp/random', '3.6.0', 'zh:1234');
  assert.equal(missingRes.ok, false);
  assert.match(missingRes.reason!, /No lockfile entry/);
});

test('lockfile serialization matches HCL block format', () => {
  const manager = new LockfileManager();
  manager.setLock({
    address: 'registry.terraform.io/hashicorp/aws',
    version: '5.80.0',
    constraints: '~> 5.80',
    hashes: ['zh:abcd1234ef5678', 'h1:XYZ98765=='],
  });

  const serialized = manager.serialize();
  assert.ok(serialized.includes('provider "registry.terraform.io/hashicorp/aws" {'));
  assert.ok(serialized.includes('version     = "5.80.0"'));
  assert.ok(serialized.includes('"zh:abcd1234ef5678"'));
});

test('plan refresh modes: normal vs refresh-only vs minimal-refresh (Terraform 1.17)', () => {
  const baseState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 10,
    lineage: 'test-lineage-uuid',
    resources: [
      {
        mode: 'managed',
        type: 'aws_vpc',
        name: 'main',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [
          {
            schema_version: 1,
            attributes: { id: 'vpc-100', cidr_block: '10.0.0.0/16', enable_dns_hostnames: false },
          },
        ],
      },
      {
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'assets',
        provider: 'provider["registry.terraform.io/hashicorp/aws"]',
        instances: [
          {
            schema_version: 1,
            attributes: { id: 'assets-prod', versioning: false },
          },
        ],
      },
    ],
  };

  // Remote cloud provider state with drift on both resources:
  // - aws_vpc.main had enable_dns_hostnames toggled to true out-of-band
  // - aws_s3_bucket.assets had versioning toggled to true out-of-band
  const remoteProvider = new Map<string, Record<string, unknown>>([
    ['aws_vpc.main', { id: 'vpc-100', cidr_block: '10.0.0.0/16', enable_dns_hostnames: true }],
    ['aws_s3_bucket.assets', { id: 'assets-prod', versioning: true }],
  ]);

  // Mode 1: Normal refresh queries ALL resources
  const normalRes = executeRefresh(baseState, remoteProvider, 'normal');
  assert.deepEqual(normalRes.refreshedAddresses.sort(), ['aws_s3_bucket.assets', 'aws_vpc.main']);
  assert.equal(normalRes.skippedAddresses.length, 0);
  assert.equal(normalRes.detectedDrift['aws_vpc.main']?.[0]?.field, 'enable_dns_hostnames');
  assert.equal(normalRes.detectedDrift['aws_s3_bucket.assets']?.[0]?.field, 'versioning');

  // Mode 2: Minimal refresh (Terraform 1.17): ONLY refreshes modified resources
  // If only aws_vpc.main is modified in config:
  const modifiedSet = new Set(['aws_vpc.main']);
  const minimalRes = executeRefresh(baseState, remoteProvider, 'minimal-refresh', modifiedSet);
  assert.deepEqual(minimalRes.refreshedAddresses, ['aws_vpc.main']);
  assert.deepEqual(minimalRes.skippedAddresses, ['aws_s3_bucket.assets']);
  // Bucket drift was skipped, reducing API query overhead!
  assert.equal(minimalRes.detectedDrift['aws_s3_bucket.assets'], undefined);
  assert.equal(minimalRes.detectedDrift['aws_vpc.main']?.[0]?.field, 'enable_dns_hostnames');
});

test('CI gotcha: applying without a saved plan applies unreviewed drift', () => {
  // Scenario:
  // Plan phase at 10:00 AM generated diff: Add 1 subnet.
  // At 10:05 AM, someone manually edited the DB security group in AWS console.
  // At 10:10 AM, CI runs apply.

  interface PlanSnapshot {
    lineage: string;
    serial: number;
    plannedActions: Array<{ address: string; action: string }>;
  }

  const reviewedPlan: PlanSnapshot = {
    lineage: 'prod-uuid-1',
    serial: 14,
    plannedActions: [{ address: 'aws_subnet.app', action: 'create' }],
  };

  // Safe approach: apply using saved plan checks serial & planned actions
  const applyWithSavedPlan = (currentSerial: number, plan: PlanSnapshot) => {
    if (currentSerial !== plan.serial) {
      throw new Error(
        `State serial changed from ${plan.serial} to ${currentSerial}; saved plan is stale!`,
      );
    }
    return plan.plannedActions;
  };

  // If state serial advanced out-of-band:
  const driftedSerial = 15;
  assert.throws(() => applyWithSavedPlan(driftedSerial, reviewedPlan), /saved plan is stale/);

  // If applying without saved plan (plain `terraform apply`):
  // The runner re-plans at 10:10 AM and applies unintended out-of-band drift remediation alongside!
  const dangerousApplyWithoutPlan = (driftDetected: boolean) => {
    return driftDetected ? 'applies_unintended_diff' : 'applies_intended_diff';
  };
  assert.equal(dangerousApplyWithoutPlan(true), 'applies_unintended_diff');
});
