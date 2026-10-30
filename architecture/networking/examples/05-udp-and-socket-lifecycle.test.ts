import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';

export class SimulatedConnectedUDPSocket {
  private boundLocalPort: number;
  private connectedRemoteIp: string | null = null;
  private connectedRemotePort: number | null = null;
  private rxBuffer: Buffer[] = [];

  constructor(localPort: number) {
    this.boundLocalPort = localPort;
  }

  connect(remoteIp: string, remotePort: number): void {
    this.connectedRemoteIp = remoteIp;
    this.connectedRemotePort = remotePort;
  }

  receivePacket(packet: Buffer, srcIp: string, srcPort: number): boolean {
    // If connected, kernel automatically filters out packets not matching connected peer
    if (this.connectedRemoteIp && this.connectedRemotePort) {
      if (srcIp !== this.connectedRemoteIp || srcPort !== this.connectedRemotePort) {
        return false; // Silently discarded by kernel
      }
    }
    this.rxBuffer.push(packet);
    return true;
  }

  read(): Buffer | undefined {
    return this.rxBuffer.shift();
  }

  getConnectedPeer(): { ip: string; port: number } | null {
    if (!this.connectedRemoteIp || !this.connectedRemotePort) return null;
    return { ip: this.connectedRemoteIp, port: this.connectedRemotePort };
  }
}

describe('Module 05: UDP Socket Semantics & Lifecycle', () => {
  it('exchanges UDP datagrams over loopback using node:dgram', async () => {
    const server = dgram.createSocket('udp4');
    const client = dgram.createSocket('udp4');

    const receivedPromise = new Promise<{ msg: string; rinfo: dgram.RemoteInfo }>((resolve) => {
      server.on('message', (msg, rinfo) => {
        resolve({ msg: msg.toString(), rinfo });
      });
    });

    await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', resolve));
    const serverAddr = server.address();

    const clientMsg = 'Zero-to-One UDP Test Message';
    client.send(Buffer.from(clientMsg), serverAddr.port, '127.0.0.1');

    const result = await receivedPromise;
    assert.equal(result.msg, clientMsg);
    assert.equal(result.rinfo.address, '127.0.0.1');

    server.close();
    client.close();
  });

  it('connected UDP socket filters out packets from non-connected sources', () => {
    const sock = new SimulatedConnectedUDPSocket(8080);
    sock.connect('192.168.1.100', 5000);

    const validPacket = Buffer.from('Allowed Data');
    const accepted = sock.receivePacket(validPacket, '192.168.1.100', 5000);
    assert.equal(accepted, true);
    assert.equal(sock.read()?.toString(), 'Allowed Data');

    // Packet from unapproved source
    const attackerPacket = Buffer.from('Spoofed Data');
    const rejected = sock.receivePacket(attackerPacket, '10.0.0.99', 5000);
    assert.equal(rejected, false);
    assert.equal(sock.read(), undefined);
  });
});
