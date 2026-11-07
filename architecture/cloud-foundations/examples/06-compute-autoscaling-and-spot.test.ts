import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Module 06: Compute Models & Autoscaling', () => {
  it('handles 2-minute spot/preemptible interruption notice window', () => {
    interface SpotInstanceLifecycle {
      instanceId: string;
      interruptionNoticeReceived: boolean;
      timeRemainingSeconds: number;
      drainingStatus: 'PENDING' | 'DRAINING' | 'TERMINATED';
    }

    function processInterruptionNotice(instance: SpotInstanceLifecycle): SpotInstanceLifecycle {
      if (instance.interruptionNoticeReceived) {
        return {
          ...instance,
          timeRemainingSeconds: 120, // 2 minutes notice on AWS Spot / 30 seconds on GCP Preemptible
          drainingStatus: 'DRAINING',
        };
      }
      return instance;
    }

    const instance: SpotInstanceLifecycle = {
      instanceId: 'i-spot-12345',
      interruptionNoticeReceived: true,
      timeRemainingSeconds: 0,
      drainingStatus: 'PENDING',
    };

    const updated = processInterruptionNotice(instance);
    assert.equal(updated.drainingStatus, 'DRAINING');
    assert.equal(updated.timeRemainingSeconds, 120);
  });

  it('demonstrates cold start vs warm execution in FaaS concurrency models', () => {
    interface InvocationMetrics {
      isColdStart: boolean;
      initDurationMs: number;
      executionDurationMs: number;
    }

    function totalLatency(m: InvocationMetrics): number {
      return (m.isColdStart ? m.initDurationMs : 0) + m.executionDurationMs;
    }

    const coldInvocation: InvocationMetrics = {
      isColdStart: true,
      initDurationMs: 450,
      executionDurationMs: 25,
    };
    const warmInvocation: InvocationMetrics = {
      isColdStart: false,
      initDurationMs: 0,
      executionDurationMs: 22,
    };

    assert.equal(totalLatency(coldInvocation), 475);
    assert.equal(totalLatency(warmInvocation), 22);
  });
});
