// Security utilities for module 13.
import net, { BlockList } from 'node:net';
import dns from 'node:dns';
import { timingSafeEqual, createHash } from 'node:crypto';

/** Deep merge that refuses prototype-polluting keys and only follows plain objects. */
export function safeMerge<T extends Record<string, unknown>>(target: T, source: unknown): T {
  if (source === null || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = (source as Record<string, unknown>)[key];
    const current = (target as Record<string, unknown>)[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object'
    ) {
      safeMerge(current as Record<string, unknown>, value);
    } else {
      Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return target;
}

/** The classic vulnerable merge, kept for the negative test. */
export function naiveMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object') {
      target[key] ??= {};
      naiveMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/** Addresses an outbound fetch to a user-supplied URL must never reach. */
export function privateAddressBlockList(): BlockList {
  const b = new BlockList();
  b.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
  b.addSubnet('10.0.0.0', 8, 'ipv4');
  b.addSubnet('172.16.0.0', 12, 'ipv4');
  b.addSubnet('192.168.0.0', 16, 'ipv4');
  b.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local, including cloud metadata 169.254.169.254
  b.addSubnet('100.64.0.0', 10, 'ipv4'); // carrier-grade NAT
  b.addSubnet('0.0.0.0', 8, 'ipv4');
  b.addAddress('::1', 'ipv6');
  b.addSubnet('fc00::', 7, 'ipv6'); // unique local
  b.addSubnet('fe80::', 10, 'ipv6'); // link-local
  return b;
}

function normalise(address: string, family: number): { address: string; type: 'ipv4' | 'ipv6' } {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address); // IPv4-mapped IPv6 hides an IPv4 target
  if (mapped) return { address: mapped[1]!, type: 'ipv4' };
  return { address, type: family === 6 ? 'ipv6' : 'ipv4' };
}

/**
 * A `lookup` function for net/http/undici that resolves, then REJECTS private targets.
 * Because the check happens inside the connection's own lookup, the address checked is the
 * address connected to: no time-of-check/time-of-use gap for DNS rebinding.
 */
export function ssrfSafeLookup(
  blockList = privateAddressBlockList(),
  resolve: typeof dns.lookup = dns.lookup,
): net.LookupFunction {
  return ((
    hostname: string,
    options: dns.LookupOptions,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | dns.LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    resolve(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = addresses as dns.LookupAddress[];
      for (const a of list) {
        const n = normalise(a.address, a.family);
        if (blockList.check(n.address, n.type)) {
          return callback(
            Object.assign(new Error(`blocked address ${a.address} for ${hostname}`), {
              code: 'E_SSRF_BLOCKED',
            }),
            '',
            0,
          );
        }
      }
      if (options.all) return callback(null, list);
      const first = list[0]!;
      callback(null, first.address, first.family);
    });
  }) as net.LookupFunction;
}

/** Constant-time comparison of secrets of any length (hash first so lengths match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
