// Module 06: State Internals, Lineage, Remote Backends, S3 Lockfiles, and State Surgery
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  S3BackendLockManager,
  StateLockError,
  type StateV4,
  type LockInfo,
} from './lib/terraform-model.ts';

test('S3 backend with use_lockfile enforces mutual exclusion', () => {
  const s3Manager = new S3BackendLockManager();

  const lockA: LockInfo = {
    ID: 'lock-session-aaa',
    Operation: 'OperationTypeApply',
    Info: '',
    Who: 'ci-runner-01@internal',
    Version: '1.17.0',
    Created: '2026-11-07T12:00:00Z',
    Path: 'terraform.tfstate',
  };

  const lockB: LockInfo = {
    ID: 'lock-session-bbb',
    Operation: 'OperationTypeApply',
    Info: '',
    Who: 'developer-laptop@workstation',
    Version: '1.17.0',
    Created: '2026-11-07T12:00:05Z',
    Path: 'terraform.tfstate',
  };

  // CI runner acquires the lock
  s3Manager.acquireLock(lockA);
  assert.equal(s3Manager.isLocked(), true);

  // Developer tries to apply concurrently -> rejected with StateLockError!
  assert.throws(
    () => s3Manager.acquireLock(lockB),
    (err: unknown) => {
      assert.ok(err instanceof StateLockError);
      assert.equal(err.lockInfo.ID, 'lock-session-aaa');
      assert.equal(err.lockInfo.Who, 'ci-runner-01@internal');
      return true;
    },
  );

  // CI runner finishes and releases lock
  s3Manager.releaseLock('lock-session-aaa');
  assert.equal(s3Manager.isLocked(), false);

  // Now developer can acquire the lock
  s3Manager.acquireLock(lockB);
  assert.equal(s3Manager.isLocked(), true);
  s3Manager.releaseLock('lock-session-bbb');
});

test('production gotcha: force-unlock race condition causes concurrent write corruption', () => {
  const s3Manager = new S3BackendLockManager();

  const stateKey = 'env/prod/terraform.tfstate';
  const initialState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 10,
    lineage: 'lineage-prod-uuid',
    resources: [],
  };

  s3Manager.writeState(stateKey, initialState, 10);

  // CI Job 1 starts, acquires lock
  s3Manager.acquireLock({
    ID: 'job-1-lock',
    Operation: 'OperationTypeApply',
    Info: 'Slow DB migration',
    Who: 'ci-job-1',
    Version: '1.17.0',
    Created: '2026-11-07T12:00:00Z',
    Path: stateKey,
  });

  // Operator assumes CI Job 1 is hung and executes `terraform force-unlock job-1-lock`
  s3Manager.forceUnlock('job-1-lock');
  assert.equal(s3Manager.isLocked(), false);

  // CI Job 2 starts immediately and acquires the lock
  s3Manager.acquireLock({
    ID: 'job-2-lock',
    Operation: 'OperationTypeApply',
    Info: 'Fast subnet update',
    Who: 'ci-job-2',
    Version: '1.17.0',
    Created: '2026-11-07T12:02:00Z',
    Path: stateKey,
  });

  // CI Job 2 writes state serial 11
  const stateJob2: StateV4 = {
    ...initialState,
    serial: 11,
    resources: [
      {
        mode: 'managed',
        type: 'aws_subnet',
        name: 'app',
        provider: 'provider.aws',
        instances: [{ schema_version: 1, attributes: { cidr: '10.0.1.0/24' } }],
      },
    ],
  };
  s3Manager.writeState(stateKey, stateJob2, 10); // successfully updates from 10 to 11

  // Meanwhile, CI Job 1 finally finishes its slow DB migration and attempts to write state
  // Expecting serial 10, but remote state is now 11!
  const stateJob1: StateV4 = {
    ...initialState,
    serial: 11,
    resources: [
      {
        mode: 'managed',
        type: 'aws_db_instance',
        name: 'main',
        provider: 'provider.aws',
        instances: [{ schema_version: 1, attributes: { engine: 'postgres' } }],
      },
    ],
  };

  // CAS check protects from silent overwrite, but Job 1 errors out and state is diverged!
  assert.throws(
    () => s3Manager.writeState(stateKey, stateJob1, 10),
    /CAS violation: expected serial 10, current state serial is 11/,
  );
});

test('state v4 structure invariants: lineage immutability and monotonic serial', () => {
  const s3Manager = new S3BackendLockManager();
  const stateKey = 'terraform.tfstate';

  const validState: StateV4 = {
    format_version: '1.0',
    terraform_version: '1.17.0',
    serial: 1,
    lineage: 'fixed-uuid-constant',
    resources: [],
  };

  s3Manager.writeState(stateKey, validState, 1);

  // Negative test: changing lineage is rejected as state corruption / foreign state
  const corruptLineageState: StateV4 = {
    ...validState,
    lineage: 'different-foreign-lineage',
  };

  assert.throws(
    () => s3Manager.writeState(stateKey, corruptLineageState, 1),
    /State lineage mismatch/,
  );
});
