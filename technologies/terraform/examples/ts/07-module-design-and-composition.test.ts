// Module 07: Module Design, Scoping, Versioning, OCI Sources, and Declarative Refactoring
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateRefactorEngine, type StateV4 } from './lib/terraform-model.ts';

test('module scoping: inputs, outputs, and internal encapsulation', () => {
  // Reusable module simulator
  interface ChildModuleScope {
    inputs: { vpcCidr: string; environment: string };
    locals: { internalTags: Record<string, string> };
    resources: { subnetId: string };
    outputs: { publicSubnetId: string };
  }

  const instantiateVpcModule = (inputs: {
    vpcCidr: string;
    environment: string;
  }): ChildModuleScope => {
    const internalTags = { Env: inputs.environment, ManagedBy: 'Terraform' };
    const subnetId = `sub-${inputs.environment}-01`;
    return {
      inputs,
      locals: { internalTags },
      resources: { subnetId },
      outputs: { publicSubnetId: subnetId },
    };
  };

  const mod = instantiateVpcModule({ vpcCidr: '10.0.0.0/16', environment: 'production' });

  // Root module accesses public outputs only:
  assert.equal(mod.outputs.publicSubnetId, 'sub-production-01');

  // Internal locals are private to child module scope:
  assert.equal(mod.locals.internalTags.Env, 'production');
});

test('production gotcha: renaming without moved block causes catastrophic destroy-and-create', () => {
  // Initial state holding critical database
  const stateWithDb: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 5,
    lineage: 'db-lineage-1',
    resources: [
      {
        mode: 'managed',
        type: 'aws_db_instance',
        name: 'legacy_db',
        provider: 'provider.aws',
        instances: [
          { schema_version: 1, attributes: { id: 'db-production-master', engine: 'postgres' } },
        ],
      },
    ],
  };

  // Scenario A: Developer renames HCL block to `aws_db_instance.postgres_primary`
  // WITHOUT adding a `moved` block:
  const planWithoutMoved = (state: StateV4, configuredName: string) => {
    const existing = state.resources.find(
      (r) => r.type === 'aws_db_instance' && r.name === 'legacy_db',
    );
    const isOldConfigured = configuredName === 'legacy_db';
    const isNewConfigured = configuredName === 'postgres_primary';

    const actions: Array<{ address: string; action: string }> = [];
    if (existing && !isOldConfigured) {
      actions.push({ address: 'aws_db_instance.legacy_db', action: 'destroy' });
    }
    if (isNewConfigured) {
      actions.push({ address: 'aws_db_instance.postgres_primary', action: 'create' });
    }
    return actions;
  };

  const dangerousActions = planWithoutMoved(stateWithDb, 'postgres_primary');
  // CATASTROPHIC PRODUCTION FAILURE: Database is destroyed!
  assert.deepEqual(dangerousActions, [
    { address: 'aws_db_instance.legacy_db', action: 'destroy' },
    { address: 'aws_db_instance.postgres_primary', action: 'create' },
  ]);

  // Scenario B: Developer adds declarative `moved` block:
  // moved { from = aws_db_instance.legacy_db, to = aws_db_instance.postgres_primary }
  const { state: migratedState, renames } = StateRefactorEngine.applyMovedBlocks(stateWithDb, [
    { from: 'aws_db_instance.legacy_db', to: 'aws_db_instance.postgres_primary' },
  ]);

  assert.deepEqual(renames, ['aws_db_instance.legacy_db -> aws_db_instance.postgres_primary']);
  assert.equal(migratedState.resources.length, 1);
  assert.equal(migratedState.resources[0]?.name, 'postgres_primary');
  assert.equal(migratedState.resources[0]?.instances[0]?.attributes['id'], 'db-production-master');

  // With moved block: Zero destroys, state serial bumped, data preserved!
  assert.equal(migratedState.serial, 6);
});

test('moving resources across module boundaries with moved blocks', () => {
  const initialState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 1,
    lineage: 's3-lineage-1',
    resources: [
      {
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'access_logs',
        provider: 'provider.aws',
        instances: [{ schema_version: 1, attributes: { bucket: 'company-access-logs' } }],
      },
    ],
  };

  // Refactoring root resource into child logging module:
  const { state: refactoredState } = StateRefactorEngine.applyMovedBlocks(initialState, [
    { from: 'aws_s3_bucket.access_logs', to: 'module.logging.aws_s3_bucket.access_logs' },
  ]);

  assert.equal(refactoredState.resources[0]?.module, 'module.logging');
  assert.equal(refactoredState.resources[0]?.type, 'aws_s3_bucket');
  assert.equal(refactoredState.resources[0]?.name, 'access_logs');
});
