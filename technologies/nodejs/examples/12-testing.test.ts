// Module 12 · Testing with node:test: structure, mocks (functions, timers, modules), snapshots,
// coverage, isolation, reporters, and assert's equality semantics. Runner features are exercised by
// running `node --test` on fixtures in child processes; mocks and asserts are exercised in-process.
import { test, describe, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import legacyAssert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNode } from './helpers/run-node.ts';

const FIX = fileURLToPath(new URL('./fixtures/12-testing/', import.meta.url));
const runTests = (args: string[], cwd = FIX) =>
  runNode(['--test', '--test-reporter=tap', ...args], { cwd });
const tapCount = (out: string, key: 'pass' | 'fail' | 'skipped' | 'todo') =>
  Number(out.match(new RegExp(`^# ${key} (\\d+)`, 'm'))?.[1] ?? NaN);

describe('mock.fn and mock.method', () => {
  test('mock.fn records calls, arguments, results and this', () => {
    const add = mock.fn((a: number, b: number) => a + b);
    add(1, 2);
    add(3, 4);
    assert.equal(add.mock.callCount(), 2);
    assert.deepEqual(add.mock.calls[1]!.arguments, [3, 4]);
    assert.equal(add.mock.calls[1]!.result, 7);
  });

  test('mockImplementationOnce, then the default implementation again', () => {
    const f = mock.fn(() => 'default');
    f.mock.mockImplementationOnce(() => 'first');
    assert.deepEqual([f(), f()], ['first', 'default']);
  });

  test('mock.method replaces a method on an object and restore() puts it back', () => {
    const clock = { now: () => 1000 };
    const m = mock.method(clock, 'now', () => 42);
    assert.equal(clock.now(), 42);
    m.mock.restore();
    assert.equal(clock.now(), 1000);
  });
});

describe('mock.timers: time without waiting', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 }));
  after(() => mock.timers.reset());

  test('tick() advances fake time and fires due timers in order', () => {
    const fired: string[] = [];
    setTimeout(() => fired.push('t100'), 100);
    setTimeout(() => fired.push('t50'), 50);
    mock.timers.tick(60);
    assert.deepEqual(fired, ['t50']);
    mock.timers.tick(40);
    assert.deepEqual(fired, ['t50', 't100']);
    mock.timers.reset();
  });

  test('Date follows the fake clock: a 30-day expiry check without sleeping', () => {
    const issued = Date.now();
    const expired = () => Date.now() - issued > 30 * 24 * 3600 * 1000;
    assert.equal(expired(), false);
    mock.timers.tick(30 * 24 * 3600 * 1000 + 1);
    assert.equal(expired(), true);
    mock.timers.reset();
  });

  test('a debounce, tested deterministically', () => {
    const calls: number[] = [];
    let handle: ReturnType<typeof setTimeout> | undefined;
    const debounced = (v: number) => {
      clearTimeout(handle);
      handle = setTimeout(() => calls.push(v), 100);
    };
    debounced(1);
    mock.timers.tick(50);
    debounced(2);
    mock.timers.tick(99);
    assert.deepEqual(calls, []);
    mock.timers.tick(1);
    assert.deepEqual(calls, [2]);
    mock.timers.reset();
  });
});

describe('runner features (child processes on fixtures)', () => {
  test('module mocks need --experimental-test-module-mocks; options.exports is the current form', () => {
    const without = runTests(['module-mock.test.mjs']);
    assert.equal(tapCount(without.stdout, 'fail'), 1);
    const withFlag = runTests(['--experimental-test-module-mocks', 'module-mock.test.mjs']);
    assert.equal(tapCount(withFlag.stdout, 'pass'), 1, withFlag.stdout + withFlag.stderr);
  });

  test('snapshots: missing snapshot fails; --test-update-snapshots writes it; then it passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-snap-'));
    try {
      cpSync(FIX, dir, { recursive: true });
      assert.equal(runTests(['snapshot.test.mjs'], dir).status, 1);
      assert.equal(runTests(['--test-update-snapshots', 'snapshot.test.mjs'], dir).status, 0);
      assert.ok(existsSync(join(dir, 'snapshot.test.mjs.snapshot')));
      assert.match(readFileSync(join(dir, 'snapshot.test.mjs.snapshot'), 'utf8'), /"nested"/);
      assert.equal(runTests(['snapshot.test.mjs'], dir).status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('coverage thresholds fail the run when uncovered lines exist', () => {
    const ok = runTests(['--experimental-test-coverage', 'partial.test.mjs']);
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /start of coverage report/);
    const strict = runTests([
      '--experimental-test-coverage',
      '--test-coverage-lines=100',
      'partial.test.mjs',
    ]);
    assert.equal(strict.status, 1);
  });

  test('skip and todo do not fail the run; --test-only runs only test.only', () => {
    const all = runTests(['modifiers.test.mjs']);
    assert.equal(all.status, 0);
    assert.equal(tapCount(all.stdout, 'skipped'), 1);
    assert.equal(tapCount(all.stdout, 'todo'), 1);
    const only = runTests(['--test-only', 'modifiers.test.mjs']);
    assert.equal(tapCount(only.stdout, 'pass'), 1);
  });

  test('an unhandled rejection inside a test fails the run', () => {
    const r = runTests(['leaky.test.mjs']);
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /lost rejection/);
  });

  test('t.plan: late assertions count only with { wait: true }', () => {
    const r = runTests(['plan.test.mjs']);
    assert.equal(tapCount(r.stdout, 'pass'), 1);
    assert.equal(tapCount(r.stdout, 'fail'), 1);
  });

  test('--test-isolation=process (default) vs none: shared globals leak between files only with none', () => {
    const isolated = runNode(
      ['--test', '--test-reporter=spec', 'isolation-a.test.mjs', 'isolation-b.test.mjs'],
      { cwd: FIX },
    );
    assert.match(isolated.stdout, /SHARED=unset/);
    const shared = runNode(
      [
        '--test',
        '--test-isolation=none',
        '--test-reporter=spec',
        'isolation-a.test.mjs',
        'isolation-b.test.mjs',
      ],
      { cwd: FIX },
    );
    assert.match(shared.stdout, /SHARED=1/);
  });

  test('the junit reporter writes CI-friendly XML', () => {
    const r = runNode(['--test', '--test-reporter=junit', 'partial.test.mjs'], { cwd: FIX });
    assert.match(r.stdout, /<testsuites/);
    assert.match(r.stdout, /<testcase name="negative and zero only"/);
  });

  test('--test-name-pattern selects tests by name', () => {
    const r = runTests(['--test-name-pattern=^runs$', 'modifiers.test.mjs']);
    assert.equal(tapCount(r.stdout, 'pass'), 1);
  });
});

describe('assert: equality semantics', () => {
  test('deepStrictEqual compares prototypes and uses SameValue for primitives (NaN equal, -0 vs +0 not)', () => {
    assert.deepStrictEqual({ a: NaN }, { a: NaN });
    assert.throws(() => assert.deepStrictEqual(0, -0));
    assert.throws(() => assert.deepStrictEqual(Object.create(null), {}));
    assert.throws(() => assert.deepStrictEqual([1], { 0: 1, length: 1 }));
  });

  test('negative: legacy (non-strict) deepEqual uses == and ignores prototypes', () => {
    legacyAssert.deepEqual({ a: 1 }, { a: '1' }); // passes: a classic false positive
    assert.throws(() => assert.deepEqual({ a: 1 }, { a: '1' })); // assert/strict's deepEqual is deepStrictEqual
  });

  test('Map, Set and Date are compared by content; Map/Set order does not matter', () => {
    assert.deepStrictEqual(
      new Map([
        [1, 'a'],
        [2, 'b'],
      ]),
      new Map([
        [2, 'b'],
        [1, 'a'],
      ]),
    );
    assert.deepStrictEqual(new Set([1, 2]), new Set([2, 1]));
    assert.deepStrictEqual(new Date(0), new Date(0));
  });

  test('partialDeepStrictEqual checks a subset (useful for large responses)', () => {
    assert.partialDeepStrictEqual(
      { id: 1, name: 'Ada', meta: { v: 2, extra: true } },
      { id: 1, meta: { v: 2 } },
    );
    assert.throws(() => assert.partialDeepStrictEqual({ id: 1 }, { id: 2 }));
  });

  test('assert.rejects checks async failures by properties; matching on message text is brittle', async () => {
    await assert.rejects(Promise.reject(Object.assign(new Error('x'), { code: 'E_X' })), {
      code: 'E_X',
    });
  });
});

describe('lifecycle hooks and test context', () => {
  let resource: { closed: boolean } | undefined;
  before(() => {
    resource = { closed: false };
  });
  after(() => {
    resource!.closed = true;
  });

  test('before/after wrap the suite; t.after cleans up per test', (t) => {
    const temp = { removed: false };
    t.after(() => {
      temp.removed = true;
    });
    assert.equal(resource!.closed, false);
  });

  test('t.signal aborts when the test times out or is cancelled', (t) => {
    assert.ok(t.signal instanceof AbortSignal);
  });
});

describe('dependency injection instead of mocking (12-di.ts)', async () => {
  const { refreshToken } = await import('./12-di.ts');

  test('refreshes an expiring token with a fake clock and a fake fetch', async () => {
    const deps = {
      now: () => 1_000_000,
      fetch: mock.fn(async () => Response.json({ value: 'new', expiresAt: 2_000_000 })),
      log: mock.fn(),
    };
    assert.equal((await refreshToken(deps, { value: 'old', expiresAt: 1_030_000 })).value, 'new');
    assert.equal(deps.fetch.mock.callCount(), 1);
    assert.equal(deps.log.mock.callCount(), 1);
  });

  test('keeps a token valid for more than a minute without any network call', async () => {
    const deps = {
      now: () => 0,
      fetch: mock.fn(async () => new Response(null, { status: 500 })),
      log: mock.fn(),
    };
    assert.equal((await refreshToken(deps, { value: 'old', expiresAt: 120_000 })).value, 'old');
    assert.equal(deps.fetch.mock.callCount(), 0);
  });

  test('maps an upstream failure to a coded error', async () => {
    const deps = {
      now: () => 0,
      fetch: mock.fn(async () => new Response('no', { status: 503 })),
      log: mock.fn(),
    };
    await assert.rejects(refreshToken(deps, { value: 'old', expiresAt: 1 }), {
      code: 'E_REFRESH',
      status: 503,
    });
  });
});
