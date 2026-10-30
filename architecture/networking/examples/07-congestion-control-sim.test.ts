import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export class AimdSimulator {
  cwnd: number;
  ssthresh: number;
  readonly mss: number;

  constructor(initialCwnd = 10, ssthresh = 64, mss = 1) {
    this.cwnd = initialCwnd;
    this.ssthresh = ssthresh;
    this.mss = mss;
  }

  onAck(): void {
    if (this.cwnd < this.ssthresh) {
      // Slow Start: +1 MSS per ACK
      this.cwnd += this.mss;
    } else {
      // Congestion Avoidance: +1/cwnd MSS per ACK (increases by 1 MSS per RTT)
      this.cwnd += (this.mss * this.mss) / this.cwnd;
    }
  }

  onPacketLoss(): void {
    this.ssthresh = Math.max(2 * this.mss, Math.floor(this.cwnd / 2));
    this.cwnd = this.ssthresh;
  }
}

/**
 * RFC 9438 CUBIC Congestion Window Model
 */
export class CubicModel {
  readonly C: number;
  readonly beta: number;
  wMax: number;
  K: number;

  constructor(wMax: number, C = 0.4, beta = 0.7) {
    this.C = C;
    this.beta = beta;
    this.wMax = wMax;
    // K = cbrt(wMax * (1 - beta) / C)
    this.K = Math.cbrt((this.wMax * (1 - this.beta)) / this.C);
  }

  computeWindow(tSeconds: number): number {
    const diff = tSeconds - this.K;
    return this.C * Math.pow(diff, 3) + this.wMax;
  }
}

describe('Module 07: Congestion Control Mathematics (AIMD & CUBIC)', () => {
  it('simulates Slow Start exponential doubling and Congestion Avoidance linear increase', () => {
    const sim = new AimdSimulator(1, 4, 1);

    // Initial cwnd = 1. Receive 1 ACK -> cwnd becomes 2
    sim.onAck();
    assert.equal(sim.cwnd, 2);

    // In Slow Start, receiving 2 ACKs for this RTT -> cwnd becomes 4 (reaches ssthresh)
    sim.onAck();
    sim.onAck();
    assert.equal(sim.cwnd, 4);

    // Now in Congestion Avoidance (cwnd >= ssthresh).
    // Receiving 4 ACKs across 1 full RTT should increment cwnd by ~1 MSS
    const cwndBefore = sim.cwnd;
    for (let i = 0; i < 4; i++) {
      sim.onAck();
    }
    const delta = sim.cwnd - cwndBefore;
    assert.ok(Math.abs(delta - 1.0) < 0.15, `Expected delta close to 1.0, got ${delta}`);
  });

  it('proves CUBIC (RFC 9438) reaches wMax at t = K and expands convexly beyond', () => {
    const wMax = 100;
    const cubic = new CubicModel(wMax, 0.4, 0.7);

    // At t = 0 (immediately after reduction)
    const w0 = cubic.computeWindow(0);
    assert.ok(w0 < wMax, `Window at t=0 (${w0}) should be less than wMax (${wMax})`);
    assert.ok(Math.abs(w0 - wMax * 0.7) < 1.0, `Expected w0 close to beta * wMax (70), got ${w0}`);

    // At t = K: window MUST equal wMax
    const wK = cubic.computeWindow(cubic.K);
    assert.ok(Math.abs(wK - wMax) < 1e-9, `Expected wK to equal wMax (100), got ${wK}`);

    // For t > K: window probes convexly above wMax
    const wProbing = cubic.computeWindow(cubic.K + 2.0);
    assert.ok(wProbing > wMax, `Expected wProbing (${wProbing}) > wMax (${wMax})`);
  });
});
