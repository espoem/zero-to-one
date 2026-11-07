import test from 'node:test';
import assert from 'node:assert/strict';
import { Prng } from './lib/prng.ts';

/* ------------------------------------------------------------------ *
 * 1. Common knowledge on a lossy chain (Halpern-Moses). Worlds are d = number of
 *    delivered messages of an alternating chain m1 (G1->G2), m2 (G2->G1), ...
 *    phi = "m1 was delivered" = (d >= 1).
 * ------------------------------------------------------------------ */
type General = 1 | 2;

function view(g: General, d: number): string {
  // The sender of m_{d+1} sent it (and it was lost); messages 1..d were delivered.
  const sent = [...Array(d + 2).keys()].filter((i) => i >= 1 && (g === 1 ? i % 2 === 1 : i % 2 === 0)).length;
  const recv = [...Array(d + 1).keys()].filter((i) => i >= 1 && (g === 1 ? i % 2 === 0 : i % 2 === 1)).length;
  return `${sent}/${recv}`;
}

export function knowledgeDepth(maxWorld: number): { depth: number[]; commonKnowledge: boolean[] } {
  const worlds = [...Array(maxWorld + 1).keys()];
  const sees = (g: General, w: number) => worlds.filter((x) => view(g, x) === view(g, w));
  let level = new Set(worlds.filter((w) => w >= 1)); // phi
  const depth = worlds.map(() => 0);
  const everybodyKnows = (s: Set<number>) =>
    new Set(worlds.filter((w) => ([1, 2] as General[]).every((g) => sees(g, w).every((x) => s.has(x)))));
  for (const w of level) depth[w] = 0;
  let k = 0;
  for (;;) {
    const next = everybodyKnows(level);
    if (next.size === 0 || next.size === level.size) {
      level = next;
      break;
    }
    k++;
    for (const w of next) depth[w] = k;
    level = next;
  }
  // Common knowledge = greatest fixpoint of X = phi AND E X.
  let x = new Set(worlds.filter((w) => w >= 1));
  for (;;) {
    const nx = new Set([...everybodyKnows(x)].filter((w) => x.has(w)));
    if (nx.size === x.size) break;
    x = nx;
  }
  return { depth, commonKnowledge: worlds.map((w) => x.has(w)) };
}

test('Module 01: common knowledge is unreachable over a lossy chain', async (t) => {
  await t.test('each delivered message buys exactly one more level of "everybody knows"', () => {
    const { depth } = knowledgeDepth(12);
    // World d (d >= 1) satisfies E^(d-1) phi but not E^d phi, away from the finite boundary.
    for (let d = 1; d <= 8; d++) assert.equal(depth[d], d - 1, `world ${d}`);
  });

  await t.test('common knowledge holds in no world (the chain connects every world to d = 0)', () => {
    const { commonKnowledge } = knowledgeDepth(12);
    assert.deepEqual(commonKnowledge.filter(Boolean), []);
  });

  await t.test('indistinguishability classes interleave: G1 groups {0,1},{2,3}; G2 groups {0},{1,2},{3,4}', () => {
    assert.equal(view(1, 0), view(1, 1));
    assert.notEqual(view(1, 1), view(1, 2));
    assert.equal(view(2, 1), view(2, 2));
    assert.notEqual(view(2, 0), view(2, 1));
  });
});

/* ------------------------------------------------------------------ *
 * 2. Exhaustive valency analysis of two tiny 3-process protocols.
 * ------------------------------------------------------------------ */
interface Proto {
  name: string;
  decide(received: ReadonlyMap<number, number>): number | undefined;
}

const waitAll: Proto = {
  name: 'wait-all-majority',
  decide: (r) => {
    if (r.size < 3) return undefined;
    const ones = [...r.values()].filter((v) => v === 1).length;
    return ones >= 2 ? 1 : 0;
  },
};

const waitTwoMin: Proto = {
  name: 'wait-two-min',
  decide: (r) => (r.size >= 2 ? Math.min(...r.values()) : undefined),
};

interface Exploration {
  decisionValues: Set<number>;
  disagreementReachable: boolean;
  stuckReachable: boolean;
  states: number;
}

export function explore(proto: Proto, inputs: number[], crashed: ReadonlySet<number>): Exploration {
  const n = inputs.length;
  const seen = new Set<string>();
  const out: Exploration = { decisionValues: new Set(), disagreementReachable: false, stuckReachable: false, states: 0 };
  type S = { recv: Map<number, number>[]; dec: (number | undefined)[]; pending: Set<string> };
  const init: S = { recv: inputs.map((v, i) => new Map([[i, v]])), dec: inputs.map(() => undefined), pending: new Set() };
  for (let i = 0; i < n; i++) {
    if (crashed.has(i)) continue; // initially crashed processes never send
    for (let j = 0; j < n; j++) if (j !== i) init.pending.add(`${i}>${j}`);
  }
  const decideAll = (s: S) => {
    for (let p = 0; p < n; p++) {
      if (crashed.has(p) || s.dec[p] !== undefined) continue;
      s.dec[p] = proto.decide(s.recv[p]!);
    }
  };
  decideAll(init);
  const key = (s: S) =>
    JSON.stringify([s.recv.map((m) => [...m].sort()), s.dec, [...s.pending].sort()]);
  const clone = (s: S): S => ({ recv: s.recv.map((m) => new Map(m)), dec: [...s.dec], pending: new Set(s.pending) });
  const stack = [init];
  while (stack.length) {
    const s = stack.pop()!;
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.states++;
    const decided = s.dec.filter((d): d is number => d !== undefined);
    for (const d of decided) out.decisionValues.add(d);
    if (new Set(decided).size > 1) out.disagreementReachable = true;
    const deliverable = [...s.pending].filter((m) => !crashed.has(Number(m.split('>')[1])));
    if (deliverable.length === 0) {
      const correctUndecided = s.dec.some((d, p) => !crashed.has(p) && d === undefined);
      if (correctUndecided) out.stuckReachable = true;
      continue;
    }
    for (const m of deliverable) {
      const [from, to] = m.split('>').map(Number) as [number, number];
      const nx = clone(s);
      nx.pending.delete(m);
      nx.recv[to]!.set(from, inputs[from]!);
      decideAll(nx);
      stack.push(nx);
    }
  }
  return out;
}

const allInputs = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [m & 1, (m >> 1) & 1, (m >> 2) & 1]);

test('Module 01: the FLP dilemma on two concrete protocols (exhaustive over delivery orders)', async (t) => {
  await t.test('wait-all is safe and valid but NOT live: one initial crash leaves survivors undecided', () => {
    for (const inputs of allInputs) {
      const noCrash = explore(waitAll, inputs, new Set());
      assert.equal(noCrash.disagreementReachable, false);
      assert.equal(noCrash.stuckReachable, false);
      assert.equal(noCrash.decisionValues.size, 1, `inputs ${inputs} is univalent without a crash`);
      for (const c of [0, 1, 2]) {
        const r = explore(waitAll, inputs, new Set([c]));
        assert.equal(r.stuckReachable, true, `inputs ${inputs} crash p${c}: survivors wait forever`);
        assert.equal(r.disagreementReachable, false);
      }
    }
  });

  await t.test('wait-two-min is live under one crash but NOT safe: a schedule makes correct processes disagree', () => {
    const r = explore(waitTwoMin, [0, 1, 1], new Set());
    assert.equal(r.disagreementReachable, true);
    for (const inputs of allInputs) {
      for (const c of [0, 1, 2]) {
        assert.equal(explore(waitTwoMin, inputs, new Set([c])).stuckReachable, false, 'always terminates with 2 live');
      }
    }
  });

  await t.test('(0,1,1) is bivalent under wait-two-min while (0,0,0) and (1,1,1) are univalent (validity)', () => {
    assert.deepEqual([...explore(waitTwoMin, [0, 1, 1], new Set()).decisionValues].sort(), [0, 1]);
    assert.deepEqual([...explore(waitTwoMin, [0, 0, 0], new Set()).decisionValues], [0]);
    assert.deepEqual([...explore(waitTwoMin, [1, 1, 1], new Set()).decisionValues], [1]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Synchronous crash consensus needs f + 1 rounds (flood-set, exhaustive adversary).
 * ------------------------------------------------------------------ */
interface Crash {
  proc: number;
  round: number; // 1-based round in which it crashes
  reaches: number; // bitmask of recipients that still get its round message
}

export function floodSetAgrees(inputs: number[], rounds: number, crashes: Crash[]): boolean {
  const n = inputs.length;
  const w: Set<number>[] = inputs.map((v) => new Set([v]));
  const crashRound = new Map(crashes.map((c) => [c.proc, c]));
  for (let r = 1; r <= rounds; r++) {
    const snapshot = w.map((s) => new Set(s));
    for (let p = 0; p < n; p++) {
      const c = crashRound.get(p);
      if (c && c.round < r) continue; // already dead
      for (let q = 0; q < n; q++) {
        if (q === p) continue;
        const qc = crashRound.get(q);
        if (qc && qc.round < r) continue;
        if (c && c.round === r && !((c.reaches >> q) & 1)) continue; // partial send then crash
        for (const v of snapshot[p]!) w[q]!.add(v);
      }
    }
  }
  const decisions = new Set<number>();
  for (let p = 0; p < n; p++) if (!crashRound.has(p)) decisions.add(Math.min(...w[p]!));
  return decisions.size <= 1;
}

function allCrashPatterns(n: number, f: number, rounds: number): Crash[][] {
  const patterns: Crash[][] = [[]];
  const subsets = 1 << n;
  const rec = (start: number, cur: Crash[]) => {
    if (cur.length === f) return;
    for (let p = start; p < n; p++) {
      for (let r = 1; r <= rounds; r++) {
        for (let m = 0; m < subsets; m++) {
          const next = [...cur, { proc: p, round: r, reaches: m }];
          patterns.push(next);
          rec(p + 1, next);
        }
      }
    }
  };
  rec(0, []);
  return patterns;
}

test('Module 01: f + 1 rounds are necessary and sufficient for synchronous crash consensus (flood-set)', async (t) => {
  const vectors = (n: number) => [...Array(1 << n).keys()].map((m) => [...Array(n).keys()].map((i) => (m >> i) & 1));

  await t.test('f = 1, n = 4: one round admits a disagreeing crash pattern, two rounds never do', () => {
    const pats1 = allCrashPatterns(4, 1, 1);
    const bad1 = pats1.some((c) => vectors(4).some((v) => !floodSetAgrees(v, 1, c)));
    assert.equal(bad1, true);
    const pats2 = allCrashPatterns(4, 1, 2);
    assert.equal(pats2.every((c) => vectors(4).every((v) => floodSetAgrees(v, 2, c))), true);
  });

  await t.test('f = 2, n = 4: two rounds fail (chain of partial crashes), three rounds hold', () => {
    const chain: Crash[] = [
      { proc: 0, round: 1, reaches: 0b0010 }, // p0 crashes telling only p1
      { proc: 1, round: 2, reaches: 0b0100 }, // p1 crashes telling only p2
    ];
    assert.equal(floodSetAgrees([0, 1, 1, 1], 2, chain), false);
    assert.equal(floodSetAgrees([0, 1, 1, 1], 3, chain), true);
    const pats = allCrashPatterns(4, 2, 3);
    assert.equal(pats.every((c) => vectors(4).every((v) => floodSetAgrees(v, 3, c))), true);
  });
});

/* ------------------------------------------------------------------ *
 * 4. Ben-Or randomized binary consensus circumvents FLP with probability 1.
 * ------------------------------------------------------------------ */
export function benOr(
  inputs: number[],
  f: number,
  crashed: ReadonlySet<number>,
  seed: number,
  maxRounds = 500
): { decisions: Map<number, number>; rounds: number } {
  const n = inputs.length;
  const rng = new Prng(seed);
  const x = [...inputs];
  const decided = new Map<number, number>();
  const alive = [...Array(n).keys()].filter((p) => !crashed.has(p));
  const sample = <T>(xs: T[]): T[] => rng.shuffle(xs).slice(0, n - f); // adversarial-ish subset of size n - f
  for (let round = 1; round <= maxRounds; round++) {
    // Phase R: report values; propose v if a strict majority of n reports agree.
    const proposals = new Map<number, number | null>();
    for (const p of alive) {
      const got = sample(alive.map((q) => x[q]!));
      const ones = got.filter((v) => v === 1).length;
      const zeros = got.length - ones;
      proposals.set(p, ones > n / 2 ? 1 : zeros > n / 2 ? 0 : null);
    }
    // Phase P: collect proposals; decide on f + 1 matching, adopt on >= 1, else flip a coin.
    for (const p of alive) {
      const got = sample(alive.map((q) => proposals.get(q)!));
      const c1 = got.filter((v) => v === 1).length;
      const c0 = got.filter((v) => v === 0).length;
      if (c1 >= f + 1) {
        decided.set(p, decided.get(p) ?? 1);
        x[p] = 1;
      } else if (c0 >= f + 1) {
        decided.set(p, decided.get(p) ?? 0);
        x[p] = 0;
      } else if (c1 >= 1) x[p] = 1;
      else if (c0 >= 1) x[p] = 0;
      else x[p] = rng.chance(0.5) ? 1 : 0;
    }
    if (alive.every((p) => decided.has(p))) return { decisions: decided, rounds: round };
  }
  return { decisions: decided, rounds: maxRounds };
}

test('Module 01: Ben-Or randomized consensus terminates with agreement and validity (n = 5, f = 2)', async (t) => {
  await t.test('agreement and termination across 300 seeds with split inputs and two crashed processes', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = benOr([0, 1, 0, 1, 1], 2, new Set([3, 4]), seed);
      assert.equal(r.decisions.size, 3, `seed ${seed} should decide on every live process`);
      assert.equal(new Set(r.decisions.values()).size, 1, `seed ${seed} agreement`);
    }
  });

  await t.test('validity: unanimous input v can only decide v, in a single round', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const v of [0, 1]) {
        const r = benOr([v, v, v, v, v], 2, new Set(), seed);
        assert.deepEqual([...new Set(r.decisions.values())], [v]);
        assert.equal(r.rounds, 1);
      }
    }
  });

  await t.test('split inputs need more than one round for at least some seeds (randomness is doing the work)', () => {
    const rounds = Array.from({ length: 200 }, (_, i) => benOr([0, 1, 0, 1, 1], 2, new Set(), i + 1).rounds);
    assert.ok(Math.max(...rounds) > 1);
  });
});
