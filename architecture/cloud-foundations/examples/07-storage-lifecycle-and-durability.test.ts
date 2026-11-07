import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StorageEconomics, type StorageTierSpec } from './lib/cloud-models.ts';

describe('Module 07: Storage Classes & Durability Economics', () => {
  const glacierInstantRetrieval: StorageTierSpec = {
    name: 'S3 Glacier Instant Retrieval',
    monthlyPerGb: 0.004,
    retrievalPerGb: 0.03,
    minimumRetentionDays: 90,
  };

  it('proves early deletion fee applies when object is deleted before minimum retention days', () => {
    // 1000 GB stored for only 10 days, then deleted
    const cost = StorageEconomics.calculateCost(glacierInstantRetrieval, 1000, 10, 0);

    // 10 days stored: 1000 * (10/30) * 0.004 = $1.3333
    // 80 days early deletion fee: 1000 * (80/30) * 0.004 = $10.6667
    // Total = $12.0000 (equivalent to full 90 days)
    assert.equal(cost.baseStorageCost, 1.3333);
    assert.equal(cost.earlyDeletionFee, 10.6667);
    assert.equal(cost.totalCost, 12);
  });

  it('differentiates 11 9s durability from availability and accidental deletion', () => {
    // 99.999999999% durability means annual probability of losing an object is 10^-11.
    // However, without Object Lock (WORM) and versioning, an authorized or compromised API call
    // issuing s3:DeleteObject permanently destroys data despite 11 9s durability.
    interface BucketConfig {
      versioningEnabled: boolean;
      objectLockEnabled: boolean;
      replicationEnabled: boolean;
    }

    function isProtectedAgainstAccidentalOrMaliciousDelete(b: BucketConfig): boolean {
      return b.versioningEnabled && b.objectLockEnabled;
    }

    assert.strictEqual(
      isProtectedAgainstAccidentalOrMaliciousDelete({
        versioningEnabled: true,
        objectLockEnabled: true,
        replicationEnabled: true,
      }),
      true,
    );

    assert.strictEqual(
      isProtectedAgainstAccidentalOrMaliciousDelete({
        versioningEnabled: true,
        objectLockEnabled: false,
        replicationEnabled: true,
      }),
      false,
    );
  });
});
