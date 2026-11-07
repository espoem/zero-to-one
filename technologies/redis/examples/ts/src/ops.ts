// Operations helpers: INFO parsing, a configuration linter for well-known production hazards,
// and a subset of the ACL rule language for reasoning about permissions.

export type Info = Record<string, Record<string, string>>;

/** Parse `INFO` output: "# Section" headers and "key:value" lines. */
export function parseInfo(text: string): Info {
  const out: Info = {};
  let section = 'default';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      section = line.slice(1).trim().toLowerCase();
      out[section] ??= {};
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    (out[section] ??= {})[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

/** Nested values such as `db0:keys=10,expires=2,avg_ttl=0`. */
export function parseNested(v: string): Record<string, string> {
  return Object.fromEntries(v.split(',').map((kv) => kv.split('=') as [string, string]));
}

// ---------------------------------------------------------------------------------------------
// Production lint
// ---------------------------------------------------------------------------------------------

export interface HostFacts {
  thp: 'always' | 'madvise' | 'never';
  overcommitMemory: 0 | 1 | 2;
  ramBytes: number;
}

export interface Finding {
  severity: 'critical' | 'warning';
  rule: string;
}

/** `config` is the CONFIG GET * map. */
export function lint(
  config: Record<string, string>,
  host: HostFacts,
  role: 'cache' | 'store',
): Finding[] {
  const f: Finding[] = [];
  const add = (severity: Finding['severity'], rule: string) => f.push({ severity, rule });
  const bindsPublic = (config.bind ?? '')
    .split(/\s+/)
    .some((a) => a === '0.0.0.0' || a === '*' || a === '::' || a === '');
  const defaultUserOpen = config['__default_user_nopass'] === 'yes';
  if (bindsPublic && config['protected-mode'] === 'no' && defaultUserOpen)
    add('critical', 'reachable on all interfaces with no password and protected-mode off');
  if (host.thp === 'always')
    add('warning', 'transparent huge pages enabled: fork latency and copy-on-write amplification');
  if (host.overcommitMemory !== 1)
    add('warning', 'vm.overcommit_memory != 1: BGSAVE/BGREWRITEAOF fork may fail');
  const maxmem = Number(config.maxmemory ?? '0');
  if (maxmem === 0)
    add('warning', 'maxmemory unset: the kernel OOM killer becomes the eviction policy');
  else if (maxmem > host.ramBytes * 0.8)
    add('warning', 'maxmemory above 80% of RAM: no headroom for fork, buffers, fragmentation');
  const policy = config['maxmemory-policy'] ?? 'noeviction';
  if (role === 'store' && policy.startsWith('allkeys-'))
    add(
      'critical',
      'durable store with an allkeys-* eviction policy: data can be evicted silently',
    );
  if (role === 'cache' && policy === 'noeviction')
    add('warning', 'cache with noeviction: writes fail with OOM when full');
  if (role === 'store' && config.appendonly !== 'yes' && (config.save ?? '') === '')
    add('critical', 'durable store with no persistence');
  if (Number(config['slowlog-log-slower-than'] ?? '10000') < 0) add('warning', 'slow log disabled');
  if ((config['rename-command-used'] ?? 'no') === 'yes')
    add('warning', 'rename-command is deprecated: use ACLs');
  return f;
}

// ---------------------------------------------------------------------------------------------
// ACL subset: on/off, nopass/>pw, ~pattern, %R~ / %W~, allkeys, +@cat / -@cat, +cmd / -cmd
// ---------------------------------------------------------------------------------------------

const CATEGORIES: Record<string, string[]> = {
  read: ['get', 'mget', 'hget', 'hgetall', 'smembers', 'zrange', 'scan', 'keys', 'exists', 'ttl'],
  write: ['set', 'del', 'hset', 'sadd', 'zadd', 'incr', 'expire', 'flushall', 'flushdb', 'unlink'],
  keyspace: ['del', 'exists', 'expire', 'ttl', 'keys', 'scan', 'unlink', 'flushall', 'flushdb'],
  dangerous: ['flushall', 'flushdb', 'keys', 'config', 'debug', 'shutdown', 'acl'],
  admin: ['config', 'debug', 'shutdown', 'acl'],
};
const ALL = [...new Set(Object.values(CATEGORIES).flat())];
const WRITES = new Set(CATEGORIES.write);

export interface AclUser {
  enabled: boolean;
  commands: Set<string>;
  patterns: Array<{ glob: string; read: boolean; write: boolean }>;
}

export function setUser(rules: string): AclUser {
  const u: AclUser = { enabled: false, commands: new Set(), patterns: [] };
  for (const r of rules.trim().split(/\s+/)) {
    if (r === 'on') u.enabled = true;
    else if (r === 'off') u.enabled = false;
    else if (r === 'allkeys') u.patterns.push({ glob: '*', read: true, write: true });
    else if (r === 'allcommands' || r === '+@all') ALL.forEach((c) => u.commands.add(c));
    else if (r === 'nocommands' || r === '-@all') u.commands.clear();
    else if (r.startsWith('%R~')) u.patterns.push({ glob: r.slice(3), read: true, write: false });
    else if (r.startsWith('%W~')) u.patterns.push({ glob: r.slice(3), read: false, write: true });
    else if (r.startsWith('%RW~')) u.patterns.push({ glob: r.slice(4), read: true, write: true });
    else if (r.startsWith('~')) u.patterns.push({ glob: r.slice(1), read: true, write: true });
    else if (r.startsWith('+@')) (CATEGORIES[r.slice(2)] ?? []).forEach((c) => u.commands.add(c));
    else if (r.startsWith('-@'))
      (CATEGORIES[r.slice(2)] ?? []).forEach((c) => u.commands.delete(c));
    else if (r.startsWith('+')) u.commands.add(r.slice(1).toLowerCase());
    else if (r.startsWith('-')) u.commands.delete(r.slice(1).toLowerCase());
    else if (r.startsWith('>') || r === 'nopass') {
      /* credentials are not modelled */
    } else throw new Error(`ERR Error in ACL SETUSER modifier '${r}': Syntax error`);
  }
  return u;
}

function globToRegExp(g: string): RegExp {
  return new RegExp(
    `^${g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')}$`,
  );
}

/** Rules apply left to right: later rules override earlier ones for the same command. */
export function check(
  u: AclUser,
  cmd: string,
  keys: string[],
): 'OK' | 'NOPERM-command' | 'NOPERM-key' | 'disabled' {
  if (!u.enabled) return 'disabled';
  const c = cmd.toLowerCase();
  if (!u.commands.has(c)) return 'NOPERM-command';
  const write = WRITES.has(c);
  for (const k of keys) {
    const ok = u.patterns.some((p) => globToRegExp(p.glob).test(k) && (write ? p.write : p.read));
    if (!ok) return 'NOPERM-key';
  }
  return 'OK';
}
