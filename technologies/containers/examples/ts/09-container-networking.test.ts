// Module 09: Container Networking: veth Pairs, Bridges, nftables NAT, DNS, and Rootless Pasta
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  DockerFirewallEvaluator,
  getRootlessNetworkDriver,
  type FirewallPacket,
} from './lib/containers-model.ts';

test('gotcha: docker published ports bypass host ufw/firewalld rules unless filtered in DOCKER-USER', () => {
  const fw = new DockerFirewallEvaluator();
  fw.ufwDefaultPolicy = 'DROP'; // Host administrator configured UFW to deny all incoming traffic

  const attackerPacket: FirewallPacket = {
    srcIp: '198.51.100.23',
    dstIp: '203.0.113.10',
    dstPort: 5432, // Published Postgres port
    inInterface: 'eth0',
  };

  // 1. Without DOCKER-USER rule: Docker PREROUTING/FORWARD chain bypasses UFW default policy!
  const unprotectedRes = fw.evaluateInboundPacket(attackerPacket, 5432);

  assert.equal(
    unprotectedRes.decision,
    'ACCEPT',
    'Docker forwarded packet to container despite host UFW default DROP!',
  );
  assert.equal(unprotectedRes.bypassedUfw, true, 'Packet bypassed UFW policy completely!');
  assert.equal(unprotectedRes.handledByDockerUser, false);

  // 2. Fix: Administrator adds a rule to the DOCKER-USER chain
  fw.addDockerUserRule((pkt) => {
    // Only allow traffic from trusted subnet 10.0.0.0/8
    if (pkt.dstPort === 5432 && !pkt.srcIp.startsWith('10.')) {
      return 'DROP';
    }
    return null;
  });

  const protectedRes = fw.evaluateInboundPacket(attackerPacket, 5432);
  assert.equal(protectedRes.decision, 'DROP');
  assert.equal(
    protectedRes.handledByDockerUser,
    true,
    'DOCKER-USER chain intercepted packet and enforced drop rule',
  );

  const trustedPacket: FirewallPacket = {
    srcIp: '10.0.1.5',
    dstIp: '203.0.113.10',
    dstPort: 5432,
    inInterface: 'eth0',
  };
  const trustedRes = fw.evaluateInboundPacket(trustedPacket, 5432);
  assert.equal(trustedRes.decision, 'ACCEPT');
});

test('rootless networking drivers: pasta preserves source IP while legacy slirp4netns masked it', () => {
  const pasta = getRootlessNetworkDriver('pasta');
  const slirp = getRootlessNetworkDriver('slirp4netns');

  assert.equal(pasta.name, 'pasta');
  assert.equal(
    pasta.preservesSourceIp,
    true,
    'Pasta passes packets into user netns preserving true remote source IP',
  );
  assert.equal(pasta.isRemovedInPodman6, false);

  assert.equal(slirp.name, 'slirp4netns');
  assert.equal(
    slirp.preservesSourceIp,
    false,
    'slirp4netns routed via user-space TAP NAT, showing 127.0.0.1 as remote source IP',
  );
  assert.equal(
    slirp.isRemovedInPodman6,
    true,
    'Podman 6.0 completely removed slirp4netns in favor of pasta',
  );
});

test('property-based test: DOCKER-USER rules have strict deterministic precedence over Docker DNAT', () => {
  fc.assert(
    fc.property(
      fc.ipV4(),
      fc.integer({ min: 1024, max: 65535 }),
      fc.boolean(),
      (ip, port, shouldDrop) => {
        const fw = new DockerFirewallEvaluator();
        if (shouldDrop) {
          fw.addDockerUserRule(() => 'DROP');
        }

        const pkt: FirewallPacket = {
          srcIp: ip,
          dstIp: '10.0.0.1',
          dstPort: port,
          inInterface: 'eth0',
        };

        const res = fw.evaluateInboundPacket(pkt, port);
        if (shouldDrop) {
          assert.equal(res.decision, 'DROP');
          assert.equal(res.handledByDockerUser, true);
        } else {
          assert.equal(res.decision, 'ACCEPT');
        }
      },
    ),
  );
});
