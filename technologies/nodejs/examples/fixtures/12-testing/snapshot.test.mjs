import { test } from 'node:test';
test('serialised shape is stable', (t) => {
  t.assert.snapshot({ id: 1, tags: ['a', 'b'], nested: { ok: true } });
});
