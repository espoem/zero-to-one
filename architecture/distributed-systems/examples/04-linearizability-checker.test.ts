import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Operation in an execution history.
 */
export interface Operation {
  id: number;
  type: 'read' | 'write';
  val: number;
  inv: number; // invocation timestamp
  res: number; // response timestamp
}

/**
 * State model for a single register:
 * Initial value is 0.
 * write(x) updates state to x and returns x.
 * read() returns current state.
 */
export class RegisterModel {
  static step(state: number, op: Operation): { valid: boolean; nextState: number } {
    if (op.type === 'write') {
      return { valid: true, nextState: op.val };
    }
    if (op.type === 'read') {
      return { valid: state === op.val, nextState: state };
    }
    return { valid: false, nextState: state };
  }
}

/**
 * Wing-Gong (WGL) Linearizability Checker with memoization.
 * Returns true if history is linearizable under RegisterModel.
 */
export function checkLinearizability(history: Operation[], initialVal = 0): boolean {
  // Sort operations by invocation time
  const ops = [...history].sort((a, b) => a.inv - b.inv);
  const memo = new Set<string>();

  function search(remainingOps: Operation[], currentState: number): boolean {
    if (remainingOps.length === 0) return true;

    // Memoization key: bitmask or sorted IDs + currentState
    const key = `${remainingOps.map((o) => o.id).join(',')}:${currentState}`;
    if (memo.has(key)) return false;

    // Find the minimal response time among all remaining operations
    let minRes = Infinity;
    for (const op of remainingOps) {
      if (op.res < minRes) minRes = op.res;
    }

    // Any operation whose invocation is <= minRes can be linearized next
    for (let i = 0; i < remainingOps.length; i++) {
      const candidate = remainingOps[i]!;
      if (candidate.inv <= minRes) {
        const { valid, nextState } = RegisterModel.step(currentState, candidate);
        if (valid) {
          const nextRemaining = [...remainingOps.slice(0, i), ...remainingOps.slice(i + 1)];
          if (search(nextRemaining, nextState)) {
            return true;
          }
        }
      }
    }

    memo.add(key);
    return false;
  }

  return search(ops, initialVal);
}

test('Module 04: Linearizability Checker (WGL Algorithm)', async (t) => {
  await t.test('Verifies valid concurrent linearizable history', () => {
    // Op 1: Write(100) from t=1 to t=10
    // Op 2: Read(100) from t=5 to t=15 (concurrent with write)
    // Op 3: Read(100) from t=12 to t=20 (starts after write finished)
    const history: Operation[] = [
      { id: 1, type: 'write', val: 100, inv: 1, res: 10 },
      { id: 2, type: 'read', val: 100, inv: 5, res: 15 },
      { id: 3, type: 'read', val: 100, inv: 12, res: 20 },
    ];

    assert.equal(checkLinearizability(history, 0), true);
  });

  await t.test('Catches non-linearizable history (stale read after write completed)', () => {
    // Op 1: Write(100) from t=1 to t=10 (COMPLETED at t=10)
    // Op 2: Read() from t=12 to t=18 (Invoked AFTER write completed, but returns stale 0!)
    const invalidHistory: Operation[] = [
      { id: 1, type: 'write', val: 100, inv: 1, res: 10 },
      { id: 2, type: 'read', val: 0, inv: 12, res: 18 },
    ];

    assert.equal(checkLinearizability(invalidHistory, 0), false);
  });

  await t.test('Catches new-then-old anomaly across concurrent readers', () => {
    // Write(1) takes place from t=1 to t=20
    // Reader A reads 1 from t=5 to t=10 (observes new value)
    // Reader B reads 0 from t=12 to t=15 (invoked AFTER Reader A finished, but observes old value!)
    const staleHistory: Operation[] = [
      { id: 1, type: 'write', val: 1, inv: 1, res: 20 },
      { id: 2, type: 'read', val: 1, inv: 5, res: 10 },
      { id: 3, type: 'read', val: 0, inv: 12, res: 15 },
    ];

    // Must be rejected: Reader B observed 0 after Reader A observed 1 in real time
    assert.equal(checkLinearizability(staleHistory, 0), false);
  });
});
