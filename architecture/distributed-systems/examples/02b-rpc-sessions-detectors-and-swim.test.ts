import test from 'node:test';
import assert from 'node:assert/strict';
import { Prng } from './lib/prng.ts';

/* ------------------------------------------------------------------ *
 * 1. At-most-once RPC over a network that drops, delays and duplicates.
 * ------------------------------------------------------------------ */
interface Req {
  client: number;
  seq: number;
  ack: number; // client has received replies for every seq <= ack
}

type Reply = { seq: number; value: number | 'STALE' };

export class CounterServer {
  counter = 0;
  executions = 0;
  private done = new Map<string, number>(); // `${client}:${seq}` -> cached result
  private watermark = new Map<number, number>(); // client -> highest GC'd seq
  private readonly mode: 'none' | 'dedupe' | 'dedupe-gc-naive' | 'dedupe-gc-watermark';
  constructor(mode: 'none' | 'dedupe' | 'dedupe-gc-naive' | 'dedupe-gc-watermark') {
    this.mode = mode;
  }

  handle(r: Req): Reply {
    if (this.mode === 'none') return { seq: r.seq, value: this.execute() };
    const key = `${r.client}:${r.seq}`;
    const cached = this.done.get(key);
    if (cached !== undefined) return { seq: r.seq, value: cached };
    if (this.mode === 'dedupe-gc-watermark' && r.seq <= (this.watermark.get(r.client) ?? 0)) {
      return { seq: r.seq, value: 'STALE' }; // answer was already acknowledged: never re-execute
    }
    const value = this.execute();
    this.done.set(key, value);
    if (this.mode === 'dedupe-gc-naive' || this.mode === 'dedupe-gc-watermark') {
      for (let s = (this.watermark.get(r.client) ?? 0) + 1; s <= r.ack; s++)
        this.done.delete(`${r.client}:${s}`);
      this.watermark.set(r.client, Math.max(this.watermark.get(r.client) ?? 0, r.ack));
    }
    return { seq: r.seq, value };
  }

  tableSize(): number {
    return this.done.size;
  }

  private execute(): number {
    this.executions++;
    return ++this.counter;
  }
}

interface Net {
  loss: number;
  dup: number;
  maxDelay: number;
}

/** Runs one sequential client issuing `ops` increments; returns the server and the number of requests sent. */
export function runRpc(
  mode: ConstructorParameters<typeof CounterServer>[0],
  ops: number,
  net: Net,
  seed: number,
): { server: CounterServer; sent: number; completed: number } {
  const rng = new Prng(seed);
  const server = new CounterServer(mode);
  type Ev = { at: number; kind: 'req' | 'reply'; req?: Req; reply?: Reply };
  const queue: Ev[] = [];
  const send = (now: number, ev: Omit<Ev, 'at'>) => {
    const copies = 1 + (rng.chance(net.dup) ? 1 : 0);
    for (let i = 0; i < copies; i++) {
      if (rng.chance(net.loss)) continue;
      queue.push({ ...ev, at: now + rng.int(1, net.maxDelay) });
    }
  };
  let now = 0;
  let seq = 1;
  let completed = 0;
  let sent = 0;
  let deadline = 0;
  const timeout = net.maxDelay * 2 + 1;
  const transmit = () => {
    sent++;
    send(now, { kind: 'req', req: { client: 1, seq, ack: seq - 1 } });
    deadline = now + timeout;
  };
  transmit();
  while (now < 1_000_000) {
    now++;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0]!.at <= now) {
      const ev = queue.shift()!;
      if (ev.kind === 'req') send(now, { kind: 'reply', reply: server.handle(ev.req!) });
      else if (ev.reply!.seq === seq && completed < ops) {
        completed++;
        seq++;
        if (completed < ops) transmit();
      }
    }
    if (completed < ops && now >= deadline) transmit();
    if (completed >= ops && queue.length === 0) break;
  }
  return { server, sent, completed };
}

test('Module 02: at-most-once RPC under loss, delay and duplication', async (t) => {
  const net: Net = { loss: 0.3, dup: 0.2, maxDelay: 8 };

  await t.test('without deduplication retries execute side effects more than once', () => {
    const r = runRpc('none', 50, net, 7);
    assert.equal(r.completed, 50);
    assert.ok(r.server.executions > 50, `executions ${r.server.executions}`);
  });

  await t.test(
    'with a dedupe table every logical operation executes exactly once (200 seeds)',
    () => {
      for (let seed = 1; seed <= 200; seed++) {
        const r = runRpc('dedupe', 40, net, seed);
        assert.equal(r.completed, 40);
        assert.equal(r.server.executions, 40, `seed ${seed}`);
        assert.equal(r.server.counter, 40);
      }
    },
  );

  await t.test('negative: GC that forgets acked entries re-executes delayed duplicates', () => {
    let violations = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = runRpc('dedupe-gc-naive', 40, { loss: 0.2, dup: 0.5, maxDelay: 30 }, seed);
      if (r.server.executions > 40) violations++;
    }
    assert.ok(violations > 0, 'a duplicate delayed past its own ack must be able to run twice');
  });

  await t.test('a per-client GC watermark bounds the table and still never re-executes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = runRpc('dedupe-gc-watermark', 40, { loss: 0.2, dup: 0.5, maxDelay: 30 }, seed);
      assert.equal(r.server.executions, 40, `seed ${seed}`);
      assert.ok(r.server.tableSize() <= 2, `table size ${r.server.tableSize()}`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 2. Retry amplification and retry budgets.
 * ------------------------------------------------------------------ */
export function leafCalls(
  layers: number,
  requests: number,
  attempts: number,
  budget: number | null,
): number {
  // Every call at the leaf fails, so every layer retries up to `attempts - 1` times.
  let incoming = requests;
  for (let l = 0; l < layers; l++) {
    let out = 0;
    let retries = 0;
    for (let i = 0; i < incoming; i++) {
      out++; // first attempt
      for (let a = 1; a < attempts; a++) {
        if (budget !== null && retries >= budget * incoming) break;
        retries++;
        out++;
      }
    }
    incoming = out;
  }
  return incoming;
}

test('Module 02: retry amplification is multiplicative and a retry budget bounds it', async (t) => {
  await t.test('3 layers x 3 attempts turn 1 request into 27 leaf calls', () => {
    assert.equal(leafCalls(3, 1, 3, null), 27);
    assert.equal(leafCalls(3, 1000, 3, null), 27_000);
  });
  await t.test('a 10% retry budget per layer caps amplification near 1.1^layers', () => {
    const n = 10_000;
    const calls = leafCalls(3, n, 3, 0.1);
    assert.ok(calls <= n * 1.1 ** 3 + 3, `calls ${calls}`);
    assert.ok(calls >= n * 1.1 ** 3 - 3, 'the budget is actually used when everything fails');
  });
});

/* ------------------------------------------------------------------ *
 * 3. Heartbeat failure detector in partial synchrony: adaptive timeout gives eventual accuracy.
 * ------------------------------------------------------------------ */
interface FdRun {
  falseSuspicionsAfter: number;
  finalSuspectedWhenCrashed: boolean;
  timeout: number;
}

export function heartbeatRun(opts: {
  seed: number;
  adaptive: boolean;
  crashAt: number | null;
  gst: number;
  delta: number;
  horizon: number;
}): FdRun {
  const rng = new Prng(opts.seed);
  const period = 10;
  let timeout = 15;
  let lastArrival = 0;
  let suspected = false;
  const arrivals: number[] = [];
  for (let sendAt = period; sendAt <= opts.horizon; sendAt += period) {
    if (opts.crashAt !== null && sendAt >= opts.crashAt) break;
    const delay = sendAt < opts.gst ? rng.int(1, 400) : rng.int(1, opts.delta);
    arrivals.push(sendAt + delay);
  }
  arrivals.sort((a, b) => a - b);
  let ai = 0;
  let falseAfter = 0;
  for (let now = 1; now <= opts.horizon; now++) {
    while (ai < arrivals.length && arrivals[ai]! <= now) {
      lastArrival = arrivals[ai]!;
      ai++;
      if (suspected) {
        suspected = false;
        if (opts.adaptive) timeout += 10; // false suspicion: be more patient
      }
    }
    const nowSuspect = now - lastArrival > timeout;
    const crashed = opts.crashAt !== null && now >= opts.crashAt;
    if (nowSuspect && !suspected && !crashed && now > opts.gst + 500) falseAfter++;
    suspected = nowSuspect;
  }
  return { falseSuspicionsAfter: falseAfter, finalSuspectedWhenCrashed: suspected, timeout };
}

test('Module 02: heartbeat detector with adaptive timeout is eventually perfect (diamond-P) after GST', async (t) => {
  const base = { crashAt: null, gst: 2000, delta: 20, horizon: 6000 };

  await t.test('eventual strong accuracy: no false suspicions well after GST for 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = heartbeatRun({ ...base, seed, adaptive: true });
      assert.equal(r.falseSuspicionsAfter, 0, `seed ${seed}`);
      assert.ok(r.timeout >= 15);
    }
  });

  await t.test(
    'negative: a fixed timeout smaller than period + delta keeps flapping forever',
    () => {
      let flapping = 0;
      for (let seed = 1; seed <= 100; seed++) {
        if (heartbeatRun({ ...base, seed, adaptive: false }).falseSuspicionsAfter > 0) flapping++;
      }
      assert.ok(flapping > 90, `flapping seeds ${flapping}`);
    },
  );

  await t.test('strong completeness: a crashed process is suspected permanently', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = heartbeatRun({ ...base, seed, adaptive: true, crashAt: 3000 });
      assert.equal(r.finalSuspectedWhenCrashed, true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 4. Phi accrual (exponential approximation as used by Cassandra) and SWIM indirect probing.
 * ------------------------------------------------------------------ */
const PHI_FACTOR = 1 / Math.LN10;
export const phiExponential = (sinceLast: number, meanInterval: number) =>
  (PHI_FACTOR * sinceLast) / meanInterval;

test('Module 02: exponential phi is -log10(P_later) and independent of variance', async (t) => {
  await t.test('phi = 8 exactly when the silence is 8 * ln(10) means long', () => {
    const mean = 1000;
    const t8 = 8 * Math.LN10 * mean;
    assert.ok(Math.abs(phiExponential(t8, mean) - 8) < 1e-9);
    assert.ok(Math.abs(Math.exp(-t8 / mean) - 1e-8) < 1e-12, 'P_later = exp(-t/mean) = 1e-8');
  });
  await t.test('doubling the mean interval halves phi for the same silence', () => {
    assert.ok(Math.abs(phiExponential(5000, 1000) / phiExponential(5000, 2000) - 2) < 1e-12);
  });
});

export function swimFalsePositives(
  n: number,
  k: number,
  periods: number,
  seed: number,
  badLinkLoss: number,
  goodLoss: number,
): { falseSuspects: number; maxMessagesPerNodePeriod: number } {
  const rng = new Prng(seed);
  // Node 0 probes node 1 over a degraded link; every other path is mostly healthy. Node 1 is ALIVE.
  const link = (a: number, b: number) =>
    (a === 0 && b === 1) || (a === 1 && b === 0) ? badLinkLoss : goodLoss;
  const ok = (a: number, b: number) => !rng.chance(link(a, b));
  let falseSuspects = 0;
  let maxMsgs = 0;
  for (let p = 0; p < periods; p++) {
    let msgs = 1; // ping
    let alive = ok(0, 1) && ok(1, 0);
    if (!alive) {
      const helpers = rng.shuffle([...Array(n).keys()].filter((x) => x > 1)).slice(0, k);
      for (const h of helpers) {
        msgs += 1; // ping-req
        if (ok(0, h) && ok(h, 1) && ok(1, h) && ok(h, 0)) alive = true;
        msgs += 3; // helper->target ping, target->helper ack, helper->origin ack (upper bound)
      }
    }
    if (!alive) falseSuspects++;
    maxMsgs = Math.max(maxMsgs, msgs);
  }
  return { falseSuspects, maxMessagesPerNodePeriod: maxMsgs };
}

test('Module 02: SWIM indirect probes mask a single degraded link at constant message cost', async (t) => {
  await t.test(
    'k = 0 (direct only) wrongly suspects a live node most periods; k = 3 almost never',
    () => {
      const direct = swimFalsePositives(50, 0, 2000, 1, 0.8, 0.02);
      const indirect = swimFalsePositives(50, 3, 2000, 1, 0.8, 0.02);
      assert.ok(direct.falseSuspects > 800, `direct ${direct.falseSuspects}`);
      assert.ok(indirect.falseSuspects < 40, `indirect ${indirect.falseSuspects}`);
    },
  );
  await t.test('per-period messages are bounded by 1 + 4k regardless of cluster size', () => {
    for (const n of [10, 100, 10_000]) {
      const r = swimFalsePositives(n, 3, 500, 2, 0.8, 0.02);
      assert.ok(
        r.maxMessagesPerNodePeriod <= 1 + 4 * 3,
        `n=${n} msgs=${r.maxMessagesPerNodePeriod}`,
      );
    }
  });
});
