import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

export type TCPState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSE_WAIT'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'TIME_WAIT';

export class TCPStateMachine {
  private state: TCPState = 'CLOSED';

  getState(): TCPState {
    return this.state;
  }

  // Active Open (Client)
  activeOpen(): void {
    if (this.state !== 'CLOSED') throw new Error(`Cannot activeOpen from ${this.state}`);
    this.state = 'SYN_SENT';
  }

  // Passive Open (Server)
  passiveOpen(): void {
    if (this.state !== 'CLOSED') throw new Error(`Cannot passiveOpen from ${this.state}`);
    this.state = 'LISTEN';
  }

  receiveSYN(): void {
    if (this.state === 'LISTEN') {
      this.state = 'SYN_RCVD';
    } else {
      throw new Error(`Cannot receiveSYN from ${this.state}`);
    }
  }

  receiveSYNACK(): void {
    if (this.state === 'SYN_SENT') {
      this.state = 'ESTABLISHED';
    } else {
      throw new Error(`Cannot receiveSYNACK from ${this.state}`);
    }
  }

  receiveACK(): void {
    switch (this.state) {
      case 'SYN_RCVD':
        this.state = 'ESTABLISHED';
        break;
      case 'FIN_WAIT_1':
        this.state = 'FIN_WAIT_2';
        break;
      case 'CLOSING':
        this.state = 'TIME_WAIT';
        break;
      case 'LAST_ACK':
        this.state = 'CLOSED';
        break;
      default:
        // ACKs in ESTABLISHED keep state unchanged
        break;
    }
  }

  // Active Close (sends FIN)
  activeClose(): void {
    if (this.state === 'ESTABLISHED') {
      this.state = 'FIN_WAIT_1';
    } else {
      throw new Error(`Cannot activeClose from ${this.state}`);
    }
  }

  receiveFIN(): void {
    switch (this.state) {
      case 'ESTABLISHED':
        this.state = 'CLOSE_WAIT'; // Passive close
        break;
      case 'FIN_WAIT_1':
        this.state = 'CLOSING'; // Simultaneous close
        break;
      case 'FIN_WAIT_2':
        this.state = 'TIME_WAIT';
        break;
      default:
        throw new Error(`Unexpected FIN in ${this.state}`);
    }
  }

  passiveCloseAppEnd(): void {
    if (this.state === 'CLOSE_WAIT') {
      this.state = 'LAST_ACK';
    } else {
      throw new Error(`Cannot close from ${this.state}`);
    }
  }

  timeWaitTimeout(): void {
    if (this.state === 'TIME_WAIT') {
      this.state = 'CLOSED';
    } else {
      throw new Error(`Cannot timeout from ${this.state}`);
    }
  }

  rst(): void {
    this.state = 'CLOSED';
  }
}

describe('Module 06: TCP Finite State Machine & Sockets Mechanics', () => {
  it('correctly models the client and server 3-way handshake and 4-way teardown', () => {
    const client = new TCPStateMachine();
    const server = new TCPStateMachine();

    // 1. Passive Open (Server)
    server.passiveOpen();
    assert.equal(server.getState(), 'LISTEN');

    // 2. Active Open (Client sends SYN)
    client.activeOpen();
    assert.equal(client.getState(), 'SYN_SENT');

    // 3. Server receives SYN, sends SYN-ACK
    server.receiveSYN();
    assert.equal(server.getState(), 'SYN_RCVD');

    // 4. Client receives SYN-ACK, sends ACK -> ESTABLISHED
    client.receiveSYNACK();
    assert.equal(client.getState(), 'ESTABLISHED');

    // 5. Server receives ACK -> ESTABLISHED
    server.receiveACK();
    assert.equal(server.getState(), 'ESTABLISHED');

    // --- TEARDOWN ---
    // Client initiates Active Close (sends FIN)
    client.activeClose();
    assert.equal(client.getState(), 'FIN_WAIT_1');

    // Server receives FIN -> CLOSE_WAIT, sends ACK
    server.receiveFIN();
    assert.equal(server.getState(), 'CLOSE_WAIT');

    // Client receives ACK -> FIN_WAIT_2
    client.receiveACK();
    assert.equal(client.getState(), 'FIN_WAIT_2');

    // Server application finishes and calls close() -> sends FIN
    server.passiveCloseAppEnd();
    assert.equal(server.getState(), 'LAST_ACK');

    // Client receives FIN -> TIME_WAIT, sends ACK
    client.receiveFIN();
    assert.equal(client.getState(), 'TIME_WAIT');

    // Server receives ACK -> CLOSED
    server.receiveACK();
    assert.equal(server.getState(), 'CLOSED');

    // Client 2*MSL timer expires -> CLOSED
    client.timeWaitTimeout();
    assert.equal(client.getState(), 'CLOSED');
  });

  it('verifies real Node.js socket configuration: TCP_NODELAY and half-close', async () => {
    let serverReceived = '';
    const server = net.createServer({ allowHalfOpen: true }, (socket) => {
      socket.setNoDelay(true);
      socket.on('data', (chunk) => {
        serverReceived += chunk.toString();
      });
      socket.on('end', () => {
        // Echo back response before closing server side
        socket.write(`ECHO: ${serverReceived}`);
        socket.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as net.AddressInfo;

    const client = net.connect({ port: addr.port, host: '127.0.0.1', allowHalfOpen: true });
    client.setNoDelay(true);

    let clientReceived = '';
    const completed = new Promise<void>((resolve) => {
      client.on('data', (chunk) => {
        clientReceived += chunk.toString();
      });
      client.on('end', () => {
        resolve();
      });
    });

    // Write data, then half-close client transmit channel
    client.write('RequestData');
    client.end(); // Sends FIN

    await completed;
    assert.equal(clientReceived, 'ECHO: RequestData');

    client.destroy();
    server.close();
  });
});
