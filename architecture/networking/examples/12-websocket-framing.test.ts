import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fc from 'fast-check';

export const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function computeWebSocketAcceptKey(clientKey: string): string {
  const hash = crypto.createHash('sha1');
  hash.update(clientKey + WS_MAGIC_GUID);
  return hash.digest('base64');
}

export function maskWebSocketPayload(payload: Buffer, maskKey: Buffer): Buffer {
  if (maskKey.length !== 4) throw new Error('Mask key must be exactly 4 bytes');
  const result = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    result[i] = payload[i]! ^ maskKey[i % 4]!;
  }
  return result;
}

export interface WebSocketFrame {
  fin: boolean;
  opcode: number;
  masked: boolean;
  maskKey?: Buffer;
  payload: Buffer;
}

export function encodeWebSocketFrame(frame: {
  fin?: boolean;
  opcode: number;
  masked?: boolean;
  payload: Buffer;
}): Buffer {
  const fin = frame.fin ?? true;
  const masked = frame.masked ?? false;
  const payloadLen = frame.payload.length;

  const b0 = (fin ? 0x80 : 0x00) | (frame.opcode & 0x0f);
  let b1 = masked ? 0x80 : 0x00;

  const headerBuffers: Buffer[] = [Buffer.from([b0])];

  if (payloadLen <= 125) {
    b1 |= payloadLen;
    headerBuffers.push(Buffer.from([b1]));
  } else if (payloadLen <= 65535) {
    b1 |= 126;
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(payloadLen, 0);
    headerBuffers.push(Buffer.from([b1]), lenBuf);
  } else {
    b1 |= 127;
    const lenBuf = Buffer.alloc(8);
    lenBuf.writeBigUInt64BE(BigInt(payloadLen), 0);
    headerBuffers.push(Buffer.from([b1]), lenBuf);
  }

  let finalPayload = frame.payload;
  if (masked) {
    const maskKey = crypto.randomBytes(4);
    headerBuffers.push(maskKey);
    finalPayload = maskWebSocketPayload(frame.payload, maskKey);
  }

  return Buffer.concat([...headerBuffers, finalPayload]);
}

export function parseWebSocketFrame(buf: Buffer): WebSocketFrame {
  if (buf.length < 2) throw new Error('Buffer too small for WebSocket frame');
  const b0 = buf[0]!;
  const b1 = buf[1]!;

  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let payloadLen = b1 & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < offset + 2) throw new Error('Truncated 16-bit payload length');
    payloadLen = buf.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buf.length < offset + 8) throw new Error('Truncated 64-bit payload length');
    payloadLen = Number(buf.readBigUInt64BE(offset));
    offset += 8;
  }

  let maskKey: Buffer | undefined;
  if (masked) {
    if (buf.length < offset + 4) throw new Error('Truncated mask key');
    maskKey = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  const rawPayload = buf.subarray(offset, offset + payloadLen);
  const payload = masked && maskKey ? maskWebSocketPayload(rawPayload, maskKey) : rawPayload;

  return { fin, opcode, masked, maskKey, payload };
}

describe('Module 12: Real-Time Protocols: WebSocket Handshake & Framing (RFC 6455)', () => {
  it('correctly calculates the Sec-WebSocket-Accept key per RFC 6455 spec example', () => {
    // Example from RFC 6455 §4.2.2:
    // Key: "dGhlIHNhbXBsZSBub25jZQ==" -> Accept: "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
    const clientKey = 'dGhlIHNhbXBsZSBub25jZQ==';
    const accept = computeWebSocketAcceptKey(clientKey);
    assert.equal(accept, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  it('encodes and decodes masked text frame from client', () => {
    const message = 'Hello Zero-to-One WebSockets!';
    const encoded = encodeWebSocketFrame({
      fin: true,
      opcode: 0x01, // Text frame
      masked: true, // Mandatory for client
      payload: Buffer.from(message, 'utf-8'),
    });

    const parsed = parseWebSocketFrame(encoded);
    assert.equal(parsed.fin, true);
    assert.equal(parsed.opcode, 1);
    assert.equal(parsed.masked, true);
    assert.equal(parsed.payload.toString('utf-8'), message);
  });

  it('property test: XOR masking is an involution (masking twice yields original bytes)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 500 }),
        fc.uint8Array({ minLength: 4, maxLength: 4 }),
        (dataArr, maskArr) => {
          const data = Buffer.from(dataArr);
          const mask = Buffer.from(maskArr);
          const masked = maskWebSocketPayload(data, mask);
          const unmasked = maskWebSocketPayload(masked, mask);
          assert.deepEqual(unmasked, data);
        }
      )
    );
  });
});
