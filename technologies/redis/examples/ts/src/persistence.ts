// Persistence models: AOF loading (with truncated tails and unfinished MULTI blocks),
// the multi-part AOF manifest, data-loss windows per fsync policy, and copy-on-write cost.
import { RespParser, RespProtocolError, encodeCommand, type RespValue } from './resp.ts';

export interface AofLoadResult {
  commands: string[][];
  /** Bytes that were ignored at the end of the file. */
  truncatedBytes: number;
}

function toArgv(v: RespValue): string[] {
  if (v.type !== 'array' || v.value === null)
    throw new RespProtocolError('AOF entry is not a command array');
  return v.value.map((x) => {
    if (x.type !== 'bulk' || x.value === null)
      throw new RespProtocolError('AOF argument is not a bulk string');
    return x.value.toString('utf8');
  });
}

/**
 * Replays an AOF (a sequence of RESP command arrays). Mirrors loadSingleAppendOnlyFile():
 *  - an incomplete last command is a truncated tail: with aof-load-truncated yes (default) the
 *    server logs a warning, truncates the file to the last complete command and starts;
 *    with "no" it refuses to start;
 *  - commands after a MULTI with no EXEC before EOF are not applied;
 *  - garbage in the middle of the file is always fatal (use redis-check-aof --fix).
 */
export function loadAof(
  bytes: Buffer,
  opts: { loadTruncated: boolean } = { loadTruncated: true },
): AofLoadResult {
  const parser = new RespParser();
  const values = parser.push(bytes); // throws RespProtocolError on corruption
  const tail = parser.pending;
  if (tail > 0 && !opts.loadTruncated)
    throw new Error('Bad file format reading the append only file (truncated)');
  const out: string[][] = [];
  let pendingTx: string[][] | null = null;
  for (const v of values) {
    const argv = toArgv(v);
    const cmd = argv[0]!.toUpperCase();
    if (cmd === 'MULTI') pendingTx = [];
    else if (cmd === 'EXEC') {
      out.push(...(pendingTx ?? []));
      pendingTx = null;
    } else if (pendingTx) pendingTx.push(argv);
    else out.push(argv);
  }
  return { commands: out, truncatedBytes: tail };
}

export const aofOf = (...cmds: string[][]): Buffer =>
  Buffer.concat(cmds.map((c) => encodeCommand(c)));

// ---------------------------------------------------------------------------------------------
// Multi-part AOF (Redis 7.0+): appendonlydir/ with a manifest
// ---------------------------------------------------------------------------------------------

export interface ManifestEntry {
  file: string;
  seq: number;
  type: 'b' | 'h' | 'i'; // base, history, incremental
}

export function parseManifest(text: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const kv = new Map<string, string>();
    for (let i = 0; i + 1 < parts.length; i += 2) kv.set(parts[i]!, parts[i + 1]!);
    const file = kv.get('file');
    const seq = Number(kv.get('seq'));
    const type = kv.get('type');
    if (!file || !Number.isInteger(seq) || !(type === 'b' || type === 'h' || type === 'i')) {
      throw new Error(`Invalid AOF manifest line: ${line}`);
    }
    entries.push({ file, seq, type });
  }
  return entries;
}

/** Files to load, in order: exactly one base, then incrementals by increasing seq; history is ignored. */
export function loadOrder(entries: ManifestEntry[]): string[] {
  const bases = entries.filter((e) => e.type === 'b');
  if (bases.length !== 1)
    throw new Error(`manifest must have exactly one base file, found ${bases.length}`);
  const incr = entries.filter((e) => e.type === 'i').sort((a, b) => a.seq - b.seq);
  for (let i = 1; i < incr.length; i++) {
    if (incr[i]!.seq <= incr[i - 1]!.seq) throw new Error('duplicate incremental sequence');
  }
  return [bases[0]!.file, ...incr.map((e) => e.file)];
}

// ---------------------------------------------------------------------------------------------
// Data-loss windows
// ---------------------------------------------------------------------------------------------

export type Policy =
  | { kind: 'rdb'; saveIntervalSec: number }
  | { kind: 'aof'; fsync: 'always' | 'everysec' | 'no' }
  | { kind: 'none' };

/**
 * Worst-case seconds of acknowledged writes lost on a crash of the *machine* (power loss),
 * ignoring replication. A process crash (kill -9) with the OS alive loses less: data already
 * written to the kernel survives even without fsync.
 */
export function worstCaseLossSeconds(p: Policy, osFlushSec = 30): number {
  switch (p.kind) {
    case 'none':
      return Infinity;
    case 'rdb':
      return p.saveIntervalSec;
    case 'aof':
      // everysec: up to ~1 s, and up to 2 s if a background fsync is slow (the main thread then
      // delays writes, see aof_delayed_fsync); "no" leaves it to the kernel (typically ~30 s).
      return p.fsync === 'always' ? 0 : p.fsync === 'everysec' ? 2 : osFlushSec;
  }
}

// ---------------------------------------------------------------------------------------------
// Copy-on-write during fork
// ---------------------------------------------------------------------------------------------

/**
 * Expected bytes copied by the kernel while a fork child is alive, for `writes` updates landing
 * uniformly on a dataset of `datasetBytes` with a given page size: each first write to a shared
 * page copies the whole page. Expected distinct pages touched = P (1 - (1 - 1/P)^W).
 */
export function expectedCowBytes(datasetBytes: number, writes: number, pageBytes: number): number {
  const pages = Math.ceil(datasetBytes / pageBytes);
  const touched = pages * (1 - Math.pow(1 - 1 / pages, writes));
  return touched * pageBytes;
}
