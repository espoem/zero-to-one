import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Deterministic Pseudo-Random Number Generator (Linear Congruential Generator).
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // Numerical Recipes LCG parameters
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
}

/**
 * Deterministic Event-Driven Network Simulation Engine.
 */
export interface SimEvent {
  timeMs: number;
  from: string;
  to: string;
  payload: string;
}

export class DeterministicNetworkSim {
  private readonly rng: DeterministicRNG;
  private currentTime = 0;
  private readonly eventQueue: SimEvent[] = [];
  readonly deliveredTrace: string[] = [];
  private readonly dropProbability: number;

  constructor(seed: number, dropProbability = 0.2) {
    this.dropProbability = dropProbability;
    this.rng = new DeterministicRNG(seed);
  }

  send(from: string, to: string, payload: string): void {
    // Packet drop decision based strictly on RNG
    if (this.rng.next() < this.dropProbability) {
      // Packet dropped!
      return;
    }
    // Randomized delivery delay between 1ms and 50ms
    const delay = this.rng.nextInt(1, 50);
    const deliverTime = this.currentTime + delay;

    this.eventQueue.push({ timeMs: deliverTime, from, to, payload });
    // Keep event queue sorted by delivery time
    this.eventQueue.sort((a, b) => a.timeMs - b.timeMs);
  }

  step(): boolean {
    if (this.eventQueue.length === 0) return false;
    const evt = this.eventQueue.shift()!;
    this.currentTime = evt.timeMs;
    this.deliveredTrace.push(`[${evt.timeMs}ms] ${evt.from}->${evt.to}: ${evt.payload}`);
    return true;
  }

  runUntilEmpty(): void {
    while (this.step()) {}
  }
}

test('Module 12: Deterministic Simulation Testing (DST)', async (t) => {
  await t.test('Identical seed reproduces byte-for-byte execution trace under simulated packet drops', () => {
    const seed = 0xdeadbeef;

    // Run 1 with seed
    const sim1 = new DeterministicNetworkSim(seed, 0.3);
    for (let i = 0; i < 20; i++) {
      sim1.send('nodeA', 'nodeB', `msg_${i}`);
    }
    sim1.runUntilEmpty();

    // Run 2 with identical seed
    const sim2 = new DeterministicNetworkSim(seed, 0.3);
    for (let i = 0; i < 20; i++) {
      sim2.send('nodeA', 'nodeB', `msg_${i}`);
    }
    sim2.runUntilEmpty();

    // Assert that both runs produced the EXACT identical sequence of dropped and delivered messages!
    assert.deepEqual(sim1.deliveredTrace, sim2.deliveredTrace);
    assert.ok(sim1.deliveredTrace.length > 0);
  });

  await t.test('Different seeds produce different randomized interleavings', () => {
    const simA = new DeterministicNetworkSim(12345, 0.4);
    const simB = new DeterministicNetworkSim(67890, 0.4);

    for (let i = 0; i < 15; i++) {
      simA.send('client', 'server', `packet_${i}`);
      simB.send('client', 'server', `packet_${i}`);
    }
    simA.runUntilEmpty();
    simB.runUntilEmpty();

    assert.notDeepEqual(simA.deliveredTrace, simB.deliveredTrace);
  });
});
