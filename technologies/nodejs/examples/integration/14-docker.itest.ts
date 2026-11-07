// Integration tests for container-specific behaviour (module 14 §2, module 10 §7).
// Run with `npm run test:integration`. Requires Docker; skips with a clear message otherwise.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const IMAGE = 'node:26.13.0-slim'; // pinned by exact tag
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8',
});
const skip =
  docker.status === 0 ? false : 'Docker is not available: skipping container integration tests';

const run = (args: string[], timeout = 60_000) =>
  spawnSync('docker', args, { encoding: 'utf8', timeout });

describe('Node as PID 1 in a container', { skip }, () => {
  test('without a handler, PID 1 ignores SIGTERM: docker stop waits for the timeout and then SIGKILLs (exit 137)', () => {
    const name = `zto-pid1-${process.pid}`;
    assert.equal(
      run(['run', '-d', '--name', name, IMAGE, 'node', '-e', 'setInterval(() => {}, 1000)']).status,
      0,
    );
    const t0 = Date.now();
    run(['stop', '--time', '3', name]);
    const waited = Date.now() - t0;
    const code = run(['inspect', name, '--format', '{{.State.ExitCode}}']).stdout.trim();
    run(['rm', '-f', name]);
    assert.ok(waited >= 2_500, `stop returned after ${waited} ms`);
    assert.equal(code, '137');
  });

  test('with --init (tini as PID 1), SIGTERM reaches node and the default handler exits promptly', () => {
    const name = `zto-init-${process.pid}`;
    assert.equal(
      run([
        'run',
        '-d',
        '--init',
        '--name',
        name,
        IMAGE,
        'node',
        '-e',
        'setInterval(() => {}, 1000)',
      ]).status,
      0,
    );
    const t0 = Date.now();
    run(['stop', '--time', '10', name]);
    const waited = Date.now() - t0;
    run(['rm', '-f', name]);
    assert.ok(waited < 8_000, `stop took ${waited} ms`);
  });
});

describe('memory limits', { skip }, () => {
  test('constrainedMemory reports the cgroup limit inside the container', () => {
    const r = run([
      'run',
      '--rm',
      '--memory',
      '256m',
      IMAGE,
      'node',
      '-p',
      'Math.round(process.constrainedMemory() / 2 ** 20)',
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(Number(r.stdout.trim()), 256);
  });
});
