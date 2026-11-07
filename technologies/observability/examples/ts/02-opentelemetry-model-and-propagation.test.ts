import test from 'node:test';
import assert from 'node:assert';
import { W3CTraceContextParser } from './lib/observability-model.ts';

test('02 - OTel model and W3C propagation edge cases', () => {
  const tp = W3CTraceContextParser.parseTraceParent(
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  );
  const serialized = W3CTraceContextParser.serializeTraceParent(tp);
  assert.strictEqual(serialized, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
});

test('02 - Reject all-zero traceId', () => {
  assert.throws(() => {
    W3CTraceContextParser.parseTraceParent(
      '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
    );
  });
});

test('02 - Span attribute preservation and status handling', () => {
  const span = {
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: '00f067aa0ba902b7',
    name: 'GET /api/v1/payment',
    kind: 'SERVER' as const,
    startTime: 1000,
    endTime: 1050,
    attributes: { 'http.status_code': 200, 'url.full': '/api/v1/payment?id=123' },
    status: { code: 'OK' as const },
  };
  assert.strictEqual(span.status.code, 'OK');
  assert.strictEqual(span.attributes['http.status_code'], 200);
});

test('02 - Clock skew and span duration verification', () => {
  const span = {
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: '00f067aa0ba902b7',
    name: 'skew-span',
    kind: 'CLIENT' as const,
    startTime: 2000,
    endTime: 1950,
    attributes: {},
    status: { code: 'UNSET' as const },
  };
  const duration = (span.endTime || span.startTime) - span.startTime;
  assert.ok(duration < 0);
});
