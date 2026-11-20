import assert from 'node:assert/strict';
import net from 'node:net';
import test, { type TestContext } from 'node:test';

type RespValue = string | number | null | RespValue[];

/**
 * Minimal zero-dependency RESP2 client over node:net for Redis / Valkey integration tests.
 */
class MinimalRespClient {
  private readonly socket: net.Socket;
  private buffer: Buffer = Buffer.alloc(0);
  private readonly waiters: Array<{
    resolve: (value: RespValue) => void;
    reject: (err: Error) => void;
  }> = [];

  private constructor(socket: net.Socket) {
    this.socket = socket;
    socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drainResponses();
    });
    socket.on('error', (err) => {
      while (this.waiters.length > 0) {
        this.waiters.shift()?.reject(err);
      }
    });
  }

  static async connect(host: string, port: number, timeoutMs = 500): Promise<MinimalRespClient> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection timeout to ${host}:${port}`));
      }, timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(new MinimalRespClient(socket));
      });
      socket.once('error', (err) => {
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      });
    });
  }

  command(...args: Array<string | number>): Promise<RespValue> {
    const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`, 'utf8')];
    for (const arg of args) {
      const buf = Buffer.from(String(arg), 'utf8');
      parts.push(Buffer.from(`$${buf.byteLength}\r\n`, 'utf8'), buf, Buffer.from('\r\n', 'utf8'));
    }
    const payload = Buffer.concat(parts);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.socket.write(payload);
    });
  }

  close(): void {
    this.socket.destroy();
  }

  private drainResponses(): void {
    while (this.waiters.length > 0) {
      const parsed = this.tryParseValue(0);
      if (!parsed) break;
      this.buffer = this.buffer.subarray(parsed.nextOffset);
      const waiter = this.waiters.shift();
      if (parsed.error) {
        waiter?.reject(parsed.error);
      } else {
        waiter?.resolve(parsed.value);
      }
    }
  }

  private tryParseValue(
    offset: number,
  ): { value: RespValue; error?: Error; nextOffset: number } | null {
    if (offset >= this.buffer.length) return null;
    const lineEnd = this.buffer.indexOf('\r\n', offset);
    if (lineEnd === -1) return null;

    const prefix = String.fromCharCode(this.buffer[offset] ?? 0);
    const line = this.buffer.subarray(offset + 1, lineEnd).toString('utf8');

    if (prefix === '+') {
      return { value: line, nextOffset: lineEnd + 2 };
    }
    if (prefix === '-') {
      return { value: null, error: new Error(`Redis error: ${line}`), nextOffset: lineEnd + 2 };
    }
    if (prefix === ':') {
      return { value: Number(line), nextOffset: lineEnd + 2 };
    }
    if (prefix === '$') {
      const len = Number(line);
      if (len === -1) return { value: null, nextOffset: lineEnd + 2 };
      const endOfBulk = lineEnd + 2 + len;
      if (this.buffer.length < endOfBulk + 2) return null;
      const value = this.buffer.subarray(lineEnd + 2, endOfBulk).toString('utf8');
      return { value, nextOffset: endOfBulk + 2 };
    }
    if (prefix === '*') {
      const count = Number(line);
      if (count === -1) return { value: null, nextOffset: lineEnd + 2 };
      const items: RespValue[] = [];
      let cursor = lineEnd + 2;
      for (let i = 0; i < count; i += 1) {
        const elem = this.tryParseValue(cursor);
        if (!elem) return null;
        if (elem.error) return elem;
        items.push(elem.value);
        cursor = elem.nextOffset;
      }
      return { value: items, nextOffset: cursor };
    }

    return {
      value: null,
      error: new Error(`Unsupported RESP prefix: ${prefix}`),
      nextOffset: this.buffer.length,
    };
  }
}

async function connectOrSkip(t: TestContext): Promise<MinimalRespClient | null> {
  try {
    const client = await MinimalRespClient.connect('127.0.0.1', 6379, 400);
    const pong = await client.command('PING');
    if (pong !== 'PONG') {
      client.close();
      t.skip('Redis/Valkey PING failed on 127.0.0.1:6379');
      return null;
    }
    return client;
  } catch {
    t.skip(
      'Redis/Valkey not running on 127.0.0.1:6379 — start Valkey 9.2 or Redis 8.10 container to run integration proofs',
    );
    return null;
  }
}

const LUA_GCRA = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local period_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local burst = tonumber(ARGV[4])
local emission_ms = period_ms / limit
local tau_ms = (burst - 1) * emission_ms
local tat = tonumber(redis.call('GET', key) or now_ms)
local allow_at = tat - tau_ms
if now_ms < allow_at then
  return {0, math.ceil(allow_at - now_ms)}
end
local new_tat = math.max(now_ms, tat) + emission_ms
redis.call('SET', key, tostring(new_tat), 'PX', math.ceil(period_ms + tau_ms))
return {1, 0}
`;

test('Redis/Valkey integration: atomic Lua GCRA rate limiter enforces burst under concurrency', async (t) => {
  const client = await connectOrSkip(t);
  if (!client) return;

  const key = `zto:test:gcra:${Date.now()}`;
  try {
    await client.command('DEL', key);
    const nowMs = Date.now();
    const decisions = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.command('EVAL', LUA_GCRA, 1, key, nowMs, 60_000, 10, 5),
      ),
    );

    const allowedCount = decisions.filter((res) => Array.isArray(res) && res[0] === 1).length;
    assert.equal(allowedCount, 5);
  } finally {
    await client.command('DEL', key).catch(() => {});
    client.close();
  }
});

test('Redis/Valkey integration: Sorted-Set real-time leaderboard ZADD and ZREVRANK', async (t) => {
  const client = await connectOrSkip(t);
  if (!client) return;

  const key = `zto:test:leaderboard:${Date.now()}`;
  try {
    await client.command('DEL', key);
    await client.command('ZADD', key, 1500, 'alice', 2400, 'bob', 1900, 'carol');
    assert.equal(await client.command('ZREVRANK', key, 'bob'), 0);
    assert.equal(await client.command('ZREVRANK', key, 'carol'), 1);
    assert.equal(await client.command('ZREVRANK', key, 'alice'), 2);
  } finally {
    await client.command('DEL', key).catch(() => {});
    client.close();
  }
});

test('Redis/Valkey integration: SET NX PX distributed lock acquisition, contention, and safe release', async (t) => {
  const client = await connectOrSkip(t);
  if (!client) return;

  const key = `zto:test:lock:${Date.now()}`;
  const releaseLua =
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  try {
    await client.command('DEL', key);
    const acquireA = await client.command('SET', key, 'owner-A', 'NX', 'PX', 5000);
    const acquireB = await client.command('SET', key, 'owner-B', 'NX', 'PX', 5000);
    assert.equal(acquireA, 'OK');
    assert.equal(acquireB, null);

    // Wrong owner cannot release A's lock
    assert.equal(await client.command('EVAL', releaseLua, 1, key, 'owner-B'), 0);
    // Correct owner releases lock cleanly
    assert.equal(await client.command('EVAL', releaseLua, 1, key, 'owner-A'), 1);
  } finally {
    await client.command('DEL', key).catch(() => {});
    client.close();
  }
});
