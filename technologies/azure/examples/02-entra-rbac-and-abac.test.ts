import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  DEFAULT_ROLE_PROPAGATION_DELAY_MS,
  MAX_ROLE_PROPAGATION_DELAY_MS,
  OWNER_ROLE,
  ROLE_PROPAGATION_DELAY_MS,
  STORAGE_BLOB_DATA_READER_ROLE,
  actionMatches,
  backoffAttemptsUntilPropagated,
  evaluateAbacConditions,
  evaluateAccess,
  evaluateAccessWithAbac,
  type AccessRequest,
  type DenyAssignment,
  type RoleAssignment,
  type RoleDefinition,
  type ScopeNode,
} from './lib/azure-models.ts';

function testScopes(): Map<string, ScopeNode> {
  return new Map<string, ScopeNode>([
    ['tenant', { id: 'tenant', kind: 'Tenant', parentId: undefined, displayName: 'T' }],
    ['mg-1', { id: 'mg-1', kind: 'ManagementGroup', parentId: 'tenant', displayName: 'MG' }],
    ['sub-1', { id: 'sub-1', kind: 'Subscription', parentId: 'mg-1', displayName: 'S' }],
    ['rg-1', { id: 'rg-1', kind: 'ResourceGroup', parentId: 'sub-1', displayName: 'RG' }],
    ['sa-1', { id: 'sa-1', kind: 'Resource', parentId: 'rg-1', displayName: 'Storage' }],
  ]);
}

const BLOB_READ = 'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read';

describe('Entra ID RBAC: control plane vs data plane', () => {
  test('Owner (actions *, no dataActions) cannot read blobs via Entra auth', () => {
    const nodes = testScopes();
    const request: AccessRequest = {
      principalId: 'alice',
      action: BLOB_READ,
      scopeId: 'sa-1',
      plane: 'data-plane',
    };
    const verdict = evaluateAccess({
      request,
      assignments: [{ principalId: 'alice', role: OWNER_ROLE, scopeId: 'sub-1', assignedAtMs: 0 }],
      denyAssignments: [],
      nodes,
      nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
    });
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.status, 403);

    // The same Owner CAN perform the control-plane read (actions: * covers it).
    const control = evaluateAccess({
      request: {
        ...request,
        action: 'Microsoft.Storage/storageAccounts/read',
        plane: 'control-plane',
      },
      assignments: [{ principalId: 'alice', role: OWNER_ROLE, scopeId: 'sub-1', assignedAtMs: 0 }],
      denyAssignments: [],
      nodes,
      nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
    });
    assert.equal(control.allowed, true);
  });

  test('Storage Blob Data Reader grants the data-plane read Owner cannot do', () => {
    const nodes = testScopes();
    const verdict = evaluateAccess({
      request: { principalId: 'bob', action: BLOB_READ, scopeId: 'sa-1', plane: 'data-plane' },
      assignments: [
        {
          principalId: 'bob',
          role: STORAGE_BLOB_DATA_READER_ROLE,
          scopeId: 'sa-1',
          assignedAtMs: 0,
        },
      ],
      denyAssignments: [],
      nodes,
      nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
    });
    assert.equal(verdict.allowed, true);
  });

  test('notActions carve holes out of wildcard allows', () => {
    const nodes = testScopes();
    const almostOwner: RoleDefinition = {
      name: 'AlmostOwner',
      actions: ['*'],
      dataActions: [],
      notActions: ['Microsoft.Authorization/*/write'],
      notDataActions: [],
    };
    const write = evaluateAccess({
      request: {
        principalId: 'carol',
        action: 'Microsoft.Authorization/roleAssignments/write',
        scopeId: 'sa-1',
        plane: 'control-plane',
      },
      assignments: [{ principalId: 'carol', role: almostOwner, scopeId: 'sub-1', assignedAtMs: 0 }],
      denyAssignments: [],
      nodes,
      nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
    });
    assert.equal(write.allowed, false);
    assert.match(actionMatches(['*'], 'anything') ? 'yes' : 'no', /yes/);
  });

  test('Negative: assignment 403s across both typical (60s) and worst-case (30m) propagation windows until backoff succeeds', () => {
    const nodes = testScopes();
    const assignments: RoleAssignment[] = [
      {
        principalId: 'dave',
        role: STORAGE_BLOB_DATA_READER_ROLE,
        scopeId: 'sa-1',
        assignedAtMs: 0,
      },
    ];
    assert.equal(DEFAULT_ROLE_PROPAGATION_DELAY_MS, 60_000);
    assert.equal(MAX_ROLE_PROPAGATION_DELAY_MS, 30 * 60_000);

    // 1. Typical fast propagation window (default 60_000 ms): denied at 5s, allowed at 60s.
    const tooEarlyDefault = evaluateAccess({
      request: { principalId: 'dave', action: BLOB_READ, scopeId: 'sa-1', plane: 'data-plane' },
      assignments,
      denyAssignments: [],
      nodes,
      nowMs: 5_000,
    });
    assert.equal(tooEarlyDefault.allowed, false);
    assert.match(tooEarlyDefault.reason, /propagat/);

    const fastAllowed = evaluateAccess({
      request: { principalId: 'dave', action: BLOB_READ, scopeId: 'sa-1', plane: 'data-plane' },
      assignments,
      denyAssignments: [],
      nodes,
      nowMs: 60_000,
    });
    assert.equal(fastAllowed.allowed, true);

    // 2. Worst-case 30-minute cached propagation window: still 403 at 60s, backoff succeeds after 30m.
    const stillCachedAt60s = evaluateAccess({
      request: { principalId: 'dave', action: BLOB_READ, scopeId: 'sa-1', plane: 'data-plane' },
      assignments,
      denyAssignments: [],
      nodes,
      nowMs: 60_000,
      propagationDelayMs: MAX_ROLE_PROPAGATION_DELAY_MS,
    });
    assert.equal(stillCachedAt60s.allowed, false);
    assert.match(stillCachedAt60s.reason, /propagat/);

    const schedule = backoffAttemptsUntilPropagated({
      assignedAtMs: 0,
      firstAttemptAtMs: 60_000,
      propagationDelayMs: MAX_ROLE_PROPAGATION_DELAY_MS,
      baseDelayMs: 60_000,
    });
    assert.equal(schedule.propagatedAtAttempt, true);
    assert.ok(schedule.attempts > 1);

    let atMs = 60_000;
    let allowed = false;
    for (let attempt = 0; attempt < schedule.attempts; attempt += 1) {
      const verdict = evaluateAccess({
        request: { principalId: 'dave', action: BLOB_READ, scopeId: 'sa-1', plane: 'data-plane' },
        assignments,
        denyAssignments: [],
        nodes,
        nowMs: atMs,
        propagationDelayMs: MAX_ROLE_PROPAGATION_DELAY_MS,
      });
      if (verdict.allowed) {
        allowed = true;
        break;
      }
      atMs += 60_000 * 2 ** attempt;
    }
    assert.equal(allowed, true);
  });

  test('ABAC condition scopes blob access by container name and blob tag', () => {
    const nodes = testScopes();
    const base = {
      request: {
        principalId: 'erin',
        action: BLOB_READ,
        scopeId: 'sa-1',
        plane: 'data-plane' as const,
      },
      assignments: [
        {
          principalId: 'erin',
          role: STORAGE_BLOB_DATA_READER_ROLE,
          scopeId: 'sa-1',
          assignedAtMs: 0,
        },
      ],
      denyAssignments: [],
      nodes,
      nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
    };
    const allowed = evaluateAccessWithAbac({
      ...base,
      abacConditions: [
        { left: '@Resource:containerName', operator: 'StringEquals', right: 'logs' },
        { left: '@Request:blobTagEnv', operator: 'StringEquals', right: 'prod' },
      ],
      abacContext: { '@Resource:containerName': 'logs', '@Request:blobTagEnv': 'prod' },
    });
    assert.equal(allowed.allowed, true);

    const denied = evaluateAccessWithAbac({
      ...base,
      abacConditions: [
        { left: '@Resource:containerName', operator: 'StringEquals', right: 'logs' },
      ],
      abacContext: { '@Resource:containerName': 'secrets' },
    });
    assert.equal(denied.allowed, false);
    assert.equal(denied.status, 403);

    assert.equal(
      evaluateAbacConditions(
        [{ left: '@Request:blobPath', operator: 'StringStartsWith', right: '2026/' }],
        { '@Request:blobPath': '2026/01/a.json' },
      ),
      true,
    );
  });

  test('property: a Deny Assignment trumps any combination of Allow assignments', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom('mg-1', 'sub-1', 'rg-1', 'sa-1'),
        (allowCount, denyScope) => {
          const nodes = testScopes();
          const reader: RoleAssignment = {
            principalId: 'mallory',
            role: STORAGE_BLOB_DATA_READER_ROLE,
            scopeId: 'sa-1',
            assignedAtMs: 0,
          };
          const owner: RoleAssignment = {
            principalId: 'mallory',
            role: OWNER_ROLE,
            scopeId: 'sub-1',
            assignedAtMs: 0,
          };
          const extras: RoleAssignment[] = [];
          for (let i = 0; i < allowCount; i += 1) {
            extras.push(i % 2 === 0 ? reader : owner);
          }
          const deny: DenyAssignment = {
            name: 'deny-blob-read',
            principalIds: ['mallory'],
            scopeId: denyScope,
            deniedActions: [],
            deniedDataActions: [BLOB_READ],
          };
          const verdict = evaluateAccess({
            request: {
              principalId: 'mallory',
              action: BLOB_READ,
              scopeId: 'sa-1',
              plane: 'data-plane',
            },
            assignments: extras,
            denyAssignments: [deny],
            nodes,
            nowMs: ROLE_PROPAGATION_DELAY_MS + 1,
          });
          assert.equal(verdict.allowed, false);
          assert.match(verdict.reason, /deny-blob-read/);
        },
      ),
      { seed: 20260202 },
    );
  });
});
