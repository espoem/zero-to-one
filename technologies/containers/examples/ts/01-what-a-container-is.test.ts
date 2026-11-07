// Module 01: What a Container Is (and Isn't): Isolation Primitives, VMs, and the OCI Stack
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  CLONE_FLAGS,
  parseCloneFlags,
  formatCloneFlags,
  evaluateIsolationBoundary,
  resolveOciExecutionChain,
  type CloneFlagName,
} from './lib/containers-model.ts';

test('container vs VM isolation primitives: containers share host kernel while VMs run guest kernels', () => {
  const containerIsolation = evaluateIsolationBoundary('container');
  const vmIsolation = evaluateIsolationBoundary('virtual-machine');

  assert.equal(containerIsolation.kernelBoundary, 'shared-host-kernel');
  assert.equal(vmIsolation.kernelBoundary, 'isolated-guest-kernel-via-hypervisor');
  assert.equal(containerIsolation.hardwareVirtualizationRequired, false);
  assert.equal(vmIsolation.hardwareVirtualizationRequired, true);
  assert.equal(containerIsolation.syscallIsolationMechanism, 'namespaces-cgroups-seccomp');
  assert.equal(vmIsolation.syscallIsolationMechanism, 'hypervisor-vm-exit-trap');
  assert.notEqual(containerIsolation.kernelBoundary, vmIsolation.kernelBoundary);
  assert.ok(containerIsolation.startupLatencyMs < vmIsolation.startupLatencyMs);
  assert.ok(containerIsolation.memoryOverheadBytes < vmIsolation.memoryOverheadBytes);
});

test('OCI layered architectural stack flows deterministically from CLI to kernel runtimes', () => {
  const dockerExecution = resolveOciExecutionChain('docker');
  const podmanExecution = resolveOciExecutionChain('podman');

  assert.equal(dockerExecution.architecture, 'daemon-centric');
  assert.equal(podmanExecution.architecture, 'daemonless');
  assert.equal(dockerExecution.hasSinglePointOfFailure, true);
  assert.equal(podmanExecution.hasSinglePointOfFailure, false);

  assert.equal(dockerExecution.leafRuntime, 'runc');
  assert.equal(podmanExecution.leafRuntime, 'crun');

  assert.equal(dockerExecution.layers[dockerExecution.layers.length - 1]?.component, 'runc');
  assert.equal(podmanExecution.layers[podmanExecution.layers.length - 1]?.component, 'crun');

  assert.equal(dockerExecution.layers.length, 5);
  assert.equal(
    podmanExecution.layers.length,
    3,
    'Podman is daemonless and omits central daemon supervisor',
  );
});

test('property-based test: clone flag combinations preserve bitwise roundtrip identity', () => {
  const flagNames = Object.keys(CLONE_FLAGS) as CloneFlagName[];

  fc.assert(
    fc.property(fc.subarray(flagNames), (selectedFlags) => {
      const mask = formatCloneFlags(selectedFlags);
      const parsed = parseCloneFlags(mask);

      // Every selected flag must be parsed back
      for (const flag of selectedFlags) {
        assert.ok(parsed.includes(flag), `Expected ${flag} in parsed flags`);
      }
      assert.equal(parsed.length, selectedFlags.length);
    }),
  );
});
