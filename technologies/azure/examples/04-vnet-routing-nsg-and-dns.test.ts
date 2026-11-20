import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAT_PORTS_PER_IP,
  cidrContains,
  evaluateEffectiveNsg,
  evaluateInternetEgress,
  evaluateNsg,
  evaluateStorageFirewall,
  resolveStoragePrivateDns,
  selectRoute,
  snatCapacity,
  snatExhausted,
  usableHostCount,
  type NsgRule,
  type Packet,
} from './lib/azure-models.ts';

const SSH: Packet = {
  direction: 'Inbound',
  sourceIp: '203.0.113.7',
  destIp: '10.1.0.4',
  destPort: 22,
  protocol: 'Tcp',
};

function allowSshSubnet(): NsgRule[] {
  return [
    {
      name: 'allow-ssh',
      priority: 100,
      direction: 'Inbound',
      action: 'Allow',
      sourcePrefix: '*',
      destPrefix: '*',
      destPort: '22',
      protocol: 'Tcp',
    },
  ];
}

describe('VNet routing, NSG evaluation and Private DNS', () => {
  test('Azure reserves 5 IPs per subnet: /29 has 3 usable, /24 has 251', () => {
    assert.equal(usableHostCount(29), 3);
    assert.equal(usableHostCount(24), 251);
    assert.equal(usableHostCount(28), 11);
    assert.throws(() => usableHostCount(33), /Invalid prefix/);
  });

  test('Negative: private subnet without explicit egress (even with UDR nextHop Internet) has no internet egress', () => {
    const isolated = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: false,
      loadBalancerOutboundRule: false,
      instancePublicIp: false,
      userDefinedRouteToNvaWithEgress: false,
    });
    assert.equal(isolated.allowed, false);
    assert.equal(isolated.path, 'none');

    // Negative: UDR 0.0.0.0/0 -> Internet does NOT restore egress on a private subnet.
    const udrToInternet = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: false,
      loadBalancerOutboundRule: false,
      instancePublicIp: false,
      userDefinedRouteToNvaWithEgress: false,
      userDefinedRouteNextHopInternet: true,
    });
    assert.equal(udrToInternet.allowed, false);
    assert.equal(udrToInternet.path, 'none');

    const viaNat = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: true,
      loadBalancerOutboundRule: false,
      instancePublicIp: false,
      userDefinedRouteToNvaWithEgress: false,
    });
    assert.equal(viaNat.allowed, true);
    assert.equal(viaNat.path, 'nat-gateway');

    const viaNva = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: false,
      loadBalancerOutboundRule: false,
      instancePublicIp: false,
      userDefinedRouteToNvaWithEgress: true,
    });
    assert.equal(viaNva.allowed, true);
    assert.equal(viaNva.path, 'udr-nva');

    const viaLb = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: false,
      loadBalancerOutboundRule: true,
      instancePublicIp: false,
      userDefinedRouteToNvaWithEgress: false,
    });
    assert.equal(viaLb.allowed, true);
    assert.equal(viaLb.path, 'lb-outbound');

    const viaPip = evaluateInternetEgress({
      defaultOutboundAccess: false,
      natGatewayAttached: false,
      loadBalancerOutboundRule: false,
      instancePublicIp: true,
      userDefinedRouteToNvaWithEgress: false,
    });
    assert.equal(viaPip.allowed, true);
    assert.equal(viaPip.path, 'instance-public-ip');
  });

  test('Negative: missing Private DNS link resolves the public IP and hits 403', () => {
    const noLink = resolveStoragePrivateDns({
      privateEndpointIp: '10.2.0.4',
      publicIp: '20.60.80.100',
      linkedPrivateDnsZones: [],
    });
    assert.equal(noLink.ip, '20.60.80.100');
    assert.equal(noLink.path, 'public-internet');
    const blocked = evaluateStorageFirewall({
      path: noLink.path,
      publicNetworkAccess: 'Disabled',
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.status, 403);

    const linked = resolveStoragePrivateDns({
      privateEndpointIp: '10.2.0.4',
      publicIp: '20.60.80.100',
      linkedPrivateDnsZones: ['privatelink.blob.core.windows.net'],
    });
    assert.equal(linked.ip, '10.2.0.4');
    assert.equal(linked.path, 'private-endpoint');
    const viaPrivate = evaluateStorageFirewall({
      path: linked.path,
      publicNetworkAccess: 'Disabled',
    });
    assert.equal(viaPrivate.allowed, true);
  });

  test('Negative: dual NSG intersection, attached default rules, and unattached NIC NSG', () => {
    // When no NIC NSG is attached (nicNsg: undefined), subnet NSG alone governs.
    const subnetGoverns = evaluateEffectiveNsg({
      subnetNsg: allowSshSubnet(),
      nicNsg: undefined,
      packet: SSH,
    });
    assert.equal(subnetGoverns.allowed, true);
    assert.match(subnetGoverns.reason, /no NIC NSG attached/);

    // An attached empty NIC NSG enforces Azure default DenyAllInBound for external SSH.
    const defaultNicDeniesSsh = evaluateEffectiveNsg({
      subnetNsg: allowSshSubnet(),
      nicNsg: [],
      packet: SSH,
    });
    assert.equal(defaultNicDeniesSsh.allowed, false);
    assert.match(defaultNicDeniesSsh.reason, /DenyAllInBound/);

    // Default rules still allow intra-VNet, Azure Load Balancer probes, and outbound Internet.
    const vnetPacket: Packet = {
      direction: 'Inbound',
      sourceIp: '10.1.0.5',
      destIp: '10.1.0.4',
      destPort: 8080,
      protocol: 'Tcp',
    };
    assert.equal(
      evaluateEffectiveNsg({ subnetNsg: [], nicNsg: [], packet: vnetPacket }).allowed,
      true,
    );
    const lbProbe: Packet = {
      direction: 'Inbound',
      sourceIp: '168.63.129.16',
      destIp: '10.1.0.4',
      destPort: 80,
      protocol: 'Tcp',
    };
    assert.equal(
      evaluateEffectiveNsg({ subnetNsg: [], nicNsg: [], packet: lbProbe }).allowed,
      true,
    );
    const outboundInternet: Packet = {
      direction: 'Outbound',
      sourceIp: '10.1.0.4',
      destIp: '8.8.8.8',
      destPort: 443,
      protocol: 'Tcp',
    };
    assert.equal(
      evaluateEffectiveNsg({ subnetNsg: [], nicNsg: [], packet: outboundInternet }).allowed,
      true,
    );

    // Custom NIC NSG deny overrides subnet allow.
    const nicDeny: NsgRule[] = [
      {
        name: 'deny-all-inbound',
        priority: 200,
        direction: 'Inbound',
        action: 'Deny',
        sourcePrefix: '*',
        destPrefix: '*',
        destPort: '*',
        protocol: '*',
      },
    ];
    const verdict = evaluateEffectiveNsg({
      subnetNsg: allowSshSubnet(),
      nicNsg: nicDeny,
      packet: SSH,
    });
    assert.equal(verdict.allowed, false);
    assert.match(verdict.reason, /NIC NSG/);

    const allowed = evaluateEffectiveNsg({
      subnetNsg: allowSshSubnet(),
      nicNsg: allowSshSubnet(),
      packet: SSH,
    });
    assert.equal(allowed.allowed, true);

    const subnetOnly = evaluateNsg(allowSshSubnet(), SSH);
    assert.equal(subnetOnly.allowed, true);
    assert.equal(subnetOnly.matchedRule, 'allow-ssh');
  });

  test('UDR longest-prefix match wins; ties break UDR > BGP > System', () => {
    const routes = [
      {
        name: 'default-bgp',
        addressPrefix: '0.0.0.0/0',
        nextHop: 'Internet',
        origin: 'BGP' as const,
      },
      {
        name: 'corp-udr',
        addressPrefix: '10.0.0.0/8',
        nextHop: '10.100.0.4',
        origin: 'UDR' as const,
      },
      {
        name: 'branch-system',
        addressPrefix: '10.20.0.0/16',
        nextHop: 'VnetLocal',
        origin: 'System' as const,
      },
    ];
    assert.equal(selectRoute(routes, '10.20.5.9')?.name, 'branch-system');
    assert.equal(selectRoute(routes, '10.30.0.1')?.name, 'corp-udr');
    assert.equal(selectRoute(routes, '8.8.8.8')?.name, 'default-bgp');

    const tie = selectRoute(
      [
        { name: 'sys', addressPrefix: '0.0.0.0/0', nextHop: 'Internet', origin: 'System' as const },
        { name: 'bgp', addressPrefix: '0.0.0.0/0', nextHop: 'Internet', origin: 'BGP' as const },
        {
          name: 'udr',
          addressPrefix: '0.0.0.0/0',
          nextHop: '10.100.0.4',
          origin: 'UDR' as const,
        },
      ],
      '1.1.1.1',
    );
    assert.equal(tie?.name, 'udr');
    assert.equal(cidrContains('10.0.0.0/8', '10.255.255.255'), true);
    assert.equal(cidrContains('10.0.0.0/8', '11.0.0.1'), false);
  });

  test('NAT Gateway SNAT port exhaustion: 64,512 ports per public IP', () => {
    assert.equal(SNAT_PORTS_PER_IP, 64_512);
    assert.equal(snatCapacity(1), 64_512);
    assert.equal(snatCapacity(2), 129_024);
    assert.equal(snatExhausted({ publicIpCount: 1, concurrentFlows: 64_512 }), false);
    assert.equal(snatExhausted({ publicIpCount: 1, concurrentFlows: 64_513 }), true);
  });
});
