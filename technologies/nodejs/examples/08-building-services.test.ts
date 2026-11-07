// Module 08 · Building services with Fastify 5: schemas, encapsulation, hooks, errors, logging,
// rate limiting, health checks and graceful shutdown. Route tests use inject(): no sockets.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import dc from 'node:diagnostics_channel';
import Fastify from 'fastify';
import { buildApp, TokenBucket, CircuitBreaker } from './08-service.ts';
import { startNode } from './helpers/run-node.ts';

describe('schemas: validation in, serialisation out', () => {
  test('a valid body is accepted and the response schema strips fields not declared (email)', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ada', email: 'ada@example.com' },
    });
    assert.equal(r.statusCode, 201);
    assert.deepEqual(r.json(), { id: 1, name: 'Ada' });
    await app.close();
  });

  test('an invalid body is a 400 before the handler runs', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'POST', url: '/users', payload: { name: '' } });
    assert.equal(r.statusCode, 400);
    await app.close();
  });

  test('surprise: additionalProperties:false REMOVES unknown fields (Ajv removeAdditional) instead of rejecting', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ada', email: 'ada@example.com', isAdmin: true },
    });
    assert.equal(r.statusCode, 201);
    await app.close();
  });

  test('bodyLimit (16 KiB here, 1 MiB default) answers 413', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'x'.repeat(20_000), email: 'a@example.com' },
    });
    assert.equal(r.statusCode, 413);
    await app.close();
  });
});

describe('encapsulation', () => {
  test('a decorator registered inside a plugin is invisible outside it; skip-override shares it', async () => {
    const app = await buildApp();
    assert.deepEqual((await app.inject('/private/check')).json(), { hasHelper: true });
    assert.deepEqual((await app.inject('/public/check')).json(), { hasHelper: false, hasDb: true });
    await app.close();
  });

  test('hooks run in a fixed order around the handler', async () => {
    const order: string[] = [];
    const app = Fastify();
    for (const h of [
      'onRequest',
      'preParsing',
      'preValidation',
      'preHandler',
      'preSerialization',
      'onSend',
      'onResponse',
    ] as const) {
      app.addHook(h, async () => {
        order.push(h);
      });
    }
    app.post('/x', async () => {
      order.push('handler');
      return { ok: true };
    });
    await app.inject({ method: 'POST', url: '/x', payload: {} });
    assert.deepEqual(order, [
      'onRequest',
      'preParsing',
      'preValidation',
      'preHandler',
      'handler',
      'preSerialization',
      'onSend',
      'onResponse',
    ]);
    await app.close();
  });
});

describe('errors and logging', () => {
  test('a thrown error becomes a generic 500 with a request id; the message stays in the logs only', async () => {
    const logs = new PassThrough();
    const lines: Array<Record<string, unknown>> = [];
    logs.on('data', (d) =>
      String(d)
        .split('\n')
        .filter(Boolean)
        .forEach((l) => lines.push(JSON.parse(l))),
    );
    const app = await buildApp({ logStream: logs });
    const r = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'req-123', authorization: 'Bearer secret' },
    });
    assert.equal(r.statusCode, 500);
    assert.deepEqual(r.json(), { error: 'Internal Server Error', requestId: 'req-123' });
    assert.ok(!r.body.includes('hunter2'));
    await app.close();
    const errLine = lines.find((l) => l.msg === 'unhandled error');
    assert.equal(errLine?.reqId, 'req-123');
    const incoming = lines.find((l) => l.msg === 'incoming request') as
      | { req?: { headers?: Record<string, string> } }
      | undefined;
    if (incoming?.req?.headers) assert.equal(incoming.req.headers.authorization, '[Redacted]');
  });

  test('Fastify publishes diagnostics_channel tracing events (what OpenTelemetry instrumentation consumes)', async () => {
    const seen: string[] = [];
    const tc = dc.tracingChannel('fastify.request.handler');
    const handlers = {
      start: (m: unknown) => seen.push(`start ${(m as { route?: { url?: string } }).route?.url}`),
      end: () => seen.push('end'),
      asyncStart() {},
      asyncEnd() {},
      error() {},
    };
    tc.subscribe(handlers);
    const app = await buildApp();
    await app.inject('/healthz');
    tc.unsubscribe(handlers);
    await app.close();
    assert.deepEqual(seen.slice(0, 2), ['start /healthz', 'end']);
  });
});

describe('rate limiting', () => {
  test('token bucket: capacity, refill and Retry-After (virtual clock)', async () => {
    let now = 0;
    const app = await buildApp({ rateLimit: { capacity: 2, refillPerSecond: 1, now: () => now } });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await app.inject('/healthz')).statusCode);
    assert.deepEqual(codes, [200, 200, 429]);
    const limited = await app.inject('/healthz');
    assert.equal(limited.headers['retry-after'], '1');
    now += 1000; // one token back
    assert.equal((await app.inject('/healthz')).statusCode, 200);
    await app.close();
  });

  test('negative: an in-memory limiter per process multiplies the limit by the number of processes', () => {
    const processes = [
      new TokenBucket(10, 0, () => 0),
      new TokenBucket(10, 0, () => 0),
      new TokenBucket(10, 0, () => 0),
    ];
    let allowed = 0;
    for (let i = 0; i < 100; i++) if (processes[i % 3]!.take('client').ok) allowed++;
    assert.equal(allowed, 30); // the intended limit was 10: use a shared store (Redis) for real limits
  });
});

describe('health and graceful shutdown', () => {
  test('readiness flips to 503 while draining; liveness stays 200', async () => {
    const app = await buildApp();
    app.state.ready = false;
    assert.equal((await app.inject('/readyz')).statusCode, 503);
    assert.equal((await app.inject('/healthz')).statusCode, 200);
    await app.close();
  });

  test('Fastify defaults differ from node:http: keepAliveTimeout 72 s, requestTimeout disabled', async () => {
    const app = Fastify();
    assert.equal(app.initialConfig.keepAliveTimeout, 72_000);
    assert.equal((app.initialConfig as { requestTimeout?: number }).requestTimeout, 0);
    assert.equal(app.initialConfig.bodyLimit, 1024 * 1024);
    await app.close();
  });

  test('SIGTERM during a request: the in-flight request completes, then the process exits 0', async () => {
    const server = fileURLToPath(new URL('./fixtures/08-service/server.ts', import.meta.url));
    const { child, firstLine, done } = await startNode([server], 'listening', {
      env: { SLOW_MS: '300' },
    });
    const port = Number(firstLine.split(' ')[1]);
    const response = new Promise<{ status: number; body: string }>((resolve, reject) => {
      http
        .get({ port, host: '127.0.0.1', path: '/slow', agent: false }, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on('error', reject);
    });
    await new Promise<void>((resolve) => {
      const onData = (d: Buffer) => {
        if (String(d).includes('request-started')) {
          child.stdout!.off('data', onData);
          resolve();
        }
      };
      child.stdout!.on('data', onData);
    });
    child.kill('SIGTERM'); // the request is now in flight
    const r = await response;
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), { done: true });
    const result = await done;
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /closed after SIGTERM/);
  });

  test('negative: a request that outlives the shutdown deadline is cut off and the process exits 1', async () => {
    const server = fileURLToPath(new URL('./fixtures/08-service/server.ts', import.meta.url));
    const { child, firstLine, done } = await startNode([server], 'listening', {
      env: { SLOW_MS: '5000', DEADLINE_MS: '200' },
    });
    const port = Number(firstLine.split(' ')[1]);
    const failed = new Promise<string>((resolve) => {
      http
        .get({ port, host: '127.0.0.1', path: '/slow', agent: false }, (res) => {
          res.resume();
          res.on('end', () => resolve('completed'));
        })
        .on('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? 'error'));
    });
    await new Promise<void>((resolve) => {
      const onData = (d: Buffer) => {
        if (String(d).includes('request-started')) {
          child.stdout!.off('data', onData);
          resolve();
        }
      };
      child.stdout!.on('data', onData);
    });
    child.kill('SIGTERM');
    const result = await done;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /deadline exceeded/);
    assert.notEqual(await failed, 'completed');
  });
});

describe('circuit breaker (virtual clock)', () => {
  test('opens after the threshold, fails fast, probes after the cool-down, closes on success', async () => {
    let now = 0;
    let calls = 0;
    const cb = new CircuitBreaker(3, 1000, () => now);
    const failing = async () => {
      calls++;
      throw new Error('upstream down');
    };
    for (let i = 0; i < 3; i++) await assert.rejects(cb.call(failing), /upstream down/);
    assert.equal(cb.current, 'open');
    await assert.rejects(cb.call(failing), { code: 'E_CIRCUIT_OPEN' });
    assert.equal(calls, 3); // the dependency was not called while open
    now += 1000;
    assert.equal(await cb.call(async () => 'recovered'), 'recovered');
    assert.equal(cb.current, 'closed');
  });

  test('a failed probe reopens the circuit immediately', async () => {
    let now = 0;
    const cb = new CircuitBreaker(1, 500, () => now);
    await assert.rejects(
      cb.call(async () => {
        throw new Error('x');
      }),
    );
    now += 500;
    await assert.rejects(
      cb.call(async () => {
        throw new Error('still down');
      }),
      /still down/,
    );
    assert.equal(cb.current, 'open');
    await assert.rejects(
      cb.call(async () => 'never'),
      { code: 'E_CIRCUIT_OPEN' },
    );
  });
});
