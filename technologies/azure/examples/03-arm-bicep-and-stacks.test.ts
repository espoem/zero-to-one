import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStackDeletion,
  auditStorageCompliance,
  authorizeStackOperation,
  planDeployment,
  type DeploymentStack,
  type TemplateResource,
} from './lib/azure-models.ts';

describe('ARM deployment modes, Deployment Stacks and policy-as-code', () => {
  test('Incremental preserves resources absent from the template', () => {
    const existing = ['/rg/vnet', '/rg/storage', '/rg/legacy-db'];
    const template = ['/rg/vnet', '/rg/storage'];
    const plan = planDeployment({ existing, template, mode: 'Incremental' });
    assert.deepEqual(plan.toDelete, []);
    assert.deepEqual(plan.toKeep, ['/rg/vnet', '/rg/storage']);
    assert.deepEqual(plan.toCreate, []);
  });

  test('Negative: Complete mode deletes pre-existing production resources missing from the template', () => {
    const existing = ['/rg/vnet', '/rg/storage', '/rg/prod-database'];
    const template = ['/rg/vnet', '/rg/storage'];
    const plan = planDeployment({ existing, template, mode: 'Complete' });
    assert.deepEqual(plan.toDelete, ['/rg/prod-database']);

    const rebuilt = planDeployment({ existing: template, template, mode: 'Complete' });
    assert.deepEqual(rebuilt.toDelete, []);
  });

  test('Deployment Stack deleteAll removes unmanaged resources; detachAll orphans them', () => {
    const base: DeploymentStack = {
      name: 'stack',
      managedResources: ['/rg/a', '/rg/b', '/rg/legacy'],
      templateResources: ['/rg/a', '/rg/b'],
      actionOnUnmanage: 'deleteAll',
      denySettings: 'none',
      excludedPrincipals: [],
    };
    const deleted = applyStackDeletion(base);
    assert.deepEqual(deleted.deleted, ['/rg/legacy']);
    assert.deepEqual(deleted.detached, []);

    const detached = applyStackDeletion({ ...base, actionOnUnmanage: 'detachAll' });
    assert.deepEqual(detached.deleted, []);
    assert.deepEqual(detached.detached, ['/rg/legacy']);
  });

  test('denyWriteAndDelete blocks even Subscription Owner unless in excludedPrincipals', () => {
    const stack: DeploymentStack = {
      name: 'guarded',
      managedResources: ['/rg/a'],
      templateResources: ['/rg/a'],
      actionOnUnmanage: 'detachAll',
      denySettings: 'denyWriteAndDelete',
      excludedPrincipals: ['break-glass-admin'],
    };
    const owner = authorizeStackOperation({
      stack,
      callerPrincipalId: 'subscription-owner',
      operation: 'delete',
    });
    assert.equal(owner.allowed, false);
    assert.equal(owner.status, 403);

    const ownerWrite = authorizeStackOperation({
      stack,
      callerPrincipalId: 'subscription-owner',
      operation: 'write',
    });
    assert.equal(ownerWrite.allowed, false);

    const breakGlass = authorizeStackOperation({
      stack,
      callerPrincipalId: 'break-glass-admin',
      operation: 'delete',
    });
    assert.equal(breakGlass.allowed, true);
  });

  test('Offline compliance gate denies public blob access and TLS below 1.2', () => {
    const resources: TemplateResource[] = [
      {
        type: 'Microsoft.Storage/storageAccounts',
        name: 'badpublic',
        allowBlobPublicAccess: true,
        minimumTlsVersion: 'TLS1_2',
      },
      {
        type: 'Microsoft.Storage/storageAccounts',
        name: 'oldtls',
        allowBlobPublicAccess: false,
        minimumTlsVersion: 'TLS1_0',
      },
      {
        type: 'Microsoft.Compute/virtualMachines',
        name: 'vm-does-not-apply',
      },
    ];
    const audit = auditStorageCompliance(resources);
    assert.equal(audit.compliant, false);
    assert.equal(audit.violations.length, 2);
    assert.match(audit.violations.join(';'), /allowBlobPublicAccess/);
    assert.match(audit.violations.join(';'), /minimumTlsVersion/);

    const clean = auditStorageCompliance([
      {
        type: 'Microsoft.Storage/storageAccounts',
        name: 'good',
        allowBlobPublicAccess: false,
        minimumTlsVersion: 'TLS1_2',
      },
    ]);
    assert.equal(clean.compliant, true);
    assert.deepEqual(clean.violations, []);
  });
});
