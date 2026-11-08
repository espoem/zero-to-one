import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IsolateExecutionHarness, IsolateLimitExceededError } from './lib/edge-models.ts';

describe('Module 01 & 02: Edge Runtime & Isolate Lifecycle Limits', () => {
  it('allows execution within memory and CPU limits', () => {
    const harness = new IsolateExecutionHarness({ maxMemoryBytes: 128 * 1024 * 1024, maxCpuTimeMs: 10 });
    harness.allocate(32 * 1024 * 1024);
    harness.consumeCpu(4);

    const metrics = harness.getMetrics();
    assert.equal(metrics.allocatedBytes, 32 * 1024 * 1024);
    assert.equal(metrics.cpuTimeMs, 4);
  });

  it('rejects heap allocations exceeding 128 MB with Error 1102', () => {
    const harness = new IsolateExecutionHarness({ maxMemoryBytes: 128 * 1024 * 1024, maxCpuTimeMs: 10 });
    harness.allocate(100 * 1024 * 1024);

    assert.throws(
      () => {
        harness.allocate(30 * 1024 * 1024);
      },
      (err: unknown) => {
        assert(err instanceof IsolateLimitExceededError);
        assert.equal(err.code, 1102);
        assert(err.message.includes('Memory limit of 128 MB exceeded'));
        return true;
      },
    );
  });

  it('terminates execution when CPU time exceeds quota (Free tier 10ms)', () => {
    const harness = new IsolateExecutionHarness({ maxMemoryBytes: 128 * 1024 * 1024, maxCpuTimeMs: 10 });
    harness.consumeCpu(8);

    assert.throws(
      () => {
        harness.consumeCpu(3);
      },
      (err: unknown) => {
        assert(err instanceof IsolateLimitExceededError);
        assert.equal(err.code, 1102);
        assert(err.message.includes('CPU-time limit of 10 ms exceeded'));
        return true;
      },
    );
  });

  it('simulates waitUntil async work extending beyond response return', async () => {
    const backgroundTasks: string[] = [];
    let responseReturned = false;

    // Simulate Worker fetch handler and ctx.waitUntil
    const handleRequest = (ctx: { waitUntil: (p: Promise<void>) => void }) => {
      ctx.waitUntil(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            backgroundTasks.push(`completed-after-response:responseReturned=${responseReturned}`);
            resolve();
          }, 20);
        }),
      );
      return new Response('Edge Handled');
    };

    const pendingPromises: Promise<void>[] = [];
    const mockCtx = {
      waitUntil: (p: Promise<void>) => {
        pendingPromises.push(p);
      },
    };

    const res = handleRequest(mockCtx);
    responseReturned = true;
    assert.equal(await res.text(), 'Edge Handled');
    assert.equal(backgroundTasks.length, 0); // Not completed yet

    await Promise.all(pendingPromises);
    assert.equal(backgroundTasks.length, 1);
    assert.equal(backgroundTasks[0], 'completed-after-response:responseReturned=true');
  });
});
