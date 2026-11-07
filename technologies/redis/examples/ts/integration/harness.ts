// Integration harness: finds a real Redis server or skips cleanly.
//
// Resolution order (first match wins):
//   1. REDIS_URL         — use an already-running server (e.g. `docker compose up`, a brew install).
//   2. REDIS_SERVER_BIN  — spawn that redis-server / valkey-server binary on a free port.
//   3. Docker            — start the pinned image with testcontainers (REDIS_IMAGE overrides it).
//   4. none              — every test calls t.skip() with the reason.
//
// Tests that need a newer server than the one found call `needVersion()` and skip with a message,
// so the suite stays green against an older local binary while still proving what it can.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { TestContext } from 'node:test';
import { Socket } from 'node:net';
import { createClient } from 'redis';
import { RespParser, encodeCommand, type RespValue } from '../src/resp.ts';

export const PINNED_IMAGE = 'redis:8.10.3';
export const PINNED_VALKEY_IMAGE = 'valkey/valkey:9.1.3';

function makeClient(url: string, resp: 2 | 3) {
  return createClient({ url, RESP: resp });
}
export type Client = ReturnType<typeof makeClient>;

export interface Server {
  url: string;
  version: string;
  flavour: 'redis' | 'valkey';
  /** True when this process owns the server (spawned binary or container), so destructive config is safe. */
  dedicated: boolean;
  /** Data directory, when this process spawned the server. */
  dir?: string;
  /** Start another server instance of the same kind (used for replication tests). */
  spawnExtra?: (args: string[]) => Promise<Server>;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr === null || typeof addr === 'string') return reject(new Error('no port'));
      srv.close(() => resolve(addr.port));
    });
  });
}

async function info(url: string): Promise<{ version: string; flavour: 'redis' | 'valkey' }> {
  const c = createClient({ url, RESP: 2 });
  await c.connect();
  try {
    const text = String(await c.sendCommand(['INFO', 'server']));
    const v = /redis_version:(\S+)/.exec(text)?.[1] ?? '0.0.0';
    const valkey = /valkey_version:(\S+)/.exec(text)?.[1];
    return valkey ? { version: valkey, flavour: 'valkey' } : { version: v, flavour: 'redis' };
  } finally {
    await c.close();
  }
}

async function spawnBinary(bin: string, extra: string[]): Promise<Server> {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), 'zto-redis-'));
  const child: ChildProcess = spawn(
    bin,
    [
      '--port',
      String(port),
      '--bind',
      '127.0.0.1',
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      dir,
      '--enable-debug-command',
      'local',
      ...extra,
    ],
    { stdio: 'ignore' },
  );
  const url = `redis://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      const meta = await info(url);
      return {
        url,
        ...meta,
        dedicated: true,
        dir,
        spawnExtra: (args) => spawnBinary(bin, args),
        stop: async () => {
          child.kill('SIGKILL');
          await new Promise((r) =>
            child.exitCode !== null || child.signalCode !== null ? r(null) : child.once('exit', r),
          );
        },
      };
    } catch {
      await sleep(100);
    }
  }
  child.kill('SIGKILL');
  throw new Error(`could not start ${bin}`);
}

async function startContainer(image: string): Promise<Server> {
  const { GenericContainer, Wait } = await import('testcontainers');
  const container = await new GenericContainer(image)
    .withExposedPorts(6379)
    .withCommand([
      'redis-server',
      '--enable-debug-command',
      'yes',
      '--save',
      '',
      '--appendonly',
      'no',
    ])
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
  const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
  const meta = await info(url);
  return { url, ...meta, dedicated: true, stop: async () => void (await container.stop()) };
}

let cached: Promise<Server | string> | undefined;

/** Returns a running server, or a string explaining why none is available. */
export function getServer(): Promise<Server | string> {
  cached ??= (async () => {
    if (process.env.REDIS_URL) {
      const meta = await info(process.env.REDIS_URL);
      return {
        url: process.env.REDIS_URL,
        ...meta,
        dedicated: process.env.ZTO_DEDICATED === '1',
        stop: async () => {},
      };
    }
    if (process.env.REDIS_SERVER_BIN) return spawnBinary(process.env.REDIS_SERVER_BIN, []);
    try {
      const { getContainerRuntimeClient } = await import('testcontainers');
      await getContainerRuntimeClient();
    } catch {
      return 'no Docker runtime and neither REDIS_URL nor REDIS_SERVER_BIN is set';
    }
    return startContainer(process.env.REDIS_IMAGE ?? PINNED_IMAGE);
  })().catch((e: unknown) => `server unavailable: ${(e as Error).message}`);
  return cached;
}

/** Connect a fresh client, or skip the test with the reason. */
export async function connect(
  t: TestContext,
  opts: { resp?: 2 | 3 } = {},
): Promise<{ c: Client; server: Server; defer: (fn: () => unknown) => void } | undefined> {
  const server = await getServer();
  if (typeof server === 'string') {
    t.skip(`integration: ${server}`);
    return undefined;
  }
  const c = makeClient(server.url, opts.resp ?? 2);
  c.on('error', () => {});
  await c.connect();
  // Cleanups run last-in first-out, *before* the client is closed (node:test runs t.after hooks
  // in registration order, which would close the client before config restores could run).
  const cleanups: Array<() => unknown> = [];
  t.after(async () => {
    for (const fn of cleanups.reverse()) {
      try {
        await fn();
      } catch {
        /* best effort */
      }
    }
    await c.close().catch(() => {});
  });
  return { c, server, defer: (fn) => cleanups.push(fn) };
}

export function cmp(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Skip unless the server is Redis >= min (Valkey is skipped for Redis-only features unless allowed). */
export function needVersion(
  t: TestContext,
  server: Server,
  min: string,
  opts: { valkey?: string } = {},
): boolean {
  if (server.flavour === 'valkey') {
    if (opts.valkey && cmp(server.version, opts.valkey) >= 0) return true;
    t.skip(
      `needs Redis >= ${min}${opts.valkey ? ` or Valkey >= ${opts.valkey}` : ''}; found Valkey ${server.version}`,
    );
    return false;
  }
  if (cmp(server.version, min) >= 0) return true;
  t.skip(`needs Redis >= ${min}; found ${server.version} (run against ${PINNED_IMAGE})`);
  return false;
}

/** Skip tests that change server-wide config (maxmemory, policies, FLUSHALL) on a shared server. */
export function needDedicated(t: TestContext, server: Server): boolean {
  if (server.dedicated) return true;
  t.skip(
    'changes server-wide config; set ZTO_DEDICATED=1 if REDIS_URL points at a throwaway server',
  );
  return false;
}

/** Unique key prefix per test so tests never collide on a shared server. */
export function k(t: TestContext, name: string): string {
  return `zto:${t.name.replace(/\W+/g, '_')}:${name}`;
}

export async function shutdown(): Promise<void> {
  const s = await cached;
  if (s && typeof s !== 'string') await s.stop();
}

/** Raw RESP connection using the track's own parser: shows exact reply types (errors inside EXEC). */
export async function rawConn(url: string) {
  const { hostname, port } = new URL(url);
  const sock = new Socket();
  await new Promise<void>((res, rej) =>
    sock.connect(Number(port), hostname, res).once('error', rej),
  );
  const parser = new RespParser();
  const queue: RespValue[] = [];
  let wake: (() => void) | undefined;
  sock.on('data', (d) => {
    queue.push(...parser.push(d));
    wake?.();
  });
  return {
    async send(bytes: Buffer | string, n: number): Promise<RespValue[]> {
      sock.write(bytes);
      while (queue.length < n) await new Promise<void>((r) => (wake = r));
      return queue.splice(0, n);
    },
    async cmd(...args: string[]): Promise<RespValue> {
      return (await this.send(encodeCommand(args), 1))[0]!;
    },
    /** Replies that arrived without a request (push frames, pub/sub). */
    drain(): RespValue[] {
      return queue.splice(0);
    },
    /** Stop reading from the socket (simulates a slow consumer). */
    pause: () => void sock.pause(),
    close: () => sock.destroy(),
  };
}
