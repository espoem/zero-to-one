// Module 07 · Networking and HTTP: sockets, server timeouts, keep-alive, parser limits, fetch/undici, DNS, HTTP/2.
// Every server listens on port 0 on loopback; slow clients are simulated with raw sockets.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import http2 from 'node:http2';
import net from 'node:net';
import dns from 'node:dns';
import { once } from 'node:events';
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  Agent as UndiciAgent,
  request as undiciRequest,
} from 'undici';

async function listen(server: net.Server | http.Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return (server.address() as net.AddressInfo).port;
}

/** Send raw bytes and collect everything until the server closes the connection. */
async function raw(port: number, payload: string): Promise<string> {
  const c = net.connect(port, '127.0.0.1');
  let data = '';
  c.setEncoding('utf8');
  c.on('data', (d: string) => (data += d));
  c.write(payload);
  await once(c, 'close');
  return data;
}
const statusLine = (resp: string) => resp.split('\r\n')[0];

describe('TCP with node:net', () => {
  test('an echo server: TCP is a byte stream, and allowHalfOpen controls the write side after FIN', async () => {
    const server = net.createServer({ allowHalfOpen: true }, (sock) => {
      let got = '';
      sock.on('data', (d) => (got += d));
      sock.on('end', () => sock.end(`echo:${got}`)); // peer finished writing; we can still reply
    });
    const port = await listen(server);
    const reply = await new Promise<string>((resolve) => {
      const c = net.connect(port, '127.0.0.1', () => {
        c.write('he');
        c.end('llo');
      });
      let r = '';
      c.on('data', (d) => (r += d));
      c.on('end', () => resolve(r));
    });
    assert.equal(reply, 'echo:hello');
    server.close();
  });

  test('connecting to a closed port fails with ECONNREFUSED', async () => {
    const s = net.createServer();
    const port = await listen(s);
    await new Promise<void>((r) => s.close(() => r()));
    const c = net.connect(port, '127.0.0.1');
    const [err] = (await once(c, 'error').catch((e) => [e])) as [NodeJS.ErrnoException];
    assert.equal(err.code, 'ECONNREFUSED');
  });
});

describe('HTTP server defaults and timeouts (Node 26)', () => {
  test('defaults: keepAliveTimeout 5 s (+1 s buffer), headersTimeout 60 s, requestTimeout 300 s, timeout 0', () => {
    const s = http.createServer();
    assert.equal(s.keepAliveTimeout, 5_000);
    assert.equal(s.keepAliveTimeoutBuffer, 1_000);
    assert.equal(s.headersTimeout, 60_000);
    assert.equal(s.requestTimeout, 300_000);
    assert.equal(s.timeout, 0);
    assert.equal(http.maxHeaderSize, 16 * 1024);
  });

  test('a client that never finishes its headers gets 408 after headersTimeout (slowloris defence)', async () => {
    const s = http.createServer(
      { headersTimeout: 100, requestTimeout: 200, connectionsCheckingInterval: 20 },
      (_q, r) => r.end('ok'),
    );
    const port = await listen(s);
    assert.equal(
      statusLine(await raw(port, 'GET / HTTP/1.1\r\nHost: x\r\n')),
      'HTTP/1.1 408 Request Timeout',
    );
    s.close();
  });

  test('the server advertises its keep-alive timeout and closes idle sockets after it', async () => {
    const s = http.createServer({ keepAliveTimeout: 150, keepAliveTimeoutBuffer: 0 }, (_q, r) =>
      r.end('ok'),
    );
    const port = await listen(s);
    const t0 = performance.now();
    const resp = await raw(port, 'GET / HTTP/1.1\r\nHost: x\r\n\r\n'); // resolves when the SERVER closes
    assert.match(resp, /Keep-Alive: timeout=0|Keep-Alive: timeout=/i);
    assert.ok(performance.now() - t0 >= 140);
    s.close();
  });
});

describe('the parser protects you (llhttp)', () => {
  test('Content-Length together with Transfer-Encoding is rejected (request smuggling defence)', async () => {
    const s = http.createServer((_q, r) => r.end('ok'));
    const port = await listen(s);
    const resp = await raw(
      port,
      'POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
    );
    assert.equal(statusLine(resp), 'HTTP/1.1 400 Bad Request');
    s.close();
  });

  test('headers above maxHeaderSize (16 KiB) get 431', async () => {
    const s = http.createServer((_q, r) => r.end('ok'));
    const port = await listen(s);
    const resp = await raw(port, `GET / HTTP/1.1\r\nHost: x\r\nX: ${'a'.repeat(20_000)}\r\n\r\n`);
    assert.equal(statusLine(resp), 'HTTP/1.1 431 Request Header Fields Too Large');
    s.close();
  });
});

describe('the http client Agent', () => {
  test('globalAgent keeps connections alive by default (since Node 19); a second request reuses the socket', async () => {
    assert.equal((http.globalAgent as http.Agent & { keepAlive: boolean }).keepAlive, true);
    const s = http.createServer((_q, r) => r.end('ok'));
    const port = await listen(s);
    const agent = new http.Agent({ keepAlive: true });
    const get = () =>
      new Promise<boolean>((resolve) =>
        http.get({ port, host: '127.0.0.1', agent }, (res) => {
          res.resume();
          res.on('end', () =>
            resolve((res as http.IncomingMessage & { req: http.ClientRequest }).req.reusedSocket),
          );
        }),
      );
    assert.equal(await get(), false);
    assert.equal(await get(), true);
    agent.destroy();
    s.close();
  });

  test('negative: an unconsumed response body blocks socket reuse', async () => {
    const s = http.createServer((_q, r) => r.end('x'.repeat(200_000)));
    const port = await listen(s);
    const agent = new http.Agent({ keepAlive: true, maxSockets: 10 });
    const first = await new Promise<http.IncomingMessage>((r) =>
      http.get({ port, host: '127.0.0.1', agent }, r),
    ); // never read
    const reused = await new Promise<boolean>((resolve) =>
      http.get({ port, host: '127.0.0.1', agent }, (res) => {
        res.resume();
        res.on('end', () =>
          resolve((res as http.IncomingMessage & { req: http.ClientRequest }).req.reusedSocket),
        );
      }),
    );
    assert.equal(reused, false); // the first socket is still busy with an unread body
    first.destroy();
    agent.destroy();
    s.close();
  });

  test('an AbortSignal cancels an outgoing request', async () => {
    const s = http.createServer(() => {
      /* never responds */
    });
    const port = await listen(s);
    const ac = new AbortController();
    const req = http.get({ port, host: '127.0.0.1', signal: ac.signal });
    const failed = once(req, 'error').catch((e: unknown) => [e]);
    ac.abort();
    const [err] = (await failed) as [Error];
    assert.equal(err.name, 'AbortError');
    s.closeAllConnections();
    s.close();
  });

  test('server.close() also closes IDLE keep-alive connections (since Node 19)', async () => {
    const s = http.createServer((_q, r) => r.end('ok'));
    const port = await listen(s);
    const agent = new http.Agent({ keepAlive: true });
    await new Promise<void>((r) =>
      http.get({ port, host: '127.0.0.1', agent }, (res) => {
        res.resume();
        res.on('end', r);
      }),
    );
    const closed = new Promise<void>((r) => s.close(() => r()));
    await closed; // would hang until keepAliveTimeout before Node 19
    agent.destroy();
  });
});

describe('fetch and undici', () => {
  test('fetch is undici: MockAgent intercepts it with no network', async () => {
    const previous = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    setGlobalDispatcher(mock);
    try {
      mock
        .get('https://api.example.com')
        .intercept({ path: '/users/1', method: 'GET' })
        .reply(200, { id: 1 });
      const r = await fetch('https://api.example.com/users/1');
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { id: 1 });
      await assert.rejects(
        fetch('https://api.example.com/unmocked'),
        (e: Error) => (e.cause as { code?: string }).code === 'UND_MOCK_ERR_MOCK_NOT_MATCHED',
      );
    } finally {
      setGlobalDispatcher(previous);
      await mock.close();
    }
  });

  test('fetch does not reject on HTTP errors; only on network failure', async () => {
    const s = http.createServer((_q, r) => {
      r.statusCode = 503;
      r.end('down');
    });
    const port = await listen(s);
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
    await r.text(); // always consume (or cancel) the body so the connection returns to the pool
    s.close();
  });

  test('an undici Agent pools connections: pipelining-free reuse with keep-alive', async () => {
    let connections = 0;
    const s = http.createServer((_q, r) => r.end('ok'));
    s.on('connection', () => connections++);
    const port = await listen(s);
    const agent = new UndiciAgent({ connections: 1 });
    for (let i = 0; i < 5; i++) {
      const { body } = await undiciRequest(`http://127.0.0.1:${port}/`, { dispatcher: agent });
      await body.text();
    }
    assert.equal(connections, 1);
    await agent.close();
    s.close();
  });

  test('AbortSignal.timeout bounds a fetch', async () => {
    const s = http.createServer(() => {
      /* hang */
    });
    const port = await listen(s);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(100) }), {
      name: 'TimeoutError',
    });
    s.closeAllConnections();
    s.close();
  });
});

describe('DNS', () => {
  test('dns.lookup (getaddrinfo, honours /etc/hosts) resolves localhost without the network', async () => {
    const addrs = await dns.promises.lookup('localhost', { all: true });
    assert.ok(addrs.length >= 1);
    assert.ok(addrs.every((a) => a.address === '127.0.0.1' || a.address === '::1'));
  });

  test('Node 26 defaults: verbatim result order and Happy Eyeballs (autoSelectFamily)', () => {
    assert.equal(dns.getDefaultResultOrder(), 'verbatim');
    assert.equal(net.getDefaultAutoSelectFamily(), true);
    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 500); // observed on 26.12.1
  });

  test('a custom lookup function plugs into every socket (here: a static map, no DNS at all)', async () => {
    const s = http.createServer((_q, r) => r.end('pinned'));
    const port = await listen(s);
    const lookup = ((
      _host: string,
      _opts: unknown,
      cb: (e: null, a: string | Array<{ address: string; family: number }>, f?: number) => void,
    ) => cb(null, [{ address: '127.0.0.1', family: 4 }])) as unknown as net.LookupFunction;
    const body = await new Promise<string>((resolve) =>
      http.get({ host: 'service.internal', port, lookup }, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve(b));
      }),
    );
    assert.equal(body, 'pinned');
    s.close();
  });
});

describe('HTTP/2', () => {
  test('one connection, multiplexed streams (cleartext h2c in-process)', async () => {
    const server = http2.createServer();
    server.on('stream', (stream: http2.ServerHttp2Stream, headers) => {
      stream.respond({ ':status': 200 });
      stream.end(`path=${headers[':path']}`);
    });
    const port = await listen(server as unknown as net.Server);
    const client = http2.connect(`http://127.0.0.1:${port}`);
    const get = (p: string) =>
      new Promise<string>((resolve) => {
        const req = client.request({ ':path': p });
        let b = '';
        req.setEncoding('utf8');
        req.on('data', (d) => (b += d));
        req.on('end', () => resolve(b));
      });
    assert.deepEqual(await Promise.all([get('/a'), get('/b'), get('/c')]), [
      'path=/a',
      'path=/b',
      'path=/c',
    ]);
    client.close();
    server.close();
  });
});

describe('handler and client utilities (07-http-utils.ts)', async () => {
  const { readBody, HttpError, withRetry } = await import('./07-http-utils.ts');

  async function bodyServer(limit: number) {
    const s = http.createServer(async (req, res) => {
      try {
        const body = await readBody(req, limit);
        res.end(`got ${body.length}`);
      } catch (err) {
        res.statusCode = err instanceof HttpError ? err.status : 500;
        res.setHeader('connection', 'close');
        res.end(String((err as Error).message));
      }
    });
    return { s, port: await listen(s) };
  }

  test('a body within the limit is read', async () => {
    const { s, port } = await bodyServer(1024);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: 'x'.repeat(100) });
      assert.equal(await r.text(), 'got 100');
    } finally {
      s.close();
    }
  });

  test('a declared Content-Length above the limit is refused with 413 before reading', async () => {
    const { s, port } = await bodyServer(1024);
    try {
      const resp = await raw(port, 'POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 999999\r\n\r\n');
      assert.equal(statusLine(resp), 'HTTP/1.1 413 Payload Too Large');
    } finally {
      s.close();
    }
  });

  test('a chunked body that grows past the limit is cut off with 413', async () => {
    const { s, port } = await bodyServer(1024);
    const big = 'x'.repeat(4096);
    try {
      const resp = await raw(
        port,
        `POST / HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n${big.length.toString(16)}\r\n${big}\r\n0\r\n\r\n`,
      );
      assert.equal(statusLine(resp), 'HTTP/1.1 413 Payload Too Large');
    } finally {
      s.closeAllConnections();
      s.close();
    }
  });

  test('withRetry retries an idempotent request after a connection reset, never a POST', async () => {
    const reset = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    let calls = 0;
    assert.equal(
      await withRetry('GET', async () => {
        if (calls++ === 0) throw reset;
        return 'ok';
      }),
      'ok',
    );
    assert.equal(calls, 2);
    let posts = 0;
    await assert.rejects(
      withRetry('POST', async () => {
        posts++;
        throw reset;
      }),
      /socket hang up/,
    );
    assert.equal(posts, 1);
  });

  test('withRetry does not retry non-transport errors', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry('GET', async () => {
        calls++;
        throw new HttpError(500, 'server error');
      }),
    );
    assert.equal(calls, 1);
  });
});
