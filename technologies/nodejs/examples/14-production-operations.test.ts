// Module 14 · Production operations: signal forwarding (PID 1 and wrappers), single executable
// applications, source maps, and version checks. Container-specific behaviour is in
// examples/integration/14-docker.itest.ts (run with `npm run test:integration`; skips without Docker).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, copyFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findSourceMap, SourceMap } from 'node:module';
import { startNode, runNode, cleanEnv } from './helpers/run-node.ts';

const FIX = fileURLToPath(new URL('./fixtures/14-ops/', import.meta.url));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('signals through wrappers (the npm start / sh -c problem)', () => {
  test('negative: a wrapper that does not forward SIGTERM dies alone; the real service keeps running', async () => {
    const {
      child: wrapper,
      firstLine,
      done,
    } = await startNode([join(FIX, 'wrapper-naive.cjs')], 'child-ready');
    const childPid = Number(firstLine.split(' ')[1]);
    wrapper.kill('SIGTERM');
    const result = await done;
    assert.equal(result.signal, 'SIGTERM'); // the wrapper died from the signal
    assert.equal(alive(childPid), true); // the service never heard about it: an orphan
    assert.doesNotMatch(result.stdout, /SIGTERM received/);
    process.kill(childPid, 'SIGKILL'); // what the orchestrator would eventually do, losing in-flight work
  });

  test('a forwarding wrapper (what tini or docker --init does) delivers SIGTERM and mirrors the exit code', async () => {
    const { child: wrapper, done } = await startNode(
      [join(FIX, 'wrapper-forwarding.cjs')],
      'child-ready',
    );
    wrapper.kill('SIGTERM');
    const result = await done;
    assert.equal(result.status, 0);
    assert.match(result.stdout, /child: SIGTERM received, draining\nchild: drained/);
  });
});

describe('single executable applications', () => {
  test(
    'node --build-sea produces one binary that runs the app without a separate node or node_modules',
    { timeout: 120_000 },
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'zto-sea-'));
      try {
        copyFileSync(join(FIX, 'app.cjs'), join(dir, 'app.cjs'));
        writeFileSync(
          join(dir, 'sea-config.json'),
          JSON.stringify({
            main: 'app.cjs',
            output: 'app-bin',
            disableExperimentalSEAWarning: true,
          }),
        );
        const build = runNode(['--build-sea=sea-config.json'], { cwd: dir, timeout: 120_000 });
        assert.equal(build.status, 0, build.stderr);
        const bin = join(dir, 'app-bin');
        assert.ok(existsSync(bin));
        assert.ok(statSync(bin).size > 50 * 1024 * 1024); // it embeds the whole Node binary
        if (process.platform === 'darwin') {
          spawnSync('codesign', ['--sign', '-', '--force', bin]);
        }
        const r = spawnSync(bin, ['a', 'b'], { encoding: 'utf8', env: cleanEnv() });
        assert.equal(r.stdout.trim(), 'hello from a single executable: isSea=true args=a,b');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('source maps', () => {
  const tsc = fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url));

  test('--enable-source-maps maps a compiled stack frame back to the TypeScript line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-sm-'));
    try {
      copyFileSync(join(FIX, 'pay.ts'), join(dir, 'pay.ts'));
      const c = spawnSync(
        tsc,
        [
          'pay.ts',
          '--sourceMap',
          '--outDir',
          'out',
          '--module',
          'nodenext',
          '--target',
          'es2022',
          '--removeComments',
        ],
        { cwd: dir, encoding: 'utf8', env: cleanEnv() },
      );
      assert.equal(c.status, 0, c.stdout + c.stderr);
      const plain = runNode([join(dir, 'out', 'pay.js')]);
      const mapped = runNode(['--enable-source-maps', join(dir, 'out', 'pay.js')]);
      assert.match(plain.stderr, /at charge \(.*pay\.js:\d+:\d+\)/); // compiled coordinates: useless for humans
      assert.match(mapped.stderr, /at charge \(.*pay\.ts:6:9\)/); // the original TypeScript line
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the SourceMap API resolves positions programmatically (for log processors and error reporters)', () => {
    const payload = {
      version: 3,
      file: 'out.js',
      sources: ['in.ts'],
      names: [],
      sourceRoot: '',
      sourcesContent: [],
      mappings: 'AAAA;AACA', // line 1 → in.ts:1, line 2 → in.ts:2
    };
    const map = new SourceMap(payload);
    const entry = map.findEntry(1, 0);
    assert.equal((entry as { originalSource?: string }).originalSource, 'in.ts');
    assert.equal((entry as { originalLine?: number }).originalLine, 1);
    assert.equal(typeof findSourceMap, 'function');
  });
});

describe('knowing what you run', () => {
  test('process.release and process.versions identify the exact runtime for incident reports', () => {
    assert.equal(process.release.name, 'node');
    assert.match(process.version, /^v26\./);
    assert.equal(process.versions.modules, '147'); // NODE_MODULE_VERSION: native addon ABI of Node 26
  });

  test('engines in package.json documents the minimum; process.versions decides at runtime', async () => {
    const pkg = JSON.parse(
      (await import('node:fs')).readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { engines: { node: string } };
    assert.equal(pkg.engines.node, '>=26');
    const [major] = process.versions.node.split('.').map(Number);
    assert.ok(major! >= 26);
  });

  test('a removed API fails loudly after an upgrade: http writeHeader is gone in Node 26', async () => {
    const http = await import('node:http');
    assert.equal(
      typeof (http.ServerResponse.prototype as unknown as { writeHeader?: unknown }).writeHeader,
      'undefined',
    );
  });

  test('a graceful child exit is visible to supervisors as code 0 after SIGTERM', async () => {
    const { child, done } = await startNode([join(FIX, 'child.cjs')], 'child-ready');
    child.kill('SIGTERM');
    const r = await done;
    assert.equal(r.status, 0);
    assert.match(r.stdout, /drained/);
  });
});

describe('deprecations as upgrade signals', () => {
  test('a runtime deprecation is only a warning by default...', () => {
    const r = runNode([
      '-e',
      'require("node:url").parse("https://example.com/a"); console.log("continued")',
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /DeprecationWarning/);
  });

  test('...and a test failure under --throw-deprecation (use it in CI before upgrading)', () => {
    const r = runNode([
      '--throw-deprecation',
      '-e',
      'require("node:url").parse("https://example.com/a"); console.log("continued")',
    ]);
    assert.equal(r.status, 1); // the warning is emitted on the next tick, so the line after the call still runs
    assert.match(r.stderr, /DEP0169/);
  });

  test('NODE_COMPILE_CACHE populates an on-disk code cache that later starts reuse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zto-cc-'));
    try {
      const prog = join(dir, 'app.cjs');
      writeFileSync(
        prog,
        'module.exports = 1; console.log(require("node:module").getCompileCacheDir() ? "cache on" : "cache off")',
      );
      const r = runNode([prog], { env: { NODE_COMPILE_CACHE: join(dir, 'cache') } });
      assert.equal(r.stdout.trim(), 'cache on');
      assert.ok(existsSync(join(dir, 'cache')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
