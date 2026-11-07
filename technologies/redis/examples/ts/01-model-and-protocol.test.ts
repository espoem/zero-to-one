// Module 01: RESP2/RESP3 wire protocol and the pipelining latency model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  RespParser,
  RespProtocolError,
  encode,
  encodeCommand,
  parseInline,
  downgradeToResp2,
  toJS,
  pipelineWallTime,
  type RespValue,
} from './src/resp.ts';

const parseAll = (s: string | Buffer) => new RespParser().push(s);

test('commands are arrays of bulk strings, whatever the protocol version', () => {
  assert.equal(
    encodeCommand(['SET', 'k', 'v']).toString(),
    '*3\r\n$3\r\nSET\r\n$1\r\nk\r\n$1\r\nv\r\n',
  );
  // Numbers are sent as their decimal text: RESP has no "integer argument" type.
  assert.equal(
    encodeCommand(['EXPIRE', 'k', 10]).toString(),
    '*3\r\n$6\r\nEXPIRE\r\n$1\r\nk\r\n$2\r\n10\r\n',
  );
});

test('bulk strings are binary safe: CRLF and NUL inside the payload survive', () => {
  const payload = Buffer.from([0x00, 0x0d, 0x0a, 0xff, 0x24]);
  const wire = encode({ type: 'bulk', value: payload });
  const [v] = parseAll(wire);
  assert.ok(v && v.type === 'bulk' && v.value);
  assert.deepEqual([...v.value], [...payload]);
});

test('RESP2 nulls: null bulk ($-1) and null array (*-1) are distinct from empty values', () => {
  const [nb, eb, na, ea] = parseAll('$-1\r\n$0\r\n\r\n*-1\r\n*0\r\n');
  assert.deepEqual(toJS(nb!), null);
  assert.deepEqual(toJS(eb!), '');
  assert.deepEqual(toJS(na!), null);
  assert.deepEqual(toJS(ea!), []);
});

test('RESP3 types: null, boolean, double incl. inf/nan, big number, verbatim, map, set, push', () => {
  const vals = parseAll(
    '_\r\n#t\r\n,3.14\r\n,-inf\r\n,nan\r\n(3492890328409238509324850943850943825024385\r\n' +
      '=15\r\ntxt:Some string\r\n%2\r\n+a\r\n:1\r\n+b\r\n:2\r\n~2\r\n+x\r\n+y\r\n>3\r\n+message\r\n+ch\r\n+hi\r\n',
  );
  assert.equal(vals.length, 10);
  assert.deepEqual(vals[0], { type: 'null' });
  assert.deepEqual(vals[1], { type: 'boolean', value: true });
  assert.equal((vals[2] as { value: number }).value, 3.14);
  assert.equal((vals[3] as { value: number }).value, -Infinity);
  assert.ok(Number.isNaN((vals[4] as { value: number }).value));
  assert.equal((vals[5] as { value: bigint }).value, 3492890328409238509324850943850943825024385n);
  assert.deepEqual(vals[6], { type: 'verbatim', format: 'txt', value: 'Some string' });
  assert.deepEqual(
    toJS(vals[7]!),
    new Map([
      ['a', 1n],
      ['b', 2n],
    ]),
  );
  assert.equal(vals[8]!.type, 'set');
  assert.equal(vals[9]!.type, 'push');
});

test('attributes decorate the following reply rather than being a reply themselves', () => {
  const [v, w] = parseAll(
    '|1\r\n+key-popularity\r\n%1\r\n$1\r\na\r\n,0.19\r\n*1\r\n:2039123\r\n+NEXT\r\n',
  );
  assert.equal(v!.type, 'array');
  assert.equal(v!.attributes?.length, 1);
  assert.deepEqual(toJS(w!), 'NEXT');
});

test('incremental parsing: replies split at every byte boundary still parse identically', () => {
  const wire = Buffer.from('*2\r\n$5\r\nhello\r\n:42\r\n+OK\r\n');
  for (let cut = 0; cut <= wire.length; cut++) {
    const p = new RespParser();
    const a = p.push(wire.subarray(0, cut));
    const b = p.push(wire.subarray(cut));
    assert.deepEqual([...a, ...b].map(toJS), [['hello', 42n], 'OK']);
    assert.equal(p.pending, 0);
  }
});

test('pipelined replies arriving in one TCP segment are all returned, in order', () => {
  const replies = parseAll('+OK\r\n:1\r\n:2\r\n$-1\r\n');
  assert.deepEqual(replies.map(toJS), ['OK', 1n, 2n, null]);
});

const arbLeaf: fc.Arbitrary<RespValue> = fc.oneof(
  fc
    .string({ unit: 'grapheme' })
    .filter((s) => !/[\r\n]/.test(s))
    .map((value) => ({ type: 'simple' as const, value })),
  fc
    .bigInt({ min: -(2n ** 63n), max: 2n ** 63n - 1n })
    .map((value) => ({ type: 'integer' as const, value })),
  fc.uint8Array({ maxLength: 40 }).map((u) => ({ type: 'bulk' as const, value: Buffer.from(u) })),
  fc.constant({ type: 'null' as const }),
  fc.boolean().map((value) => ({ type: 'boolean' as const, value })),
  fc
    .double({ noNaN: true })
    .filter((d) => !Object.is(d, -0))
    .map((value) => ({ type: 'double' as const, value })),
);
const arbValue: fc.Arbitrary<RespValue> = fc.letrec<{ v: RespValue }>((tie) => ({
  v: fc.oneof(
    { depthSize: 'small' },
    arbLeaf,
    fc.array(tie('v'), { maxLength: 4 }).map((value) => ({ type: 'array' as const, value })),
    fc
      .array(fc.tuple(tie('v'), tie('v')), { maxLength: 3 })
      .map((value) => ({ type: 'map' as const, value })),
  ),
})).v;

test('property: decode(encode(v)) == v, and arbitrary chunking does not change the result', () => {
  fc.assert(
    fc.property(
      fc.array(arbValue, { minLength: 1, maxLength: 5 }),
      fc.array(fc.nat(), { maxLength: 6 }),
      (vals, cuts) => {
        const wire = Buffer.concat(vals.map(encode));
        const p = new RespParser();
        const got: RespValue[] = [];
        let pos = 0;
        for (const c of cuts.map((x) => x % (wire.length + 1)).sort((a, b) => a - b)) {
          got.push(...p.push(wire.subarray(pos, c)));
          pos = c;
        }
        got.push(...p.push(wire.subarray(pos)));
        assert.deepEqual(got, vals);
      },
    ),
    { numRuns: 300 },
  );
});

test('downgrade: a RESP3 map reaches a RESP2 client as a flat [k1, v1, k2, v2] array', () => {
  const m: RespValue = {
    type: 'map',
    value: [
      [
        { type: 'simple', value: 'f' },
        { type: 'integer', value: 1n },
      ],
    ],
  };
  assert.deepEqual(toJS(downgradeToResp2(m)), ['f', 1n]);
  assert.deepEqual(toJS(downgradeToResp2({ type: 'null' })), null);
  assert.deepEqual(toJS(downgradeToResp2({ type: 'boolean', value: true })), 1n);
});

test('inline commands: quotes group words, escapes are honoured', () => {
  assert.deepEqual(parseInline('SET greeting "hello world"\r\n'), [
    'SET',
    'greeting',
    'hello world',
  ]);
  assert.deepEqual(parseInline('PING'), ['PING']);
});

// --- negative tests: malformed input is a protocol error, never a silent mis-parse -------------

test('negative: unknown type byte is rejected', () => {
  assert.throws(() => parseAll('?oops\r\n'), RespProtocolError);
});

test('negative: bulk payload longer than its declared length is rejected', () => {
  assert.throws(() => parseAll('$3\r\nhello\r\n'), RespProtocolError);
});

test('negative: non-numeric lengths and integers are rejected', () => {
  assert.throws(() => parseAll('$x\r\n'), RespProtocolError);
  assert.throws(() => parseAll(':12a\r\n'), RespProtocolError);
  assert.throws(() => parseAll('#y\r\n'), RespProtocolError);
});

test('negative: bulk length above proto-max-bulk-len is refused before buffering it', () => {
  const p = new RespParser({ maxBulkLength: 16 });
  assert.throws(() => p.push('$17\r\n'), RespProtocolError);
});

test('negative: hostile nesting depth is bounded', () => {
  const p = new RespParser({ maxDepth: 8 });
  assert.throws(() => p.push('*1\r\n'.repeat(20) + ':1\r\n'), RespProtocolError);
});

test('negative: simple strings cannot carry CR/LF; that is what bulk strings are for', () => {
  assert.throws(() => encode({ type: 'simple', value: 'a\r\nb' }), RespProtocolError);
});

test('an incomplete reply is not an error: the parser waits for the rest', () => {
  const p = new RespParser();
  assert.deepEqual(p.push('$5\r\nhel'), []);
  assert.ok(p.pending > 0);
  assert.deepEqual(p.push('lo\r\n').map(toJS), ['hello']);
});

test('latency model: pipelining divides the RTT term, not the server term', () => {
  // 10 000 commands, 0.5 ms RTT, 2 µs of server time each.
  const rr = pipelineWallTime(10_000, 1, 0.5, 0.002);
  const pipe = pipelineWallTime(10_000, 100, 0.5, 0.002);
  assert.equal(rr, 10_000 * 0.5 + 20);
  assert.equal(pipe, 100 * 0.5 + 20);
  assert.ok(rr / pipe > 70);
  // Once the window is large, server time dominates and a bigger window stops helping.
  const huge = pipelineWallTime(10_000, 10_000, 0.5, 0.002);
  assert.ok(pipe - huge < 50);
  assert.throws(() => pipelineWallTime(1, 0, 1, 1), RangeError);
});
