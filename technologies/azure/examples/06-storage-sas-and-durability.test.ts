import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  GeoReplicatedBlob,
  StorageAccountNameRegistry,
  TIER_MINIMUM_DAYS,
  VersionedBlobStore,
  authorizeSas,
  earlyDeletionChargeableDays,
  validateStorageAccountName,
  type ArchiveTier,
} from './lib/azure-models.ts';

describe('Storage: naming, SAS, ETag, GRS failover', () => {
  test('Account names: 3-24 lowercase alphanumerics, globally unique', () => {
    assert.equal(validateStorageAccountName('prodstorage01').valid, true);
    assert.equal(validateStorageAccountName('ab').valid, false);
    assert.equal(validateStorageAccountName('a'.repeat(25)).valid, false);
    assert.equal(validateStorageAccountName('Prod-Storage').valid, false);
    assert.equal(validateStorageAccountName('prod_storage').valid, false);

    const registry = new StorageAccountNameRegistry();
    assert.equal(registry.register('prodstorage01').registered, true);
    const collision = registry.register('prodstorage01');
    assert.equal(collision.registered, false);
    assert.match(collision.reason, /NameAlreadyTaken/);
    assert.equal(registry.register('Bad-Name').registered, false);
  });

  test('Negative: account/service SAS rejected when shared key is disabled; user-delegation SAS works', () => {
    const nowMs = 1_000_000;
    const window = { expiresOnMs: nowMs + 3_600_000 };

    const serviceSas = authorizeSas({
      sas: { kind: 'Service', permissions: 'r', ...window },
      allowSharedKeyAccess: false,
      nowMs,
      requiredPermission: 'r',
    });
    assert.equal(serviceSas.allowed, false);
    assert.equal(serviceSas.code, 'SharedKeyDisabled');

    const entraSas = authorizeSas({
      sas: { kind: 'UserDelegation', permissions: 'r', ...window },
      allowSharedKeyAccess: false,
      nowMs,
      requiredPermission: 'r',
    });
    assert.equal(entraSas.allowed, true);

    const expired = authorizeSas({
      sas: { kind: 'UserDelegation', permissions: 'r', expiresOnMs: nowMs - 1 },
      allowSharedKeyAccess: true,
      nowMs,
      requiredPermission: 'r',
    });
    assert.equal(expired.allowed, false);
    assert.equal(expired.status, 403);
    assert.match(expired.code, /expired/);
  });

  test('Negative: concurrent blob write with a stale If-Match ETag fails with 412', () => {
    const store = new VersionedBlobStore();
    const first = store.putBlob('docs', 'report.txt', 'v1');
    assert.equal(first.status, 200);
    assert.ok(first.etag);

    const second = store.putBlob('docs', 'report.txt', 'v2', { ifMatch: first.etag });
    assert.equal(second.status, 200);
    assert.notEqual(second.etag, first.etag);

    const stale = store.putBlob('docs', 'report.txt', 'v3', { ifMatch: first.etag });
    assert.equal(stale.status, 412);
    assert.equal(stale.code, 'PreconditionFailed');
    assert.equal(store.getBlob('docs', 'report.txt').content, 'v2');
  });

  test('Negative: If-None-Match: * createOnce returns 201 on create and 409 Conflict on duplicate', () => {
    const store = new VersionedBlobStore();
    const created = store.createOnce('leases', 'leader.lock', 'owner-a');
    assert.equal(created.status, 201);
    assert.ok(created.etag);

    const duplicate = store.putBlob('leases', 'leader.lock', 'owner-b', { ifNoneMatch: '*' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.code, 'BlobAlreadyExists');
    assert.equal(store.getBlob('leases', 'leader.lock').content, 'owner-a');
  });

  test('Negative: GRS secondary reads fail (403); unplanned failover loses unreplicated writes and demotes to LRS', () => {
    const blob = new GeoReplicatedBlob({ redundancy: 'GRS' });
    blob.write('t0-base', 0);
    blob.replicate(60_000);
    assert.equal(blob.lastSyncTime(), 60_000);

    // GRS and GZRS do not expose readable secondary endpoints prior to failover.
    const grsRead = blob.readSecondary();
    assert.equal(grsRead.status, 403);
    assert.equal(grsRead.code, 'SecondaryReadNotAllowed');

    const gzrsBlob = new GeoReplicatedBlob({ redundancy: 'GZRS' });
    assert.equal(gzrsBlob.readSecondary().status, 403);
    assert.equal(gzrsBlob.readSecondary().code, 'SecondaryReadNotAllowed');

    // 10 minutes of async writes never replicated (typical <= 15 min RPO lag).
    blob.write('t1-unreplicated', 300_000);
    blob.write('t2-unreplicated', 600_000);

    const result = blob.unplannedFailover(660_000);
    assert.equal(result.lostWrites, 2);
    assert.equal(result.newRedundancy, 'LRS');
    assert.equal(blob.redundancy, 'LRS');
    assert.equal(blob.readPrimary(), 't0-base');

    const noSecondary = blob.readSecondary();
    assert.equal(noSecondary.status, 409);
    assert.equal(noSecondary.code, 'SecondaryNotAvailable');
  });

  test('RA-GRS and RA-GZRS secondary reads return stale 200 before sync catches up', () => {
    const blob = new GeoReplicatedBlob({ redundancy: 'RA-GRS' });
    blob.write('v1', 0);
    blob.replicate(1_000);
    blob.write('v2', 2_000);
    const before = blob.readSecondary();
    assert.equal(before.status, 200);
    assert.equal(before.content, 'v1');
    assert.equal(before.stale, true);
    blob.replicate(3_000);
    const after = blob.readSecondary();
    assert.equal(after.status, 200);
    assert.equal(after.content, 'v2');
    assert.equal(after.stale, false);

    const raGzrs = new GeoReplicatedBlob({ redundancy: 'RA-GZRS' });
    raGzrs.write('z1', 0);
    raGzrs.replicate(500);
    assert.equal(raGzrs.readSecondary().status, 200);
  });

  test('property: early-deletion penalty is monotonically non-increasing with retention elapsed', () => {
    assert.equal(TIER_MINIMUM_DAYS.Archive, 180);
    assert.equal(TIER_MINIMUM_DAYS.Cold, 90);
    assert.equal(TIER_MINIMUM_DAYS.Cool, 30);
    assert.equal(TIER_MINIMUM_DAYS.Hot, 0);
    fc.assert(
      fc.property(
        fc.constantFrom<ArchiveTier>('Archive', 'Cool', 'Cold', 'Hot'),
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 0, max: 400 }),
        (tier, a, b) => {
          const early = Math.min(a, b);
          const late = Math.max(a, b);
          const chargeEarly = earlyDeletionChargeableDays(tier, early);
          const chargeLate = earlyDeletionChargeableDays(tier, late);
          assert.ok(
            chargeEarly >= chargeLate,
            `${tier}: charge(${early})=${chargeEarly} should be >= charge(${late})=${chargeLate}`,
          );
          assert.equal(earlyDeletionChargeableDays(tier, TIER_MINIMUM_DAYS[tier] + 50), 0);
        },
      ),
      { seed: 20260606 },
    );
  });
});
