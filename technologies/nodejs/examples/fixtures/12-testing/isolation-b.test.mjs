import { test } from 'node:test';
test('b reports the global', () => { console.log(`SHARED=${globalThis.SHARED ?? 'unset'}`); });
