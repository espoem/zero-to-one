// Exhaustive model check of the cache-aside dual-write race (module 04, section 4).
// A reader and a writer each execute a fixed sequence of atomic steps; we enumerate EVERY
// interleaving that preserves each actor's program order and classify the final state.

export type Step =
  | 'R:readDb'
  | 'R:setCache'
  | 'W:writeDb'
  | 'W:delCache'
  | 'W:delCache2'
  | 'W:setCacheNew'; // write-through: install the new value

/** All merges of two sequences that keep the relative order inside each sequence. */
export function interleavings<T>(a: T[], b: T[]): T[][] {
  if (a.length === 0) return [b];
  if (b.length === 0) return [a];
  return [
    ...interleavings(a.slice(1), b).map((rest) => [a[0]!, ...rest]),
    ...interleavings(a, b.slice(1)).map((rest) => [b[0]!, ...rest]),
  ];
}

export interface Outcome {
  cache: 'absent' | 'old' | 'new';
  db: 'old' | 'new';
  stale: boolean; // cache holds the old value after the DB holds the new one
}

export interface Options {
  /** Versioned cache writes: SET only if the offered version is not older than what is cached. */
  versioned?: boolean;
  /** The reader starts with a cache miss (otherwise there is nothing to race for). */
}

/** Run one interleaving. The cache starts empty and the DB holds "old". */
export function run(order: Step[], opts: Options = {}): Outcome {
  let db: 'old' | 'new' = 'old';
  let cache: 'absent' | 'old' | 'new' = 'absent';
  let readValue: 'old' | 'new' | undefined;
  for (const step of order) {
    switch (step) {
      case 'R:readDb':
        readValue = db;
        break;
      case 'R:setCache':
        // versioned: refuse to overwrite a newer cached version with an older one
        if (opts.versioned && cache === 'new' && readValue === 'old') break;
        cache = readValue!;
        break;
      case 'W:setCacheNew':
        cache = 'new';
        break;
      case 'W:writeDb':
        db = 'new';
        break;
      case 'W:delCache':
      case 'W:delCache2':
        cache = 'absent';
        break;
    }
  }
  return { cache, db, stale: cache === 'old' && db === 'new' };
}

export interface Report {
  total: number;
  stale: number;
  staleOrders: Step[][];
}

export function check(
  writer: Step[],
  opts: Options = {},
  reader: Step[] = ['R:readDb', 'R:setCache'],
): Report {
  const all = interleavings(reader, writer);
  const staleOrders = all.filter((o) => run(o, opts).stale);
  return { total: all.length, stale: staleOrders.length, staleOrders };
}
