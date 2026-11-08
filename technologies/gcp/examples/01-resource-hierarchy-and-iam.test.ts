import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceHierarchyEngine } from './lib/gcp-models.ts';
import type { ResourceNode, IamPolicy } from './lib/gcp-models.ts';

describe('Google Cloud Resource Hierarchy & IAM Policy Evaluation Engine', () => {
  const engine = new ResourceHierarchyEngine();

  // Define Hierarchy: Org 101 -> Folder Engineering (201) -> Project Prod (301) -> Bucket (401)
  const org: ResourceNode = { id: 'organizations/101', name: 'Acme Corp', type: 'ORGANIZATION' };
  const folder: ResourceNode = {
    id: 'folders/201',
    name: 'Engineering',
    type: 'FOLDER',
    parentId: 'organizations/101',
  };
  const project: ResourceNode = {
    id: 'projects/301',
    name: 'prod-api',
    type: 'PROJECT',
    parentId: 'folders/201',
  };
  const bucket: ResourceNode = {
    id: 'resources/401',
    name: 'gs://prod-customer-vault',
    type: 'RESOURCE',
    parentId: 'projects/301',
  };

  engine.addNode(org);
  engine.addNode(folder);
  engine.addNode(project);
  engine.addNode(bucket);

  // Register Standard Roles
  engine.registerRole('roles/resourcemanager.organizationViewer', [
    'resourcemanager.organizations.get',
  ]);
  engine.registerRole('roles/viewer', [
    'storage.buckets.get',
    'storage.objects.get',
    'compute.instances.get',
  ]);
  engine.registerRole('roles/storage.admin', [
    'storage.buckets.get',
    'storage.buckets.create',
    'storage.objects.get',
    'storage.objects.create',
    'storage.objects.delete',
  ]);
  engine.registerRole('roles/storage.objectViewer', ['storage.objects.get']);

  it('Default Deny: Request with zero policy bindings is denied', () => {
    const result = engine.evaluateAccess({
      principal: 'user:charlie@example.com',
      permission: 'storage.objects.get',
      resourceId: 'resources/401',
    });

    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'DEFAULT_DENY');
  });

  it('Inheritance Down Hierarchy: Organization Allow policy grants access on descendant project resource', () => {
    const orgPolicy: IamPolicy = {
      nodeId: 'organizations/101',
      allowBindings: [
        {
          role: 'roles/viewer',
          members: ['user:auditor@example.com'],
        },
      ],
    };
    engine.setPolicy(orgPolicy);

    const result = engine.evaluateAccess({
      principal: 'user:auditor@example.com',
      permission: 'storage.objects.get',
      resourceId: 'resources/401',
    });

    assert.equal(result.allowed, true);
    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.grantedAtNodeId, 'organizations/101');
    assert.equal(result.grantedRole, 'roles/viewer');
  });

  it('Union of Permissions: Local Project role adds permissions beyond inherited Folder role', () => {
    const folderPolicy: IamPolicy = {
      nodeId: 'folders/201',
      allowBindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['user:developer@example.com'],
        },
      ],
    };
    const projectPolicy: IamPolicy = {
      nodeId: 'projects/301',
      allowBindings: [
        {
          role: 'roles/storage.admin',
          members: ['user:developer@example.com'],
        },
      ],
    };
    engine.setPolicy(folderPolicy);
    engine.setPolicy(projectPolicy);

    // Permission present in storage.admin at Project level
    const deleteResult = engine.evaluateAccess({
      principal: 'user:developer@example.com',
      permission: 'storage.objects.delete',
      resourceId: 'resources/401',
    });

    assert.equal(deleteResult.allowed, true);
    assert.equal(deleteResult.decision, 'ALLOW');
    assert.equal(deleteResult.grantedAtNodeId, 'projects/301');
  });

  it('Deny Policy Precedence: Organization Deny policy overrides Project-level Storage Admin Allow', () => {
    const orgDenyPolicy: IamPolicy = {
      nodeId: 'organizations/101',
      allowBindings: [],
      denyRules: [
        {
          deniedPermissions: ['storage.objects.delete'],
          deniedPrincipals: ['principalSet://goog/public:all'],
          exceptionPrincipals: ['user:security-officer@example.com'],
        },
      ],
    };
    engine.setPolicy(orgDenyPolicy);

    // developer@example.com has roles/storage.admin on project 301, but is blocked by Org Deny
    const blockedResult = engine.evaluateAccess({
      principal: 'user:developer@example.com',
      permission: 'storage.objects.delete',
      resourceId: 'resources/401',
    });

    assert.equal(blockedResult.allowed, false);
    assert.equal(blockedResult.decision, 'DENY');
    assert.equal(blockedResult.deniedAtNodeId, 'organizations/101');

    // security-officer is in exception list, so if granted Allow, they succeed
    const secProjectPolicy: IamPolicy = {
      nodeId: 'projects/301',
      allowBindings: [
        {
          role: 'roles/storage.admin',
          members: ['user:security-officer@example.com'],
        },
      ],
    };
    engine.setPolicy(secProjectPolicy);

    const secResult = engine.evaluateAccess({
      principal: 'user:security-officer@example.com',
      permission: 'storage.objects.delete',
      resourceId: 'resources/401',
    });

    assert.equal(secResult.allowed, true);
    assert.equal(secResult.decision, 'ALLOW');
  });

  it('IAM Conditions (CEL): Grants access conditionally based on resource tags', () => {
    const conditionalPolicy: IamPolicy = {
      nodeId: 'projects/301',
      allowBindings: [
        {
          role: 'roles/storage.admin',
          members: ['user:contractor@example.com'],
          condition: {
            expression: "resource.tags['environment'] == 'prod'",
            title: 'Only in Prod environment',
          },
        },
      ],
    };
    engine.setPolicy(conditionalPolicy);

    // Non-matching tag -> denied
    const nonMatchResult = engine.evaluateAccess({
      principal: 'user:contractor@example.com',
      permission: 'storage.objects.create',
      resourceId: 'resources/401',
      context: {
        resourceTags: { environment: 'dev' },
      },
    });
    assert.equal(nonMatchResult.allowed, false);

    // Matching tag -> allowed
    const matchResult = engine.evaluateAccess({
      principal: 'user:contractor@example.com',
      permission: 'storage.objects.create',
      resourceId: 'resources/401',
      context: {
        resourceTags: { environment: 'prod' },
      },
    });
    assert.equal(matchResult.allowed, true);
    assert.equal(matchResult.decision, 'ALLOW');
  });

  it('Principal Access Boundary (PAB): Blocks access to resources outside permitted perimeter', () => {
    engine.setPrincipalAccessBoundary({
      principal: 'user:pab-user@example.com',
      permittedResourcePrefixes: ['projects/301'],
    });

    const projectPolicy: IamPolicy = {
      nodeId: 'projects/301',
      allowBindings: [
        {
          role: 'roles/viewer',
          members: ['user:pab-user@example.com'],
        },
      ],
    };
    engine.setPolicy(projectPolicy);

    // Inside boundary (prefix match)
    const allowed = engine.evaluateAccess({
      principal: 'user:pab-user@example.com',
      permission: 'compute.instances.get',
      resourceId: 'projects/301/zones/us-central1-a/instances/vm-1',
    });
    assert.equal(allowed.allowed, true);

    // Outside boundary -> blocked immediately by PAB
    const blocked = engine.evaluateAccess({
      principal: 'user:pab-user@example.com',
      permission: 'compute.instances.get',
      resourceId: 'projects/999/zones/us-central1-a/instances/vm-secret',
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.decision, 'DENY');
    assert.match(blocked.reason, /Principal Access Boundary/);
  });
});
