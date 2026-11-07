// Module 04: Pods, Workloads, Probes, Rollouts, and Graceful Termination
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PodProbeStateMachine,
  simulateTerminationRace,
  calculateRolloutBounds,
} from './lib/kubernetes-model.ts';

test('probe state machine: startup probe gates liveness and readiness until success', () => {
  const machine = new PodProbeStateMachine(true, { failureThreshold: 3 });

  // Startup failing: liveness failures do not trigger restart yet
  machine.stepProbe('startup', false);
  const livenessResult = machine.stepProbe('liveness', false);
  assert.equal(livenessResult.restarted, false);
  assert.equal(machine.isReady, false);

  // Startup succeeds
  machine.stepProbe('startup', true);
  assert.equal(machine.startupPassed, true);

  // Readiness succeeds
  const readyResult = machine.stepProbe('readiness', true);
  assert.equal(readyResult.ready, true);
});

test('negative test: liveness probe checking external DB causes cascading restarts across replicas during a DB outage', () => {
  const replicas = 5;
  const podProbes = Array.from(
    { length: replicas },
    () => new PodProbeStateMachine(false, { failureThreshold: 3 }),
  );

  // Simulate external database downtime for 3 probe cycles
  let totalRestarts = 0;
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const probe of podProbes) {
      const res = probe.stepProbe('liveness', false); // DB ping fails
      if (res.restarted) totalRestarts++;
    }
  }

  // All 5 replicas crashed and entered restart loop simultaneously!
  assert.equal(totalRestarts, replicas);
  for (const probe of podProbes) {
    assert.equal(probe.restartCount, 1);
    assert.equal(probe.isReady, false);
  }
});

test('negative test: pod termination without preStop sleep causes 502 Bad Gateway race condition', () => {
  // Ingress controller / kube-proxy takes 3s to remove pod from iptables/endpoints
  const withoutPreStop = simulateTerminationRace({
    hasPreStopSleep: false,
    preStopDurationSeconds: 0,
    endpointRemovalDelaySeconds: 3,
  });

  assert.equal(withoutPreStop.finalStatus, '502-bad-gateway-race');
  assert.ok(withoutPreStop.droppedRequests > 0);

  // With preStop: sleep 5, container stays alive until endpoints are fully removed
  const withPreStop = simulateTerminationRace({
    hasPreStopSleep: true,
    preStopDurationSeconds: 5,
    endpointRemovalDelaySeconds: 3,
  });

  assert.equal(withPreStop.finalStatus, 'clean-zero-downtime');
  assert.equal(withPreStop.droppedRequests, 0);
});

test('deployment rollout bounds respect maxSurge and maxUnavailable constraints', () => {
  // Replicas: 8, maxSurge: 25% (2 pods), maxUnavailable: 25% (2 pods)
  const bounds = calculateRolloutBounds(8, '25%', '25%');

  assert.equal(bounds.surgeCount, 2);
  assert.equal(bounds.unavailableCount, 2);
  assert.equal(bounds.maxAllowedPods, 10); // 8 + 2
  assert.equal(bounds.minAvailablePods, 6); // 8 - 2

  // Zero-downtime strict rollout: maxUnavailable = 0, maxSurge = 1
  const strict = calculateRolloutBounds(4, 1, 0);
  assert.equal(strict.maxAllowedPods, 5);
  assert.equal(strict.minAvailablePods, 4);
});
