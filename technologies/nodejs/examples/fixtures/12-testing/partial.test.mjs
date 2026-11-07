import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './greeter.mjs';
test('negative and zero only', () => {
  assert.equal(classify(-1), 'negative');
  assert.equal(classify(0), 'zero');
});
