// Module 06 · File system, child processes, paths and the OS.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  writeFile,
  readdir,
  stat,
  glob,
  mkdtempDisposable,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, availableParallelism, cpus, EOL, constants as osConstants } from 'node:os';
import path from 'node:path';
import { execFile, exec, spawn, fork, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { writeFileAtomic, resolveInside } from './06-fs-utils.ts';
import { runNode } from './helpers/run-node.ts';

const execFileP = promisify(execFile);
const execP = promisify(exec);
let dir = '';
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'zto-node-06-'));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('file handles', () => {
  test('await using closes a FileHandle deterministically', async () => {
    const file = path.join(dir, 'using.txt');
    await writeFile(file, 'hello');
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    {
      await using fh = await open(file, 'r');
      handle = fh;
      assert.equal(await fh.readFile('utf8'), 'hello');
    }
    assert.equal(handle!.fd, -1); // closed on scope exit
  });

  test('negative: a FileHandle left to the garbage collector is now a fatal ERR_INVALID_STATE', () => {
    const r = runNode([
      '--expose-gc',
      '-e',
      `(async () => {
         let fh = await require('fs/promises').open(${JSON.stringify(import.meta.filename)});
         fh = null;
         for (let i = 0; i < 3; i++) { globalThis.gc(); await new Promise((r) => setTimeout(r, 10)); }
         console.log('survived');
       })()`,
    ]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ERR_INVALID_STATE|closed during garbage collection/);
    assert.doesNotMatch(r.stdout, /survived/);
  });

  test('mkdtempDisposable removes the directory on dispose', async () => {
    let created = '';
    {
      await using tmp = await mkdtempDisposable(path.join(tmpdir(), 'zto-disp-'));
      created = tmp.path;
      await writeFile(path.join(created, 'x'), '1');
      assert.ok(existsSync(created));
    }
    assert.equal(existsSync(created), false);
  });
});

describe('atomic replacement', () => {
  test('writeFileAtomic: readers see the old or the new content, never a torn file', async () => {
    const target = path.join(dir, 'config.json');
    await writeFile(target, JSON.stringify({ v: 1 }));
    await writeFileAtomic(target, JSON.stringify({ v: 2 }));
    assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), { v: 2 });
    const leftovers = (await readdir(dir)).filter((f) => f.includes('.tmp-'));
    assert.deepEqual(leftovers, []);
  });

  test('negative: a failed write leaves the original intact and no temp file behind', async () => {
    const target = path.join(dir, 'keep.json');
    await writeFile(target, 'original');
    const bad = {
      toString() {
        throw new Error('serialisation failed');
      },
    };
    await assert.rejects(writeFileAtomic(target, bad as unknown as string)); // not a string or Uint8Array
    assert.equal(await readFile(target, 'utf8'), 'original');
    assert.deepEqual(
      (await readdir(dir)).filter((f) => f.startsWith('keep.json.tmp-')),
      [],
    );
  });

  test('rename() over an existing file replaces it in one step (same file system)', async () => {
    const a = path.join(dir, 'a');
    const b = path.join(dir, 'b');
    await writeFile(a, 'new');
    await writeFile(b, 'old');
    await rename(a, b);
    assert.equal(await readFile(b, 'utf8'), 'new');
  });
});

describe('paths', () => {
  test('join normalises; resolve makes absolute; a leading ../ escapes', () => {
    assert.equal(path.posix.join('/srv/files', '../etc/passwd'), '/srv/etc/passwd');
    assert.equal(path.posix.resolve('/srv/files', '/etc/passwd'), '/etc/passwd');
  });

  test('resolveInside blocks traversal, absolute paths and prefix confusion', () => {
    const root = '/srv/files';
    assert.equal(resolveInside(root, 'a/b.txt'), '/srv/files/a/b.txt');
    assert.throws(() => resolveInside(root, '../etc/passwd'), { code: 'E_PATH_TRAVERSAL' });
    assert.throws(() => resolveInside(root, '/etc/passwd'), { code: 'E_PATH_TRAVERSAL' });
    assert.throws(() => resolveInside(root, '../files-secret/x'), { code: 'E_PATH_TRAVERSAL' }); // startsWith('/srv/files') would pass!
    assert.throws(() => resolveInside(root, 'a\0.txt'), { code: 'E_PATH_TRAVERSAL' });
  });

  test('negative: a naive startsWith check is fooled by a sibling directory', () => {
    const naive = (root: string, p: string) => path.posix.resolve(root, p).startsWith(root);
    assert.equal(naive('/srv/files', '../files-secret/x'), true); // the bug
  });

  test('platform-specific forms exist on every platform', () => {
    assert.equal(path.win32.join('C:\\a', '..', 'b'), 'C:\\b');
    assert.equal(path.posix.sep, '/');
    assert.equal(typeof EOL, 'string');
  });
});

describe('glob', () => {
  test('fs.promises.glob is an async iterator (no third-party glob needed)', async () => {
    await writeFile(path.join(dir, 'g1.log'), '');
    await writeFile(path.join(dir, 'g2.log'), '');
    await writeFile(path.join(dir, 'g3.txt'), '');
    const found: string[] = [];
    for await (const f of glob('*.log', { cwd: dir })) found.push(String(f));
    assert.deepEqual(found.sort(), ['g1.log', 'g2.log']);
  });
});

describe('child processes', () => {
  const evil = 'x; echo INJECTED';

  test('negative: exec() runs a shell, so interpolated input is executed', async () => {
    const { stdout } = await execP(`echo ${evil}`);
    assert.match(stdout, /INJECTED/);
  });

  test('execFile() passes arguments as an array: no shell, no injection', async () => {
    const { stdout } = await execFileP('echo', [evil]);
    assert.equal(stdout.trim(), evil);
  });

  test('spawn with shell:true and an args array is deprecated (DEP0190): args are concatenated, not escaped', () => {
    const r = runNode([
      '-e',
      'require("child_process").spawnSync("echo", ["a; echo INJECTED"], { shell: true, stdio: "inherit" })',
    ]);
    assert.match(r.stderr, /DEP0190/);
    assert.match(r.stdout, /INJECTED/);
  });

  test('exec() buffers output and kills the child past maxBuffer (default 1 MiB)', async () => {
    await assert.rejects(
      execP(`"${process.execPath}" -e "process.stdout.write('x'.repeat(2_000_000))"`),
      {
        code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      },
    );
  });

  test('spawn() streams output with backpressure and reports code and signal separately', async () => {
    const child = spawn(process.execPath, [
      '-e',
      'process.stdout.write("x".repeat(3_000_000)); process.exitCode = 7',
    ]);
    let bytes = 0;
    child.stdout.on('data', (d: Buffer) => (bytes += d.length));
    const [code, signal] = await once(child, 'close');
    assert.equal(bytes, 3_000_000);
    assert.equal(code, 7);
    assert.equal(signal, null);
  });

  test('killing a child: code is null, signal names the signal', async () => {
    const child = spawn(process.execPath, [
      '-e',
      'setInterval(() => {}, 1000); console.log("ready")',
    ]);
    await once(child.stdout, 'data');
    child.kill('SIGTERM');
    const [code, signal] = await once(child, 'exit');
    assert.equal(code, null);
    assert.equal(signal, 'SIGTERM');
  });

  test('an AbortSignal kills the child', async () => {
    const ac = new AbortController();
    const child = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000); console.log("ready")'],
      { signal: ac.signal },
    );
    child.on('error', () => {}); // AbortError is emitted as 'error'
    await once(child.stdout, 'data');
    ac.abort();
    const [, signal] = await once(child, 'exit');
    assert.equal(signal, 'SIGTERM');
  });

  test('fork() IPC with advanced serialisation carries Map and BigInt', async () => {
    const childFile = path.join(dir, 'ipc-child.cjs');
    await writeFile(
      childFile,
      'process.on("message", (m) => { process.send({ isMap: m.m instanceof Map, big: typeof m.b }); process.disconnect(); });',
    );
    const child = fork(childFile, { serialization: 'advanced' });
    child.send({ m: new Map([[1, 2]]), b: 10n });
    const [reply] = (await once(child, 'message')) as [{ isMap: boolean; big: string }];
    assert.deepEqual(reply, { isMap: true, big: 'bigint' });
    await once(child, 'exit');
  });

  test('negative: default JSON serialisation turns a Map into {} and rejects BigInt', async () => {
    const childFile = path.join(dir, 'ipc-json.cjs');
    await writeFile(
      childFile,
      'process.on("message", (m) => { process.send({ isMap: m.m instanceof Map, keys: Object.keys(m.m) }); process.disconnect(); });',
    );
    const child = fork(childFile);
    assert.throws(() => child.send({ b: 1n }), TypeError);
    child.send({ m: new Map([[1, 2]]) });
    const [reply] = (await once(child, 'message')) as [{ isMap: boolean; keys: string[] }];
    assert.deepEqual(reply, { isMap: false, keys: [] });
    await once(child, 'exit');
  });

  test('spawnSync blocks the event loop; the async APIs do not', () => {
    const t0 = performance.now();
    spawnSync(process.execPath, ['-e', 'const end = Date.now() + 50; while (Date.now() < end);']);
    assert.ok(performance.now() - t0 >= 50);
  });
});

describe('the OS', () => {
  test('availableParallelism respects affinity; cpus().length counts all CPUs', () => {
    assert.ok(availableParallelism() >= 1);
    assert.ok(availableParallelism() <= cpus().length || cpus().length === 0);
  });

  test('signal numbers come from os.constants', () => {
    assert.equal(osConstants.signals.SIGTERM, 15);
    assert.equal(osConstants.signals.SIGKILL, 9);
  });

  test('stat exposes size, mode and timestamps with ns precision via bigint', async () => {
    const s = await stat(import.meta.filename, { bigint: true });
    assert.equal(typeof s.mtimeNs, 'bigint');
    assert.ok(s.size > 0n);
  });
});

describe('exclusive creation as a lock', () => {
  test("open(path, 'wx') succeeds for exactly one of two concurrent callers", async () => {
    const lock = path.join(dir, 'job.lock');
    const results = await Promise.allSettled([open(lock, 'wx'), open(lock, 'wx')]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(won.length, 1);
    assert.equal(lost[0]?.reason.code, 'EEXIST');
    for (const r of won)
      await (r as PromiseFulfilledResult<Awaited<ReturnType<typeof open>>>).value.close();
  });

  test('a stale lock can be detected: kill(pid, 0) throws ESRCH for a dead process', async () => {
    const child = spawn(process.execPath, ['-e', '0']);
    await once(child, 'exit');
    assert.throws(() => process.kill(child.pid!, 0), { code: 'ESRCH' });
    assert.equal(process.kill(process.pid, 0), true); // signal 0 only checks existence and permission
  });

  test('opendir iterates a directory lazily', async () => {
    const { opendir } = await import('node:fs/promises');
    let n = 0;
    for await (const _ of await opendir(dir)) n++;
    assert.ok(n > 0);
  });
});

describe('container limits as seen by Node', () => {
  test('constrainedMemory and availableMemory are numbers (huge when unconstrained)', () => {
    assert.equal(typeof process.constrainedMemory(), 'number');
    assert.equal(typeof process.availableMemory(), 'number');
  });
});

describe('a robust run() helper', async () => {
  const { run } = await import('./06-fs-utils.ts');

  test('captures output up to a cap while still draining the pipe (no deadlock on 5 MB)', async () => {
    const r = await run(process.execPath, ['-e', 'process.stdout.write("y".repeat(5_000_000))'], {
      maxOutput: 1000,
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout.length, 1000);
  });

  test('kills a hung child at the deadline', async () => {
    const r = await run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      timeoutMs: 200,
    });
    assert.equal(r.timedOut, true);
    assert.equal(r.code, null);
  });

  test('a missing program is an error event (ENOENT), not an exit code', async () => {
    await assert.rejects(run('definitely-not-a-program-zto', []), { code: 'ENOENT' });
  });

  test('a replaced env drops PATH: the child sees only what you pass', async () => {
    const r = await run(
      process.execPath,
      ['-e', 'console.log(JSON.stringify(Object.keys(process.env).sort()))'],
      { env: { ONLY: '1' } },
    );
    const keys = (JSON.parse(r.stdout) as string[]).filter((k) => k !== '__CF_USER_TEXT_ENCODING');
    assert.deepEqual(keys, ['ONLY']);
  });
});
