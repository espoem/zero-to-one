// Hermetic runner for the track's Lua scripts.
//
// Runs the *same* .lua files that integration tests send to a real server with EVAL, inside
// fengari (Lua 5.3 in JavaScript) against a tiny in-memory command executor. Redis embeds
// Lua 5.1; the scripts avoid 5.3-only syntax (integer division //, bitwise operators, utf8),
// so behaviour matches for them. This proves script *logic*; atomicity and replication are
// proven against a real server in integration/05-transactions-scripting.test.ts.
//
// Type conversions follow https://redis.io/docs/latest/develop/programmability/lua-api/ :
//   Redis -> Lua: integer -> number, bulk -> string, nil bulk -> false, array -> table,
//                 status -> {ok=...}; an error reply raises (redis.call) or returns {err=...} (pcall)
//   Lua -> Redis: number -> integer (truncated), string -> bulk, true -> 1, false/nil -> nil,
//                 {ok=...} -> status, {err=...} -> error, array table -> array (up to first nil)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// fengari ships CommonJS without types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fengari: any = require('fengari');
const { lua, lauxlib, lualib, to_luastring } = fengari;

export type Reply = number | string | null | Reply[] | { ok: string } | { err: string };

export class CommandError extends Error {}

/** Minimal keyspace with the commands our scripts use. Values are strings or hashes. */
export class MiniRedis {
  readonly data = new Map<string, string | Map<string, string>>();
  readonly ttl = new Map<string, number>();
  now = 0;
  log: string[][] = [];

  private alive(k: string): boolean {
    const e = this.ttl.get(k);
    if (e !== undefined && e <= this.now) {
      this.data.delete(k);
      this.ttl.delete(k);
    }
    return this.data.has(k);
  }
  private str(k: string): string | null {
    if (!this.alive(k)) return null;
    const v = this.data.get(k)!;
    if (typeof v !== 'string')
      throw new CommandError('WRONGTYPE Operation against a key holding the wrong kind of value');
    return v;
  }
  private hash(k: string, create: boolean): Map<string, string> | null {
    if (!this.alive(k)) {
      if (!create) return null;
      const m = new Map<string, string>();
      this.data.set(k, m);
      return m;
    }
    const v = this.data.get(k)!;
    if (typeof v === 'string')
      throw new CommandError('WRONGTYPE Operation against a key holding the wrong kind of value');
    return v;
  }
  private incrBy(k: string, by: number): number {
    const cur = this.str(k);
    if (cur !== null && !/^-?\d+$/.test(cur))
      throw new CommandError('ERR value is not an integer or out of range');
    const n = Number(cur ?? '0') + by;
    this.data.set(k, String(n));
    return n;
  }

  exec(argv: string[]): Reply {
    this.log.push(argv);
    const [cmd, ...a] = argv;
    switch (cmd!.toUpperCase()) {
      case 'GET':
        return this.str(a[0]!);
      case 'SET': {
        const [k, v, ...opts] = a;
        const up = opts.map((o) => o.toUpperCase());
        if (up.includes('NX') && this.alive(k!)) return null;
        this.data.set(k!, v!);
        this.ttl.delete(k!);
        const px = up.indexOf('PX');
        if (px >= 0) this.ttl.set(k!, this.now + Number(opts[px + 1]));
        return { ok: 'OK' };
      }
      case 'DEL':
        return a.filter((k) => this.alive(k) && (this.data.delete(k), this.ttl.delete(k), true))
          .length;
      case 'EXISTS':
        return a.filter((k) => this.alive(k)).length;
      case 'INCR':
        return this.incrBy(a[0]!, 1);
      case 'INCRBY':
        return this.incrBy(a[0]!, Number(a[1]));
      case 'DECRBY':
        return this.incrBy(a[0]!, -Number(a[1]));
      case 'PEXPIRE':
        if (!this.alive(a[0]!)) return 0;
        this.ttl.set(a[0]!, this.now + Number(a[1]));
        return 1;
      case 'PTTL':
        if (!this.alive(a[0]!)) return -2;
        return this.ttl.has(a[0]!) ? this.ttl.get(a[0]!)! - this.now : -1;
      case 'HSET': {
        const h = this.hash(a[0]!, true)!;
        let added = 0;
        for (let i = 1; i < a.length; i += 2) {
          if (!h.has(a[i]!)) added++;
          h.set(a[i]!, a[i + 1]!);
        }
        return added;
      }
      case 'HMGET': {
        const h = this.hash(a[0]!, false);
        return a.slice(1).map((f) => h?.get(f) ?? null);
      }
      default:
        throw new CommandError(`ERR unknown command '${cmd}'`);
    }
  }
}

function push(L: unknown, r: Reply): void {
  if (r === null) lua.lua_pushboolean(L, false);
  else if (typeof r === 'number') lua.lua_pushinteger(L, r);
  else if (typeof r === 'string') lua.lua_pushstring(L, to_luastring(r));
  else if (Array.isArray(r)) {
    lua.lua_createtable(L, r.length, 0);
    r.forEach((x, i) => {
      push(L, x);
      lua.lua_rawseti(L, -2, i + 1);
    });
  } else if ('ok' in r) {
    lua.lua_createtable(L, 0, 1);
    lua.lua_pushstring(L, to_luastring(r.ok));
    lua.lua_setfield(L, -2, to_luastring('ok'));
  } else {
    lua.lua_createtable(L, 0, 1);
    lua.lua_pushstring(L, to_luastring(r.err));
    lua.lua_setfield(L, -2, to_luastring('err'));
  }
}

function pull(L: unknown, idx: number): Reply {
  const t = lua.lua_type(L, idx);
  if (t === lua.LUA_TNUMBER) return Math.trunc(lua.lua_tonumber(L, idx));
  if (t === lua.LUA_TSTRING) return lua.lua_tojsstring(L, idx);
  if (t === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, idx) ? 1 : null;
  if (t === lua.LUA_TTABLE) {
    const abs = lua.lua_absindex(L, idx);
    for (const field of ['err', 'ok'] as const) {
      lua.lua_getfield(L, abs, to_luastring(field));
      if (lua.lua_type(L, -1) === lua.LUA_TSTRING) {
        const s = lua.lua_tojsstring(L, -1);
        lua.lua_pop(L, 1);
        return field === 'err' ? { err: s } : { ok: s };
      }
      lua.lua_pop(L, 1);
    }
    const out: Reply[] = [];
    for (let i = 1; ; i++) {
      lua.lua_rawgeti(L, abs, i);
      if (lua.lua_type(L, -1) === lua.LUA_TNIL) {
        lua.lua_pop(L, 1);
        break;
      }
      out.push(pull(L, -1));
      lua.lua_pop(L, 1);
    }
    return out;
  }
  return null;
}

const PRELUDE = `
redis = {}
function redis.call(...) return __rcall(...) end
function redis.pcall(...)
  local ok, r = pcall(__rcall, ...)
  if ok then return r end
  return {err = r}
end
function redis.error_reply(m) return {err = m} end
function redis.status_reply(m) return {ok = m} end
`;

/** EVAL semantics against MiniRedis. Throws CommandError for an error reply, like a client would. */
export function evalScript(
  db: MiniRedis,
  source: string,
  keys: string[],
  args: Array<string | number>,
): Reply {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lua.lua_pushjsfunction(L, (Ls: unknown) => {
    const n = lua.lua_gettop(Ls);
    const argv: string[] = [];
    for (let i = 1; i <= n; i++) argv.push(lua.lua_tojsstring(Ls, i));
    let r: Reply;
    try {
      r = db.exec(argv);
    } catch (e) {
      lua.lua_pushstring(Ls, to_luastring((e as Error).message));
      return lua.lua_error(Ls);
    }
    push(Ls, r);
    return 1;
  });
  lua.lua_setglobal(L, to_luastring('__rcall'));
  for (const [name, list] of [
    ['KEYS', keys],
    ['ARGV', args.map(String)],
  ] as const) {
    push(L, [...list]);
    lua.lua_setglobal(L, to_luastring(name));
  }
  if (lauxlib.luaL_dostring(L, to_luastring(PRELUDE)) !== lua.LUA_OK)
    throw new Error('prelude failed');
  if (lauxlib.luaL_loadstring(L, to_luastring(source)) !== lua.LUA_OK) {
    throw new CommandError(`ERR Error compiling script: ${lua.lua_tojsstring(L, -1)}`);
  }
  if (lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
    throw new CommandError(lua.lua_tojsstring(L, -1));
  }
  const r = pull(L, -1);
  if (r !== null && typeof r === 'object' && !Array.isArray(r) && 'err' in r)
    throw new CommandError(r.err);
  return r;
}

export function loadScript(name: string): string {
  return readFileSync(new URL(`../../lua/${name}`, import.meta.url), 'utf8');
}
