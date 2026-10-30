import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface BGPRoute {
  prefix: string;
  nextHop: string;
  weight?: number;        // Local to router (default 0)
  localPref?: number;    // AS-wide (default 100)
  locallyOriginated?: boolean;
  asPath: number[];       // List of ASNs
  origin: 'IGP' | 'EGP' | 'INCOMPLETE'; // IGP(0) < EGP(1) < INCOMPLETE(2)
  med?: number;           // Multi-Exit Discriminator (lower preferred)
  isEBGP: boolean;        // eBGP preferred over iBGP
  igpMetric?: number;     // Metric to NEXT_HOP (lower preferred)
  routerId: string;       // Tie-breaker (lower numeric IP)
}

export function compareBGPPaths(a: BGPRoute, b: BGPRoute): number {
  // 1. Highest Weight
  const weightA = a.weight ?? 0;
  const weightB = b.weight ?? 0;
  if (weightA !== weightB) return weightB - weightA;

  // 2. Highest LOCAL_PREF
  const lpA = a.localPref ?? 100;
  const lpB = b.localPref ?? 100;
  if (lpA !== lpB) return lpB - lpA;

  // 3. Locally Originated
  const localA = a.locallyOriginated ? 1 : 0;
  const localB = b.locallyOriginated ? 1 : 0;
  if (localA !== localB) return localB - localA;

  // 4. Shortest AS_PATH
  if (a.asPath.length !== b.asPath.length) {
    return a.asPath.length - b.asPath.length;
  }

  // 5. Origin Code (IGP < EGP < INCOMPLETE)
  const originRank = { IGP: 0, EGP: 1, INCOMPLETE: 2 };
  if (originRank[a.origin] !== originRank[b.origin]) {
    return originRank[a.origin] - originRank[b.origin];
  }

  // 6. Lowest MED
  const medA = a.med ?? 0;
  const medB = b.med ?? 0;
  if (medA !== medB) return medA - medB;

  // 7. eBGP over iBGP
  if (a.isEBGP !== b.isEBGP) {
    return a.isEBGP ? -1 : 1;
  }

  // 8. Lowest IGP metric to NEXT_HOP
  const igpA = a.igpMetric ?? 0;
  const igpB = b.igpMetric ?? 0;
  if (igpA !== igpB) return igpA - igpB;

  // 9. Lowest BGP Router ID (alphabetical comparison of IPv4 string)
  return a.routerId.localeCompare(b.routerId);
}

export function selectBestBGPRoute(routes: BGPRoute[]): BGPRoute {
  if (routes.length === 0) throw new Error('No routes provided');
  const sorted = [...routes].sort(compareBGPPaths);
  return sorted[0]!;
}

export interface ROA {
  prefix: string;
  prefixLength: number;
  maxLength: number;
  asn: number;
}

export type RovStatus = 'VALID' | 'INVALID' | 'NOT_FOUND';

export function validateRPKI(advertisedPrefix: string, advertisedAsn: number, roaDatabase: ROA[]): RovStatus {
  const [ip, lenStr] = advertisedPrefix.split('/');
  const len = Number.parseInt(lenStr ?? '32', 10);

  // Check if any ROA covers this prefix
  const coveringRoas = roaDatabase.filter(r => {
    const [roaIp, roaLenStr] = r.prefix.split('/');
    const roaLen = Number.parseInt(roaLenStr ?? '32', 10);
    // Simple equality or covering check for demo
    return roaIp === ip && len >= roaLen;
  });

  if (coveringRoas.length === 0) {
    return 'NOT_FOUND';
  }

  // If covering ROA exists, check if any matches ASN and length
  const matched = coveringRoas.some(r => r.asn === advertisedAsn && len <= r.maxLength);
  return matched ? 'VALID' : 'INVALID';
}

describe('Module 04: BGP Path Selection & RPKI Route Origin Validation', () => {
  it('selects route with higher LOCAL_PREF despite longer AS_PATH (Economic Peering Rule)', () => {
    const transitRoute: BGPRoute = {
      prefix: '203.0.113.0/24',
      nextHop: '198.51.100.1',
      localPref: 100, // Paid transit
      asPath: [64501, 64500], // 2 hops
      origin: 'IGP',
      isEBGP: true,
      routerId: '198.51.100.1',
    };

    const peeringRoute: BGPRoute = {
      prefix: '203.0.113.0/24',
      nextHop: '198.51.100.2',
      localPref: 200, // Free peering at IXP
      asPath: [64502, 64503, 64500], // 3 hops (longer!)
      origin: 'IGP',
      isEBGP: true,
      routerId: '198.51.100.2',
    };

    const best = selectBestBGPRoute([transitRoute, peeringRoute]);
    assert.equal(best.nextHop, '198.51.100.2');
    assert.equal(best.localPref, 200);
  });

  it('selects shortest AS_PATH when LOCAL_PREF is equal', () => {
    const routeA: BGPRoute = {
      prefix: '192.0.2.0/24',
      nextHop: '10.0.0.1',
      localPref: 100,
      asPath: [64510, 64520, 64500], // 3 hops
      origin: 'IGP',
      isEBGP: true,
      routerId: '10.0.0.1',
    };

    const routeB: BGPRoute = {
      prefix: '192.0.2.0/24',
      nextHop: '10.0.0.2',
      localPref: 100,
      asPath: [64530, 64500], // 2 hops
      origin: 'IGP',
      isEBGP: true,
      routerId: '10.0.0.2',
    };

    const best = selectBestBGPRoute([routeA, routeB]);
    assert.equal(best.nextHop, '10.0.0.2');
  });

  it('detects and invalidates sub-prefix BGP hijack using RPKI ROV', () => {
    const roaDatabase: ROA[] = [
      {
        prefix: '198.51.100.0/22',
        prefixLength: 22,
        maxLength: 22, // No sub-prefixes permitted!
        asn: 64500,    // Legitimate owner
      },
    ];

    // Legitimate announcement
    const validState = validateRPKI('198.51.100.0/22', 64500, roaDatabase);
    assert.equal(validState, 'VALID');

    // Hijack 1: Malicious ASN announcing same prefix
    const hijackAsn = validateRPKI('198.51.100.0/22', 64555, roaDatabase);
    assert.equal(hijackAsn, 'INVALID');

    // Hijack 2: Sub-prefix hijack (/24 exceeds maxLength /22)
    const subprefixHijack = validateRPKI('198.51.100.0/24', 64500, roaDatabase);
    assert.equal(subprefixHijack, 'INVALID');

    // Unknown prefix without ROA
    const unknownState = validateRPKI('203.0.113.0/24', 64500, roaDatabase);
    assert.equal(unknownState, 'NOT_FOUND');
  });
});
