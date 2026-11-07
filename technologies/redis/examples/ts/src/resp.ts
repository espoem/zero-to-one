// RESP2 / RESP3 incremental parser and encoder.
// Spec: https://redis.io/docs/latest/develop/reference/protocol-spec/
// Streamed aggregates (`$?`, `*?` with `;` chunks) are intentionally not supported; no server
// command emits them today, and the parser rejects them with a protocol error.

export type RespValue =
  | { type: 'simple'; value: string; attributes?: RespMap }
  | { type: 'error'; value: string; attributes?: RespMap }
  | { type: 'integer'; value: bigint; attributes?: RespMap }
  | { type: 'bulk'; value: Buffer | null; attributes?: RespMap }
  | { type: 'array'; value: RespValue[] | null; attributes?: RespMap }
  | { type: 'null'; attributes?: RespMap }
  | { type: 'boolean'; value: boolean; attributes?: RespMap }
  | { type: 'double'; value: number; attributes?: RespMap }
  | { type: 'bignum'; value: bigint; attributes?: RespMap }
  | { type: 'bulkError'; value: string; attributes?: RespMap }
  | { type: 'verbatim'; format: string; value: string; attributes?: RespMap }
  | { type: 'map'; value: RespMap; attributes?: RespMap }
  | { type: 'set'; value: RespValue[]; attributes?: RespMap }
  | { type: 'push'; value: RespValue[]; attributes?: RespMap };

export type RespMap = Array<[RespValue, RespValue]>;

export class RespProtocolError extends Error {
  override name = 'RespProtocolError';
}

/** Thrown internally when the buffer ends mid-value; the parser waits for more bytes. */
const INCOMPLETE = Symbol('incomplete');

export interface ParserOptions {
  /** Mirrors the server's `proto-max-bulk-len` (default 512 MB). */
  maxBulkLength?: number;
  /** Defence against deeply nested replies exhausting the stack. */
  maxDepth?: number;
}

export class RespParser {
  private buf: Buffer = Buffer.alloc(0);
  private readonly maxBulk: number;
  private readonly maxDepth: number;

  constructor(opts: ParserOptions = {}) {
    this.maxBulk = opts.maxBulkLength ?? 512 * 1024 * 1024;
    this.maxDepth = opts.maxDepth ?? 128;
  }

  /** Feed bytes; returns every value completed by them (zero or more: pipelined replies). */
  push(chunk: Uint8Array | string): RespValue[] {
    this.buf = Buffer.concat([this.buf, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
    const out: RespValue[] = [];
    for (;;) {
      if (this.buf.length === 0) break;
      let res: { v: RespValue; end: number };
      try {
        res = this.read(0, 0);
      } catch (e) {
        if (e === INCOMPLETE) break;
        throw e;
      }
      out.push(res.v);
      this.buf = this.buf.subarray(res.end);
    }
    return out;
  }

  /** Bytes received but not yet forming a complete value. */
  get pending(): number {
    return this.buf.length;
  }

  private line(pos: number): { text: string; next: number } {
    const idx = this.buf.indexOf('\r\n', pos, 'latin1');
    if (idx < 0) throw INCOMPLETE;
    return { text: this.buf.toString('utf8', pos, idx), next: idx + 2 };
  }

  private int(text: string, what: string): number {
    if (!/^-?\d+$/.test(text))
      throw new RespProtocolError(`invalid ${what}: ${JSON.stringify(text)}`);
    return Number(text);
  }

  private blob(pos: number, len: number): { data: Buffer; next: number } {
    if (len > this.maxBulk) throw new RespProtocolError(`bulk length ${len} exceeds limit`);
    if (this.buf.length < pos + len + 2) throw INCOMPLETE;
    if (this.buf[pos + len] !== 0x0d || this.buf[pos + len + 1] !== 0x0a) {
      throw new RespProtocolError('bulk payload not terminated by CRLF');
    }
    return { data: Buffer.from(this.buf.subarray(pos, pos + len)), next: pos + len + 2 };
  }

  private read(pos: number, depth: number): { v: RespValue; end: number } {
    if (depth > this.maxDepth) throw new RespProtocolError('nesting too deep');
    if (pos >= this.buf.length) throw INCOMPLETE;
    const prefix = String.fromCharCode(this.buf[pos]!);
    const { text, next } = this.line(pos + 1);
    switch (prefix) {
      case '+':
        return { v: { type: 'simple', value: text }, end: next };
      case '-':
        return { v: { type: 'error', value: text }, end: next };
      case ':':
        if (!/^[+-]?\d+$/.test(text)) throw new RespProtocolError(`invalid integer: ${text}`);
        return { v: { type: 'integer', value: BigInt(text) }, end: next };
      case '(':
        if (!/^[+-]?\d+$/.test(text)) throw new RespProtocolError(`invalid big number: ${text}`);
        return { v: { type: 'bignum', value: BigInt(text) }, end: next };
      case '_':
        if (text !== '') throw new RespProtocolError('null must be empty');
        return { v: { type: 'null' }, end: next };
      case '#':
        if (text !== 't' && text !== 'f') throw new RespProtocolError(`invalid boolean: ${text}`);
        return { v: { type: 'boolean', value: text === 't' }, end: next };
      case ',': {
        const map: Record<string, number> = { inf: Infinity, '-inf': -Infinity, nan: NaN };
        const d = text in map ? map[text]! : Number(text);
        if (!(text in map) && (text === '' || Number.isNaN(d)))
          throw new RespProtocolError(`invalid double: ${text}`);
        return { v: { type: 'double', value: d }, end: next };
      }
      case '$': {
        if (text === '?') throw new RespProtocolError('streamed strings are not supported');
        const len = this.int(text, 'bulk length');
        if (len === -1) return { v: { type: 'bulk', value: null }, end: next }; // RESP2 null bulk
        if (len < 0) throw new RespProtocolError(`negative bulk length ${len}`);
        const b = this.blob(next, len);
        return { v: { type: 'bulk', value: b.data }, end: b.next };
      }
      case '!': {
        const len = this.int(text, 'bulk error length');
        if (len < 0) throw new RespProtocolError('negative bulk error length');
        const b = this.blob(next, len);
        return { v: { type: 'bulkError', value: b.data.toString('utf8') }, end: b.next };
      }
      case '=': {
        const len = this.int(text, 'verbatim length');
        if (len < 4) throw new RespProtocolError('verbatim string needs a 3-byte format and ":"');
        const b = this.blob(next, len);
        const s = b.data.toString('utf8');
        if (s[3] !== ':') throw new RespProtocolError('verbatim format separator missing');
        return { v: { type: 'verbatim', format: s.slice(0, 3), value: s.slice(4) }, end: b.next };
      }
      case '*':
      case '~':
      case '>': {
        if (text === '?') throw new RespProtocolError('streamed aggregates are not supported');
        const n = this.int(text, 'aggregate length');
        if (n === -1 && prefix === '*') return { v: { type: 'array', value: null }, end: next }; // RESP2 null array
        if (n < 0) throw new RespProtocolError(`negative aggregate length ${n}`);
        const items: RespValue[] = [];
        let p = next;
        for (let i = 0; i < n; i++) {
          const r = this.read(p, depth + 1);
          items.push(r.v);
          p = r.end;
        }
        const type = prefix === '*' ? 'array' : prefix === '~' ? 'set' : 'push';
        return { v: { type, value: items } as RespValue, end: p };
      }
      case '%':
      case '|': {
        const n = this.int(text, 'map length');
        if (n < 0) throw new RespProtocolError('negative map length');
        const entries: RespMap = [];
        let p = next;
        for (let i = 0; i < n; i++) {
          const key = this.read(p, depth + 1);
          const val = this.read(key.end, depth + 1);
          entries.push([key.v, val.v]);
          p = val.end;
        }
        if (prefix === '%') return { v: { type: 'map', value: entries }, end: p };
        // Attribute: metadata attached to the *next* value, which is the real reply.
        const real = this.read(p, depth + 1);
        return { v: { ...real.v, attributes: entries }, end: real.end };
      }
      default:
        throw new RespProtocolError(`unknown type byte ${JSON.stringify(prefix)}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------------------------

const CRLF = '\r\n';

function fmtDouble(d: number): string {
  if (Number.isNaN(d)) return 'nan';
  if (d === Infinity) return 'inf';
  if (d === -Infinity) return '-inf';
  return String(d);
}

export function encode(v: RespValue): Buffer {
  const parts: Buffer[] = [];
  const s = (x: string) => parts.push(Buffer.from(x));
  if (v.attributes) {
    s(`|${v.attributes.length}${CRLF}`);
    for (const [a, b] of v.attributes) parts.push(encode(a), encode(b));
  }
  switch (v.type) {
    case 'simple':
    case 'error':
      if (/[\r\n]/.test(v.value))
        throw new RespProtocolError('simple strings cannot contain CR or LF');
      s(`${v.type === 'simple' ? '+' : '-'}${v.value}${CRLF}`);
      break;
    case 'integer':
      s(`:${v.value}${CRLF}`);
      break;
    case 'bignum':
      s(`(${v.value}${CRLF}`);
      break;
    case 'null':
      s(`_${CRLF}`);
      break;
    case 'boolean':
      s(`#${v.value ? 't' : 'f'}${CRLF}`);
      break;
    case 'double':
      s(`,${fmtDouble(v.value)}${CRLF}`);
      break;
    case 'bulk':
      if (v.value === null) s(`$-1${CRLF}`);
      else {
        s(`$${v.value.length}${CRLF}`);
        parts.push(v.value);
        s(CRLF);
      }
      break;
    case 'bulkError': {
      const b = Buffer.from(v.value);
      s(`!${b.length}${CRLF}`);
      parts.push(b);
      s(CRLF);
      break;
    }
    case 'verbatim': {
      if (v.format.length !== 3) throw new RespProtocolError('verbatim format must be 3 bytes');
      const b = Buffer.from(`${v.format}:${v.value}`);
      s(`=${b.length}${CRLF}`);
      parts.push(b);
      s(CRLF);
      break;
    }
    case 'array':
      if (v.value === null) {
        s(`*-1${CRLF}`);
        break;
      }
    // falls through
    case 'set':
    case 'push': {
      const items = v.value!;
      s(`${v.type === 'array' ? '*' : v.type === 'set' ? '~' : '>'}${items.length}${CRLF}`);
      for (const it of items) parts.push(encode(it));
      break;
    }
    case 'map':
      s(`%${v.value.length}${CRLF}`);
      for (const [a, b] of v.value) parts.push(encode(a), encode(b));
      break;
  }
  return Buffer.concat(parts);
}

/** Clients always send commands as a RESP array of bulk strings, in RESP2 and RESP3 alike. */
export function encodeCommand(args: ReadonlyArray<string | number | Buffer>): Buffer {
  return encode({
    type: 'array',
    value: args.map((a) => ({
      type: 'bulk',
      value: Buffer.isBuffer(a) ? a : Buffer.from(String(a)),
    })),
  });
}

/**
 * Inline command format (what `telnet` or `nc` sends): space-separated, double quotes group.
 * The server accepts it only when the first byte is not `*`.
 */
export function parseInline(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  for (const m of line.replace(/\r?\n$/, '').matchAll(re)) {
    out.push(
      m[1] !== undefined
        ? m[1].replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 'r' ? '\r' : c))
        : m[2]!,
    );
  }
  return out;
}

/**
 * What a RESP2 client sees for a RESP3 reply: maps flatten to arrays, sets to arrays,
 * null/boolean/double/bignum become bulk strings or integers. This is the server-side
 * downgrade done for connections that did not send `HELLO 3`.
 */
export function downgradeToResp2(v: RespValue): RespValue {
  switch (v.type) {
    case 'null':
      return { type: 'bulk', value: null };
    case 'boolean':
      return { type: 'integer', value: v.value ? 1n : 0n };
    case 'double':
      return {
        type: 'bulk',
        value: Buffer.from(
          v.value === Infinity ? 'inf' : v.value === -Infinity ? '-inf' : String(v.value),
        ),
      };
    case 'bignum':
      return { type: 'bulk', value: Buffer.from(String(v.value)) };
    case 'bulkError':
      return { type: 'error', value: v.value };
    case 'verbatim':
      return { type: 'bulk', value: Buffer.from(v.value) };
    case 'map':
      return {
        type: 'array',
        value: v.value.flatMap(([a, b]) => [downgradeToResp2(a), downgradeToResp2(b)]),
      };
    case 'set':
    case 'push':
      return { type: 'array', value: v.value.map(downgradeToResp2) };
    case 'array':
      return { type: 'array', value: v.value === null ? null : v.value.map(downgradeToResp2) };
    default: {
      const { attributes: _drop, ...rest } = v;
      return rest as RespValue;
    }
  }
}

/** Convenience: decode a parsed value into plain JS for assertions. */
export function toJS(v: RespValue): unknown {
  switch (v.type) {
    case 'bulk':
      return v.value === null ? null : v.value.toString('utf8');
    case 'array':
      return v.value === null ? null : v.value.map(toJS);
    case 'set':
    case 'push':
      return v.value.map(toJS);
    case 'map':
      return new Map(v.value.map(([a, b]) => [toJS(a), toJS(b)]));
    case 'null':
      return null;
    case 'error':
    case 'bulkError':
      return new Error(v.value);
    default:
      return v.value;
  }
}

// ---------------------------------------------------------------------------------------------
// Latency model used in module 01 (pipelining vs request/response)
// ---------------------------------------------------------------------------------------------

/**
 * Wall-clock time to complete `n` commands with a pipeline window of `window`
 * (1 = classic request/response), given round-trip time and per-command server time.
 * Each window costs one RTT plus the serial server time of its commands.
 */
export function pipelineWallTime(
  n: number,
  window: number,
  rttMs: number,
  serviceMs: number,
): number {
  if (n <= 0) return 0;
  if (window < 1) throw new RangeError('window must be >= 1');
  const batches = Math.ceil(n / window);
  return batches * rttMs + n * serviceMs;
}
