// A small but production-shaped Fastify 5 service used by module 08.
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Writable } from 'node:stream';

export interface AppOptions {
  logStream?: Writable;
  rateLimit?: { capacity: number; refillPerSecond: number; now?: () => number };
  slowMs?: number;
}

/** Token bucket per key. Invariant: 0 <= tokens <= capacity; tokens refill linearly with time. */
export class TokenBucket {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;
  constructor(
    capacity: number,
    refillPerSecond: number,
    now: () => number = () => performance.now(),
  ) {
    this.capacity = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.now = now;
  }
  take(key: string): { ok: boolean; retryAfterMs: number } {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, at: t };
    b.tokens = Math.min(this.capacity, b.tokens + (t - b.at) * this.refillPerMs);
    b.at = t;
    this.buckets.set(key, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { ok: true, retryAfterMs: 0 };
    }
    return { ok: false, retryAfterMs: Math.ceil((1 - b.tokens) / this.refillPerMs) };
  }
}

const userSchema = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
    },
  },
  response: {
    201: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } }, // no email, no internals
  },
} as const;

/** An encapsulated plugin: its decorator is invisible to sibling plugins. */
const privateArea: FastifyPluginAsync = async (app) => {
  app.decorate('secretHelper', () => 'only inside');
  app.get('/private/check', async () => ({ hasHelper: app.hasDecorator('secretHelper') }));
};

/** A plugin that opts out of encapsulation (what fastify-plugin does): its decorator is shared. */
const sharedDb: FastifyPluginAsync = async (app) => {
  app.decorate('db', {
    users: new Map<number, { id: number; name: string; email: string }>(),
    nextId: 1,
  });
};
(sharedDb as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;

export async function buildApp(
  opts: AppOptions = {},
): Promise<FastifyInstance & { state: { ready: boolean } }> {
  const app = Fastify({
    logger: opts.logStream
      ? { level: 'info', stream: opts.logStream, redact: ['req.headers.authorization'] }
      : false,
    bodyLimit: 16 * 1024,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    return503OnClosing: true,
  }) as unknown as FastifyInstance & { state: { ready: boolean } };
  app.decorate('state', { ready: true });

  await app.register(sharedDb);
  await app.register(privateArea);
  app.get('/public/check', async () => ({
    hasHelper: app.hasDecorator('secretHelper'),
    hasDb: app.hasDecorator('db'),
  }));

  if (opts.rateLimit) {
    const rl = opts.rateLimit;
    const bucket = new TokenBucket(rl.capacity, rl.refillPerSecond, rl.now);
    app.addHook('onRequest', async (req, reply) => {
      const r = bucket.take(req.ip);
      if (!r.ok) {
        reply.header('retry-after', Math.ceil(r.retryAfterMs / 1000));
        return reply.code(429).send({ error: 'Too Many Requests' });
      }
    });
  }

  app.post('/users', { schema: userSchema }, async (req, reply) => {
    const db = (app as unknown as { db: { users: Map<number, unknown>; nextId: number } }).db;
    const body = req.body as { name: string; email: string };
    const user = { id: db.nextId++, ...body };
    db.users.set(user.id, user);
    req.log.info({ userId: user.id }, 'user created');
    return reply.code(201).send(user); // serialiser drops `email`
  });

  app.get('/boom', async () => {
    throw new Error('database password is hunter2'); // must not leak to the client
  });

  app.get('/slow', async (req) => {
    req.log.info('slow request started');
    process.stdout.write('request-started\n'); // readiness token for the shutdown test
    await sleep(opts.slowMs ?? 300);
    return { done: true };
  });

  app.get('/healthz', async () => ({ status: 'ok' })); // liveness: the process can serve
  app.get('/readyz', async (_req, reply) =>
    app.state.ready ? { status: 'ready' } : reply.code(503).send({ status: 'draining' }),
  );

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'Bad Request', message: err.message });
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    return reply
      .code(status)
      .send({ error: status === 500 ? 'Internal Server Error' : err.message, requestId: req.id });
  });

  return app;
}

/**
 * Graceful shutdown. Order matters:
 * 1. fail readiness so the load balancer stops routing new requests here;
 * 2. optionally wait for endpoint propagation (Kubernetes preStop-like delay);
 * 3. app.close(): stop accepting, let in-flight requests finish, close idle keep-alive sockets, run onClose hooks;
 * 4. a hard deadline (unref'd) in case something hangs.
 */
export function installGracefulShutdown(
  app: FastifyInstance & { state: { ready: boolean } },
  { drainDelayMs = 0, deadlineMs = 10_000 } = {},
): void {
  let shuttingDown = false;
  const onSignal = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return; // second signal: ignore (or force-exit, by policy)
    shuttingDown = true;
    app.state.ready = false;
    const deadline = setTimeout(() => {
      process.stderr.write('shutdown deadline exceeded\n');
      process.exit(1);
    }, deadlineMs);
    deadline.unref();
    await sleep(drainDelayMs);
    await app.close();
    process.stdout.write(`closed after ${signal}\n`);
    process.exitCode = 0;
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
}

/** Closed → open → half-open circuit breaker with an injectable clock. */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private openedAt = 0;
  private probing = false;
  private readonly threshold: number;
  private readonly coolDownMs: number;
  private readonly now: () => number;
  constructor(threshold: number, coolDownMs: number, now: () => number = () => performance.now()) {
    this.threshold = threshold;
    this.coolDownMs = coolDownMs;
    this.now = now;
  }
  get current() {
    return this.state;
  }
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const open = () => Object.assign(new Error('circuit open'), { code: 'E_CIRCUIT_OPEN' });
    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.coolDownMs) throw open();
      this.state = 'half-open';
    }
    if (this.state === 'half-open') {
      if (this.probing) throw open();
      this.probing = true;
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (err) {
      this.failures++;
      if (this.state === 'half-open' || this.failures >= this.threshold) {
        this.state = 'open';
        this.openedAt = this.now();
      }
      throw err;
    } finally {
      this.probing = false;
    }
  }
}
