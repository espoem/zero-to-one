// FTS5 internals used by the Module 08 proofs: a reference BM25 and a decoder for the segment structure record.
// Both read only SQL-visible shadow tables, so they work through any binding.
import { decodeVarint } from './file-format.ts';
import type { Db } from './helpers.ts';

export const K1 = 1.2;
export const B = 0.75;

/** Sum of the per-column token counts stored in `<t>_docsize` (the `D` of BM25) for every row. */
export function rowLengths(db: Db, table: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of db.prepare(`SELECT id, sz FROM ${table}_docsize`).all() as {
    id: number;
    sz: Buffer;
  }[]) {
    let off = 0;
    let total = 0n;
    while (off < r.sz.length) {
      const v = decodeVarint(r.sz, off);
      total += v.value;
      off += v.length;
    }
    out.set(r.id, Number(total));
  }
  return out;
}

/**
 * Re-implementation of fts5's bm25() (ext/fts5/fts5_aux.c) for a query made of single-token phrases.
 * Returns rowid -> score with the same sign convention as bm25(): negative, smaller is better.
 *
 *   idf(q)   = max(ln((N - n(q) + 0.5) / (n(q) + 0.5)), 1e-6)       (idf <= 0 is replaced by 1e-6)
 *   f(q, d)  = sum of column weights over the occurrences of q in d
 *   score(d) = - sum_q idf(q) * f * (k1 + 1) / (f + k1 * (1 - b + b * |d| / avgdl))
 */
export function referenceBm25(
  db: Db,
  table: string,
  terms: string[],
  weights: Record<string, number> = {},
): Map<number, number> {
  const lengths = rowLengths(db, table);
  const N = lengths.size;
  const avgdl = [...lengths.values()].reduce((a, b) => a + b, 0) / N;
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS temp.${table}_vrow USING fts5vocab(main, ${table}, 'row')`,
  );
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS temp.${table}_vinst USING fts5vocab(main, ${table}, 'instance')`,
  );
  const scores = new Map<number, number>();
  for (const term of terms) {
    const n =
      (db.prepare(`SELECT doc FROM temp.${table}_vrow WHERE term = ?`).pluck().get(term) as
        | number
        | undefined) ?? 0;
    if (n === 0) continue;
    let idf = Math.log((N - n + 0.5) / (n + 0.5));
    if (idf <= 0) idf = 1e-6;
    const freq = new Map<number, number>();
    for (const r of db
      .prepare(`SELECT doc, col FROM temp.${table}_vinst WHERE term = ?`)
      .all(term) as { doc: number; col: string }[]) {
      freq.set(r.doc, (freq.get(r.doc) ?? 0) + (weights[r.col] ?? 1));
    }
    for (const [doc, f] of freq) {
      const D = lengths.get(doc)!;
      scores.set(
        doc,
        (scores.get(doc) ?? 0) - idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * D) / avgdl))),
      );
    }
  }
  return scores;
}

export interface Fts5Structure {
  cookie: number;
  levels: { nMerge: number; segments: { id: number; pgnoFirst: number; pgnoLast: number }[] }[];
  nWriteCounter: number;
}

/** Decode the structure record at `<t>_data` rowid 10: cookie, nLevel, nSegment, nWrite, then per level nMerge, nSeg and segments. */
export function fts5Structure(db: Db, table: string): Fts5Structure {
  const buf = db.prepare(`SELECT block FROM ${table}_data WHERE id = 10`).pluck().get() as Buffer;
  const cookie = buf.readUInt32BE(0);
  let off = 4;
  const next = (): number => {
    const v = decodeVarint(buf, off);
    off += v.length;
    return Number(v.value);
  };
  const nLevel = next();
  const nSegment = next();
  const nWriteCounter = next();
  const levels: Fts5Structure['levels'] = [];
  let seen = 0;
  for (let l = 0; l < nLevel; l++) {
    const nMerge = next();
    const nSeg = next();
    const segments = [];
    for (let s = 0; s < nSeg; s++)
      segments.push({ id: next(), pgnoFirst: next(), pgnoLast: next() });
    seen += nSeg;
    levels.push({ nMerge, segments });
  }
  if (seen !== nSegment)
    throw new Error(`structure record: ${seen} segments decoded, header says ${nSegment}`);
  if (off !== buf.length) throw new Error(`structure record: ${buf.length - off} trailing bytes`);
  return { cookie, levels, nWriteCounter };
}

export const segmentCount = (s: Fts5Structure): number =>
  s.levels.reduce((n, l) => n + l.segments.length, 0);
