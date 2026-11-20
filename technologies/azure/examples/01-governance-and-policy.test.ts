import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  MAX_MANAGEMENT_GROUP_LEVELS,
  authorizeArmOperation,
  canPerformControlPlaneWrite,
  countManagementGroupLevels,
  createResource,
  evaluateDenyPolicies,
  evaluateDeployIfNotExists,
  isScopeOrAncestor,
  scopeChain,
  updateResource,
  validateManagementGroupDepth,
  type GovernedResource,
  type PolicyAssignment,
  type ScopeNode,
} from './lib/azure-models.ts';

function buildHierarchy(depthMg: number): { nodes: Map<string, ScopeNode>; leafId: string } {
  const nodes = new Map<string, ScopeNode>();
  nodes.set('tenant', { id: 'tenant', kind: 'Tenant', parentId: undefined, displayName: 'Tenant' });
  let parent = 'tenant';
  for (let i = 1; i <= depthMg; i += 1) {
    const id = `mg-${i}`;
    nodes.set(id, { id, kind: 'ManagementGroup', parentId: parent, displayName: `MG ${i}` });
    parent = id;
  }
  nodes.set('sub-1', {
    id: 'sub-1',
    kind: 'Subscription',
    parentId: parent,
    displayName: 'Subscription 1',
  });
  nodes.set('rg-1', {
    id: 'rg-1',
    kind: 'ResourceGroup',
    parentId: 'sub-1',
    displayName: 'RG 1',
  });
  nodes.set('res-1', {
    id: 'res-1',
    kind: 'Resource',
    parentId: 'rg-1',
    displayName: 'Storage account',
  });
  return { nodes, leafId: 'res-1' };
}

describe('Governance: Management Group -> Subscription -> RG hierarchy', () => {
  test('Six management-group levels are valid; the seventh is rejected', () => {
    const ok = buildHierarchy(6);
    assert.equal(countManagementGroupLevels(ok.leafId, ok.nodes), 6);
    assert.equal(validateManagementGroupDepth(ok.leafId, ok.nodes).valid, true);

    const over = buildHierarchy(7);
    const verdict = validateManagementGroupDepth(over.leafId, over.nodes);
    assert.equal(verdict.valid, false);
    assert.equal(verdict.depth, 7);
    assert.match(verdict.reason, /exceeds the maximum of 6/);
    assert.equal(MAX_MANAGEMENT_GROUP_LEVELS, 6);
  });

  test('Scope chain resolves Tenant -> MG -> Subscription -> RG -> Resource in order', () => {
    const { nodes, leafId } = buildHierarchy(2);
    const chain = scopeChain(leafId, nodes).map((n) => n.kind);
    assert.deepEqual(chain, [
      'Tenant',
      'ManagementGroup',
      'ManagementGroup',
      'Subscription',
      'ResourceGroup',
      'Resource',
    ]);
    assert.equal(isScopeOrAncestor('mg-1', 'res-1', nodes), true);
    assert.equal(isScopeOrAncestor('rg-1', 'mg-1', nodes), false);
  });

  test('Negative: RG-region outage blocks ARM writes on resources in a healthy region', () => {
    const blocked = canPerformControlPlaneWrite({
      rgRegionStatus: 'outage',
      resourceRegionStatus: 'healthy',
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.status, 503);
    assert.match(blocked.reason, /healthy/);

    const healthy = canPerformControlPlaneWrite({
      rgRegionStatus: 'healthy',
      resourceRegionStatus: 'healthy',
    });
    assert.equal(healthy.allowed, true);
  });

  test('Negative: DeployIfNotExists runs on create and update; untouched pre-existing resources require remediation', () => {
    const { nodes } = buildHierarchy(1);
    const assignment: PolicyAssignment = {
      name: 'deploy-encryption',
      scopeId: 'sub-1',
      effect: 'DeployIfNotExists',
      assignedAtMs: 1_000,
    };
    void nodes;
    const legacy: GovernedResource = {
      id: 'legacy',
      scopeId: 'res-1',
      type: 'Microsoft.Storage/storageAccounts',
      fields: {},
      createdAtMs: 100,
    };
    // Pre-existing resource never updated stays non-compliant until remediation runs.
    const before = evaluateDeployIfNotExists(legacy, assignment, false);
    assert.equal(before.compliant, false);
    assert.equal(before.remediated, false);

    const afterRemediation = evaluateDeployIfNotExists(legacy, assignment, true);
    assert.equal(afterRemediation.compliant, true);
    assert.equal(afterRemediation.remediated, true);

    // Updating the resource after assignment triggers DINE without a remediation task.
    const updated = updateResource(legacy, { tags: { env: 'prod' } }, assignment, 1_500);
    assert.equal(updated.dine.compliant, true);
    assert.equal(updated.dine.remediated, true);
    assert.match(updated.dine.reason, /Updated after assignment/);

    // Creating a new resource after assignment also triggers DINE on write.
    const created = createResource(
      { id: 'fresh', scopeId: 'res-1', type: 'Microsoft.Storage/storageAccounts', fields: {} },
      assignment,
      2_000,
    );
    assert.equal(created.dine.compliant, true);
    assert.match(created.dine.reason, /Created after assignment/);
  });

  test('Negative: ReadOnly and CanNotDelete locks return 409 ScopeLocked on blocked ARM ops; data-plane bypasses locks', () => {
    const { nodes } = buildHierarchy(1);
    const readOnlyLocks = [{ scopeId: 'rg-1', level: 'ReadOnly' as const }];
    const listKeys = authorizeArmOperation(
      {
        method: 'POST',
        plane: 'control-plane',
        description: 'POST listKeys',
        isListKeys: true,
      },
      'res-1',
      readOnlyLocks,
      nodes,
    );
    assert.equal(listKeys.allowed, false);
    assert.equal(listKeys.status, 409);
    assert.equal(listKeys.code, 'ScopeLocked');

    const dataRead = authorizeArmOperation(
      { method: 'GET', plane: 'data-plane', description: 'Entra blob read' },
      'res-1',
      readOnlyLocks,
      nodes,
    );
    assert.equal(dataRead.allowed, true);

    const controlRead = authorizeArmOperation(
      { method: 'GET', plane: 'control-plane', description: 'GET resource' },
      'res-1',
      readOnlyLocks,
      nodes,
    );
    assert.equal(controlRead.allowed, true);

    const deleteLocks = [{ scopeId: 'rg-1', level: 'CanNotDelete' as const }];
    const blockedDelete = authorizeArmOperation(
      { method: 'DELETE', plane: 'control-plane', description: 'DELETE resource' },
      'res-1',
      deleteLocks,
      nodes,
    );
    assert.equal(blockedDelete.allowed, false);
    assert.equal(blockedDelete.status, 409);
    assert.equal(blockedDelete.code, 'ScopeLocked');

    const allowedPut = authorizeArmOperation(
      { method: 'PUT', plane: 'control-plane', description: 'PUT tags' },
      'res-1',
      deleteLocks,
      nodes,
    );
    assert.equal(allowedPut.allowed, true);
  });

  test('property: Deny at any ancestor MG overrides compliant child scopes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        fc.boolean(),
        (mgDepth, denyAt, childCompliant) => {
          const { nodes } = buildHierarchy(mgDepth);
          const denyScope = `mg-${Math.min(denyAt + 1, mgDepth)}`;
          const resource: GovernedResource = {
            id: 'res',
            scopeId: 'res-1',
            type: 'Microsoft.Storage/storageAccounts',
            fields: childCompliant ? {} : { allowBlobPublicAccess: true },
            createdAtMs: 0,
          };
          const assignments: PolicyAssignment[] = [
            {
              name: 'ancestor-deny',
              scopeId: denyScope,
              effect: 'Deny',
              targetResourceType: 'Microsoft.Storage/storageAccounts',
              field: 'allowBlobPublicAccess',
              forbiddenValue: true,
              assignedAtMs: 0,
            },
          ];
          const verdict = evaluateDenyPolicies(resource, assignments, nodes);
          if (!childCompliant) {
            assert.equal(verdict.allowed, false);
          } else {
            assert.equal(verdict.allowed, true);
          }
          // A Deny-all at the root MG always wins regardless of the child state.
          const rootDeny: PolicyAssignment = {
            name: 'root-deny-all',
            scopeId: 'mg-1',
            effect: 'Deny',
            targetResourceType: 'Microsoft.Storage/storageAccounts',
            assignedAtMs: 0,
          };
          const rootVerdict = evaluateDenyPolicies(resource, [rootDeny], nodes);
          assert.equal(rootVerdict.allowed, false);
          assert.match(rootVerdict.reason, /root-deny-all/);
        },
      ),
      { seed: 20260101 },
    );
  });
});
