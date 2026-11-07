// Module 13 · Node-specific security: permission model, prototype pollution, vm, ReDoS, SSRF,
// secrets comparison, supply chain. Permission and engine flags run in child processes.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  existsSync,
  cpSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import {
  safeMerge,
  naiveMerge,
  ssrfSafeLookup,
  privateAddressBlockList,
  safeEqual,
} from './13-security.ts';
import { runNode, cleanEnv } from './helpers/run-node.ts';

describe('the permission model (a seat belt, not a sandbox)', () => {
  let dir = '';
  const probe = `
    const fs = require('fs'); const out = {};
    for (const p of ['allowed/a.txt', 'secret/key.txt', 'allowed/link.txt']) {
      try { out[p] = fs.readFileSync(p, 'utf8').trim(); } catch (e) { out[p] = e.code; }
    }
    try { require('child_process').execFileSync(process.execPath, ['-e', '0']); out.child = 'ok'; } catch (e) { out.child = e.code; }
    try { new (require('worker_threads').Worker)('0', { eval: true }).terminate(); out.worker = 'ok'; } catch (e) { out.worker = e.code; }
    try { require('fs').writeFileSync('allowed/new.txt', 'x'); out.write = 'ok'; } catch (e) { out.write = e.code; }
    out.hasSecret = process.permission ? process.permission.has('fs.read', require('path').resolve('secret/key.txt')) : 'no model';
    console.log(JSON.stringify(out));`;

  before(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'zto-perm-')));
    mkdirSync(join(dir, 'allowed'));
    mkdirSync(join(dir, 'secret'));
    writeFileSync(join(dir, 'allowed', 'a.txt'), 'public');
    writeFileSync(join(dir, 'secret', 'key.txt'), 's3cret');
    symlinkSync(join(dir, 'secret', 'key.txt'), join(dir, 'allowed', 'link.txt'));
    writeFileSync(join(dir, 'probe.cjs'), probe);
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  test('--permission denies by default: fs outside grants, child processes, workers, writes → ERR_ACCESS_DENIED', () => {
    const r = runNode(
      [
        '--permission',
        `--allow-fs-read=${join(dir, 'probe.cjs')}`,
        `--allow-fs-read=${join(dir, 'allowed')}`,
        'probe.cjs',
      ],
      { cwd: dir },
    );
    const out = JSON.parse(r.stdout);
    assert.equal(out['allowed/a.txt'], 'public');
    assert.equal(out['secret/key.txt'], 'ERR_ACCESS_DENIED');
    assert.equal(out.child, 'ERR_ACCESS_DENIED');
    assert.equal(out.worker, 'ERR_ACCESS_DENIED');
    assert.equal(out.write, 'ERR_ACCESS_DENIED');
    assert.equal(out.hasSecret, false);
  });

  test('negative: a symlink inside a granted directory reads a file outside it', () => {
    const r = runNode(
      [
        '--permission',
        `--allow-fs-read=${join(dir, 'probe.cjs')}`,
        `--allow-fs-read=${join(dir, 'allowed')}`,
        'probe.cjs',
      ],
      { cwd: dir },
    );
    assert.equal(JSON.parse(r.stdout)['allowed/link.txt'], 's3cret'); // documented limitation
  });

  test('--permission-audit allows everything but publishes each violation on diagnostics_channel', () => {
    const r = runNode([
      '--permission-audit',
      '-e',
      `
      const seen = [];
      require('diagnostics_channel').subscribe('node:permission-model:fs', (m) => seen.push(m.permission));
      require('fs').readFileSync(${JSON.stringify(join(dir, 'secret', 'key.txt'))});
      console.log(seen.join(','));`,
    ]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /FileSystemRead/);
  });

  test('process.permission.drop() revokes a permission for the rest of the process', () => {
    const r = runNode([
      '--permission',
      '--allow-fs-read=*',
      '-e',
      `
      const fs = require('fs');
      fs.readFileSync(${JSON.stringify(join(dir, 'allowed', 'a.txt'))});
      process.permission.drop('fs.read');
      try { fs.readFileSync(${JSON.stringify(join(dir, 'allowed', 'a.txt'))}); console.log('still readable'); } catch (e) { console.log(e.code); }`,
    ]);
    assert.equal(r.stdout.trim(), 'ERR_ACCESS_DENIED');
  });

  test('--env-file is read before the model starts: it is not restricted', () => {
    writeFileSync(join(dir, 'secret', '.env'), 'TOKEN=from-env-file');
    const r = runNode(
      ['--permission', `--env-file=${join(dir, 'secret', '.env')}`, '-p', 'process.env.TOKEN'],
      { cwd: dir },
    );
    assert.equal(r.stdout.trim(), 'from-env-file');
  });
});

describe('prototype pollution', () => {
  test('negative: a naive recursive merge of parsed JSON pollutes Object.prototype', () => {
    const payload = JSON.parse('{"__proto__": {"isAdmin": true}}'); // JSON.parse creates an OWN "__proto__" key
    assert.ok(Object.hasOwn(payload, '__proto__'));
    try {
      naiveMerge({}, payload);
      assert.equal(({} as { isAdmin?: boolean }).isAdmin, true); // every object is now "admin"
    } finally {
      delete (Object.prototype as { isAdmin?: boolean }).isAdmin;
    }
  });

  test('safeMerge skips __proto__, constructor and prototype keys', () => {
    const out = safeMerge(
      { a: 1 },
      JSON.parse(
        '{"__proto__": {"isAdmin": true}, "b": {"c": 2}, "constructor": {"prototype": {"x": 1}}}',
      ),
    );
    assert.equal(({} as { isAdmin?: boolean }).isAdmin, undefined);
    assert.deepEqual(out, { a: 1, b: { c: 2 } });
  });

  test('--disable-proto=throw removes the __proto__ accessor from the whole process', () => {
    const r = runNode([
      '--disable-proto=throw',
      '-e',
      'try { ({}).__proto__; console.log("allowed") } catch (e) { console.log(e.code) }',
    ]);
    assert.equal(r.stdout.trim(), 'ERR_PROTO_ACCESS');
  });

  test('Fastify rejects bodies containing __proto__ by default (secure-json-parse)', async () => {
    const app = Fastify();
    app.post('/', async () => ({ ok: true }));
    const r = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: '{"__proto__": {"polluted": 1}}',
    });
    assert.equal(r.statusCode, 400);
    await app.close();
  });

  test('null-prototype objects cannot be polluted through lookups', () => {
    const lookup: Record<string, string> = Object.assign(Object.create(null), { a: '1' });
    assert.equal(lookup['toString'], undefined);
    assert.equal('constructor' in lookup, false);
  });
});

describe('vm is not a sandbox', () => {
  test('negative: code in a new context reaches the host process through the constructor chain', () => {
    const escaped = vm.runInNewContext(
      'this.constructor.constructor("return process")()',
    ) as NodeJS.Process;
    assert.equal(escaped.pid, process.pid); // full access to the host
  });

  test('vm timeouts stop synchronous loops but not asynchronous work', () => {
    assert.throws(() => vm.runInNewContext('while (true) {}', {}, { timeout: 50 }), {
      code: 'ERR_SCRIPT_EXECUTION_TIMEOUT',
    });
  });
});

describe('ReDoS', () => {
  const evil = String.raw`/^(a+)+$/`;

  test('negative: a catastrophic-backtracking regex on 40 characters never finishes (killed by timeout)', () => {
    const r = runNode(['-e', `${evil}.test('a'.repeat(40) + '!')`], { timeout: 1_500 });
    assert.equal(r.signal, 'SIGTERM'); // spawnSync killed it: the event loop would be frozen
  });

  test('the linear-time engine (/l flag, --enable-experimental-regexp-engine) answers instantly', () => {
    const r = runNode(
      [
        '--enable-experimental-regexp-engine',
        '-e',
        `console.log(${evil}l.test('a'.repeat(40) + '!'))`,
      ],
      { timeout: 5_000 },
    );
    assert.equal(r.stdout.trim(), 'false');
  });

  test('bounding input length is the cheapest defence', () => {
    const MAX = 64;
    const check = (s: string) => s.length <= MAX && /^[a-z0-9-]+$/.test(s); // no nested quantifiers either
    assert.equal(check('a'.repeat(10_000)), false);
    assert.equal(check('valid-slug-1'), true);
  });
});

describe('SSRF: validating where a URL really points', () => {
  test('the block list covers loopback, private, link-local (metadata) and IPv6 ranges', () => {
    const b = privateAddressBlockList();
    for (const [ip, t] of [
      ['127.0.0.1', 'ipv4'],
      ['10.1.2.3', 'ipv4'],
      ['172.20.0.1', 'ipv4'],
      ['192.168.1.1', 'ipv4'],
      ['169.254.169.254', 'ipv4'],
      ['::1', 'ipv6'],
      ['fd00::1', 'ipv6'],
    ] as const) {
      assert.equal(b.check(ip, t), true, ip);
    }
    assert.equal(b.check('93.184.216.34', 'ipv4'), false);
  });

  test('the guard runs INSIDE the connection lookup: a name resolving to loopback is refused', async () => {
    const server = http.createServer((_q, r) => r.end('internal secret'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
      http
        .get({ host: 'localhost', port, lookup: ssrfSafeLookup() }, () =>
          resolve(new Error('connected!') as NodeJS.ErrnoException),
        )
        .on('error', resolve);
    });
    assert.equal(err.code, 'E_SSRF_BLOCKED');
    server.close();
  });

  test('IPv4-mapped IPv6 addresses are normalised before checking (a common bypass)', async () => {
    const fakeResolve = ((
      _h: string,
      _o: unknown,
      cb: (e: null, a: Array<{ address: string; family: number }>) => void,
    ) =>
      cb(null, [
        { address: '::ffff:169.254.169.254', family: 6 },
      ])) as unknown as typeof import('node:dns').lookup;
    const lookup = ssrfSafeLookup(privateAddressBlockList(), fakeResolve);
    const err = await new Promise<NodeJS.ErrnoException | null>((r) =>
      lookup('metadata.attacker.example', {}, (e) => r(e)),
    );
    assert.equal(err?.code, 'E_SSRF_BLOCKED');
  });
});

describe('secrets in comparisons', () => {
  test('timingSafeEqual throws on different lengths (a crash, and a length oracle)', () => {
    assert.throws(() => timingSafeEqual(Buffer.from('abc'), Buffer.from('abcd')), {
      code: 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH',
    });
  });

  test('safeEqual hashes first, so any lengths compare in constant time', () => {
    assert.equal(safeEqual('token-123', 'token-123'), true);
    assert.equal(safeEqual('token-123', 'token-1234'), false);
  });
});

describe('supply chain: install scripts', () => {
  const npm = spawnSync('npm', ['--version'], { encoding: 'utf8', env: cleanEnv() });
  const fixture = fileURLToPath(new URL('./fixtures/13-security/npm-app/', import.meta.url));

  test(
    'a dependency install script runs arbitrary code; --ignore-scripts prevents it',
    { skip: npm.status !== 0 ? 'npm not on PATH' : false },
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'zto-npm-'));
      try {
        cpSync(fixture, dir, { recursive: true });
        const install = (extra: string[]) =>
          spawnSync('npm', ['install', '--no-audit', '--no-fund', '--offline', ...extra], {
            cwd: dir,
            encoding: 'utf8',
            env: cleanEnv(),
          });
        assert.equal(install(['--ignore-scripts']).status, 0);
        assert.equal(existsSync(join(dir, 'PWNED')), false);
        rmSync(join(dir, 'node_modules'), { recursive: true, force: true });
        assert.equal(install([]).status, 0);
        assert.equal(existsSync(join(dir, 'PWNED')), true); // the "compromised" dependency ran code at install time
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('header injection', () => {
  test('CR/LF in a header value is rejected (ERR_INVALID_CHAR): no response splitting', async () => {
    const server = http.createServer((_q, res) => {
      assert.throws(() => res.setHeader('x-user', 'a\r\nSet-Cookie: session=attacker'), {
        code: 'ERR_INVALID_CHAR',
      });
      res.end('ok');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const r = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/`);
    assert.equal(r.headers.get('set-cookie'), null);
    await r.text();
    server.close();
  });
});

describe('SSRF guard for fetch (undici dispatcher)', () => {
  test('the same lookup plugged into an undici Agent protects global fetch', async () => {
    const { Agent } = await import('undici');
    const server = http.createServer((_q, r) => r.end('internal secret'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const dispatcher = new Agent({ connect: { lookup: ssrfSafeLookup() } });
    await assert.rejects(
      fetch(`http://localhost:${port}/`, { dispatcher } as RequestInit),
      (e: Error) => (e.cause as { code?: string }).code === 'E_SSRF_BLOCKED',
    );
    await dispatcher.close();
    server.close();
  });
});

describe('pollution gadgets', () => {
  test('Node 26 core ignores INHERITED child_process options: a polluted prototype does not enable shell or env', () => {
    // In a child process: pollution is process-wide, so it must never touch the test runner.
    const r = runNode([
      '-e',
      `
      Object.prototype.shell = true;            // what a vulnerable merge of {"__proto__":{"shell":true}} does
      Object.prototype.env = { INJECTED: '1' };
      const cp = require('child_process');
      console.log(cp.spawnSync('echo', ['$((6*7))'], { encoding: 'utf8' }).stdout.trim());
      console.log(cp.spawnSync(process.execPath, ['-p', 'process.env.INJECTED'], { encoding: 'utf8' }).stdout.trim());`,
    ]);
    assert.deepEqual(r.stdout.trim().split('\n'), ['$((6*7))', 'undefined']); // own-property reads in core
  });

  test('negative: application code that reads options through the prototype chain is still a gadget', () => {
    const r = runNode([
      '-e',
      `
      Object.prototype.isAdmin = true;
      function authorize(user) { return user.isAdmin === true; }   // inherited property counts
      console.log(authorize({ name: 'mallory' }));`,
    ]);
    assert.equal(r.stdout.trim(), 'true');
  });
});
