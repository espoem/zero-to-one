import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Server-side Idempotency Deduplication Table.
 */
export interface DedupeRecord<T> {
  seqNum: number;
  status: 'IN_FLIGHT' | 'COMPLETED';
  response?: T;
}

export class IdempotentRpcServer<Req, Res> {
  private readonly clientTables = new Map<string, Map<number, DedupeRecord<Res>>>();
  private executionCount = 0;
  private readonly handler: (req: Req) => Res;

  constructor(handler: (req: Req) => Res) {
    this.handler = handler;
  }

  execute(clientId: string, seqNum: number, req: Req): { res: Res; replayed: boolean } {
    let table = this.clientTables.get(clientId);
    if (!table) {
      table = new Map();
      this.clientTables.set(clientId, table);
    }

    const record = table.get(seqNum);
    if (record) {
      if (record.status === 'COMPLETED' && record.response !== undefined) {
        return { res: record.response, replayed: true };
      }
      throw new Error(`RPC ${clientId}:${seqNum} is currently in flight`);
    }

    // Register IN_FLIGHT
    table.set(seqNum, { seqNum, status: 'IN_FLIGHT' });
    this.executionCount++;
    const res = this.handler(req);
    table.set(seqNum, { seqNum, status: 'COMPLETED', response: res });
    return { res, replayed: false };
  }

  get totalExecutions(): number {
    return this.executionCount;
  }
}

/**
 * Exponential backoff with Full Jitter and Decorrelated Jitter.
 */
export function fullJitterBackoff(attempt: number, baseMs = 100, capMs = 5000, randomFn = Math.random): number {
  const maxWait = Math.min(capMs, baseMs * Math.pow(2, attempt));
  return Math.floor(randomFn() * maxWait);
}

export function decorrelatedJitterBackoff(
  prevSleepMs: number,
  baseMs = 100,
  capMs = 5000,
  randomFn = Math.random
): number {
  const ceiling = Math.min(capMs, prevSleepMs * 3);
  const sleep = baseMs + randomFn() * (ceiling - baseMs);
  return Math.floor(Math.min(capMs, sleep));
}

/**
 * Simplified Phi-Accrual Failure Detector.
 * Phi = -log10(P_later(delta_t))
 */
export class PhiAccrualFailureDetector {
  private readonly intervals: number[] = [];
  private lastHeartbeat: number | null = null;
  private readonly windowSize: number;

  constructor(windowSize = 20) {
    this.windowSize = windowSize;
  }

  heartbeat(timestampMs: number): void {
    if (this.lastHeartbeat !== null) {
      const delta = timestampMs - this.lastHeartbeat;
      this.intervals.push(delta);
      if (this.intervals.length > this.windowSize) {
        this.intervals.shift();
      }
    }
    this.lastHeartbeat = timestampMs;
  }

  phi(nowMs: number): number {
    if (this.lastHeartbeat === null || this.intervals.length < 2) {
      return 0; // Not enough samples
    }

    const delta = nowMs - this.lastHeartbeat;
    // Compute mean and standard deviation of heartbeat intervals
    let sum = 0;
    for (const d of this.intervals) sum += d;
    const mean = sum / this.intervals.length;

    let varSum = 0;
    for (const d of this.intervals) varSum += Math.pow(d - mean, 2);
    const variance = varSum / this.intervals.length;
    const stdDev = Math.max(10, Math.sqrt(variance)); // Floor avoids division by zero or extreme sensitivity

    // Standard normal distribution tail P(X >= delta)
    const z = (delta - mean) / stdDev;
    if (z <= 0) return 0; // Heartbeat is on time or earlier than mean

    // For large z, calculate -log10(P) directly to avoid underflow
    if (z > 8) {
      const log10P = -(z * z / 2) * Math.LOG10E - Math.log10(z * Math.sqrt(2 * Math.PI));
      return Math.min(16, -log10P);
    }

    // Standard rational approximation for normal upper tail
    const t = 1.0 / (1.0 + 0.2316419 * z);
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const pLater = (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
    const phi = -Math.log10(Math.max(1e-16, pLater));
    return Math.min(16, phi);
  }
}

test('Module 02: Networks, RPC & Failure Detectors', async (t) => {
  await t.test('Idempotency table ensures single execution across retried RPCs', () => {
    let balance = 1000;
    const server = new IdempotentRpcServer<{ amount: number }, { balance: number }>((req) => {
      balance += req.amount;
      return { balance };
    });

    // Client executes transfer of $500
    const call1 = server.execute('client_A', 1, { amount: 500 });
    assert.equal(call1.res.balance, 1500);
    assert.equal(call1.replayed, false);
    assert.equal(server.totalExecutions, 1);

    // Network timeout occurs, client retries identical request (same clientId and seqNum)
    const call2 = server.execute('client_A', 1, { amount: 500 });
    assert.equal(call2.res.balance, 1500);
    assert.equal(call2.replayed, true); // Result returned from dedupe cache
    assert.equal(server.totalExecutions, 1); // Handler NOT re-executed!

    // Next sequential call
    const call3 = server.execute('client_A', 2, { amount: 100 });
    assert.equal(call3.res.balance, 1600);
    assert.equal(server.totalExecutions, 2);
  });

  await t.test('Jitter backoff spreads retry delays within bounds', () => {
    const sleep0 = fullJitterBackoff(0, 100, 1000, () => 0.5);
    const sleep3 = fullJitterBackoff(3, 100, 1000, () => 0.5);
    assert.ok(sleep0 <= 100);
    assert.ok(sleep3 <= 800);

    const decorr1 = decorrelatedJitterBackoff(200, 100, 5000, () => 0.5);
    assert.ok(decorr1 >= 100 && decorr1 <= 600);
  });

  await t.test('Phi-Accrual detector scales suspicion smoothly with elapsed delay', () => {
    const detector = new PhiAccrualFailureDetector(10);
    // Simulate heartbeats arriving around 100ms with natural network jitter
    const samples = [98, 102, 100, 95, 105, 99, 101, 100, 97, 103];
    let clock = 1000;
    detector.heartbeat(clock);
    for (const interval of samples) {
      clock += interval;
      detector.heartbeat(clock);
    }

    // Immediately after heartbeat (0ms elapsed): phi is 0
    assert.equal(detector.phi(clock), 0);

    // 120ms elapsed (slightly delayed): small suspicion
    const phiSmall = detector.phi(clock + 120);
    // 500ms elapsed (severe delay): high suspicion
    const phiHigh = detector.phi(clock + 500);

    assert.ok(phiSmall < phiHigh, `Expected phiSmall (${phiSmall}) < phiHigh (${phiHigh})`);
    assert.ok(phiHigh > 3.0, `Expected phiHigh (${phiHigh}) > 3.0`);
  });
});
