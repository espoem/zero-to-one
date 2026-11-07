// Module 02: Linux Namespaces, Process Trees, PID 1 Semantics, and User Namespace Mapping
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  parseUidMap,
  mapToHost,
  mapToContainer,
  generateRootlessUidMap,
  ContainerProcessTree,
} from './lib/containers-model.ts';

test('user namespace uid_map parsing maps container UIDs to host UIDs', () => {
  const sampleUidMap = `
    0 1000 1
    1 100000 65536
  `;
  const mappings = parseUidMap(sampleUidMap);

  assert.equal(mappings.length, 2);
  assert.equal(mapToHost(0, mappings), 1000, 'Container root (0) maps to host user 1000');
  assert.equal(
    mapToHost(1, mappings),
    100000,
    'Container UID 1 maps to start of subuid allocation',
  );
  assert.equal(mapToHost(1000, mappings), 100999, 'Container UID 1000 maps to host subuid 100999');

  // Inverse mapping
  assert.equal(mapToContainer(1000, mappings), 0, 'Host UID 1000 maps to container root');
  assert.equal(
    mapToContainer(100999, mappings),
    1000,
    'Host subuid 100999 maps to container UID 1000',
  );
  assert.equal(mapToContainer(999999, mappings), 65534, 'Unmapped host UID maps to overflow UID');
});

test('gotcha: rootless bind mount UID mismatch without --userns=keep-id', () => {
  // Scenario: Developer on host (UID 1000) bind-mounts a workspace folder into a rootless container.
  // The container runs an unprivileged application as container UID 1000 (e.g. node / nonroot).
  const defaultRootlessMap = generateRootlessUidMap({
    hostUid: 1000,
    subuidStart: 100000,
    subuidCount: 65536,
    mode: 'default',
  });

  // When container UID 1000 writes a file to the bind mount:
  const hostFileOwnerUid = mapToHost(1000, defaultRootlessMap);
  assert.equal(
    hostFileOwnerUid,
    100999,
    'Without keep-id, files created by container user 1000 are owned on the host by subuid 100999!',
  );
  assert.notEqual(
    hostFileOwnerUid,
    1000,
    'Host user 1000 cannot edit or git commit files written by container without permission errors',
  );

  // Solution: In Podman with --userns=keep-id
  const keepIdMap = generateRootlessUidMap({
    hostUid: 1000,
    subuidStart: 100000,
    subuidCount: 65536,
    mode: 'keep-id',
  });
  const hostFileOwnerWithKeepId = mapToHost(1000, keepIdMap);
  assert.equal(
    hostFileOwnerWithKeepId,
    1000,
    'With --userns=keep-id, container UID 1000 maps exactly to host UID 1000, eliminating bind-mount ownership conflicts',
  );
});

test('gotcha: shell-form ENTRYPOINT ignores SIGTERM, triggering 10s grace timeout and SIGKILL exit 137', () => {
  // Shell form: ENTRYPOINT /entrypoint.sh -> PID 1 is /bin/sh, app is PID 2
  const tree = new ContainerProcessTree('shell-form');

  assert.equal(tree.processes.get(1)?.name, '/bin/sh');
  assert.equal(tree.processes.get(2)?.name, 'node-app');

  // docker stop sends SIGTERM to PID 1
  const result = tree.simulateStopTimeout(10);

  assert.equal(
    result.exitCode,
    137,
    'Container exited with 137 due to unhandled SIGTERM followed by SIGKILL',
  );
  assert.ok(
    tree.gracePeriodExpired,
    'Daemon grace period expired because shell did not forward signal',
  );
  assert.ok(result.reason.includes('SIGTERM ignored by PID 1'));
});

test('exec-form ENTRYPOINT receives SIGTERM directly and exits cleanly with 0', () => {
  // Exec form: ENTRYPOINT ["node", "server.js"] -> PID 1 is node
  const tree = new ContainerProcessTree('exec-form');

  assert.equal(tree.processes.get(1)?.name, 'node-app');

  const result = tree.simulateStopTimeout(10);
  assert.equal(result.exitCode, 0, 'App handled SIGTERM gracefully and exited cleanly with code 0');
  assert.equal(tree.gracePeriodExpired, false);
});

test('gotcha: zombie accumulation without init vs zombie reaping with tini (--init)', () => {
  // 1. Without init (shell form): orphaned processes cannot be reaped
  const treeWithoutInit = new ContainerProcessTree('shell-form');
  // Child spawns grandchild worker
  const workerPid = treeWithoutInit.spawn(2, 'worker-task');
  // Parent app (PID 2) exits, reparenting worker to PID 1 (/bin/sh)
  treeWithoutInit.exit(2, 0);
  // Worker finishes and exits as an orphan
  treeWithoutInit.exit(workerPid, 0);

  const reapedWithoutInit = treeWithoutInit.reapZombies();
  assert.equal(
    reapedWithoutInit.length,
    0,
    'Shell does not act as subreaper for orphaned grandchildren',
  );
  assert.equal(
    treeWithoutInit.processes.get(workerPid)?.isZombie,
    true,
    'Zombie accumulates in process table',
  );

  // 2. With --init / tini
  const treeWithInit = new ContainerProcessTree('tini-init');
  assert.equal(treeWithInit.processes.get(1)?.name, 'tini');
  const workerPid2 = treeWithInit.spawn(2, 'worker-task');
  // Parent app (PID 2) exits, reparenting worker to PID 1 (tini)
  treeWithInit.exit(2, 0);
  // Worker finishes and exits as an orphan
  treeWithInit.exit(workerPid2, 0);

  const reapedWithInit = treeWithInit.reapZombies();
  assert.deepEqual(
    reapedWithInit.sort(),
    [2, workerPid2].sort(),
    'Tini reaps both exited app and orphaned zombie processes successfully',
  );
  assert.equal(treeWithInit.processes.has(workerPid2), false, 'Zombie removed from process table');
});

test('property-based test: user ID mappings within allocation range are bijective and monotonic', () => {
  const mappings = [
    { containerId: 0, hostId: 1000, length: 1 },
    { containerId: 1, hostId: 100000, length: 1000 },
  ];

  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1000 }), (containerUid) => {
      const hostUid = mapToHost(containerUid, mappings);
      const mappedBack = mapToContainer(hostUid, mappings);
      assert.equal(
        mappedBack,
        containerUid,
        'Bidirectional mapping must preserve identity within mapped range',
      );
    }),
  );
});
