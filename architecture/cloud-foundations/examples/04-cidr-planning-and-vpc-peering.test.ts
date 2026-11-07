import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CidrBlock } from './lib/cloud-models.ts';

describe('Module 04: Virtual Networking & CIDR Planning', () => {
  it('correctly splits /16 VPC into non-overlapping subnets across availability zones', () => {
    const vpc = new CidrBlock('10.100.0.0/16');
    assert.equal(vpc.size, 65536);

    // Split into 4 x /18 blocks
    const tiers = vpc.split(18);
    assert.equal(tiers.length, 4);
    assert.equal(tiers[0]!.cidr, '10.100.0.0/18');
    assert.equal(tiers[1]!.cidr, '10.100.64.0/18');
    assert.equal(tiers[2]!.cidr, '10.100.128.0/18');
    assert.equal(tiers[3]!.cidr, '10.100.192.0/18');

    // Verify none overlap
    for (let i = 0; i < tiers.length; i++) {
      for (let j = i + 1; j < tiers.length; j++) {
        assert.ok(!tiers[i]!.overlaps(tiers[j]!));
      }
    }
  });

  it('detects overlapping CIDRs that prevent VPC peering', () => {
    const corpNetwork = new CidrBlock('10.20.0.0/16');
    const acquisitionNetwork = new CidrBlock('10.20.128.0/18');
    const separateNetwork = new CidrBlock('10.30.0.0/16');

    assert.ok(corpNetwork.overlaps(acquisitionNetwork));
    assert.ok(!corpNetwork.overlaps(separateNetwork));
  });

  it('proves non-transitivity of VPC peering requiring transit hub', () => {
    // VPC A is peered with VPC B, and VPC B is peered with VPC C.
    // Without Transit Gateway / Azure vWAN / GCP NCC, A cannot talk to C through B.
    interface PeeringConnection {
      from: string;
      to: string;
    }
    const peerings: PeeringConnection[] = [
      { from: 'VPC-A', to: 'VPC-B' },
      { from: 'VPC-B', to: 'VPC-C' },
    ];

    function canRouteDirectly(src: string, dst: string): boolean {
      return peerings.some(
        (p) => (p.from === src && p.to === dst) || (p.from === dst && p.to === src),
      );
    }

    assert.ok(canRouteDirectly('VPC-A', 'VPC-B'));
    assert.ok(canRouteDirectly('VPC-B', 'VPC-C'));
    assert.strictEqual(canRouteDirectly('VPC-A', 'VPC-C'), false);
  });
});
