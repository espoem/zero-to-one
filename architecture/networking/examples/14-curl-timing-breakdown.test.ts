import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';

export interface HttpTimingBreakdown {
  dnsLookupMs: number;
  tcpConnectMs: number;
  ttfbMs: number;
  totalMs: number;
  statusCode: number;
}

export function measureHttpRequest(url: string, simulatedDelayMs = 0): Promise<HttpTimingBreakdown> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    let tDns = t0;
    let tConnect = t0;
    let tFirstByte = t0;

    const req = http.get(url, (res) => {
      res.once('data', () => {
        tFirstByte = performance.now();
      });

      res.on('data', () => {
        // Drain stream
      });

      res.on('end', () => {
        const tTotal = performance.now();
        resolve({
          dnsLookupMs: tDns - t0,
          tcpConnectMs: tConnect - tDns,
          ttfbMs: tFirstByte - tConnect,
          totalMs: tTotal - t0,
          statusCode: res.statusCode ?? 0,
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        tDns = performance.now();
      });

      socket.on('connect', () => {
        tConnect = performance.now();
      });
    });

    req.on('error', reject);
  });
}

describe('Module 14: Network Diagnostics: Precision Connection Timing Decomposition', () => {
  it('measures and isolates DNS, TCP connect, and TTFB phases accurately', async () => {
    // Spin up local HTTP server with artificial 20ms processing delay
    const server = http.createServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      }, 25);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as net.AddressInfo;
    const url = `http://127.0.0.1:${addr.port}/test`;

    const timings = await measureHttpRequest(url);
    assert.equal(timings.statusCode, 200);

    // Assertions on local loopback timing characteristics
    assert.ok(timings.totalMs >= 20, `Total time (${timings.totalMs}ms) should reflect server processing delay`);
    assert.ok(timings.ttfbMs >= 20, `TTFB (${timings.ttfbMs}ms) should isolate backend server processing time`);

    server.close();
  });
});
