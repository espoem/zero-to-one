// Stream building blocks used in module 05.
import { Readable, Transform, type TransformCallback } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

/**
 * Splits a byte or string stream into lines (objectMode output).
 * Invariant: after each transform() call, `this.tail` holds exactly the bytes after the last '\n'
 * seen so far, so no line is emitted before its terminator and none is lost at a chunk boundary.
 */
export class LineSplitter extends Transform {
  private tail = '';
  private readonly decoder = new StringDecoder('utf8');

  constructor() {
    super({ readableObjectMode: true });
  }

  override _transform(chunk: Buffer | string, _enc: BufferEncoding, cb: TransformCallback): void {
    const text = this.tail + (typeof chunk === 'string' ? chunk : this.decoder.write(chunk));
    const parts = text.split('\n');
    this.tail = parts.pop() ?? '';
    for (const line of parts) this.push(line);
    cb();
  }

  override _flush(cb: TransformCallback): void {
    const rest = this.tail + this.decoder.end();
    if (rest.length > 0) this.push(rest);
    cb();
  }
}

/** A Readable that produces `count` chunks of `size` bytes, only when asked (pull-based). */
export function boundedProducer(count: number, size: number): Readable {
  let produced = 0;
  return new Readable({
    highWaterMark: 1024,
    read() {
      if (produced++ < count) this.push(Buffer.alloc(size, 0x61));
      else this.push(null);
    },
  });
}

/**
 * Decodes length-prefixed frames: [u32 big-endian length][payload] ... (a common TCP framing).
 * Invariant: `this.pending` holds bytes that do not yet form a complete frame, so
 * pending.length < 4 or pending.length < 4 + declared length. Frames above `maxFrame` are rejected
 * before their payload is buffered (a memory-exhaustion defence).
 */
export class FrameDecoder extends Transform {
  private pending: Buffer = Buffer.alloc(0);
  private readonly maxFrame: number;
  constructor(maxFrame = 1 << 20) {
    super({ readableObjectMode: true });
    this.maxFrame = maxFrame;
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    while (this.pending.length >= 4) {
      const len = this.pending.readUInt32BE(0);
      if (len > this.maxFrame)
        return cb(
          Object.assign(new Error(`frame of ${len} bytes exceeds ${this.maxFrame}`), {
            code: 'E_FRAME_TOO_LARGE',
          }),
        );
      if (this.pending.length < 4 + len) break;
      this.push(Buffer.from(this.pending.subarray(4, 4 + len))); // copy: do not pin the upstream chunk
      this.pending = this.pending.subarray(4 + len);
    }
    cb();
  }

  override _flush(cb: TransformCallback): void {
    cb(
      this.pending.length === 0
        ? null
        : Object.assign(new Error('truncated frame at end of stream'), { code: 'E_TRUNCATED' }),
    );
  }
}

export function encodeFrame(payload: Buffer): Buffer {
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.length, 0); // every byte of the unsafe allocation is overwritten
  return Buffer.concat([header, payload]);
}
