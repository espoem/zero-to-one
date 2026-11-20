import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KeyVaultThrottleBucket,
  SoftDeleteKeyVault,
  TOPOLOGY_RPO_RTO,
  activeActiveAvailability,
  authorizeSecretRead,
  commitmentBreakEvenUtilization,
  compareLogTablePlanCosts,
  evaluateFinOpsCommitment,
  meetsRpoRto,
  seriesAvailability,
} from './lib/azure-models.ts';

describe('Key Vault recovery, SLA math and BCDR topologies', () => {
  test('Negative: same-name vault/secret recreate during retention fails with 409', () => {
    const vault = new SoftDeleteKeyVault({ retentionDays: 90, purgeProtection: true });
    assert.equal(vault.setSecret('api-key', 's3cr3t').status, 200);
    assert.equal(vault.deleteSecret('api-key', 0).status, 200);

    const recreate = vault.setSecret('api-key', 'new-value');
    assert.equal(recreate.status, 409);
    assert.match(recreate.code ?? '', /SecretSoftDeleted/);

    const purgeBlocked = vault.purgeSecret('api-key');
    assert.equal(purgeBlocked.status, 409);
    assert.equal(purgeBlocked.code, 'PurgeProtectionEnabled');

    vault.deleteVault(1_000);
    const vaultRecreate = vault.recreateVault();
    assert.equal(vaultRecreate.status, 409);
    assert.match(vaultRecreate.code, /PurgeProtectionEnabled/);
  });

  test('Explicit recover() restores the vault and its secrets', () => {
    const vault = new SoftDeleteKeyVault({ retentionDays: 90, purgeProtection: true });
    vault.setSecret('api-key', 's3cr3t');
    vault.deleteSecret('api-key', 0);
    vault.deleteVault(1_000);

    assert.equal(vault.recoverVault().status, 200);
    const recovered = vault.recoverSecret('api-key', 43_200_000);
    assert.equal(recovered.status, 200);
    assert.equal(vault.getSecret('api-key').value, 's3cr3t');

    const expired = new SoftDeleteKeyVault({ retentionDays: 90, purgeProtection: false });
    expired.setSecret('old', 'x');
    expired.deleteSecret('old', 0);
    assert.equal(expired.purgeSecret('old').status, 200);
    assert.equal(expired.recoverSecret('old', 91 * 24 * 3_600_000).status, 404);
  });

  test('RBAC per-secret grants vs vault access-policy blast radius', () => {
    const scoped = authorizeSecretRead({
      model: 'RBAC',
      principalId: 'app-a',
      secretName: 'secret-a',
      vaultName: 'v',
      rbacGrants: [{ principalId: 'app-a', scope: '/vaults/v/secrets/secret-a' }],
    });
    assert.equal(scoped.allowed, true);

    const crossSecret = authorizeSecretRead({
      model: 'RBAC',
      principalId: 'app-a',
      secretName: 'secret-b',
      vaultName: 'v',
      rbacGrants: [{ principalId: 'app-a', scope: '/vaults/v/secrets/secret-a' }],
    });
    assert.equal(crossSecret.allowed, false);
    assert.equal(crossSecret.status, 403);

    // Vault access policy is vault-wide: the same principal reads secret-b too.
    const blastRadius = authorizeSecretRead({
      model: 'VaultAccessPolicy',
      principalId: 'app-a',
      secretName: 'secret-b',
      vaultName: 'v',
      vaultPolicyGet: ['app-a'],
    });
    assert.equal(blastRadius.allowed, true);
    assert.match(blastRadius.reason, /blast radius/);
  });

  test('Composite SLA: series multiplies, active-active takes the parallel complement', () => {
    const series = seriesAvailability([0.999, 0.999]);
    assert.ok(Math.abs(series - 0.998001) < 1e-9);

    const threeTier = seriesAvailability([0.999, 0.9995, 0.999]);
    assert.ok(threeTier < 0.999);

    // Two 99.9% regions in active-active: 99.9999%.
    const parallel = activeActiveAvailability(0.999, 0.999);
    assert.ok(Math.abs(parallel - 0.999999) < 1e-9);
    assert.ok(parallel > series);
  });

  test('RPO/RTO validation across Backup/Restore, Warm Standby and Active-Active', () => {
    assert.deepEqual(TOPOLOGY_RPO_RTO.ActiveActive.rpoMinutes, [0, 1]);

    const nightly = meetsRpoRto('BackupRestore', 15, 15);
    assert.equal(nightly.meetsRpo, false);
    assert.equal(nightly.meetsRto, false);

    const standby = meetsRpoRto('WarmStandby', 15, 60);
    assert.equal(standby.meetsRpo, true);
    assert.equal(standby.meetsRto, true);

    const global = meetsRpoRto('ActiveActive', 5, 5);
    assert.equal(global.meetsRpo, true);
    assert.equal(global.meetsRto, true);
    assert.match(global.reason, /ActiveActive/);
  });

  test('Negative: Key Vault rolling 10s throttle bucket returns 429 with Retry-After at limit', () => {
    const getBucket = new KeyVaultThrottleBucket({ limit: 2_000, windowMs: 10_000 });
    for (let i = 0; i < 2_000; i += 1) {
      assert.equal(getBucket.consume(1, 0).allowed, true);
    }
    const throttled = getBucket.consume(1, 2_000);
    assert.equal(throttled.allowed, false);
    assert.equal(throttled.status, 429);
    assert.equal(throttled.code, 'Throttled');
    assert.equal(throttled.retryAfterSeconds, 8);

    // Once the 10-second rolling window passes, requests succeed again.
    assert.equal(getBucket.consume(1, 10_000).allowed, true);

    // Shared 300/10s secret-create + cert-import bucket boundary.
    const writeBucket = new KeyVaultThrottleBucket({ limit: 300, windowMs: 10_000 });
    for (let i = 0; i < 300; i += 1) {
      assert.equal(writeBucket.consume(1, 500).status, 200);
    }
    assert.equal(writeBucket.consume(1, 500).status, 429);
  });

  test('Log Analytics table-plan cost comparator: Auxiliary wins for verbose archive; Analytics wins for heavy querying', () => {
    // High ingestion (1,000 GB), rare incident queries (10 GB scanned): Auxiliary is cheapest.
    const verboseArchive = compareLogTablePlanCosts({
      ingestionGbPerMonth: 1_000,
      queriedGbPerMonth: 10,
      retentionMonthsBeyondIncluded: 1,
    });
    assert.equal(verboseArchive.cheapestPlan, 'Auxiliary');
    const aux = verboseArchive.plans.find((p) => p.plan === 'Auxiliary')!;
    const basic = verboseArchive.plans.find((p) => p.plan === 'Basic')!;
    const analytics = verboseArchive.plans.find((p) => p.plan === 'Analytics')!;
    assert.ok(aux.totalCost < basic.totalCost);
    assert.ok(basic.totalCost < analytics.totalCost);

    // Moderate ingestion (100 GB) with heavy continuous querying (60,000 GB scanned): Analytics wins.
    const hotTelemetry = compareLogTablePlanCosts({
      ingestionGbPerMonth: 100,
      queriedGbPerMonth: 60_000,
    });
    assert.equal(hotTelemetry.cheapestPlan, 'Analytics');
  });

  test('FinOps commitment break-even calculator and Azure Hybrid Benefit stacking', () => {
    // Break-even utilization = 1 - discount (72% 3-yr RI -> 28%, 65% 3-yr Savings Plan -> 35%).
    assert.equal(commitmentBreakEvenUtilization(0.72), 0.28);
    assert.equal(commitmentBreakEvenUtilization(0.65), 0.35);

    const termHours = 1_000;
    // Exactly at break-even (280 of 1,000 hours): 3-yr Reservation ties On-Demand.
    const atBreakEven = evaluateFinOpsCommitment({
      model: 'Reservation3Yr',
      baseComputeHourly: 0.1,
      licenseHourly: 0.05,
      termHours,
      usedHours: 280,
      commitmentDiscount: 0.72,
    });
    assert.ok(Math.abs(atBreakEven.totalCost - atBreakEven.onDemandCost) < 1e-6);

    // Negative: below break-even (200 of 1,000 hours), commitment wastes money vs On-Demand.
    const underUtilized = evaluateFinOpsCommitment({
      model: 'Reservation3Yr',
      baseComputeHourly: 0.1,
      licenseHourly: 0.05,
      termHours,
      usedHours: 200,
      commitmentDiscount: 0.72,
    });
    assert.equal(underUtilized.beatsOnDemand, false);
    assert.ok(underUtilized.totalCost > underUtilized.onDemandCost);

    // Steady-state 100% utilization: Reservation3Yr < SavingsPlan3Yr < Reservation1Yr < OnDemand,
    // and stacking Azure Hybrid Benefit eliminates the OS/SQL license surcharge.
    const steadyBase = {
      baseComputeHourly: 0.1,
      licenseHourly: 0.05,
      termHours,
      usedHours: 1_000,
    };
    const onDemand = evaluateFinOpsCommitment({
      ...steadyBase,
      model: 'OnDemand',
      commitmentDiscount: 0,
    });
    const ri1 = evaluateFinOpsCommitment({
      ...steadyBase,
      model: 'Reservation1Yr',
      commitmentDiscount: 0.4,
    });
    const sp3 = evaluateFinOpsCommitment({
      ...steadyBase,
      model: 'SavingsPlan3Yr',
      commitmentDiscount: 0.65,
    });
    const ri3 = evaluateFinOpsCommitment({
      ...steadyBase,
      model: 'Reservation3Yr',
      commitmentDiscount: 0.72,
    });
    const ri3Ahb = evaluateFinOpsCommitment({
      ...steadyBase,
      model: 'Reservation3Yr',
      commitmentDiscount: 0.72,
      azureHybridBenefit: true,
    });
    assert.ok(ri3Ahb.totalCost < ri3.totalCost);
    assert.ok(ri3.totalCost < sp3.totalCost);
    assert.ok(sp3.totalCost < ri1.totalCost);
    assert.ok(ri1.totalCost < onDemand.totalCost);
  });
});
