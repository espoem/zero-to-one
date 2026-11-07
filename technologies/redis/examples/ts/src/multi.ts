// Operational model of MULTI / EXEC / DISCARD / WATCH (multi.c), on top of MiniRedis.
//
//  - Commands after MULTI are *queued*; the reply is +QUEUED.
//  - A command rejected at queue time (unknown command, wrong arity) flags the transaction:
//    EXEC then returns -EXECABORT and runs nothing.
//  - Runtime errors (WRONGTYPE, not an integer) are reported per command inside EXEC's reply;
//    the other commands still run. There is no rollback.
//  - WATCH k: if k is modified by anyone (including expiry) between WATCH and EXEC, EXEC
//    returns a null reply and runs nothing (optimistic concurrency, check-and-set).
import { MiniRedis, CommandError, type Reply } from './lua.ts';

const ARITY: Record<string, number> = {
  GET: 2,
  SET: -3,
  DEL: -2,
  INCR: 2,
  INCRBY: 3,
  DECRBY: 3,
  HSET: -4,
  HMGET: -3,
  EXISTS: -2,
  PEXPIRE: 3,
  PTTL: 2,
};
const WRITES = new Set(['SET', 'DEL', 'INCR', 'INCRBY', 'DECRBY', 'HSET', 'PEXPIRE']);

export class VersionedRedis extends MiniRedis {
  /** Per-key modification counter, the model of "the key was touched" used by WATCH. */
  readonly version = new Map<string, number>();
  override exec(argv: string[]): Reply {
    const r = super.exec(argv);
    const cmd = argv[0]!.toUpperCase();
    if (WRITES.has(cmd)) {
      const keys = cmd === 'DEL' ? argv.slice(1) : [argv[1]!];
      for (const k of keys) this.version.set(k, (this.version.get(k) ?? 0) + 1);
    }
    return r;
  }
}

export class Connection {
  private queue: string[][] | null = null;
  private dirty = false;
  private watched = new Map<string, number>();
  private readonly db: VersionedRedis;
  constructor(db: VersionedRedis) {
    this.db = db;
  }

  call(...argv: string[]): Reply | 'QUEUED' {
    const cmd = argv[0]!.toUpperCase();
    if (cmd === 'MULTI') {
      if (this.queue) throw new CommandError('ERR MULTI calls can not be nested');
      this.queue = [];
      return { ok: 'OK' };
    }
    if (cmd === 'WATCH') {
      if (this.queue) throw new CommandError('ERR WATCH inside MULTI is not allowed');
      for (const k of argv.slice(1)) this.watched.set(k, this.db.version.get(k) ?? 0);
      return { ok: 'OK' };
    }
    if (cmd === 'DISCARD') {
      if (!this.queue) throw new CommandError('ERR DISCARD without MULTI');
      this.reset();
      return { ok: 'OK' };
    }
    if (cmd === 'EXEC') {
      if (!this.queue) throw new CommandError('ERR EXEC without MULTI');
      const q = this.queue;
      const dirty = this.dirty;
      const conflict = [...this.watched].some(([k, v]) => (this.db.version.get(k) ?? 0) !== v);
      this.reset();
      if (dirty)
        throw new CommandError('EXECABORT Transaction discarded because of previous errors.');
      if (conflict) return null; // nil reply: someone touched a watched key
      return q.map((c) => {
        try {
          return this.db.exec(c);
        } catch (e) {
          return { err: (e as Error).message };
        }
      });
    }
    if (this.queue) {
      const arity = ARITY[cmd];
      if (arity === undefined || (arity > 0 ? argv.length !== arity : argv.length < -arity)) {
        this.dirty = true;
        throw new CommandError(
          arity === undefined
            ? `ERR unknown command '${argv[0]}'`
            : `ERR wrong number of arguments for '${argv[0]!.toLowerCase()}' command`,
        );
      }
      this.queue.push(argv);
      return 'QUEUED';
    }
    return this.db.exec(argv);
  }

  private reset(): void {
    this.queue = null;
    this.dirty = false;
    this.watched = new Map(); // EXEC and DISCARD always UNWATCH
  }
}
