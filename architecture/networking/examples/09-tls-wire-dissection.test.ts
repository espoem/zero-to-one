import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface TLSRecordHeader {
  contentType: number; // 22 = Handshake
  version: number;     // 0x0303 (TLS 1.2 legacy wire value in record header)
  length: number;
}

export interface TLSClientHello {
  clientVersion: number;
  clientRandom: Buffer;
  sessionId: Buffer;
  cipherSuites: number[];
  extensions: Map<number, Buffer>;
  sni?: string;
  isTLS13: boolean;
}

export function parseTLSRecordHeader(buf: Buffer): { header: TLSRecordHeader; payload: Buffer } {
  if (buf.length < 5) throw new Error('Buffer too small for TLS record header');
  const contentType = buf[0]!;
  const version = buf.readUInt16BE(1);
  const length = buf.readUInt16BE(3);
  if (buf.length < 5 + length) throw new Error('TLS record payload truncated');

  return {
    header: { contentType, version, length },
    payload: buf.subarray(5, 5 + length),
  };
}

export function parseTLSClientHello(buf: Buffer): TLSClientHello {
  // Handshake Type (1 byte: 1 = ClientHello) + Length (3 bytes)
  const handshakeType = buf[0]!;
  if (handshakeType !== 1) throw new Error(`Not a ClientHello: ${handshakeType}`);
  const handshakeLength = (buf[1]! << 16) | (buf[2]! << 8) | buf[3]!;
  if (buf.length < 4 + handshakeLength) throw new Error('ClientHello payload truncated');

  let offset = 4;
  const clientVersion = buf.readUInt16BE(offset);
  offset += 2;

  const clientRandom = buf.subarray(offset, offset + 32);
  offset += 32;

  const sessionIdLen = buf[offset]!;
  offset += 1;
  const sessionId = buf.subarray(offset, offset + sessionIdLen);
  offset += sessionIdLen;

  const cipherSuitesLen = buf.readUInt16BE(offset);
  offset += 2;
  const cipherSuites: number[] = [];
  for (let i = 0; i < cipherSuitesLen; i += 2) {
    cipherSuites.push(buf.readUInt16BE(offset + i));
  }
  offset += cipherSuitesLen;

  const compMethodsLen = buf[offset]!;
  offset += 1 + compMethodsLen; // Skip compression methods

  const extensions = new Map<number, Buffer>();
  let sni: string | undefined;
  let isTLS13 = false;

  if (offset + 2 <= buf.length) {
    const extLen = buf.readUInt16BE(offset);
    offset += 2;
    const endExtensions = offset + extLen;

    while (offset + 4 <= endExtensions) {
      const extType = buf.readUInt16BE(offset);
      const extDataLen = buf.readUInt16BE(offset + 2);
      offset += 4;
      const extData = buf.subarray(offset, offset + extDataLen);
      extensions.set(extType, extData);
      offset += extDataLen;

      // Check server_name (SNI, Type 0x0000)
      if (extType === 0x0000 && extData.length >= 5) {
        // list length (2) + type (1, 0 = host_name) + name length (2)
        const nameLen = extData.readUInt16BE(3);
        sni = extData.subarray(5, 5 + nameLen).toString('ascii');
      }

      // Check supported_versions (Type 0x002b)
      if (extType === 0x002b) {
        // Check if 0x0304 (TLS 1.3) is in the list
        for (let j = 1; j < extData.length; j += 2) {
          if (extData.readUInt16BE(j) === 0x0304) {
            isTLS13 = true;
            break;
          }
        }
      }
    }
  }

  return { clientVersion, clientRandom, sessionId, cipherSuites, extensions, sni, isTLS13 };
}

describe('Module 09: TLS 1.3 Wire Record & ClientHello Dissection', () => {
  it('parses a synthetic TLS 1.3 ClientHello record and extracts SNI and version', () => {
    // Construct dummy TLS ClientHello
    const sniBytes = Buffer.from('api.zero-to-one.internal', 'ascii');
    const sniExtData = Buffer.concat([
      Buffer.from([0x00, sniBytes.length + 3]), // Server Name list length
      Buffer.from([0x00]),                      // Name type = host_name
      Buffer.from([0x00, sniBytes.length]),     // Name length
      sniBytes,
    ]);

    const suppVersionsData = Buffer.from([
      0x02,       // List length (2 bytes)
      0x03, 0x04, // TLS 1.3 (0x0304)
    ]);

    const extensionsPayload = Buffer.concat([
      // SNI extension: Type 0x0000, Length, Data
      Buffer.from([0x00, 0x00, 0x00, sniExtData.length]),
      sniExtData,
      // supported_versions: Type 0x002b, Length, Data
      Buffer.from([0x00, 0x2b, 0x00, suppVersionsData.length]),
      suppVersionsData,
    ]);

    const clientHelloBody = Buffer.concat([
      Buffer.from([0x03, 0x03]),                // Legacy client version 0x0303
      Buffer.alloc(32, 0xaa),                   // 32-byte Client Random
      Buffer.from([0x00]),                      // Session ID len 0
      Buffer.from([0x00, 0x02, 0x13, 0x01]),    // Cipher suites: TLS_AES_128_GCM_SHA256 (0x1301)
      Buffer.from([0x01, 0x00]),                // Compression methods: 1, null
      Buffer.from([0x00, extensionsPayload.length]),
      extensionsPayload,
    ]);

    // Handshake header: Type 1 (ClientHello), Length (3 bytes)
    const handshakeHeader = Buffer.alloc(4);
    handshakeHeader[0] = 0x01;
    handshakeHeader[1] = (clientHelloBody.length >> 16) & 0xff;
    handshakeHeader[2] = (clientHelloBody.length >> 8) & 0xff;
    handshakeHeader[3] = clientHelloBody.length & 0xff;

    const fullHandshake = Buffer.concat([handshakeHeader, clientHelloBody]);

    // TLS Record Header: 0x16 (Handshake), 0x0303 (TLS 1.2 legacy wire), Length (2 bytes)
    const recordHeader = Buffer.alloc(5);
    recordHeader[0] = 0x16;
    recordHeader.writeUInt16BE(0x0303, 1);
    recordHeader.writeUInt16BE(fullHandshake.length, 3);

    const fullRecord = Buffer.concat([recordHeader, fullHandshake]);

    const { header, payload } = parseTLSRecordHeader(fullRecord);
    assert.equal(header.contentType, 22);
    assert.equal(header.version, 0x0303);

    const parsedClientHello = parseTLSClientHello(payload);
    assert.equal(parsedClientHello.sni, 'api.zero-to-one.internal');
    assert.equal(parsedClientHello.isTLS13, true);
    assert.equal(parsedClientHello.cipherSuites.includes(0x1301), true);
  });
});
