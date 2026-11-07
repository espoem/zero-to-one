// Module 10: Docker versus Podman, Buildah, and Skopeo: Daemonless Architecture, Pods, and Quadlet
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  validateDockerApiVersion,
  validatePodmanDatabase,
  simulateEngineCrashImpact,
  createPodNamespaceTopology,
} from './lib/containers-model.ts';

test('daemon vs daemonless architecture: failure of daemon stops all containers vs conmon isolation', () => {
  const dockerDefaultCrash = simulateEngineCrashImpact('docker-without-live-restore');
  const dockerLiveRestoreCrash = simulateEngineCrashImpact('docker-with-live-restore');
  const podmanCrash = simulateEngineCrashImpact('podman');

  assert.equal(dockerDefaultCrash.daemonDied, true);
  assert.equal(dockerDefaultCrash.containersSurvive, false);
  assert.equal(dockerDefaultCrash.hasSinglePointOfFailure, true);

  assert.equal(dockerLiveRestoreCrash.daemonDied, true);
  assert.equal(dockerLiveRestoreCrash.containersSurvive, true);

  assert.equal(podmanCrash.daemonDied, false);
  assert.equal(podmanCrash.containersSurvive, true);
  assert.equal(podmanCrash.hasSinglePointOfFailure, false);
  assert.equal(podmanCrash.processMonitor, 'conmon');
});

test('pod concept: containers within a pod share network, IPC, and UTS namespaces', () => {
  const topology = createPodNamespaceTopology('web-pod', [
    { name: 'nginx-ingress', port: 8080 },
    { name: 'node-app' },
  ]);

  assert.ok(topology.sharedNamespaces.includes('net'));
  assert.ok(topology.sharedNamespaces.includes('ipc'));
  assert.ok(topology.sharedNamespaces.includes('uts'));
  assert.ok(topology.isolatedNamespaces.includes('pid'));
  assert.equal(topology.infraContainer.holdsNamespaces, true);

  // Because they share network namespace, containers communicate over localhost
  const ingress = topology.containers[0]!;
  const nodeApp = topology.containers[1]!;
  assert.equal(nodeApp.canLoopbackReach(ingress.port!), '127.0.0.1:8080');
});

test('gotcha: Docker 29 raised minimum API version to 1.44, rejecting legacy clients', () => {
  // Legacy client (e.g. older Testcontainers or docker-py requesting API 1.41)
  const legacyClientReq = validateDockerApiVersion('1.41');
  assert.equal(legacyClientReq.supported, false);
  assert.equal(legacyClientReq.minApi, '1.44');
  assert.ok(legacyClientReq.error?.includes('client version 1.41 is too old'));
  assert.ok(legacyClientReq.error?.includes('Minimum supported API version is 1.44'));

  // Another older client requesting 1.43
  const v143Req = validateDockerApiVersion('1.43');
  assert.equal(v143Req.supported, false);

  // Modern client requesting 1.44 or 1.48
  const modernReq = validateDockerApiVersion('1.44');
  assert.equal(modernReq.supported, true);
  assert.equal(modernReq.error, undefined);

  const latestReq = validateDockerApiVersion('1.48');
  assert.equal(latestReq.supported, true);
});

test('gotcha: Podman 6.0 removed BoltDB database backend; direct upgrade without SQLite migration fails', () => {
  // Scenario: System administrator upgrades directly from Podman 5.x with BoltDB to Podman 6.x
  const podman6WithBoltDb = validatePodmanDatabase('boltdb', 6);
  assert.equal(podman6WithBoltDb.valid, false);
  assert.ok(podman6WithBoltDb.error?.includes('completely removed BoltDB'));
  assert.ok(podman6WithBoltDb.error?.includes('migrate state to SQLite via Podman 5.8'));

  // With migrated SQLite database
  const podman6WithSqlite = validatePodmanDatabase('sqlite', 6);
  assert.equal(podman6WithSqlite.valid, true);
  assert.equal(podman6WithSqlite.error, undefined);
});

test('property-based test: Docker API validator correctly partitions versions around 1.44 threshold', () => {
  fc.assert(
    fc.property(fc.float({ min: 1.0, max: 2.0, noNaN: true }), (ver) => {
      const verStr = ver.toFixed(2);
      const numericVer = parseFloat(verStr);
      const res = validateDockerApiVersion(verStr);
      if (numericVer < 1.44) {
        assert.equal(res.supported, false);
        assert.ok(res.error !== undefined);
      } else {
        assert.equal(res.supported, true);
        assert.equal(res.error, undefined);
      }
    }),
  );
});
