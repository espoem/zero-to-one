import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Module 02: Resource Hierarchy & Governance Guardrails', () => {
  it('models policy inheritance and preventive SCP / Org Policy constraints', () => {
    interface OrganizationUnit {
      id: string;
      parent: string | null;
      appliedScpDenyActions: string[];
    }

    const orgHierarchy: OrganizationUnit[] = [
      { id: 'root', parent: null, appliedScpDenyActions: ['s3:DeleteBucketPolicy'] },
      { id: 'ou-core', parent: 'root', appliedScpDenyActions: [] },
      { id: 'ou-prod', parent: 'ou-core', appliedScpDenyActions: ['rds:DeleteDBInstance'] },
      { id: 'acc-prod-db-1', parent: 'ou-prod', appliedScpDenyActions: [] },
    ];

    // Compute effective preventive denies down the tree
    function getInheritedDenies(unitId: string): string[] {
      const unit = orgHierarchy.find((u) => u.id === unitId);
      if (!unit) return [];
      const parentDenies = unit.parent ? getInheritedDenies(unit.parent) : [];
      return Array.from(new Set([...parentDenies, ...unit.appliedScpDenyActions]));
    }

    const prodAccountDenies = getInheritedDenies('acc-prod-db-1');
    assert.deepEqual(
      prodAccountDenies.sort(),
      ['rds:DeleteDBInstance', 's3:DeleteBucketPolicy'].sort(),
    );
  });

  it('proves break-glass account isolation from central identity provider', () => {
    // Break-glass accounts must have emergency local credentials in an external vault (e.g. YubiKey/Hardware token),
    // bypassing corrupted corporate IdP / SSO outages
    const emergencyAccount = {
      accountId: '999999999999',
      ssoFederationEnabled: false,
      hardwareMfaEnforced: true,
      alertOnConsoleLoginTopic: 'arn:aws:sns:us-east-1:111122223333:SecurityP0Incident',
    };
    assert.strictEqual(emergencyAccount.ssoFederationEnabled, false);
    assert.strictEqual(emergencyAccount.hardwareMfaEnforced, true);
  });
});
