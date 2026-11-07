import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
test('mock.module replaces a dependency before it is imported', async () => {
  const m = mock.module('./clock.mjs', { exports: { now: () => 'frozen' } });
  const { greet } = await import('./greeter.mjs');
  assert.equal(greet('Ada'), 'hello Ada at frozen');
  m.restore();
});
