import { test } from 'node:test';
import assert from 'node:assert/strict';
test('a sets a global', () => { globalThis.SHARED = (globalThis.SHARED ?? 0) + 1; assert.ok(true); });
