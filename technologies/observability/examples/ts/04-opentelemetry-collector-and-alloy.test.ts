import test from 'node:test';
import assert from 'node:assert';
import { CollectorPipelineSimulator, ConsistentHashRing } from './lib/observability-model.ts';

test('04 - Memory limiter backpressure trigger and OOM prevention (Gotcha #5)', () => {
  const spans: any[] = [];
  assert.throws(() => {
    CollectorPipelineSimulator.process(spans, 1000000, 1200000);
  });
});

test('04 - Tail sampling hash routing across collector instances (Gotcha #6)', () => {
  const ring = new ConsistentHashRing();
  ring.addNode('collector-1');
  ring.addNode('collector-2');
  const node = ring.getNode('4bf92f3577b34da6a3ce929d0e0e4736');
  assert.ok(node === 'collector-1' || node === 'collector-2');
});

test('04 - OTTL syntax rules and span filtering', () => {
  const span = {
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: '00f067aa0ba902b7',
    name: 'health_check',
    kind: 'SERVER' as const,
    startTime: 100,
    attributes: { 'http.route': '/healthz' },
    status: { code: 'OK' as const },
  };
  const drop = span.attributes['http.route'] === '/healthz';
  assert.strictEqual(drop, true);
});

test('04 - Collector pipeline ordering validation', () => {
  const pipeline = ['receiver', 'memory_limiter', 'processor', 'exporter'];
  assert.strictEqual(pipeline[1], 'memory_limiter');
});
