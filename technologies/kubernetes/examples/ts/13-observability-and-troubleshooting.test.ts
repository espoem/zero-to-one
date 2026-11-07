// Module 13: Observability, Metrics API, and Pod Troubleshooting Playbook
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosePod, detectMutableLatestNodeSkew } from './lib/kubernetes-model.ts';

test('troubleshooting triage accurately diagnoses CrashLoopBackOff', () => {
  const pod = {
    status: {
      phase: 'Running',
      containerStatuses: [
        {
          ready: false,
          restartCount: 5,
          image: 'app:v1',
          state: {
            waiting: {
              reason: 'CrashLoopBackOff',
              message: 'back-off 5m0s restarting failed container',
            },
          },
        },
      ],
    },
  };

  const diagnosis = diagnosePod(pod);
  assert.equal(diagnosis.diagnosis, 'CrashLoopBackOff');
  assert.ok(diagnosis.rootCause.includes('crashing repeatedly'));
});

test('troubleshooting triage accurately diagnoses ImagePullBackOff', () => {
  const pod = {
    status: {
      phase: 'Pending',
      containerStatuses: [
        {
          ready: false,
          restartCount: 0,
          image: 'registry.corp.internal/missing:latest',
          state: {
            waiting: {
              reason: 'ImagePullBackOff',
              message: 'Back-off pulling image "registry.corp.internal/missing:latest"',
            },
          },
        },
      ],
    },
  };

  const diagnosis = diagnosePod(pod);
  assert.equal(diagnosis.diagnosis, 'ImagePullBackOff');
  assert.ok(diagnosis.rootCause.includes('Failed to pull container image'));
});

test('troubleshooting triage accurately diagnoses OOMKilled containers (exit code 137)', () => {
  const pod = {
    status: {
      phase: 'Running',
      containerStatuses: [
        {
          ready: false,
          restartCount: 2,
          image: 'memory-hog:v1',
          state: {
            terminated: {
              exitCode: 137,
              reason: 'OOMKilled',
            },
          },
        },
      ],
    },
  };

  const diagnosis = diagnosePod(pod);
  assert.equal(diagnosis.diagnosis, 'OOMKilled');
  assert.ok(diagnosis.rootCause.includes('exit code 137'));
  assert.ok(diagnosis.rootCause.includes('memory limit'));
});

test('troubleshooting triage accurately diagnoses Pending scheduling deadlock', () => {
  const pod = {
    status: {
      phase: 'Pending',
      conditions: [
        {
          type: 'PodScheduled',
          status: 'False',
          reason: 'Unschedulable',
        },
      ],
    },
  };

  const diagnosis = diagnosePod(pod);
  assert.equal(diagnosis.diagnosis, 'Pending');
  assert.ok(diagnosis.rootCause.includes('Scheduling failed'));
});

test('negative test: using :latest tag with imagePullPolicy: IfNotPresent causes node version skew', () => {
  const skew = detectMutableLatestNodeSkew('myapp:latest', 'IfNotPresent', {
    'node-1': 'sha256:aaaa1111',
    'node-2': 'sha256:bbbb2222',
  });
  assert.equal(skew.hasVersionSkew, true);
  assert.ok(skew.warning.includes('Node version skew detected'));
});
