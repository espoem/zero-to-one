// Verification script for the hands-on tasks (H1–H6) in exams/interview.md.
// By default it checks the reference solutions; set SOLUTIONS to check your own file.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { Writable } from 'node:stream';
import { describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

type ExamSolutions = typeof import('./exam-solutions.ts');
const S: ExamSolutions = await import(process.env.SOLUTIONS ?? './exam-solutions.ts');

function fixture(rel: string): URL {
  return new URL(`./fixtures/09-workers/${rel}`, import.meta.url);
}

describe('H1 · promisifyOnce', () => {
  test('resolves result for successful error-first callback', async () => {
    const fn = (a: number, b: number, cb: (err: Error | null, sum: number) => void) => {
      setImmediate(() => cb(null, a + b));
    };
    const pFn = S.promisifyOnce(fn);
    const res = await pFn(3, 7);
    assert.equal(res, 10);
  });

  test('rejects when callback receives an error', async () => {
    const fn = (cb: (err: Error | null, val?: string) => void) => {
      setImmediate(() => cb(new Error('boom')));
    };
    const pFn = S.promisifyOnce(fn);
    await assert.rejects(pFn(), /boom/);
  });

  test('guards against double callbacks: only first settlement applies', async () => {
    const fn = (cb: (err: Error | null, val?: string) => void) => {
      cb(null, 'first');
      cb(null, 'second');
      cb(new Error('late error'));
    };
    const pFn = S.promisifyOnce(fn);
    const res = await pFn();
    assert.equal(res, 'first');
  });

  test('guards against synchronous exceptions inside the function', async () => {
    const fn = () => {
      throw new Error('sync crash');
    };
    const pFn = S.promisifyOnce(fn);
    await assert.rejects(pFn(), /sync crash/);
  });
});

describe('H2 · FrameDecoder', () => {
  test('decodes multiple frames in a single chunk', async () => {
    const decoder = new S.FrameDecoder();
    const frames: Buffer[] = [];
    decoder.on('data', (f: Buffer) => frames.push(f));

    const f1 = S.encodeFrame(Buffer.from('hello'));
    const f2 = S.encodeFrame(Buffer.from('world'));
    decoder.write(Buffer.concat([f1, f2]));
    decoder.end();
    await once(decoder, 'end');

    assert.equal(frames.length, 2);
    assert.equal(frames[0]?.toString('utf8'), 'hello');
    assert.equal(frames[1]?.toString('utf8'), 'world');
  });

  test('reassembles frames split across arbitrary byte boundaries', async () => {
    const decoder = new S.FrameDecoder();
    const frames: Buffer[] = [];
    decoder.on('data', (f: Buffer) => frames.push(f));

    const payload = Buffer.from('chunked-frame-data');
    const full = S.encodeFrame(payload);

    // Feed one byte at a time
    for (let i = 0; i < full.length; i++) {
      decoder.write(full.subarray(i, i + 1));
    }
    decoder.end();
    await once(decoder, 'end');

    assert.equal(frames.length, 1);
    assert.equal(frames[0]?.toString('utf8'), 'chunked-frame-data');
  });

  test('rejects frames exceeding maxFrame with E_FRAME_TOO_LARGE', async () => {
    const decoder = new S.FrameDecoder(16); // max 16 bytes
    const errorPromise = once(decoder, 'error').then(([err]) => err);

    const oversized = S.encodeFrame(Buffer.alloc(32, 0x41));
    decoder.write(oversized);

    const err = (await errorPromise) as { code?: string; message: string };
    assert.equal(err.code, 'E_FRAME_TOO_LARGE');
  });

  test('rejects truncated trailing frame with E_TRUNCATED on flush', async () => {
    const decoder = new S.FrameDecoder();
    const errorPromise = once(decoder, 'error').then(([err]) => err);

    // Header says 10 bytes, but only 4 bytes follow
    const header = Buffer.alloc(4);
    header.writeUInt32BE(10, 0);
    decoder.write(Buffer.concat([header, Buffer.from('four')]));
    decoder.end();

    const err = (await errorPromise) as { code?: string };
    assert.equal(err.code, 'E_TRUNCATED');
  });
});

describe('H3 · writeWithBackpressure', () => {
  test('writes all chunks to a fast writable without waiting', async () => {
    const received: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        received.push(String(chunk));
        cb();
      },
    });

    await S.writeWithBackpressure(sink, ['a', 'b', 'c']);
    assert.deepEqual(received, ['a', 'b', 'c']);
  });

  test('pauses on write() false and waits for drain', async () => {
    const writes: string[] = [];
    let drainCount = 0;

    // highWaterMark 1 byte: writing 'hello' returns false
    const slowSink = new Writable({
      highWaterMark: 1,
      write(chunk, _enc, cb) {
        writes.push(String(chunk));
        setTimeout(cb, 10);
      },
    });
    slowSink.on('drain', () => {
      drainCount++;
    });

    await S.writeWithBackpressure(slowSink, ['chunk1', 'chunk2', 'chunk3']);
    assert.equal(writes.length, 3);
    assert.ok(drainCount >= 1, `expected drain calls, got ${drainCount}`);
  });

  test('rejects if the writable emits error and removes listeners', async () => {
    const sink = new Writable({
      highWaterMark: 1,
      write(_chunk, _enc, cb) {
        setTimeout(() => cb(new Error('disk failure')), 5);
      },
    });

    await assert.rejects(
      S.writeWithBackpressure(sink, ['part1', 'part2', 'part3']),
      /disk failure/,
    );
    assert.equal(sink.listenerCount('drain'), 0);
  });
});

describe('H4 · withTimeout', () => {
  test('resolves successfully before deadline without leaving timers', async () => {
    const res = await S.withTimeout(async () => {
      await delay(10);
      return 'done';
    }, 100);
    assert.equal(res, 'done');
  });

  test('rejects with TimeoutError when deadline is exceeded and aborts signal', async () => {
    let signalAborted = false;
    await assert.rejects(
      S.withTimeout(async (signal) => {
        signal.addEventListener('abort', () => {
          signalAborted = true;
        });
        await delay(150);
        return 'too late';
      }, 20),
      (err: Error) => err.name === 'TimeoutError',
    );
    assert.equal(signalAborted, true);
  });

  test('cancels immediately if parentSignal is already aborted', async () => {
    const parent = AbortSignal.abort(new Error('parent aborted'));
    await assert.rejects(
      S.withTimeout(async () => 'never', 100, parent),
      /parent aborted/,
    );
  });

  test('aborts when parent signal fires during execution', async () => {
    const controller = new AbortController();
    let abortedReason: unknown;

    setTimeout(() => controller.abort(new Error('cancelled by caller')), 15);

    await assert.rejects(
      S.withTimeout(
        async (signal) => {
          signal.addEventListener('abort', () => {
            abortedReason = signal.reason;
          });
          await delay(200);
          return 'ok';
        },
        500,
        controller.signal,
      ),
      /cancelled by caller/,
    );
    assert.match(String(abortedReason), /cancelled by caller/);
  });
});

describe('H5 · WorkerPool', () => {
  test('computes results with bounded worker pool', async () => {
    const pool = new S.WorkerPool(fixture('task.mjs'), 2, 10);
    const results = await Promise.all([
      pool.run<number>({ kind: 'fib', n: 10 }),
      pool.run<number>({ kind: 'fib', n: 12 }),
      pool.run<number>({ kind: 'fib', n: 14 }),
    ]);
    assert.deepEqual(results, [55, 144, 377]);
    assert.ok(pool.peakConcurrency <= 2);
    await pool.close();
  });

  test('rejects with queue full when capacity is exceeded', async () => {
    // 1 worker, maxQueue = 1: can hold 1 running + 1 in queue. 3rd run must reject.
    const pool = new S.WorkerPool(fixture('task.mjs'), 1, 1);
    const p1 = pool.run({ kind: 'fib', n: 25 });
    const p2 = pool.run({ kind: 'fib', n: 25 });

    await assert.rejects(pool.run({ kind: 'fib', n: 25 }), /queue full/);

    await Promise.all([p1, p2]);
    await pool.close();
  });

  test('replaces crashed workers and continues servicing requests', async () => {
    const pool = new S.WorkerPool(fixture('task.mjs'), 1, 5);
    await assert.rejects(pool.run({ kind: 'crash' }), /crashed the worker/);
    const res = await pool.run<number>({ kind: 'fib', n: 8 });
    assert.equal(res, 21);
    await pool.close();
  });
});

describe('H6 · gracefulShutdown', () => {
  test('graceful shutdown waits for in-flight request to finish (forced === false)', async () => {
    let reqReceived: () => void;
    const reqPromise = new Promise<void>((resolve) => {
      reqReceived = resolve;
    });

    const server = http.createServer((_req, res) => {
      reqReceived();
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      }, 50);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };

    // Start request
    const clientReq = http.get(`http://127.0.0.1:${addr.port}`);
    const clientResPromise = new Promise<string>((resolve, reject) => {
      clientReq.on('response', (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve(body));
      });
      clientReq.on('error', reject);
    });

    await reqPromise;
    // Initiate shutdown with generous deadline
    const shutdownPromise = S.gracefulShutdown(server, 1000);
    const body = await clientResPromise;
    const shutdownResult = await shutdownPromise;

    assert.equal(body, 'ok');
    assert.equal(shutdownResult.forced, false);
  });

  test('forces socket termination when request exceeds deadline (forced === true)', async () => {
    let reqReceived: () => void;
    const reqPromise = new Promise<void>((resolve) => {
      reqReceived = resolve;
    });

    const server = http.createServer((_req, res) => {
      reqReceived();
      // Intentionally hangs longer than shutdown deadline
      setTimeout(() => {
        res.end('too late');
      }, 500);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };

    const clientReq = http.get(`http://127.0.0.1:${addr.port}`);
    clientReq.on('error', () => {
      // Expected socket destruction
    });

    await reqPromise;
    // 50ms deadline is shorter than the 500ms handler
    const shutdownResult = await S.gracefulShutdown(server, 50);
    assert.equal(shutdownResult.forced, true);
  });

  test('child process graceful shutdown on SIGTERM exits 0', async () => {
    const serverScript = `
      import http from 'node:http';
      import { installGracefulShutdown } from './examples/exam-solutions.ts';

      const server = http.createServer((req, res) => {
        if (req.url === '/slow') {
          process.stdout.write('req-started\\n');
          setTimeout(() => {
            res.writeHead(200);
            res.end('done');
          }, 60);
        }
      });

      installGracefulShutdown(server, 2000);

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        process.stdout.write('listening ' + port + '\\n');
      });
    `;

    const child = spawn(process.execPath, ['--input-type=module', '-e', serverScript], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    const waitForToken = (token: string): Promise<string> =>
      new Promise((resolve) => {
        const check = () => {
          const match = stdoutBuffer.split('\n').find((line) => line.includes(token));
          if (match !== undefined) return match;
          return null;
        };
        const found = check();
        if (found !== null) return resolve(found);
        const onData = (chunk: Buffer | string) => {
          stdoutBuffer += String(chunk);
          const f = check();
          if (f !== null) {
            child.stdout.off('data', onData);
            resolve(f);
          }
        };
        child.stdout.on('data', onData);
      });

    const listenLine = await waitForToken('listening');
    const port = Number(listenLine.split(' ')[1]);

    const responsePromise = new Promise<string>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/slow`, (res) => {
          let b = '';
          res.on('data', (c) => (b += c));
          res.on('end', () => resolve(b));
        })
        .on('error', reject);
    });

    await waitForToken('req-started');
    child.kill('SIGTERM');

    const body = await responsePromise;
    assert.equal(body, 'done');

    const [exitCode] = await once(child, 'exit');
    assert.equal(exitCode, 0);
  });
});
