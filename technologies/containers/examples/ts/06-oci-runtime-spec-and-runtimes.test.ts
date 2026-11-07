// Module 06: OCI Runtime Specification and Runtimes: Bundles, Lifecycle, runc, crun, and Sandboxes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  OciRuntimeContainer,
  compareOciRuntimeMemoryFootprint,
  type RuntimeLifecycleState,
} from './lib/containers-model.ts';

test('OCI runtime bundle config.json specifies rootfs, process arguments, and namespaces', () => {
  const ociConfig = {
    ociVersion: '1.2.0',
    process: {
      terminal: false,
      user: { uid: 0, gid: 0 },
      args: ['node', 'server.js'],
      env: [
        'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        'NODE_ENV=production',
      ],
      cwd: '/app',
      noNewPrivileges: true,
    },
    root: {
      path: 'rootfs',
      readonly: true,
    },
    mounts: [
      { destination: '/proc', type: 'proc', source: 'proc' },
      {
        destination: '/dev',
        type: 'tmpfs',
        source: 'tmpfs',
        options: ['nosuid', 'strictatime', 'mode=755'],
      },
    ],
    linux: {
      namespaces: [
        { type: 'pid' },
        { type: 'network' },
        { type: 'ipc' },
        { type: 'uts' },
        { type: 'mount' },
      ],
    },
  };

  assert.equal(ociConfig.root.path, 'rootfs');
  assert.equal(ociConfig.process.args[0], 'node');
  assert.equal(ociConfig.process.noNewPrivileges, true);
  assert.equal(ociConfig.linux.namespaces.length, 5);
});

test('OCI container lifecycle state machine transitions from creating to stopped', () => {
  const container = new OciRuntimeContainer('test-container-1', '/var/run/bundles/c1');
  assert.equal(container.state, 'creating');

  // create bundle -> state = created
  container.create();
  assert.equal(container.state, 'created');
  assert.deepEqual(container.hooksRun, ['prestart', 'createRuntime', 'createContainer']);

  // start process -> state = running
  container.start();
  assert.equal(container.state, 'running');
  assert.ok(container.hooksRun.includes('startContainer'));

  // kill signal -> state = stopped
  container.kill('SIGTERM');
  assert.equal(container.state, 'stopped');
  assert.ok(container.hooksRun.includes('kill:SIGTERM'));

  // delete container
  container.delete();
  assert.equal(container.state, 'stopped');
  assert.ok(container.hooksRun.includes('poststop'));
});

test('invalid lifecycle transitions are rejected by OCI runtime', () => {
  const container = new OciRuntimeContainer('test-container-2', '/var/run/bundles/c2');
  container.create();
  container.start();

  // Cannot call start() again on an already running container
  assert.throws(() => container.start(), /must be in created state/);

  // Cannot delete a running container without force=true
  assert.throws(() => container.delete(false), /Cannot delete running container/);

  // Force delete succeeds
  container.delete(true);
  assert.equal(container.state, 'stopped');
});

test('runc vs crun runtime characteristics comparison', () => {
  const comparison = compareOciRuntimeMemoryFootprint();

  assert.equal(comparison.runc.binaryLanguage, 'Go');
  assert.equal(comparison.crun.binaryLanguage, 'C');
  assert.ok(comparison.crunIsLowerFootprint);
  assert.ok(comparison.crun.executableSizeBytes < comparison.runc.executableSizeBytes);
  assert.ok(
    comparison.crun.forkExecMemoryOverheadBytes < comparison.runc.forkExecMemoryOverheadBytes,
  );
  assert.ok(comparison.memorySavingsRatio >= 5);
  assert.ok(comparison.executableSizeRatio >= 5);
});

test('property-based test: valid state progression never reverses order', () => {
  const expectedOrder: RuntimeLifecycleState[] = ['creating', 'created', 'running', 'stopped'];

  fc.assert(
    fc.property(fc.constant(true), () => {
      const c = new OciRuntimeContainer('prop-test', '/tmp');
      const observed: RuntimeLifecycleState[] = [c.state];

      c.create();
      observed.push(c.state);

      c.start();
      observed.push(c.state);

      c.kill('SIGKILL');
      observed.push(c.state);

      assert.deepEqual(observed, expectedOrder);
    }),
  );
});
