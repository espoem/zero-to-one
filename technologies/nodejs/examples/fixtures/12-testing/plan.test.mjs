import { test } from 'node:test';
test('plan with wait: an assertion made later still counts', (t) => {
  t.plan(2, { wait: true });
  t.assert.ok(true);
  setTimeout(() => t.assert.ok(true), 1); // asynchronous assertion still counted
});
test('plan violated: a callback assertion after the test returned does not count', (t) => {
  t.plan(2);
  t.assert.ok(true);
  setTimeout(() => t.assert.ok(true), 1);
});
