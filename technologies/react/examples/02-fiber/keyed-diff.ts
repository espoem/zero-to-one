/**
 * A faithful model of React's keyed child reconciliation
 * (`reconcileChildrenArray` + `placeChild` in ReactChildFiber.js), reduced to keys.
 *
 * It answers one question: given the old and new key orders of a list, which children
 * does React keep in place, move, insert or delete? The test suite checks the model
 * against the real react-dom by counting DOM placement calls.
 */
export type Op =
  | { kind: "insert"; key: string; index: number }
  | { kind: "move"; key: string; index: number }
  | { kind: "delete"; key: string };

export interface DiffResult {
  ops: Op[];
  /** Keys reused without a DOM move, in new order. */
  stayed: string[];
}

export function reconcileKeyed(oldKeys: readonly string[], newKeys: readonly string[]): DiffResult {
  const ops: Op[] = [];
  const stayed: string[] = [];
  let lastPlacedIndex = 0;
  let i = 0;

  // Pass 1: walk both lists in lockstep while the keys agree (the common prefix).
  // Invariant: old[0..i) and new[0..i) are equal and stay in place.
  while (i < oldKeys.length && i < newKeys.length && oldKeys[i] === newKeys[i]) {
    stayed.push(newKeys[i]!);
    lastPlacedIndex = i;
    i++;
  }

  // New list exhausted: everything left in the old list is deleted.
  if (i === newKeys.length) {
    for (let k = i; k < oldKeys.length; k++) ops.push({ kind: "delete", key: oldKeys[k]! });
    return { ops, stayed };
  }

  // Old list exhausted: everything left in the new list is inserted.
  if (i === oldKeys.length) {
    for (let k = i; k < newKeys.length; k++) ops.push({ kind: "insert", key: newKeys[k]!, index: k });
    return { ops, stayed };
  }

  // Pass 2: index the remaining old children by key.
  const remaining = new Map<string, number>();
  for (let k = i; k < oldKeys.length; k++) remaining.set(oldKeys[k]!, k);

  // Invariant (loop over j): the old indices of `stayed` are strictly increasing and
  // lastPlacedIndex is the largest of them. A reused child whose old index is smaller than
  // lastPlacedIndex would be out of order, so it must move.
  for (let j = i; j < newKeys.length; j++) {
    const key = newKeys[j]!;
    const oldIndex = remaining.get(key);
    if (oldIndex === undefined) {
      ops.push({ kind: "insert", key, index: j });
      continue;
    }
    remaining.delete(key);
    if (oldIndex < lastPlacedIndex) {
      ops.push({ kind: "move", key, index: j });
    } else {
      lastPlacedIndex = oldIndex;
      stayed.push(key);
    }
  }

  for (const key of remaining.keys()) ops.push({ kind: "delete", key });
  return { ops, stayed };
}

/** Length of the longest increasing subsequence — the minimum-moves lower bound. */
export function lisLength(xs: readonly number[]): number {
  const tails: number[] = [];
  for (const x of xs) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}
