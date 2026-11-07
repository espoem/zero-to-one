import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
describe('modifiers', () => {
  test('runs', () => assert.ok(true));
  test('skipped', { skip: 'not on this platform' }, () => assert.fail('never'));
  test('todo', { todo: 'write me' }, () => assert.fail('todo failures do not fail the run'));
  test.only('only', () => assert.ok(true));
});
