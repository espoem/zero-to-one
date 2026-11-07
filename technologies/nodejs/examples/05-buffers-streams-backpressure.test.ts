// Module 05 · Buffers, streams and backpressure.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer, constants as bufferConstants } from 'node:buffer';
import { StringDecoder } from 'node:string_decoder';
import {
  Readable,
  Writable,
  Transform,
  PassThrough,
  Duplex,
  pipeline as pipelineCb,
  getDefaultHighWaterMark,
} from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';
import { text, json } from 'node:stream/consumers';
import { createGzip, createGunzip } from 'node:zlib';
import { setImmediate as tick } from 'node:timers/promises';
import fc from 'fast-check';
import { LineSplitter, boundedProducer, FrameDecoder, encodeFrame } from './05-streams.ts';
import { runNode } from './helpers/run-node.ts';

describe('Buffer', () => {
  test('Node 26 defaults: 64 KiB pool, allocations below 32 KiB come from it', () => {
    assert.equal(Buffer.poolSize, 64 * 1024);
    let a = Buffer.from('secret-token');
    let b = Buffer.allocUnsafe(16);
    if (a.buffer !== b.buffer) {
      a = Buffer.from('secret-token');
      b = Buffer.allocUnsafe(16);
    } // pool rolled over once
    assert.equal(a.buffer, b.buffer, 'small unsafe allocations share one ArrayBuffer');
    assert.notEqual(Buffer.alloc(16).buffer, a.buffer, 'alloc() is never pooled');
    assert.notEqual(
      Buffer.allocUnsafeSlow(16).buffer,
      a.buffer,
      'allocUnsafeSlow() is never pooled',
    );
  });

  test('negative: buf.buffer exposes NEIGHBOURING pooled data (never hand .buffer to untrusted code)', () => {
    let secret = Buffer.from('secret-token');
    let mine = Buffer.from('x');
    if (secret.buffer !== mine.buffer) {
      secret = Buffer.from('secret-token');
      mine = Buffer.from('x');
    }
    const whole = Buffer.from(mine.buffer); // the entire pool slab, not just my 1 byte
    assert.ok(whole.includes('secret-token'));
    assert.ok(mine.byteOffset > 0);
  });

  test('--zero-fill-buffers makes allocUnsafe zeroed (at a cost)', () => {
    const r = runNode([
      '--zero-fill-buffers',
      '-p',
      'Buffer.allocUnsafe(64).every((b) => b === 0)',
    ]);
    assert.equal(r.stdout.trim(), 'true');
  });

  test('Buffer#slice SHARES memory (like subarray); Uint8Array#slice COPIES', () => {
    const buf = Buffer.from('abc');
    buf.subarray(0, 1)[0] = 0x7a; // 'z'
    assert.equal(buf.toString(), 'zbc');
    const u8 = new Uint8Array(buf);
    u8.slice(0, 1)[0] = 0x79;
    assert.equal(u8[0], 0x7a); // unchanged: Uint8Array#slice copied
  });

  test('length is bytes, not characters', () => {
    assert.equal('€'.length, 1);
    assert.equal(Buffer.byteLength('€'), 3);
    assert.equal(Buffer.byteLength('😀'), 4);
    assert.equal('😀'.length, 2);
  });

  test('decoding a split multi-byte character: toString corrupts, StringDecoder buffers', () => {
    const euro = Buffer.from('€'); // e2 82 ac
    const [p1, p2] = [euro.subarray(0, 2), euro.subarray(2)];
    assert.equal(p1.toString() + p2.toString(), '��'); // two replacement chars
    const d = new StringDecoder('utf8');
    assert.equal(d.write(p1) + d.write(p2) + d.end(), '€');
  });

  test('encodings: base64url, hex, latin1 is not UTF-8', () => {
    const b = Buffer.from([0xfb, 0xff]);
    assert.equal(b.toString('base64'), '+/8=');
    assert.equal(b.toString('base64url'), '-_8');
    assert.equal(b.toString('hex'), 'fbff');
    assert.equal(Buffer.from('€').toString('latin1'), 'â\u0082¬');
  });

  test('a Buffer is a Uint8Array; the max length is bounded', () => {
    assert.ok(Buffer.from('a') instanceof Uint8Array);
    assert.ok(bufferConstants.MAX_LENGTH >= 2 ** 32);
    assert.throws(() => Buffer.alloc(bufferConstants.MAX_LENGTH + 1), { code: 'ERR_OUT_OF_RANGE' });
  });
});

describe('Writable: write() returns the backpressure signal', () => {
  test('write() returns false once the buffer reaches highWaterMark; drain fires when it empties', async () => {
    const pending: Array<() => void> = [];
    const w = new Writable({
      highWaterMark: 4,
      write(_c, _e, cb) {
        pending.push(cb);
      },
    });
    assert.equal(w.write('ab'), true);
    assert.equal(w.write('cd'), false); // 4 bytes buffered >= hwm
    assert.equal(w.writableNeedDrain, true);
    assert.equal(w.write('ef'), false); // still accepted! false is advice, not refusal
    assert.equal(w.writableLength, 6);
    const drained = new Promise((r) => w.once('drain', r));
    while (pending.length) {
      pending.shift()!();
      await tick();
    }
    await drained;
    assert.equal(w.writableLength, 0);
  });

  test('defaults: 64 KiB for byte streams (since Node 22), 16 objects in objectMode', () => {
    assert.equal(getDefaultHighWaterMark(false), 65536);
    assert.equal(getDefaultHighWaterMark(true), 16);
  });

  test('negative: a producer that ignores write() === false buffers without bound', () => {
    const w = new Writable({
      highWaterMark: 1024,
      write(_c, _e, _cb) {
        /* consumer stalls */
      },
    });
    for (let i = 0; i < 1000; i++) w.write(Buffer.alloc(1024));
    assert.equal(w.writableLength, 1000 * 1024); // 1000x the high-water mark, all in memory
  });

  test('a producer that respects backpressure keeps memory bounded by the high-water marks', async () => {
    const hwm = 1024;
    let maxBuffered = 0;
    const slow = new Writable({
      highWaterMark: hwm,
      write(_chunk, _enc, cb) {
        setImmediate(cb);
      },
    });
    const src = boundedProducer(200, 256); // 200 chunks of 256 bytes, produced on demand
    src.on(
      'data',
      () => (maxBuffered = Math.max(maxBuffered, src.readableLength + slow.writableLength)),
    );
    await pipeline(src, slow);
    assert.ok(maxBuffered <= 2 * hwm + 256, `buffered ${maxBuffered}`); // both buffers' hwm + one chunk
  });

  test("writing a string with the 'buffer' encoding is rejected (Node 26.3+)", () => {
    const w = new Writable({
      write(_c, _e, cb) {
        cb();
      },
    });
    assert.throws(() => w.write('x', 'buffer' as BufferEncoding), { code: 'ERR_UNKNOWN_ENCODING' });
  });
});

describe('pipe() vs pipeline()', () => {
  test('negative: pipe() does not propagate errors; the destination is left open (leak)', async () => {
    const src = new Readable({ read() {} });
    const dst = new PassThrough();
    src.on('error', () => {});
    src.pipe(dst);
    src.destroy(new Error('source failed'));
    await tick();
    await tick();
    assert.equal(dst.destroyed, false);
    dst.destroy();
  });

  test('pipeline() destroys every stream and reports the first error', async () => {
    const src = new Readable({ read() {} });
    const dst = new PassThrough();
    const done = new Promise<Error | null | undefined>((r) => pipelineCb(src, dst, r));
    src.destroy(new Error('source failed'));
    assert.equal((await done)?.message, 'source failed');
    assert.equal(dst.destroyed, true);
  });

  test('pipeline() accepts an AbortSignal and async generator stages', async () => {
    const ac = new AbortController();
    const seen: string[] = [];
    const p = pipeline(
      Readable.from(['a', 'b', 'c']),
      async function* (source) {
        for await (const s of source) {
          yield String(s).toUpperCase();
          if (s === 'b') ac.abort();
        }
      },
      new Writable({
        objectMode: true,
        write(c, _e, cb) {
          seen.push(String(c));
          cb();
        },
      }),
      { signal: ac.signal },
    );
    await assert.rejects(p, { name: 'AbortError' });
    assert.ok(!seen.includes('C'));
  });

  test('gzip round trip through pipeline, consumed with stream/consumers', async () => {
    const input = 'hello '.repeat(10_000);
    const gz = Readable.from([input]).pipe(createGzip());
    const compressed = Buffer.concat(await gz.toArray());
    assert.ok(compressed.length < input.length / 10);
    assert.equal(await text(Readable.from([compressed]).pipe(createGunzip())), input);
    assert.deepEqual(await json(Readable.from(['{"a":', '1}'])), { a: 1 });
  });
});

describe('implementing streams', () => {
  test('a Transform that splits lines correctly across chunk boundaries', async () => {
    const out: string[] = [];
    await pipeline(
      Readable.from(['al', 'pha\nbe', 'ta\n', 'gam', 'ma']),
      new LineSplitter(),
      new Writable({
        objectMode: true,
        write(line, _e, cb) {
          out.push(line);
          cb();
        },
      }),
    );
    assert.deepEqual(out, ['alpha', 'beta', 'gamma']);
  });

  test('property: LineSplitter output is independent of how the input is chunked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.stringMatching(/^[a-z]{0,5}$/), { maxLength: 8 }),
        fc.array(fc.nat(30), { maxLength: 6 }),
        async (lines, cuts) => {
          const textIn = lines.join('\n');
          const points = [...new Set(cuts.map((c) => c % (textIn.length + 1)))].sort(
            (a, b) => a - b,
          );
          const chunks: string[] = [];
          let prev = 0;
          for (const p of [...points, textIn.length]) {
            chunks.push(textIn.slice(prev, p));
            prev = p;
          }
          const out: string[] = [];
          await pipeline(
            Readable.from(chunks.filter((c) => c.length > 0)),
            new LineSplitter(),
            new Writable({
              objectMode: true,
              write(l, _e, cb) {
                out.push(l);
                cb();
              },
            }),
          );
          const expected = textIn.split('\n');
          if (expected.at(-1) === '') expected.pop(); // a trailing newline ends the last line; it does not start a new one
          assert.deepEqual(out, expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('a Transform that throws in transform() errors the pipeline instead of crashing', async () => {
    const bad = new Transform({
      transform(_c, _e, cb) {
        cb(new Error('bad chunk'));
      },
    });
    await assert.rejects(pipeline(Readable.from(['x']), bad, new PassThrough()), /bad chunk/);
  });

  test('Duplex: two independent sides (duplexPair connects two of them)', async () => {
    const { duplexPair } = await import('node:stream');
    const [a, b] = duplexPair();
    a.end('ping');
    assert.equal(await text(b as unknown as Readable), 'ping');
    assert.ok(a instanceof Duplex);
  });

  test("finished() resolves on 'finish' for writables and rejects on premature close", async () => {
    const w = new PassThrough();
    const ok = finished(w.resume());
    w.end('x');
    await ok;
    const r = new PassThrough();
    const premature = finished(r);
    r.destroy();
    await assert.rejects(premature, { code: 'ERR_STREAM_PREMATURE_CLOSE' });
  });
});

describe('modern consumption', () => {
  test('for await over a Readable applies backpressure automatically', async () => {
    let produced = 0;
    const src = new Readable({
      objectMode: true,
      highWaterMark: 2,
      read() {
        produced++;
        this.push(produced <= 10 ? produced : null);
      },
    });
    let maxAhead = 0;
    let consumed = 0;
    for await (const _ of src) {
      consumed++;
      maxAhead = Math.max(maxAhead, produced - consumed);
      await tick();
    }
    assert.equal(consumed, 10);
    assert.ok(maxAhead <= 3, `producer ran ${maxAhead} ahead`);
  });

  test('Readable#map with bounded concurrency preserves order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await Readable.from([1, 2, 3, 4, 5, 6])
      .map(
        async (x: number) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await tick();
          inFlight--;
          return x * 10;
        },
        { concurrency: 2 },
      )
      .toArray();
    assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
    assert.ok(peak <= 2);
  });

  test('Web Streams interop: Readable.toWeb / fromWeb', async () => {
    const web = Readable.toWeb(Readable.from([Buffer.from('web')]));
    const back = Readable.fromWeb(web as Parameters<typeof Readable.fromWeb>[0]);
    assert.equal(await text(back), 'web');
  });
});

describe('binary framing (FrameDecoder)', () => {
  const decodeAll = async (chunks: Buffer[], max?: number) => {
    const out: string[] = [];
    await pipeline(
      Readable.from(chunks),
      new FrameDecoder(max),
      new Writable({
        objectMode: true,
        write(f: Buffer, _e, cb) {
          out.push(f.toString());
          cb();
        },
      }),
    );
    return out;
  };

  test('property: frames decode identically under any re-chunking of the byte stream', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 6 }),
        fc.array(fc.nat(200), { maxLength: 8 }),
        async (msgs, cuts) => {
          const bytes = Buffer.concat(msgs.map((m) => encodeFrame(Buffer.from(m))));
          const points = [...new Set(cuts.map((c) => c % (bytes.length + 1)))].sort(
            (a, b) => a - b,
          );
          const chunks: Buffer[] = [];
          let prev = 0;
          for (const p of [...points, bytes.length]) {
            if (p > prev) chunks.push(bytes.subarray(prev, p));
            prev = p;
          }
          assert.deepEqual(await decodeAll(chunks), msgs);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('negative: an oversized declared length is rejected before buffering the payload', async () => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(10_000_000);
    await assert.rejects(decodeAll([header], 1024), { code: 'E_FRAME_TOO_LARGE' });
  });

  test('negative: a stream that ends mid-frame is an error, not silent data loss', async () => {
    const frame = encodeFrame(Buffer.from('hello'));
    await assert.rejects(decodeAll([frame.subarray(0, 6)]), { code: 'E_TRUNCATED' });
  });
});

describe('zlib safety', () => {
  test('maxOutputLength stops a decompression bomb', async () => {
    const { gzipSync, gunzip } = await import('node:zlib');
    const bomb = gzipSync(Buffer.alloc(50 * 1024 * 1024)); // 50 MiB of zeros compresses to ~50 KiB
    assert.ok(bomb.length < 100 * 1024);
    await assert.rejects(
      new Promise((res, rej) =>
        gunzip(bomb, { maxOutputLength: 1024 * 1024 }, (e, r) => (e ? rej(e) : res(r))),
      ),
      { code: 'ERR_BUFFER_TOO_LARGE' },
    );
  });
});
