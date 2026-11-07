// Module 01 · Runtime architecture: process lifecycle, exit codes, preload, CLI and config.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { runNode, runModule } from './helpers/run-node.ts';

const require = createRequire(import.meta.url);

function scratch(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'zto-node-01-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('the runtime identifies its parts', () => {
  test('process.versions names V8, libuv and the bundled dependencies', () => {
    assert.match(process.versions.node, /^26\./);
    assert.match(process.versions.v8, /^14\.6\./);
    for (const dep of [
      'uv',
      'undici',
      'llhttp',
      'openssl',
      'zlib',
      'ada',
      'simdutf',
      'nghttp2',
      'sqlite',
      'amaro',
    ]) {
      assert.equal(typeof process.versions[dep], 'string', dep);
    }
  });

  test('type stripping and require(esm) are on by default (process.features)', () => {
    assert.equal(process.features.typescript, 'strip');
    assert.equal(process.features.require_module, true);
  });

  test('26.13.0 marks the line as LTS "Lithium"; 26.12.x reports no lts field', () => {
    const lts = (process.release as { lts?: string }).lts;
    if (lts !== undefined) assert.equal(lts, 'Lithium');
    else assert.match(process.version, /^v26\.(\d|1[0-2])\./);
  });
});

describe('built-in module resolution', () => {
  test('scheme-only built-ins need the node: prefix', () => {
    assert.throws(() => require('test'), { code: 'MODULE_NOT_FOUND' });
    assert.equal(typeof require('node:test'), 'function');
    assert.equal(typeof require('node:sqlite').DatabaseSync, 'function');
  });

  test('process.getBuiltinModule loads built-ins without import/require', () => {
    const fs = process.getBuiltinModule('node:fs');
    assert.equal(typeof fs.readFileSync, 'function');
    assert.equal(process.getBuiltinModule('fs'), fs);
    // returns undefined (not throws) for unknown ids and for scheme-only ids without the prefix
    assert.equal(process.getBuiltinModule('node:nope' as 'node:fs'), undefined);
    assert.equal(process.getBuiltinModule('test' as 'node:fs'), undefined);
  });
});

describe('process lifecycle and exit codes', () => {
  test('uncaught exception exits 1', () => {
    assert.equal(runNode(['-e', 'throw new Error("boom")']).status, 1);
  });

  test('unhandled rejection exits 1 by default (throw mode since Node 15)', () => {
    const r = runNode(['-e', 'Promise.reject(new Error("r"))']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Error: r/);
  });

  test('--unhandled-rejections=warn keeps the process alive (negative: do not ship this)', () => {
    const r = runNode([
      '--unhandled-rejections=warn',
      '-e',
      'Promise.reject(new Error("r")); setTimeout(() => console.log("alive"), 1)',
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /alive/);
  });

  test('an unsettled top-level await exits 13 with a warning', () => {
    const r = runModule('await new Promise(() => {})');
    assert.equal(r.status, 13);
    assert.match(r.stderr, /unsettled top-level await/i);
  });

  test('process.exitCode sets the code without cutting the loop short', () => {
    const r = runNode([
      '-e',
      'process.exitCode = 3; setTimeout(() => console.log("still ran"), 1)',
    ]);
    assert.equal(r.status, 3);
    assert.match(r.stdout, /still ran/);
  });

  test('death by an unhandled signal: no exit code, signal is reported', () => {
    const r = runNode(['-e', 'process.kill(process.pid, "SIGTERM"); setTimeout(() => {}, 10_000)']);
    assert.equal(r.status, null);
    assert.equal(r.signal, 'SIGTERM');
  });

  test('invalid CLI option exits 9', () => {
    assert.equal(runNode(['--definitely-not-a-flag', '-e', '1']).status, 9);
  });

  test('beforeExit may schedule more work; exit handlers are synchronous only', () => {
    const r = runNode([
      '-e',
      `let again = true;
       process.on('beforeExit', () => { console.log('beforeExit'); if (again) { again = false; setTimeout(() => console.log('more work'), 1); } });
       process.on('exit', (code) => { console.log('exit', code); setTimeout(() => console.log('NEVER'), 0); });`,
    ]);
    assert.deepEqual(r.stdout.trim().split('\n'), [
      'beforeExit',
      'more work',
      'beforeExit',
      'exit 0',
    ]);
  });

  test('process.exit() inside beforeExit skips the second beforeExit', () => {
    const r = runNode([
      '-e',
      `process.on('beforeExit', () => { console.log('b'); process.exit(4); });`,
    ]);
    assert.equal(r.status, 4);
    assert.equal(r.stdout.trim(), 'b');
  });
});

describe('preload: --require (CJS) and --import (ESM) run before the entry point', () => {
  test('order is -r, then --import, then main', () => {
    const dir = scratch({
      'pre.cjs': 'console.log("require-preload")',
      'pre.mjs': 'console.log("import-preload")',
      'main.cjs': 'console.log("main")',
    });
    try {
      const r = runNode(['--import', './pre.mjs', '-r', './pre.cjs', 'main.cjs'], { cwd: dir });
      assert.deepEqual(r.stdout.trim().split('\n'), ['require-preload', 'import-preload', 'main']);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('environment files', () => {
  const dotenv = 'A=fromfile\nB="multi\nline"\n# comment\nC=${A}x\nexport D=4\n';

  test('--env-file: the real environment wins over the file; no ${} interpolation', () => {
    const dir = scratch({ '.env': dotenv });
    try {
      const r = runNode(
        [
          '--env-file=.env',
          '-p',
          'JSON.stringify([process.env.A, process.env.B, process.env.C, process.env.D])',
        ],
        {
          cwd: dir,
          env: { A: 'fromenv' },
        },
      );
      assert.deepEqual(JSON.parse(r.stdout), ['fromenv', 'multi\nline', '${A}x', '4']);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test('--env-file on a missing file is fatal; --env-file-if-exists is not', () => {
    const dir = scratch({});
    try {
      assert.equal(runNode(['--env-file=.missing', '-e', '1'], { cwd: dir }).status, 9);
      assert.equal(runNode(['--env-file-if-exists=.missing', '-e', '1'], { cwd: dir }).status, 0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test('util.parseEnv is the same parser, exposed as a function', () => {
    assert.deepEqual(
      { ...parseEnv(dotenv) },
      { A: 'fromfile', B: 'multi\nline', C: '${A}x', D: '4' },
    );
  });
});

describe('NODE_OPTIONS and the config file', () => {
  test('flags that change what runs are rejected in NODE_OPTIONS', () => {
    const r = runNode(['-e', '1'], { env: { NODE_OPTIONS: '--print' } });
    assert.equal(r.status, 9);
    assert.match(r.stderr, /not allowed in NODE_OPTIONS/);
  });

  test('--config-file: nodeOptions apply, and a permission namespace enables --permission', () => {
    const dir = scratch({
      'pre.mjs': 'globalThis.PRELOADED = true;',
      'main.mjs':
        'console.log(JSON.stringify([globalThis.PRELOADED === true, process.permission?.has("fs.write") ?? null]))',
      'node.config.json': JSON.stringify({
        nodeOptions: { import: ['./pre.mjs'] },
        permission: { 'allow-fs-read': ['*'] },
      }),
    });
    try {
      const r = runNode(['--config-file=node.config.json', 'main.mjs'], { cwd: dir });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(JSON.parse(r.stdout), [true, false]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test('observed on 26.12.1: if NODE_OPTIONS is set at all, nodeOptions from the file are not applied', () => {
    // Pinned observation, not documented behaviour. Re-check on every Node upgrade.
    const dir = scratch({
      'pre.mjs': 'globalThis.PRELOADED = true;',
      'main.mjs': 'console.log(globalThis.PRELOADED === true)',
      'node.config.json': JSON.stringify({ nodeOptions: { import: ['./pre.mjs'] } }),
    });
    try {
      const r = runNode(['--config-file=node.config.json', 'main.mjs'], {
        cwd: dir,
        env: { NODE_OPTIONS: '--no-warnings' },
      });
      assert.equal(r.stdout.trim(), 'false');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test('unknown keys in the config file are a startup error', () => {
    const dir = scratch({
      'node.config.json': JSON.stringify({ nodeOptions: { 'max-old-space-size': 64 } }),
    });
    try {
      const r = runNode(['--config-file=node.config.json', '-e', '1'], { cwd: dir });
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /not supported|invalid/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('node --run', () => {
  test('runs a package.json script without npm, skips pre/post hooks, sets NODE_RUN_SCRIPT_NAME', () => {
    const dir = scratch({
      'package.json': JSON.stringify({
        scripts: { prehi: 'echo PRE', hi: 'echo NAME=$NODE_RUN_SCRIPT_NAME', posthi: 'echo POST' },
      }),
    });
    try {
      const r = runNode(['--run', 'hi'], { cwd: dir });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout.trim(), 'NAME=hi');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('the process object and standard I/O', () => {
  test('assigning undefined to process.env stores the STRING "undefined"', () => {
    process.env.ZTO_PROBE = undefined as unknown as string;
    assert.equal(process.env.ZTO_PROBE, 'undefined');
    assert.ok(process.env.ZTO_PROBE); // truthy: the bug
    delete process.env.ZTO_PROBE;
    assert.equal(process.env.ZTO_PROBE, undefined);
  });

  test('process.exit() truncates queued writes to a piped stdout; exitCode does not', () => {
    const size = 8_000_000;
    const truncated = runNode(['-e', `process.stdout.write('x'.repeat(${size})); process.exit(0)`]);
    assert.ok(truncated.stdout.length < size, `got ${truncated.stdout.length}`);
    const complete = runNode([
      '-e',
      `process.stdout.write('x'.repeat(${size})); process.exitCode = 0`,
    ]);
    assert.equal(complete.stdout.length, size);
  });

  test('a SIGTERM listener removes the default exit: the process keeps running until told otherwise', () => {
    const r = runNode([
      '-e',
      `process.on('SIGTERM', () => { console.log('caught'); setTimeout(() => { console.log('cleanup done'); process.exitCode = 0; }, 5); });
       process.kill(process.pid, 'SIGTERM');
       setTimeout(() => {}, 50);`,
    ]);
    assert.equal(r.status, 0);
    assert.equal(r.signal, null);
    assert.deepEqual(r.stdout.trim().split('\n'), ['caught', 'cleanup done']);
  });

  test('execArgv holds the Node flags, argv the program arguments', () => {
    const r = runNode([
      '--no-warnings',
      '-e',
      'console.log(JSON.stringify([process.execArgv, process.argv.slice(1)]))',
      'a',
      'b',
    ]);
    const [execArgv, args] = JSON.parse(r.stdout) as [string[], string[]];
    assert.ok(execArgv.includes('--no-warnings'));
    assert.deepEqual(args, ['a', 'b']);
  });
});
