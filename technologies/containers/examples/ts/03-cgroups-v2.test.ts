// Module 03: Control Groups v2: Unified Hierarchy, Resource Controllers, PSI, and OOM Mechanics
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  createCgroupV2Tree,
  enableSubtreeController,
  parseCpuMax,
  calculateEffectiveCores,
  evaluateCpuThrottling,
  MemoryCgroupController,
} from './lib/containers-model.ts';

test('cgroups v2 unified hierarchy enforces "no internal processes" constraint in non-root groups', () => {
  const root = createCgroupV2Tree();
  // Root can enable controllers into subtree_control
  const rootRes = enableSubtreeController(root, 'memory');
  assert.equal(rootRes.success, true);

  // Create child cgroup /docker/container-a
  const containerGroup = {
    path: '/docker/container-a',
    controllers: new Set(['cpu', 'memory', 'io']),
    subtreeControl: new Set<string>(),
    procs: new Set<number>([1234]), // Has active process in cgroup.procs
    children: new Map(),
  };

  // Attempting to enable subtree_control while containing processes must fail with EBUSY
  const failRes = enableSubtreeController(containerGroup, 'cpu');
  assert.equal(failRes.success, false);
  assert.ok(failRes.error?.includes('EBUSY'));
  assert.ok(failRes.error?.includes('internal process constraint violated'));

  // Once process moves to a leaf node or exits:
  containerGroup.procs.clear();
  const okRes = enableSubtreeController(containerGroup, 'cpu');
  assert.equal(okRes.success, true);
});

test('cpu.max CFS quota and period parsing calculates fractional and unlimited core budgets', () => {
  const halfCore = parseCpuMax('50000 100000');
  assert.equal(calculateEffectiveCores(halfCore), 0.5);

  const fourCores = parseCpuMax('400000 100000');
  assert.equal(calculateEffectiveCores(fourCores), 4.0);

  const unlimited = parseCpuMax('max 100000');
  assert.equal(calculateEffectiveCores(unlimited), Number.POSITIVE_INFINITY);
});

test('gotcha: cgroup-unaware runtimes spawn excessive threads causing CFS CPU quota throttling', () => {
  // Scenario: Container has quota 100ms per 100ms period (1 core).
  // An older Go / Java runtime detects 32 host CPU cores in /proc/cpuinfo and spawns 32 active worker threads.
  // In a single 100ms period, 32 threads request 800ms of CPU compute.
  const oneCoreConfig = { quota: 100000, period: 100000 };
  const requestedComputeUs = 800000; // 800ms compute requested across 32 threads

  const throttle = evaluateCpuThrottling(oneCoreConfig, requestedComputeUs);

  assert.equal(throttle.throttled, true);
  assert.equal(throttle.periods, 8, '8 periods required to fulfill the 800ms workload');
  assert.equal(
    throttle.throttledPeriods,
    7,
    '7 out of 8 periods will suffer CFS throttling pauses',
  );
  assert.equal(
    throttle.throttledTimeUs,
    700000,
    'Process is paused for 700ms out of 800ms wall time!',
  );
});

test('gotcha: exit code 137 does not always mean OOM; verify memory.events oom_kill', () => {
  // Case A: Container terminated due to Memory OOM Killer
  const memCgroup = new MemoryCgroupController(256 * 1024 * 1024); // 256MB
  const allocRes = memCgroup.allocate(512 * 1024 * 1024); // Attempt to allocate 512MB

  assert.equal(allocRes.success, false);
  assert.equal(allocRes.oomKilled, true);
  assert.equal(allocRes.exitCode, 137, 'OOM-killed process receives SIGKILL (128 + 9 = 137)');
  assert.equal(memCgroup.oomKills, 1, 'memory.events oom_kill counter is incremented');

  // Case B: Container terminated due to docker stop 10s grace timeout (e.g. shell-form entrypoint)
  const stopTimeoutExitCode = 137;
  const dockerInspectState = {
    ExitCode: stopTimeoutExitCode,
    OOMKilled: false, // NOT OOM killed!
    Status: 'exited',
  };

  assert.equal(stopTimeoutExitCode, allocRes.exitCode, 'Both scenarios produce exit code 137');
  assert.notEqual(
    dockerInspectState.OOMKilled,
    allocRes.oomKilled,
    'Operators must inspect State.OOMKilled / memory.events to avoid misdiagnosing timeout as OOM',
  );
});

test('gotcha: cgroup-unaware runtime sizing heap to host RAM causes immediate OOM kill', () => {
  const containerMemoryLimitBytes = 512 * 1024 * 1024; // 512 MB
  const hostPhysicalRamBytes = 64 * 1024 * 1024 * 1024; // 64 GB

  const cgroup = new MemoryCgroupController(containerMemoryLimitBytes);

  // Unaware runtime sizes default heap to 25% of host RAM: 16 GB!
  const naiveInitialHeapBytes = hostPhysicalRamBytes * 0.25;

  const result = cgroup.allocate(naiveInitialHeapBytes);
  assert.equal(result.oomKilled, true);
  assert.equal(result.exitCode, 137);
  assert.equal(cgroup.oomKills, 1);

  // Aware runtime reads /sys/fs/cgroup/memory.max and bounds heap to e.g. 75% of container limit
  const awareHeapBytes = containerMemoryLimitBytes * 0.75;
  const cgroupAware = new MemoryCgroupController(containerMemoryLimitBytes);
  const awareResult = cgroupAware.allocate(awareHeapBytes);

  assert.equal(awareResult.success, true);
  assert.equal(awareResult.oomKilled, false);
  assert.equal(cgroupAware.oomKills, 0);
});

test('property-based test: CFS quota scaling maintains strict linearity with quota ratios', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 10000, max: 1000000 }),
      fc.integer({ min: 10000, max: 100000 }),
      (quota, period) => {
        const cores = calculateEffectiveCores({ quota, period });
        assert.equal(cores, quota / period);
        assert.ok(cores > 0);
      },
    ),
  );
});
