// Module 09: Infrastructure Import, Config Generation, Removed Blocks, Terraform Query, and Drift Remediation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateRefactorEngine, type StateV4 } from './lib/terraform-model.ts';

test('declarative import blocks ingest unmanaged infrastructure into state', () => {
  const emptyState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 1,
    lineage: 'import-lineage-1',
    resources: [],
  };

  const importedState = StateRefactorEngine.applyImport(emptyState, [
    {
      to: 'aws_s3_bucket.legacy_data',
      id: 'existing-production-bucket-2024',
      provider: 'provider["registry.terraform.io/hashicorp/aws"]',
      attributes: {
        bucket: 'existing-production-bucket-2024',
        region: 'us-east-1',
        arn: 'arn:aws:s3:::existing-production-bucket-2024',
      },
    },
  ]);

  assert.equal(importedState.resources.length, 1);
  assert.equal(importedState.resources[0]?.type, 'aws_s3_bucket');
  assert.equal(importedState.resources[0]?.name, 'legacy_data');
  assert.equal(
    importedState.resources[0]?.instances[0]?.attributes['id'],
    'existing-production-bucket-2024',
  );
  assert.equal(importedState.serial, 2);

  // Negative test: Importing into an existing address fails
  assert.throws(
    () =>
      StateRefactorEngine.applyImport(importedState, [
        {
          to: 'aws_s3_bucket.legacy_data',
          id: 'duplicate-bucket',
          provider: 'provider.aws',
          attributes: {},
        },
      ]),
    /already exists in state; cannot import duplicate address/,
  );
});

test('production gotcha: deleting prevent_destroy block from config destroys resource', () => {
  // Scenario:
  // aws_rds_cluster.primary has `prevent_destroy = true` in config v1.
  // Developer wants to delete it or mistakenly deletes the whole block from main.tf.

  const planFromConfig = (
    resourceInConfig: boolean,
    preventDestroyInConfig: boolean,
  ): { action: string; blockedByPreventDestroy: boolean } => {
    if (!resourceInConfig) {
      // The resource block was removed from HCL.
      // Because the block is GONE, prevent_destroy is NO LONGER READ by the parser!
      // Terraform plans destruction!
      return { action: 'destroy', blockedByPreventDestroy: false };
    }
    if (preventDestroyInConfig) {
      return { action: 'no-op', blockedByPreventDestroy: true };
    }
    return { action: 'update', blockedByPreventDestroy: false };
  };

  // When config block is deleted:
  const outcome = planFromConfig(false, false);
  // FATAL GOTCHA: It plans destruction because prevent_destroy was inside the deleted block!
  assert.equal(outcome.action, 'destroy');
  assert.equal(outcome.blockedByPreventDestroy, false);
});

test('Terraform 1.16+ removed block with destroy = false drops from state without destroying infrastructure', () => {
  const stateWithCluster: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 10,
    lineage: 'rds-lineage-1',
    resources: [
      {
        mode: 'managed',
        type: 'aws_rds_cluster',
        name: 'prod_db',
        provider: 'provider.aws',
        instances: [
          {
            schema_version: 1,
            attributes: { id: 'cluster-prod-001', engine: 'aurora-postgresql' },
          },
        ],
      },
    ],
  };

  // Using Terraform 1.16+ removed block:
  // removed {
  //   from = aws_rds_cluster.prod_db
  //   lifecycle {
  //     destroy = false
  //   }
  // }
  const {
    state: updatedState,
    droppedFromState,
    destroyedInInfra,
  } = StateRefactorEngine.applyRemovedBlocks(stateWithCluster, [
    { from: 'aws_rds_cluster.prod_db', destroy: false },
  ]);

  // Dropped safely from state file:
  assert.deepEqual(droppedFromState, ['aws_rds_cluster.prod_db']);
  assert.equal(updatedState.resources.length, 0);

  // Infrastructure is NOT destroyed!
  assert.deepEqual(destroyedInInfra, []);
  assert.equal(updatedState.serial, 11);
});

test('out-of-band drift detection and planned reconciliation', () => {
  interface StateInstance {
    ingressRules: string[];
  }

  const desiredConfig: StateInstance = {
    ingressRules: ['10.0.0.0/16'],
  };

  // Out-of-band drift in cloud: someone added '0.0.0.0/0' in console
  const liveCloudState: StateInstance = {
    ingressRules: ['10.0.0.0/16', '0.0.0.0/0'],
  };

  const reconcileDrift = (desired: StateInstance, live: StateInstance) => {
    const rulesToRemove = live.ingressRules.filter((r) => !desired.ingressRules.includes(r));
    return {
      driftDetected: rulesToRemove.length > 0,
      plannedRevocations: rulesToRemove,
    };
  };

  const diff = reconcileDrift(desiredConfig, liveCloudState);
  assert.equal(diff.driftDetected, true);
  assert.deepEqual(diff.plannedRevocations, ['0.0.0.0/0']);
});
