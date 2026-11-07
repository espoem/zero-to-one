import test from 'node:test';
import assert from 'node:assert';
import { AsyncLocalStorage } from 'node:async_hooks';

test('03 - AsyncLocalStorage context propagation across promises', async () => {
  const als = new AsyncLocalStorage<{ traceId: string }>();
  await als.run({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736' }, async () => {
    const store = als.getStore();
    assert.strictEqual(store?.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
    await Promise.resolve();
    const storeAfter = als.getStore();
    assert.strictEqual(storeAfter?.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  });
});

test('03 - Log formatter correlation with trace ID', () => {
  const formatLog = (msg: string, traceId?: string) =>
    JSON.stringify({ message: msg, trace_id: traceId });
  const log = JSON.parse(formatLog('test error', '4bf92f3577b34da6a3ce929d0e0e4736'));
  assert.strictEqual(log.trace_id, '4bf92f3577b34da6a3ce929d0e0e4736');
});

test('03 - Missing span.end() exception path simulation', () => {
  let ended = false;
  const doWork = () => {
    try {
      throw new Error('fail');
    } finally {
      // simulating missing span.end() in catch block
    }
  };
  assert.throws(doWork);
  assert.strictEqual(ended, false);
});

test('03 - Manual span creation and attribute setting', () => {
  const span = { name: 'manual-span', attributes: {} as Record<string, any> };
  span.attributes['user.id'] = 'user_999';
  assert.strictEqual(span.attributes['user.id'], 'user_999');
});
